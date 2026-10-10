// M6 acceptance tests: (1) de-identification, (2) invented facts / advice are rejected and never shown.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import glossary from "../locales/glossary.json" with { type: "json" };
import {
  assertDeidentified, buildAssistantContext, buildSummaryInput, identifiersOf, scrubUserText,
} from "../supabase/functions/_shared/deidentify.ts";
import { buildContext, itemsFromSummaryInput, validateDraft } from "../supabase/functions/_shared/validator.ts";
import type { Glossary } from "../supabase/functions/_shared/glossary.ts";
import { amina, omar, saada, schedule, TODAY } from "./fixtures.ts";
import type { PatientRecord } from "../supabase/functions/_shared/types.ts";

const G = glossary as unknown as Glossary;
const OPTS = { textField: "summary", requireRefs: true, maxWords: 150 } as const;

function ctxFor(record: PatientRecord, lang: "fr" | "so" | "ar" | "en" = "fr") {
  const { input } = buildSummaryInput(record, lang, TODAY);
  return { input, ctx: buildContext(itemsFromSummaryInput(input), input, input.medications.map((m) => m.dosage)) };
}
const draft = (summary: string, refs: string[]) => JSON.stringify({ summary, source_refs: refs });

// ---------------------------------------------------------------------------------------------
// (1) De-identification
// ---------------------------------------------------------------------------------------------
test("summary payload contains no name, id, phone, region or exact birth date", () => {
  for (const record of [amina, omar, saada]) {
    const { input } = buildSummaryInput(record, "so", TODAY);
    const json = JSON.stringify(input);
    for (const id of identifiersOf(record)) {
      assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(json),
        `payload leaks ${id}`);
    }
    assert.ok(!json.includes(record.patient.region), "no region/address");
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(json), "no database uuid");
    assert.ok(!json.includes("+253"), "no phone");
    assert.equal(input.age_years, record === amina ? 29 : 40);
    assert.doesNotThrow(() => assertDeidentified(input, identifiersOf(record)));
  }
});

test("payload guard throws if an identifier slips in", () => {
  const { input } = buildSummaryInput(amina, "fr", TODAY);
  const leaked = { ...input, note: "Amina Robleh Kassim" };
  assert.throws(() => assertDeidentified(leaked, identifiersOf(amina)), /de-identification failure/);
  assert.throws(() => assertDeidentified({ x: "+253 00 00 11 21" }, []), /phone/);
  assert.throws(() => assertDeidentified({ x: amina.patient.id }, []), /database id/);
  // "Ali" (a name) must not be confused with "criticality"
  assert.doesNotThrow(() => assertDeidentified({ criticality: "high" }, ["Ali"]));
});

test("assistant context is de-identified too (children: relative dates only)", () => {
  const child: PatientRecord = {
    ...amina,
    patient: { ...amina.patient, id: "10000000-0000-4000-a000-000000000101", given_name: "Ilyas", birth_date: "2025-04-10" },
    immunizations: [], pregnancies: [], conditions: [], allergies: [], medications: [],
  };
  const parent = { ...amina, children: [{ id: child.patient.id, given_name: "Ilyas", family_name: "Abdi", birth_date: "2025-04-10", sex: "male" }] };
  const ctx = buildAssistantContext(parent, [{ record: child }], schedule, "fr", TODAY);
  const payload = { ...ctx, refMap: undefined };
  assert.doesNotThrow(() => assertDeidentified(payload, [...identifiersOf(parent), ...identifiersOf(child)]));
  assert.ok(!JSON.stringify(payload).includes("2025-04-10"), "child birth date not sent");
});

test("user free text is scrubbed before reaching the model", () => {
  const out = scrubUserText("Bonjour, je suis Amina Robleh Kassim, née le 01/09/1997, tél +253 00 00 11 21", identifiersOf(amina));
  assert.ok(!/amina|robleh|kassim|1997|253/i.test(out), out);
});

// ---------------------------------------------------------------------------------------------
// (2) Validator
// ---------------------------------------------------------------------------------------------
test("accepts faithful summaries in fr / so / ar / en", () => {
  const cases: [string, "fr" | "so" | "ar" | "en", string][] = [
    ["Vous avez 29 ans. Votre dossier indique une anémie. Vous êtes allergique à la pénicilline (allergie importante). Vous prenez du fer + acide folique, 1 comprimé par jour. Vous avez reçu le vaccin tétanos-diphtérie. Vous êtes enceinte de 24 semaines.", "fr", ""],
    ["Waxaad tahay 29 sano. Diiwaankaagu wuxuu muujinayaa dhiig-yaraan. Waxaad xasaasiyad ku leedahay bensiliin. Waxaad qaadataa birta iyo folik asiid. Waxaad uur leedahay 24 toddobaad.", "so", ""],
    ["عمرك 29 سنة. يشير ملفك إلى فقر الدم. لديك حساسية من البنسلين. تتناولين الحديد وحمض الفوليك، قرص واحد يومياً. أنت حامل في الأسبوع 24.", "ar", ""],
    ["You are 29. Your record shows anaemia. You are allergic to penicillin. You take iron + folic acid, 1 tablet a day. You received the tetanus-diphtheria vaccine. You are 24 weeks pregnant.", "en", ""],
  ];
  for (const [summary, lang] of cases) {
    const { ctx } = ctxFor(amina, lang);
    const res = validateDraft(draft(summary, ["cond_1", "all_1", "med_1", "imm_1", "preg_1"]), ctx, G, OPTS);
    assert.ok(res.ok, `${lang}: ${!res.ok ? res.reason : ""}`);
  }
});

