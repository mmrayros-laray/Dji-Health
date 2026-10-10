// Shape of public.get_patient_record() — shared by the app and the Edge Functions.

export type Source = "patient" | "professional";

export interface Patient {
  id: string;
  given_name: string;
  family_name: string;
  birth_date: string;
  sex: "female" | "male" | "other" | "unknown";
  blood_group: string;
  preferred_language: "fr" | "so" | "ar" | "en";
  region: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_synthetic: boolean;
  created_at: string;
}

export interface Condition {
  id: string; patient_id: string; code: string | null; display: string;
  clinical_status: "active" | "inactive" | "resolved"; onset_date: string | null; is_critical: boolean;
  source: Source; created_at: string;
}
export interface Allergy {
  id: string; patient_id: string; substance: string; reaction: string | null;
  criticality: "low" | "high" | "unable-to-assess"; source: Source; created_at: string;
}
export interface Medication {
  id: string; patient_id: string; name: string; dosage_text: string | null;
  status: "active" | "completed" | "stopped"; start_date: string | null; source: Source; created_at: string;
}
export interface Immunization {
  id: string; patient_id: string; vaccine_code: string; vaccine_name: string; date_given: string;
  dose_number: number | null; facility: string | null; source: Source; created_at: string;
}
export interface Encounter {
  id: string; patient_id: string; facility: string; practitioner_id: string | null; practitioner_name: string | null;
  date: string; reason: string; notes: string | null; source: Source; created_at: string;
}
export interface Observation {
  id: string; patient_id: string; encounter_id: string | null;
  type: "weight" | "height" | "blood_pressure" | "hemoglobin" | "glucose" | "temperature" | "muac";
  value: number | null; value_text: string | null; unit: string | null; date: string; source: Source;
}
export interface AntenatalVisit {
  id: string; pregnancy_id: string; visit_number: number; date: string; status: "done" | "planned";
  gestational_weeks: number | null; bp: string | null; weight_kg: number | null; notes: string | null; facility: string | null;
}
export interface Pregnancy {
  id: string; patient_id: string; lmp_date: string; edd_date: string; status: "active" | "completed" | "ended";
  risk_level: "standard" | "high"; source: Source; antenatal_visits: AntenatalVisit[];
}
export interface DocumentRef {
  id: string; patient_id: string; title: string; kind: string; storage_path: string;
  mime_type: string | null; size_bytes: number | null; source: Source; created_at: string;
}
export interface ChildSummary {
  id: string; given_name: string; family_name: string; birth_date: string; sex: string;
}

export interface PatientRecord {
  patient: Patient;
  conditions: Condition[];
  allergies: Allergy[];
  medications: Medication[];
  immunizations: Immunization[];
  encounters: Encounter[];
  observations: Observation[];
  pregnancies: Pregnancy[];
  documents: DocumentRef[];
  children: ChildSummary[];
  viewer: { role: "patient" | "clinician" | "ministry_viewer" | "admin"; is_owner: boolean };
}

export interface ScheduleEntry {
  id: string; vaccine_code: string; vaccine_name: string; dose_number: number; due_age_weeks: number;
  target: "child" | "pregnancy"; validation_status: string; source_note: string;
}
