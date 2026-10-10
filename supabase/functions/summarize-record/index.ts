// summarize-record — AI record summary (CLAUDE.md §7, BUILD_PLAN M6).
// 1. Read the record AS THE USER (RLS + audit log apply). Only the record owner/guardian may ask.
// 2. Cache: at most one generation per patient per language per hour.
// 3. De-identify server-side; refuse to send anything that still contains an identifier.
// 4. Claude (claude-sonnet-5-5) → JSON {summary, source_refs}.
// 5. Validator. On failure: store the draft in ai_validator_rejections, return the neutral fallback.
import glossary from "../_shared/glossary.json" with { type: "json" };
import { anthropic, MODEL, responseText } from "../_shared/anthropic.ts";
import { assertDeidentified, buildSummaryInput, identifiersOf } from "../_shared/deidentify.ts";
import type { Glossary } from "../_shared/glossary.ts";
import { asLang, corsHeaders, devLog, json, serviceClient, userClient } from "../_shared/http.ts";
import { AI_LABEL, SUMMARY_FALLBACK } from "../_shared/messages.ts";
import type { PatientRecord } from "../_shared/types.ts";
import { SUMMARY_OUTPUT_SCHEMA as OUTPUT_SCHEMA, SUMMARY_SYSTEM_PROMPT as SYSTEM_PROMPT } from "../_shared/summary_prompt.ts";
import { buildContext, itemsFromSummaryInput, validateDraft } from "../_shared/validator.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const language = asLang(body.language);
  const patientId: string | null = typeof body.patient_id === "string" ? body.patient_id : null;
  const fallback = (status: string) =>
    json({ status, summary: SUMMARY_FALLBACK[language], source_refs: [], ref_map: {}, label: AI_LABEL[language], language });

  const supa = userClient(req);
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return json({ error: "unauthorized" }, 401);

  // (1) read as the user — logged by get_patient_record
  const { data: record, error } = await supa.rpc("get_patient_record", { p_patient_id: patientId });
  if (error || !record) return json({ error: "forbidden" }, 403);
  const rec = record as PatientRecord;
  if (!rec.viewer.is_owner) return json({ error: "forbidden" }, 403); // summaries are for the patient themself

  const admin = serviceClient();
  const pid = rec.patient.id;

  // (2) cache / rate limit
  const { data: cached } = await admin
    .from("ai_summaries")
    .select("summary, source_refs, ref_map, validator_passed, created_at")
    .eq("patient_id", pid).eq("language", language)
    .gt("created_at", new Date(Date.now() - 3600_000).toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cached) {
    if (!cached.validator_passed) return fallback("unavailable");
    return json({ status: "ok", cached: true, summary: cached.summary, source_refs: cached.source_refs,
                  ref_map: cached.ref_map, label: AI_LABEL[language], language, created_at: cached.created_at });
  }

  // (3) de-identify
  const today = new Date().toISOString().slice(0, 10);
  const { input, refMap } = buildSummaryInput(rec, language, today);
  try {
    assertDeidentified(input, identifiersOf(rec));
  } catch (e) {
    console.error(String(e));
    return fallback("unavailable");
  }
  devLog("summarize-record payload", input);

  // (4) Claude
  let draft: string | null = null;
  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 400,
      // No extended thinking: a 120-word restatement doesn't need it and it would eat the 400-token budget.
      thinking: { type: "between_tools" },
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    draft = responseText(msg);
  } catch (e) {
    console.error("Claude API error", e instanceof Error ? e.message : e);
    return fallback("unavailable"); // transient: nothing cached, the user can retry
  }

  // (5) validate — the guarantee
  const ctx = buildContext(itemsFromSummaryInput(input), input, input.medications.map((m) => m.dosage));
  const result = draft
    ? validateDraft(draft, ctx, glossary as unknown as Glossary, { textField: "summary", requireRefs: true, maxWords: 150 })
    : { ok: false as const, reason: "no_text_or_refusal" };

  await admin.from("audit_log").insert({
    actor_id: auth.user.id, actor_role: "patient", action: "ai_summary", patient_id: pid,
    details: { language, model: MODEL, validator_passed: result.ok },
  });

  if (!result.ok) {
    await admin.from("ai_validator_rejections").insert({
      patient_id: pid, function_name: "summarize-record", language, draft: draft ?? "(empty)", reason: result.reason,
    });
    await admin.from("ai_summaries").insert({
      patient_id: pid, language, summary: SUMMARY_FALLBACK[language], source_refs: [], ref_map: {},
      model: MODEL, validator_passed: false,
    });
    return fallback("unavailable");
  }

  const usedRefMap = Object.fromEntries(result.source_refs.map((r) => [r, refMap[r]]));
  const { data: saved } = await admin.from("ai_summaries").insert({
    patient_id: pid, language, summary: result.text, source_refs: result.source_refs, ref_map: usedRefMap,
    model: MODEL, validator_passed: true,
  }).select("created_at").single();

  return json({ status: "ok", cached: false, summary: result.text, source_refs: result.source_refs,
                ref_map: usedRefMap, label: AI_LABEL[language], language, created_at: saved?.created_at });
});
