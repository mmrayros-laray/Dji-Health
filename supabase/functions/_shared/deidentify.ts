// De-identification before anything is sent to the Claude API (CLAUDE.md §2.4, §7).
// Removed: names, IDs (incl. database UUIDs), phone, address/region, emergency contact, exact birth date,
// facility and practitioner names, free-text notes. Kept: age in years, sex, coded clinical facts.
// Every item gets an opaque ref ("cond_1"...); the ref → {section, id} map stays on the server.
import { ageMonths, ageYears, gestationalAge, nextVaccines, vaccinationCalendar } from "./clinical.ts";
import type { PatientRecord, ScheduleEntry } from "./types.ts";

export type Lang = "fr" | "so" | "ar" | "en";

export interface SummaryInput {
  language: Lang;
  age_years: number;
  sex: string;
  conditions: { ref: string; display: string; status: string; code?: string }[];
  allergies: { ref: string; substance: string; criticality: string }[];
  medications: { ref: string; name: string; dosage: string }[];
  immunizations: { ref: string; name: string; date: string; code?: string; dose?: number }[];
  pregnancy?: { ref: string; gestational_weeks: number; risk_level: string; antenatal_visits_done: number };
}

export type RefMap = Record<string, { section: string; id: string }>;

export function buildSummaryInput(record: PatientRecord, language: Lang, today: string): { input: SummaryInput; refMap: RefMap } {
  const refMap: RefMap = {};
  const ref = (prefix: string, i: number, section: string, id: string) => {
    const r = `${prefix}_${i + 1}`;
    refMap[r] = { section, id };
    return r;
  };

  const input: SummaryInput = {
    language,
    age_years: ageYears(record.patient.birth_date, today),
    sex: record.patient.sex,
    conditions: record.conditions
      .filter((c) => c.clinical_status === "active")
      .map((c, i) => ({ ref: ref("cond", i, "conditions", c.id), display: c.display, status: c.clinical_status, ...(c.code ? { code: c.code } : {}) })),
    allergies: record.allergies.map((a, i) => ({
      ref: ref("all", i, "allergies", a.id), substance: a.substance, criticality: a.criticality,
    })),
    medications: record.medications
      .filter((m) => m.status === "active")
      .map((m, i) => ({ ref: ref("med", i, "medications", m.id), name: m.name, dosage: m.dosage_text ?? "" })),
    immunizations: record.immunizations.map((im, i) => ({
      ref: ref("imm", i, "immunizations", im.id), name: im.vaccine_name, date: im.date_given.slice(0, 10),
      code: im.vaccine_code, ...(im.dose_number ? { dose: im.dose_number } : {}),
    })),
  };

  const preg = record.pregnancies.find((p) => p.status === "active");
  if (preg) {
    input.pregnancy = {
      ref: ref("preg", 0, "pregnancies", preg.id),
      gestational_weeks: gestationalAge(preg.lmp_date, preg.edd_date, today).weeks,
      risk_level: preg.risk_level,
      antenatal_visits_done: preg.antenatal_visits.filter((v) => v.status === "done").length,
    };
  }
  return { input, refMap };
}

/** Identifying strings for a record — used by tests and by the payload guard below. */
export function identifiersOf(record: PatientRecord): string[] {
  const p = record.patient;
  return [
    p.id, p.given_name, p.family_name, ...p.family_name.split(/\s+/), p.birth_date, p.emergency_contact_name ?? "", p.emergency_contact_phone ?? "",
    ...record.children.flatMap((c) => [c.id, c.given_name, c.birth_date]),
  ].filter((s) => s && s.length >= 3);
}

/** Case-insensitive whole-word matcher ("Ali" must not match "criticality"). */
function wordRe(word: string, flags = ""): RegExp {
  const body = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, `iu${flags}`);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PHONE_RE = /\+?\d[\d\s]{6,}\d/;

/** Last line of defence: throws if a payload about to leave for the Claude API contains an identifier. */
export function assertDeidentified(payload: unknown, identifiers: string[]): void {
  const text = JSON.stringify(payload);
  for (const id of identifiers) {
    if (id && wordRe(id).test(text)) {
      throw new Error("de-identification failure: payload contains an identifier");
    }
  }
  if (UUID_RE.test(text)) throw new Error("de-identification failure: payload contains a database id");
  if (PHONE_RE.test(text)) throw new Error("de-identification failure: payload contains a phone-like number");
}

/** Removes identifiers a user may type into the assistant ("je suis Amina Robleh, née le ..."). */
export function scrubUserText(text: string, identifiers: string[]): string {
  let out = text.slice(0, 600);
  for (const id of [...identifiers].sort((a, b) => b.length - a.length)) {
    if (!id || id.length < 3) continue;
    out = out.replace(wordRe(id, "g"), "[…]");
  }
  out = out
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s.-]{6,}\d/g, "[numéro]")
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, "[date]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[date]");
  return out;
}

/** Extra context for the assistant agent's tools: still de-identified, relative dates only for children. */
export function buildAssistantContext(record: PatientRecord, children: { record: PatientRecord }[],
                                      schedule: ScheduleEntry[], language: Lang, today: string) {
  const { input, refMap } = buildSummaryInput(record, language, today);
  const preg = record.pregnancies.find((p) => p.status === "active");
  const visits = preg?.antenatal_visits.map((v, i) => {
    const r = `anc_${i + 1}`;
    refMap[r] = { section: "pregnancies", id: v.id };
    return {
      ref: r, visit_number: v.visit_number, status: v.status, gestational_weeks: v.gestational_weeks,
      date: v.date, bp: v.bp, weight_kg: v.weight_kg,
    };
  }) ?? [];
  const encounters = record.encounters.slice(0, 10).map((e, i) => {
    const r = `enc_${i + 1}`;
    refMap[r] = { section: "encounters", id: e.id };
    return { ref: r, date: e.date.slice(0, 10), reason: e.reason, entered_by: e.source };
  });
  const kids = children.map((c, ci) => {
    const rows = vaccinationCalendar(c.record.patient.birth_date, schedule, c.record.immunizations, today);
    const childRef = `child_${ci + 1}`;
    refMap[childRef] = { section: "children", id: c.record.patient.id };
    return {
      ref: childRef,
      age_months: ageMonths(c.record.patient.birth_date, today),
      sex: c.record.patient.sex,
      vaccines: rows.map((r, i) => {
        const vr = `${childRef}_vac_${i + 1}`;
        refMap[vr] = { section: "children", id: c.record.patient.id };
        return { ref: vr, name: r.schedule.vaccine_name, dose: r.schedule.dose_number, status: r.status, due_in_days: r.daysUntilDue };
      }),
      next_vaccines: nextVaccines(rows).map((r) => ({ name: r.schedule.vaccine_name, dose: r.schedule.dose_number, status: r.status, due_in_days: r.daysUntilDue })),
      schedule_note: "Calendrier indicatif de démonstration — à valider par le Ministère",
    };
  });
  return { input, refMap, visits, encounters, children: kids, documents_count: record.documents.length };
}
