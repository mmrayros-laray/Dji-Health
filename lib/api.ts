// Data hooks. Every record read goes through get_patient_record(), which writes the audit log.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatientRecord, ScheduleEntry } from "../supabase/functions/_shared/types.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { supabase } from "./supabase";

export type { PatientRecord, ScheduleEntry };

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ------------------------------------------------------------------ patient record
/** Own record (patientId undefined) or a child's record (guardian). Persisted for offline reading. */
export function useRecord(patientId?: string) {
  return useQuery({
    queryKey: ["record", patientId ?? "me"],
    staleTime: 0, // always revalidate on open (new visits appear immediately; offline → cached copy)
    queryFn: () => rpc<PatientRecord>("get_patient_record", { p_patient_id: patientId ?? null }),
  });
}

/** Clinician view: requires a reason, never persisted offline. */
export function useClinicianRecord(patientId: string, reason: string | null) {
  return useQuery({
    queryKey: ["clinician-record", patientId, reason],
    enabled: Boolean(reason),
    gcTime: 0,
    queryFn: () => rpc<PatientRecord>("get_patient_record", { p_patient_id: patientId, p_reason: reason }),
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    staleTime: 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vaccination_schedule").select("*").order("due_age_weeks");
      if (error) throw new Error(error.message);
      return data as ScheduleEntry[];
    },
  });
}

export interface ProgramParameter { key: string; value: number; unit: string | null; validation_status: string; source_note: string }
export function useProgramParameters() {
  return useQuery({
    queryKey: ["params"],
    staleTime: 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("program_parameters").select("*");
      if (error) throw new Error(error.message);
      return Object.fromEntries((data as ProgramParameter[]).map((p) => [p.key, p])) as Record<string, ProgramParameter>;
    },
  });
}

export interface AccessEntry {
  id: number; created_at: string; action: string; actor_role: string; actor_name: string | null;
  reason: string | null; flagged: boolean; is_self: boolean;
}
export function useAccessHistory(patientId?: string) {
  return useQuery({
    queryKey: ["access", patientId ?? "me"],
    queryFn: () => rpc<AccessEntry[]>("get_access_history", { p_patient_id: patientId ?? null, p_limit: 200 }),
  });
}

// ------------------------------------------------------------------ patient-reported items
export type EditableSection = "conditions" | "allergies" | "medications" | "immunizations";

export function useSaveItem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ section, id, values }: { section: EditableSection; id?: string; values: Record<string, unknown> }) => {
      const q = id
        ? supabase.from(section).update(values).eq("id", id).eq("source", "patient")
        : supabase.from(section).insert({ ...values, patient_id: patientId });
      const { error } = await q;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["record"] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ section, id }: { section: EditableSection | "documents"; id: string }) => {
      const { error } = await supabase.from(section).delete().eq("id", id).eq("source", "patient");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["record"] }),
  });
}

