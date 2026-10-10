import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import glossary from "../locales/glossary.json" with { type: "json" };
import { gestationalAge, nextVaccines, vaccinationCalendar } from "../supabase/functions/_shared/clinical.ts";
import { translateItem, type Glossary } from "../supabase/functions/_shared/glossary.ts";
import type { Immunization } from "../supabase/functions/_shared/types.ts";
import { schedule, TODAY } from "./fixtures.ts";

const imm = (code: string, dose: number, date: string): Immunization => ({
  id: code + dose, patient_id: "c", vaccine_code: code, vaccine_name: code, date_given: date, dose_number: dose,
  facility: null, source: "professional", created_at: date,
});

test("vaccination calendar: done / overdue / due / upcoming, driven by the schedule table", () => {
  // child born 548 days ago (18 months): everything up to 14 weeks done, RR1 missed
  const birth = "2025-04-10";
  const given = [imm("BCG", 1, "2025-04-13"), imm("PENTA", 1, "2025-05-25"), imm("PENTA", 2, "2025-06-22"), imm("PENTA", 3, "2025-07-20")];
  const rows = vaccinationCalendar(birth, schedule, given, TODAY);
  const by = (code: string, dose: number) => rows.find((r) => r.schedule.vaccine_code === code && r.schedule.dose_number === dose)!;
  assert.equal(by("PENTA", 3).status, "done");
  assert.equal(by("RR", 1).status, "overdue");
  assert.equal(by("RR", 2).status, "due"); // due at 78 weeks = 546 days, i.e. 2 days ago
  assert.deepEqual(nextVaccines(rows).map((r) => r.schedule.vaccine_code), ["RR", "RR"]);
});

test("vaccination calendar: next vaccine in the future", () => {
  const rows = vaccinationCalendar("2026-07-11", schedule, [imm("BCG", 1, "2026-07-12"), imm("PENTA", 1, "2026-08-22"), imm("PENTA", 2, "2026-09-19")], TODAY);
  const next = nextVaccines(rows);
  assert.equal(next[0].schedule.vaccine_code, "PENTA");
  assert.equal(next[0].schedule.dose_number, 3);
  assert.equal(next[0].daysUntilDue, 7);
});

test("gestational age", () => {
  const ga = gestationalAge("2026-04-25", "2027-01-30", TODAY);
  assert.equal(ga.weeks, 24);
  assert.equal(ga.trimester, 2);
});

test("glossary copy for Edge Functions is in sync with locales/glossary.json", () => {
  assert.equal(readFileSync("supabase/functions/_shared/glossary.json", "utf8"), readFileSync("locales/glossary.json", "utf8"),
    "run `npm run sync:glossary`");
});

test("glossary translates record items for display", () => {
  const G = glossary as unknown as Glossary;
  assert.equal(translateItem("Anémie", "D64.9", "so", G), "Dhiig-yaraan");
  assert.equal(translateItem("Hypertension artérielle", "I10", "ar", G), "ارتفاع ضغط الدم");
  assert.equal(translateItem("Fer + acide folique", undefined, "en", G), "Iron + folic acid");
  assert.equal(translateItem("Tétanos-diphtérie (Td)", "TD", "en", G), "Tetanus-diphtheria");
  assert.equal(translateItem("Texte libre inconnu", undefined, "en", G), "Texte libre inconnu");
  // every term has all four demo languages
  for (const t of G.terms) for (const l of ["fr", "so", "ar", "en"] as const) assert.ok(t[l], `${t.id}.${l}`);
});
