// record-assistant — "Assistant DjiHealth", a record-navigation agent for the patient.
// Same guarantees as summarize-record (CLAUDE.md §2.2–2.5, §7):
//   * reads the record AS THE USER (RLS + audit log), owner/guardian only;
//   * the model only ever sees de-identified data, fetched through read-only tools;
//   * the user's own typed text is scrubbed of identifiers before it is sent;
//   * every answer goes through the same validator; requests for advice/diagnosis get a fixed
//     server-side refusal text, never model text; rejected drafts are stored and never shown.
import glossary from "../_shared/glossary.json" with { type: "json" };
import { type Anthropic, anthropic, MODEL, responseText } from "../_shared/anthropic.ts";
import { assertDeidentified, buildAssistantContext, identifiersOf, scrubUserText } from "../_shared/deidentify.ts";
import type { Glossary } from "../_shared/glossary.ts";
import { asLang, corsHeaders, devLog, json, serviceClient, userClient } from "../_shared/http.ts";
import { AI_LABEL, ASSISTANT_FALLBACK, ASSISTANT_OUT_OF_SCOPE } from "../_shared/messages.ts";
import type { PatientRecord, ScheduleEntry } from "../_shared/types.ts";
import { buildContext, itemsFromSummaryInput, type ValidationItem, validateDraft } from "../_shared/validator.ts";

const MAX_TURNS = 5;
const MAX_PER_HOUR = 30;
const SCREENS = ["none", "vault", "conditions", "allergies", "medications", "immunizations", "encounters", "documents",
                 "emergency_card", "maternal", "children", "summary", "share", "access"] as const;