test("REJECTS an invented condition (the injected bad draft is never returned)", () => {
  const { ctx } = ctxFor(amina);
  const bad = draft("Vous avez une anémie et un diabète de type 2.", ["cond_1"]);
  const res = validateDraft(bad, ctx, G, OPTS);
  assert.equal(res.ok, false);
  assert.match((res as { reason: string }).reason, /entity_not_in_record:diabetes_t2/);
  assert.ok(!("text" in res), "no text is ever returned for a rejected draft");
});

test("REJECTS invented facts in other languages", () => {
  const { ctx } = ctxFor(amina, "so");
  const so = validateDraft(draft("Waxaad qabtaa dhiig-yaraan iyo duumo.", ["cond_1"]), ctx, G, OPTS);
  assert.match((so as { reason: string }).reason, /entity_not_in_record:malaria/);
  const ar = validateDraft(draft("لديك فقر الدم وتتناولين الأنسولين.", ["cond_1"]), ctx, G, OPTS);
  assert.match((ar as { reason: string }).reason, /entity_not_in_record:insulin/);
  const en = validateDraft(draft("You have anaemia. Watch for pre-eclampsia.", ["cond_1"]), ctx, G, OPTS);
  assert.equal(en.ok, false);
});

test("REJECTS advice, risk, urgency and dosage changes", () => {
  const { ctx } = ctxFor(amina);
  const bads = [
    "Vous avez une anémie. Vous devriez manger plus de viande.",
    "Votre anémie augmente le risque de complications.",
    "Vous avez une anémie, consultez immédiatement un médecin.",
    "Vous prenez du fer + acide folique, 2 comprimés par jour.",
    "You have anaemia. You should rest more.",
    "Waxaad qabtaa dhiig-yaraan. Waa inaad cunto badan cuntid.",
    "لديك فقر الدم. يجب عليك تناول المزيد من اللحوم.",
    "Vous avez une anémie. Arrêtez le fer + acide folique.",
  ];
  for (const b of bads) {
    const res = validateDraft(draft(b, ["cond_1", "med_1"]), ctx, G, OPTS);
    assert.equal(res.ok, false, `should reject: ${b}`);
  }
});

test("REJECTS structural problems: bad JSON, unknown refs, uncited items, too long", () => {
  const { ctx } = ctxFor(amina);
  assert.equal(validateDraft("not json", ctx, G, OPTS).ok, false);
  assert.match((validateDraft(draft("Vous avez une anémie.", []), ctx, G, OPTS) as { reason: string }).reason, /empty_source_refs/);
  assert.match((validateDraft(draft("Vous avez une anémie.", ["cond_9"]), ctx, G, OPTS) as { reason: string }).reason, /unknown_ref/);
  assert.match((validateDraft(draft("Vous avez une anémie et une allergie à la pénicilline.", ["cond_1"]), ctx, G, OPTS) as { reason: string }).reason, /uncited_entity:penicillin/);
  assert.match((validateDraft(draft("Anémie. ".repeat(200), ["cond_1"]), ctx, G, OPTS) as { reason: string }).reason, /too_long/);
  assert.match((validateDraft(draft("Vous avez une anémie depuis 14 mois.", ["cond_1"]), ctx, G, OPTS) as { reason: string }).reason, /number_not_in_record:14/);
});

test("longest match wins: Arabic sickle-cell is not read as plain anaemia", () => {
  const { ctx } = ctxFor(saada, "ar");
  const res = validateDraft(draft("لديك فقر الدم المنجلي. تتناولين حمض الفوليك 5 ملغ مرة يومياً.", ["cond_1", "med_1"]), ctx, G, OPTS);
  assert.ok(res.ok, !res.ok ? res.reason : "");
});

test("dose numbers must match the record (200 mg ok, 400 mg rejected)", () => {
  const { ctx } = ctxFor(omar);
  assert.ok(validateDraft(draft("Vous prenez de la carbamazépine, 200 mg deux fois par jour.", ["med_1"]), ctx, G, OPTS).ok);
  assert.equal(validateDraft(draft("Vous prenez de la carbamazépine, 400 mg deux fois par jour.", ["med_1"]), ctx, G, OPTS).ok, false);
});