// ------------------------------------------------------------------ documents (Storage)
export function useUploadDocument(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: { uri: string; name: string; mimeType: string; size?: number; title: string; kind: string; webFile?: Blob }) => {
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${patientId}/${Date.now().toString(36)}-${safe}`;
      const body = file.webFile ?? (await (await fetch(file.uri)).arrayBuffer());
      const up = await supabase.storage.from("documents").upload(path, body, { contentType: file.mimeType, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("documents").insert({
        patient_id: patientId, title: file.title, kind: file.kind, storage_path: path, mime_type: file.mimeType, size_bytes: file.size ?? null,
      });
      if (error) {
        await supabase.storage.from("documents").remove([path]);
        throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["record"] }),
  });
}

export async function documentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ------------------------------------------------------------------ emergency card (M3)
export interface StoredCard { token: string; id: string; expires_at: string }
const cardKey = (patientId: string) => `djh.emergency.${patientId}`;

/** The plain token is only ever known to this device (the DB stores a hash). */
export function useEmergencyCard(patientId: string | undefined) {
  return useQuery({
    queryKey: ["emergency-card", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(cardKey(patientId!)).catch(() => null);
      const stored = raw ? (JSON.parse(raw) as StoredCard) : null;
      const { data, error } = await supabase.from("emergency_tokens").select("id, created_at, expires_at, revoked_at")
        .eq("patient_id", patientId!).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      const active = (data ?? []).find((t) => !t.revoked_at && new Date(t.expires_at) > new Date());
      const card = stored && active && stored.id === active.id ? stored : null;
      return { card, hasActiveElsewhere: Boolean(active && !card), tokens: data ?? [] };
    },
  });
}

export function useCreateEmergencyCard(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const card = await rpc<StoredCard>("create_emergency_token", { p_patient_id: patientId });
      await AsyncStorage.setItem(cardKey(patientId), JSON.stringify(card));
      return card;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-card", patientId] });
      qc.invalidateQueries({ queryKey: ["access"] });
    },
  });
}

export function useRevokeEmergencyCard(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await rpc<number>("revoke_emergency_tokens", { p_patient_id: patientId });
      await AsyncStorage.removeItem(cardKey(patientId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emergency-card", patientId] });
      qc.invalidateQueries({ queryKey: ["access"] });
    },
  });
}

export interface EmergencyData {
  first_name: string; age_years: number; blood_group: string;
  critical_allergies: { substance: string; reaction: string | null }[];
  critical_conditions: { display: string }[];
  current_medications: { name: string; dosage: string | null }[];
  emergency_contact: { name: string | null; phone: string | null };
}
export type EmergencyResult = { status: "ok"; data: EmergencyData } | { status: "revoked" | "expired" | "not_found" | "error" };

/** Public: no session needed. Each call is logged server-side as a flagged emergency access. */
export function useEmergencyView(token: string) {
  return useQuery({
    queryKey: ["emergency-view", token],
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<EmergencyResult> => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/emergency-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ token }),
      });
      try {
        return (await res.json()) as EmergencyResult;
      } catch {
        return { status: "error" };
      }
    },
  });
}

// ------------------------------------------------------------------ consent (M5)
export interface ConsentRow {
  id: string; practitioner_name: string | null; practitioner_facility: string | null; granted_at: string | null;
  expires_at: string; revoked_at: string | null; created_at: string; status: "pending" | "active" | "expired" | "revoked";
}
export function useConsents(patientId?: string) {
  return useQuery({
    queryKey: ["consents", patientId ?? "me"],
    refetchInterval: 10_000, // the patient sees the doctor "arrive" during the demo
    queryFn: () => rpc<ConsentRow[]>("my_consents", { p_patient_id: patientId ?? null }),
  });
}

export function useCreateConsentCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpc<{ consent_id: string; code: string; expires_at: string }>("create_consent_code", { p_hours: 24 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] }),
  });
}

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rpc<void>("revoke_consent", { p_consent_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents"] });
      qc.invalidateQueries({ queryKey: ["access"] });
    },
  });
}

export interface ClinicianPatient {
  consent_id: string; patient_id: string; given_name: string; family_name: string; birth_date: string;
  sex: string; region: string; granted_at: string; expires_at: string;
}
export function useClinicianPatients() {
  return useQuery({
    queryKey: ["clinician-patients"],
    gcTime: 0,
    queryFn: () => rpc<ClinicianPatient[]>("clinician_patients"),
  });
}

export function useClaimConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, reason }: { code: string; reason: string }) =>
      rpc<{ consent_id: string; patient_id: string; expires_at: string }>("claim_consent_code", { p_code: code, p_reason: reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinician-patients"] }),
  });
}

export function useAddEncounter(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { reason: string; notes: string; observations: { type: string; value?: string; value_text?: string; unit: string }[] }) =>
      rpc<string>("add_encounter", { p_patient_id: patientId, p_reason: v.reason, p_notes: v.notes || null, p_observations: v.observations }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinician-record", patientId] }),
  });
}

// ------------------------------------------------------------------ AI (M6 + assistant)
export interface SummaryResponse {
  status: "ok" | "unavailable"; summary: string; source_refs: string[];
  ref_map: Record<string, { section: string; id: string }>; label: string; language: string; cached?: boolean; created_at?: string;
}
export function useSummary(language: string, patientId?: string) {
  return useQuery({
    queryKey: ["summary", patientId ?? "me", language],
    staleTime: 3600_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SummaryResponse>("summarize-record", {
        body: { language, patient_id: patientId ?? null },
      });
      if (error) throw new Error(error.message);
      return data!;
    },
  });
}

export interface AssistantReply {
  kind: "answer" | "not_in_record" | "out_of_scope" | "app_help" | "fallback" | "error";
  answer: string; source_refs: string[]; ref_map: Record<string, { section: string; id: string }>;
  screen: string; label: string; language: string;
}
export function useAssistant() {
  return useMutation({
    mutationFn: async ({ messages, language }: { messages: { role: "user" | "assistant"; content: string }[]; language: string }) => {
      const { data, error } = await supabase.functions.invoke<AssistantReply>("record-assistant", { body: { messages, language } });
      if (error) throw new Error(error.message);
      return data!;
    },
  });
}

export interface Rejection { id: string; patient_id: string | null; function_name: string; language: string | null; draft: string; reason: string; created_at: string }
export function useRejections() {
  return useQuery({ queryKey: ["rejections"], gcTime: 0, queryFn: () => rpc<Rejection[]>("admin_ai_rejections", { p_limit: 200 }) });
}

// ------------------------------------------------------------------ Ministry (M7)
export interface Cell { count: number | null; suppressed: boolean }
export interface Dashboard {
  generated_at: string; region: string | null; min_cell_size: number; synthetic: boolean; regions: string[];
  total_enrolled: number | null;
  enrolled_by_region: ({ region: string } & Cell)[];
  vaccination_coverage: { vaccine_code: string; vaccine_name: string; dose_number: number; eligible: number | null;
                          vaccinated: number | null; coverage_pct: number | null; suppressed: boolean }[];
  pregnancies_by_trimester: ({ trimester: number } & Cell)[];
  anc_completion: { recommended_visits: number; recommended_visits_status: string; eligible: number | null;
                    complete: number | null; pct: number | null; suppressed: boolean };
  top_conditions: ({ code: string; display: string } & Cell)[];
}
export function useDashboard(region: string | null) {
  return useQuery({
    queryKey: ["dashboard", region],
    gcTime: 0,
    queryFn: () => rpc<Dashboard>("ministry_dashboard", { p_region: region }),
  });
}