const SYSTEM_PROMPT = `You are "Assistant DjiHealth", a helper inside a patient's health-record app (demo with synthetic data).
You help the patient FIND and UNDERSTAND WHAT IS WRITTEN in their own record, and find their way around the app.

Rules:
- Use the tools to read the record. Only state facts returned by the tools. If the answer is not in the record, say so (kind "not_in_record").
- Never give a diagnosis, cause, risk, prognosis, interpretation of results, treatment advice, dosage change or recommendation. Never tell the patient what they should do about their health.
- If the question asks for any of that (e.g. "is this serious?", "should I stop my medicine?", "what does this mean for my baby?"), do not answer it: return kind "out_of_scope" with an empty answer.
- Questions about using the app (sharing the record, the emergency card, changing language) are kind "app_help". Explain which screen to open; do not mention medical facts.
- Answer in the requested language (fr = French, so = Somali, ar = Arabic, en = English), in simple words, maximum 80 words.
- Copy names, dates and doses exactly as the tools return them. Do not compute new numbers, except you may express "due_in_days" as days or whole weeks.
- List in source_refs the "ref" of every record item you mention.
- Set "screen" to the most relevant app screen (or "none").
Return JSON: {"kind": "answer"|"not_in_record"|"out_of_scope"|"app_help", "answer": string, "source_refs": string[], "screen": string}.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["answer", "not_in_record", "out_of_scope", "app_help"] },
    answer: { type: "string" },
    source_refs: { type: "array", items: { type: "string" } },
    screen: { type: "string", enum: [...SCREENS] },
  },
  required: ["kind", "answer", "source_refs", "screen"],
  additionalProperties: false,
};

const noInput = { type: "object" as const, properties: {}, additionalProperties: false };
const TOOLS: Anthropic.Tool[] = [
  { name: "get_profile", description: "Age in years, sex, and counts of items in each record section.", input_schema: noInput, strict: true },
  { name: "get_conditions", description: "Active health conditions in the record.", input_schema: noInput, strict: true },
  { name: "get_allergies", description: "Allergies and their criticality.", input_schema: noInput, strict: true },
  { name: "get_medications", description: "Current medications with the dosage text exactly as recorded.", input_schema: noInput, strict: true },
  { name: "get_immunizations", description: "Vaccines the patient received, with dates.", input_schema: noInput, strict: true },
  { name: "get_pregnancy", description: "Current pregnancy follow-up: gestational weeks, risk level, antenatal visits done and planned (dates, blood pressure, weight).", input_schema: noInput, strict: true },
  { name: "get_children_vaccines", description: "For each child of the patient: age in months and vaccination calendar status (done / due / overdue / upcoming, due_in_days). The schedule is a demo placeholder to be validated by the Ministry.", input_schema: noInput, strict: true },
  { name: "get_recent_visits", description: "Last health visits (date, reason, entered by patient or professional).", input_schema: noInput, strict: true },
];

interface ChatTurn { role: "user" | "assistant"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const language = asLang(body.language);
  const history: ChatTurn[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m: ChatTurn) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .slice(-7)
    : [];
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "bad_request" }, 400);
  while (history.length && history[0].role !== "user") history.shift();

  const reply = (kind: string, answer: string, extra: Record<string, unknown> = {}) =>
    json({ kind, answer, source_refs: [], ref_map: {}, screen: "none", label: AI_LABEL[language], language, ...extra });

  const supa = userClient(req);
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return json({ error: "unauthorized" }, 401);
  const admin = serviceClient();

  // rate limit
  const { count } = await admin.from("audit_log").select("id", { count: "exact", head: true })
    .eq("actor_id", auth.user.id).eq("action", "ai_assistant")
    .gt("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= MAX_PER_HOUR) return json({ error: "rate_limited" }, 429);

  // read as the user (logged), plus children the user is guardian of
  const { data: record, error } = await supa.rpc("get_patient_record", { p_patient_id: null });
  if (error || !record) return json({ error: "forbidden" }, 403);
  const rec = record as PatientRecord;
  if (!rec.viewer.is_owner) return json({ error: "forbidden" }, 403);
  const children: { record: PatientRecord }[] = [];
  for (const c of rec.children) {
    const { data } = await supa.rpc("get_patient_record", { p_patient_id: c.id });
    if (data) children.push({ record: data as PatientRecord });
  }
  const { data: schedule } = await supa.from("vaccination_schedule").select("*");

  const today = new Date().toISOString().slice(0, 10);
  const ctx = buildAssistantContext(rec, children, (schedule ?? []) as ScheduleEntry[], language, today);
  const identifiers = [...identifiersOf(rec), ...children.flatMap((c) => identifiersOf(c.record))];

  const toolData: Record<string, unknown> = {
    get_profile: {
      age_years: ctx.input.age_years, sex: ctx.input.sex,
      counts: { conditions: ctx.input.conditions.length, allergies: ctx.input.allergies.length,
                medications: ctx.input.medications.length, immunizations: ctx.input.immunizations.length,
                documents: ctx.documents_count, children: ctx.children.length },
      pregnant: Boolean(ctx.input.pregnancy),
    },
    get_conditions: ctx.input.conditions,
    get_allergies: ctx.input.allergies,
    get_medications: ctx.input.medications,
    get_immunizations: ctx.input.immunizations,
    get_pregnancy: ctx.input.pregnancy ? { ...ctx.input.pregnancy, visits: ctx.visits } : null,
    get_children_vaccines: ctx.children,
    get_recent_visits: ctx.encounters,
  };
  try {
    assertDeidentified(toolData, identifiers);
  } catch (e) {
    console.error(String(e));
    return reply("error", ASSISTANT_FALLBACK[language]);
  }

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.role === "user" ? scrubUserText(m.content, identifiers) : m.content.slice(0, 800),
  }));
  messages.push({ role: "user", content: `[language: ${language}]` });
  // merge the language hint into the last user turn (roles must alternate)
  const hint = messages.pop()!;
  const last = messages[messages.length - 1];
  last.content = `${last.content}\n\n${hint.content}`;
  devLog("record-assistant messages", messages);

  // agent loop: the model decides which read-only tools to call
  let draft: string | null = null;
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const msg = await anthropic().messages.create({
        model: MODEL,
        max_tokens: 1200,
        thinking: { type: "between_tools" },
        output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
      if (msg.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: msg.content });
        const results: Anthropic.ToolResultBlockParam[] = msg.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => (b.name in toolData
            ? { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(toolData[b.name]) }
            : { type: "tool_result", tool_use_id: b.id, content: "unknown tool", is_error: true }));
        devLog("record-assistant tool results", results);
        messages.push({ role: "user", content: results });
        continue;
      }
      draft = responseText(msg);
      break;
    }
  } catch (e) {
    console.error("Claude API error", e instanceof Error ? e.message : e);
    return reply("error", ASSISTANT_FALLBACK[language]);
  }

  // validate
  const items: ValidationItem[] = [
    ...itemsFromSummaryInput(ctx.input),
    ...ctx.visits.map((v) => ({ ref: v.ref, text: "" })),
    ...ctx.encounters.map((e) => ({ ref: e.ref, text: e.reason })),
    ...ctx.children.flatMap((c) => [{ ref: c.ref, text: "" }, ...c.vaccines.map((v) => ({ ref: v.ref, text: v.name }))]),
  ];
  const vctx = buildContext(items, toolData, ctx.input.medications.map((m) => m.dosage));
  let kind = "answer";
  let screen = "none";
  try {
    const parsed = JSON.parse(draft ?? "{}");
    kind = String(parsed.kind ?? "answer");
    screen = (SCREENS as readonly string[]).includes(parsed.screen) ? parsed.screen : "none";
  } catch { /* handled by the validator */ }

  await admin.from("audit_log").insert({
    actor_id: auth.user.id, actor_role: "patient", action: "ai_assistant", patient_id: rec.patient.id,
    details: { language, model: MODEL, kind },
  });

  if (kind === "out_of_scope") return reply("out_of_scope", ASSISTANT_OUT_OF_SCOPE[language], { screen });

  const result = draft
    ? validateDraft(draft, vctx, glossary as unknown as Glossary, { textField: "answer", requireRefs: kind === "answer", maxWords: 120 })
    : { ok: false as const, reason: "no_text_or_refusal" };
  if (!result.ok) {
    await admin.from("ai_validator_rejections").insert({
      patient_id: rec.patient.id, function_name: "record-assistant", language, draft: draft ?? "(empty)", reason: result.reason,
    });
    return reply("fallback", ASSISTANT_FALLBACK[language]);
  }
  const refMap = Object.fromEntries(result.source_refs.map((r) => [r, ctx.refMap[r]]));
  return json({ kind, answer: result.text, source_refs: result.source_refs, ref_map: refMap, screen,
                label: AI_LABEL[language], language });
});
