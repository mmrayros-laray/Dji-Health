// M6 evaluation: 10 seeded patients × 4 languages through the REAL summary pipeline
// (de-identification → Claude → validator), logging pass/fail. Nothing is stored or shown to anyone.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
//     deno run --allow-net --allow-env --allow-read scripts/ai-eval.ts
//
// Uses the service role only to READ synthetic seed data for the evaluation.
import glossary from "../supabase/functions/_shared/glossary.json" with { type: "json" };
import { anthropic, MODEL, responseText } from "../supabase/functions/_shared/anthropic.ts";
import { assertDeidentified, buildSummaryInput, identifiersOf } from "../supabase/functions/_shared/deidentify.ts";
import type { Glossary } from "../supabase/functions/_shared/glossary.ts";
import { serviceClient } from "../supabase/functions/_shared/http.ts";
import { SUMMARY_OUTPUT_SCHEMA, SUMMARY_SYSTEM_PROMPT } from "../supabase/functions/_shared/summary_prompt.ts";
import type { PatientRecord } from "../supabase/functions/_shared/types.ts";
import { buildContext, itemsFromSummaryInput, validateDraft } from "../supabase/functions/_shared/validator.ts";

const LANGS = ["fr", "so", "ar", "en"] as const;
const db = serviceClient();
const today = new Date().toISOString().slice(0, 10);

async function load(pid: string): Promise<PatientRecord> {
  const one = async (t: string) => (await db.from(t).select("*").eq("patient_id", pid)).data ?? [];
  const { data: patient } = await db.from("patients").select("*").eq("id", pid).single();
  const pregnancies = await one("pregnancies");
  for (const p of pregnancies) p.antenatal_visits = (await db.from("antenatal_visits").select("*").eq("pregnancy_id", p.id)).data ?? [];
  return {
    patient, pregnancies, conditions: await one("conditions"), allergies: await one("allergies"), medications: await one("medications"),
    immunizations: await one("immunizations"), encounters: [], observations: [], documents: [], children: [],
    viewer: { role: "patient", is_owner: true },
  } as unknown as PatientRecord;
}

const ids = Array.from({ length: 10 }, (_, i) => `10000000-0000-4000-a000-${String(i + 1).padStart(12, "0")}`);
let pass = 0, total = 0;
for (const pid of ids) {
  const rec = await load(pid);
  for (const lang of LANGS) {
    total++;
    const { input } = buildSummaryInput(rec, lang, today);
    assertDeidentified(input, identifiersOf(rec));
    const msg = await anthropic().messages.create({
      model: MODEL, max_tokens: 400, thinking: { type: "between_tools" },
      output_config: { effort: "low", format: { type: "json_schema", schema: SUMMARY_OUTPUT_SCHEMA } },
      system: SUMMARY_SYSTEM_PROMPT, messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const draft = responseText(msg);
    const ctx = buildContext(itemsFromSummaryInput(input), input, input.medications.map((m) => m.dosage));
    const res = draft ? validateDraft(draft, ctx, glossary as unknown as Glossary, { textField: "summary", requireRefs: true, maxWords: 150 })
                      : { ok: false as const, reason: `no_text (${msg.stop_reason})` };
    if (res.ok) pass++;
    console.log(`${res.ok ? "PASS" : "FAIL"}  patient ${pid.slice(-2)}  ${lang}  ${res.ok ? res.text.slice(0, 90) : res.reason}`);
  }
}
console.log(`\n${pass}/${total} drafts passed the validator (${Math.round((100 * pass) / total)} %).`);
