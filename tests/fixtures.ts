// Synthetic test records mirroring public.get_patient_record() for the seeded demo patients.
import type { PatientRecord, ScheduleEntry } from "../supabase/functions/_shared/types.ts";

export const TODAY = "2026-10-10";

const base = { source: "professional" as const, created_at: "2026-01-01T00:00:00Z" };

export const amina: PatientRecord = {
  patient: {
    id: "10000000-0000-4000-a000-000000000001", given_name: "Amina", family_name: "Robleh Kassim",
    birth_date: "1997-09-01", sex: "female", blood_group: "O+", preferred_language: "so", region: "Balbala",
    emergency_contact_name: "Ayan Robleh (sœur)", emergency_contact_phone: "+253 00 00 11 21",
    is_synthetic: true, created_at: "2026-01-01T00:00:00Z",
  },
  conditions: [{ id: "c1", patient_id: "p1", code: "D64.9", display: "Anémie", clinical_status: "active",
                 onset_date: "2026-08-11", is_critical: false, ...base }],
  allergies: [{ id: "a1", patient_id: "p1", substance: "Pénicilline", reaction: "Urticaire", criticality: "high", ...base }],
  medications: [{ id: "m1", patient_id: "p1", name: "Fer + acide folique", dosage_text: "1 comprimé par jour",
                  status: "active", start_date: "2026-08-11", ...base }],
  immunizations: [{ id: "i1", patient_id: "p1", vaccine_code: "TD", vaccine_name: "Tétanos-diphtérie (Td)",
                    date_given: "2026-07-25", dose_number: 1, facility: "Centre de santé de Balbala (démo)", ...base }],
  encounters: [{ id: "e1", patient_id: "p1", facility: "Centre de santé de Balbala (démo)", practitioner_id: null,
                 practitioner_name: "Hodan Warsama, sage-femme (démo)", date: "2026-07-25T00:00:00Z",
                 reason: "Consultation prénatale", notes: "Résultat du bilan : hémoglobine basse.", ...base }],
  observations: [],
  pregnancies: [{
    id: "pg1", patient_id: "p1", lmp_date: "2026-04-25", edd_date: "2027-01-30", status: "active", risk_level: "standard",
    source: "professional",
    antenatal_visits: [
      { id: "v1", pregnancy_id: "pg1", visit_number: 1, date: "2026-06-27", status: "done", gestational_weeks: 9, bp: "110/70", weight_kg: 58, notes: null, facility: null },
      { id: "v2", pregnancy_id: "pg1", visit_number: 2, date: "2026-08-15", status: "done", gestational_weeks: 16, bp: "112/72", weight_kg: 59.4, notes: null, facility: null },
      { id: "v4", pregnancy_id: "pg1", visit_number: 4, date: "2026-10-24", status: "planned", gestational_weeks: 26, bp: null, weight_kg: null, notes: null, facility: null },
    ],
  }],
  documents: [],
  children: [],
  viewer: { role: "patient", is_owner: true },
};

export const omar: PatientRecord = {
  ...amina,
  patient: { ...amina.patient, id: "10000000-0000-4000-a000-000000000009", given_name: "Omar", family_name: "Djama Farah",
             birth_date: "1986-07-12", sex: "male", emergency_contact_name: "Hawa Djama (épouse)", emergency_contact_phone: "+253 00 00 19 29" },
  conditions: [{ id: "c9", patient_id: "p9", code: "G40", display: "Épilepsie", clinical_status: "active", onset_date: null, is_critical: true, ...base }],
  allergies: [{ id: "a9", patient_id: "p9", substance: "Sulfamides", reaction: null, criticality: "high", ...base }],
  medications: [{ id: "m9", patient_id: "p9", name: "Carbamazépine", dosage_text: "200 mg deux fois par jour", status: "active", start_date: null, ...base }],
  immunizations: [],
  pregnancies: [],
};

export const saada: PatientRecord = {
  ...omar,
  patient: { ...omar.patient, given_name: "Saada", family_name: "Ismail Houssein", sex: "female" },
  conditions: [{ id: "c8", patient_id: "p8", code: "D57", display: "Drépanocytose", clinical_status: "active", onset_date: null, is_critical: true, ...base }],
  allergies: [],
  medications: [{ id: "m8", patient_id: "p8", name: "Acide folique", dosage_text: "5 mg une fois par jour", status: "active", start_date: null, ...base }],
};

const s = (code: string, name: string, dose: number, weeks: number): ScheduleEntry => ({
  id: `${code}${dose}`, vaccine_code: code, vaccine_name: name, dose_number: dose, due_age_weeks: weeks, target: "child",
  validation_status: "à valider par le Ministère", source_note: "démo",
});
export const schedule: ScheduleEntry[] = [
  s("BCG", "BCG", 1, 0), s("PENTA", "Pentavalent", 1, 6), s("PENTA", "Pentavalent", 2, 10), s("PENTA", "Pentavalent", 3, 14),
  s("RR", "Rougeole-Rubéole", 1, 39), s("RR", "Rougeole-Rubéole", 2, 78),
];
