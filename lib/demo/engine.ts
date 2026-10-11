// Offline demo engine — used only when EXPO_PUBLIC_DEMO_MODE=1 (shareable preview without a backend).
// It replays the backend's behaviour in the browser on the synthetic seed snapshot (lib/demo/snapshot.json):
// access rules (owner / guardian / consented clinician / ministry aggregates only), audit log, consent codes,
// emergency tokens. AI texts are pre-written templates built from the record, then passed through the SAME
// validator as the Edge Functions; they are labelled as preview examples. No data leaves the browser.
import glossary from "../../locales/glossary.json";
import { buildAssistantContext, buildSummaryInput, type Lang } from "../../supabase/functions/_shared/deidentify.ts";
import { translateItem, type Glossary } from "../../supabase/functions/_shared/glossary.ts";
import { AI_LABEL, ASSISTANT_FALLBACK, ASSISTANT_OUT_OF_SCOPE, SUMMARY_FALLBACK } from "../../supabase/functions/_shared/messages.ts";
import type { PatientRecord, ScheduleEntry } from "../../supabase/functions/_shared/types.ts";
import { buildContext, itemsFromSummaryInput, validateDraft, type ValidationItem } from "../../supabase/functions/_shared/validator.ts";
import { normalize } from "../../supabase/functions/_shared/text.ts";
import snapshotRaw from "./snapshot.json";

const G = glossary as unknown as Glossary;
const DAY = 86_400_000;

// ------------------------------------------------------------------ dates: keep the story relative to today
function shiftDates<T>(value: T, days: number): T {
  if (!days) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const t = new Date(v.length === 10 ? `${v}T00:00:00Z` : v).getTime();
      if (Number.isNaN(t)) return v;
      const iso = new Date(t + days * DAY).toISOString();
      return v.length === 10 ? iso.slice(0, 10) : iso;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
const todayIso = () => new Date().toISOString().slice(0, 10);
const snapDays = Math.round((Date.parse(`${todayIso()}T00:00:00Z`) - Date.parse(`${snapshotRaw.snapshot_date}T00:00:00Z`)) / DAY);
const snapshot = shiftDates(snapshotRaw, snapDays) as typeof snapshotRaw;

// ------------------------------------------------------------------ accounts
const uid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const pid = (n: number) => `10000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
type Role = "patient" | "clinician" | "ministry_viewer" | "admin";
interface Account { userId: string; role: Role; patientId?: string }
const ACCOUNTS: Record<string, Account> = {
  "amina@demo.djihealth.test": { userId: uid(1), role: "patient", patientId: pid(1) },
  "fatouma@demo.djihealth.test": { userId: uid(2), role: "patient", patientId: pid(2) },
  "dr.hassan@demo.djihealth.test": { userId: uid(3), role: "clinician" },
  "ministere@demo.djihealth.test": { userId: uid(4), role: "ministry_viewer" },
  "admin@demo.djihealth.test": { userId: uid(5), role: "admin" },
};
const practitioners = snapshot.practitioners as { id: string; user_id: string | null; name: string; role: string; facility: string }[];
const myPractitioner = (userId: string) => practitioners.find((p) => p.user_id === userId);

// ------------------------------------------------------------------ state (persisted per browser, best effort)
interface Audit { id: number; created_at: string; action: string; actor_id: string | null; actor_role: string; patient_id: string | null; reason: string | null; flagged: boolean }
interface Token { id: string; token: string; patient_id: string; created_at: string; expires_at: string; revoked_at: string | null }
interface Consent { id: string; patient_id: string; code: string | null; practitioner_id: string | null; granted_at: string | null; expires_at: string; revoked_at: string | null; created_at: string }
interface Rejection { id: string; patient_id: string | null; function_name: string; language: string | null; draft: string; reason: string; created_at: string }
interface State {
  version: string;
  user: string | null; // email
  records: Record<string, PatientRecord>;
  audit: Audit[];
  tokens: Token[];
  consents: Consent[];
  rejections: Rejection[];
  seq: number;
}
const KEY = "djh.demo.state";
const VERSION = `v1:${snapshotRaw.snapshot_date}`;

function fresh(): State {
  return {
    version: VERSION,
    user: null,
    records: JSON.parse(JSON.stringify(snapshot.records)),
    audit: [],
    tokens: [],
    consents: [],
    rejections: [{
      id: "rej-example", patient_id: pid(1), function_name: "summarize-record", language: "en",
      draft: '{"summary":"You are 29 and you have anaemia and type 2 diabetes. You should rest.","source_refs":["cond_1"]}',
      reason: "entity_not_in_record:diabetes_t2", created_at: new Date(Date.now() - 3600_000).toISOString(),
    }],
    seq: 1,
  };
}

let state: State = (() => {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.version === VERSION) return s;
    }
  } catch { /* storage blocked: in-memory only */ }
  return fresh();
})();
function save() {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
const listeners = new Set<() => void>();
export function onAuthChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((f) => f());

const latency = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));
class DemoError extends Error {}
const deny = () => { throw new DemoError("access denied"); };
const now = () => new Date().toISOString();
const newId = () => `demo-${Date.now().toString(36)}-${(state.seq++).toString(36)}`;
function randomToken(len: number, alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_") {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// ------------------------------------------------------------------ session
function me(): Account | null { return state.user ? ACCOUNTS[state.user] ?? null : null; }
export function session() {
  const a = me();
  return a ? { userId: a.userId, role: a.role } : null;
}
export async function signIn(email: string) {
  if (!ACCOUNTS[email]) throw new DemoError("Compte de démonstration inconnu");
  state.user = email; save(); emit();
  return latency(undefined, 250);
}
export async function signOut() { state.user = null; save(); emit(); }
export function resetDemo() { state = fresh(); save(); emit(); }

// ------------------------------------------------------------------ access rules (mirror of the RLS helpers)
function childrenOf(patientId: string): string[] {
  return state.records[patientId]?.children.map((c) => c.id) ?? [];
}
function isOwner(patientId: string): boolean {
  const a = me();
  return Boolean(a && a.role === "patient" && a.patientId && (patientId === a.patientId || childrenOf(a.patientId).includes(patientId)));
}
function activeConsent(patientId: string): Consent | undefined {
  const a = me();
  const prac = a?.role === "clinician" ? myPractitioner(a.userId) : undefined;
  if (!prac) return undefined;
  return state.consents.find((c) => c.patient_id === patientId && c.practitioner_id === prac.id && c.granted_at && !c.revoked_at && c.expires_at > now());
}
function log(patientId: string | null, action: string, reason: string | null = null, flagged = false, actorRole?: string) {
  const a = me();
  state.audit.unshift({ id: state.seq++, created_at: now(), action, actor_id: actorRole === "emergency_scan" ? null : a?.userId ?? null,
    actor_role: actorRole ?? a?.role ?? "system", patient_id: patientId, reason, flagged });
}

// ------------------------------------------------------------------ record
export async function getRecord(patientId: string | null, reason?: string | null): Promise<PatientRecord> {
  const a = me();
  const id = patientId ?? a?.patientId;
  if (!id || !state.records[id] || !(isOwner(id) || activeConsent(id))) deny();
  if (a?.role === "clinician" && !reason?.trim()) throw new DemoError("a reason is required for clinician access");
  log(id!, "record_view", reason ?? null);
  save();
  const rec = JSON.parse(JSON.stringify(state.records[id!])) as PatientRecord;
  rec.viewer = { role: a!.role, is_owner: isOwner(id!) };
  return latency(rec);
}

export async function accessHistory(patientId: string | null) {
  const a = me();
  const id = patientId ?? a?.patientId;
  if (!id || !isOwner(id)) deny();
  const rows = state.audit.filter((r) => r.patient_id === id).slice(0, 200).map((r) => {
    const acc = Object.entries(ACCOUNTS).find(([, x]) => x.userId === r.actor_id)?.[1];
    const prac = r.actor_id ? myPractitioner(r.actor_id) : undefined;
    return {
      id: r.id, created_at: r.created_at, action: r.action, actor_role: r.actor_role,
      actor_name: prac?.name ?? (acc?.patientId ? state.records[acc.patientId]?.patient.given_name ?? null : null),
      reason: r.reason, flagged: r.flagged, is_self: r.actor_id === a?.userId,
    };
  });
  return latency(rows);
}

export const schedule = async () => latency(snapshot.schedule as unknown as ScheduleEntry[]);
export const programParameters = async () => latency(snapshot.params as { key: string; value: number; unit: string | null; validation_status: string; source_note: string }[]);

// ------------------------------------------------------------------ patient-reported items
type Section = "conditions" | "allergies" | "medications" | "immunizations" | "documents";
export async function saveItem(patientId: string, section: Exclude<Section, "documents">, id: string | undefined, values: Record<string, unknown>) {
  if (!isOwner(patientId)) deny();
  const list = state.records[patientId][section] as unknown as Record<string, unknown>[];
  if (id) {
    const item = list.find((x) => x.id === id && x.source === "patient");
    if (!item) deny();
    Object.assign(item!, values, { updated_at: now() });
  } else {
    list.unshift({ id: newId(), patient_id: patientId, ...defaults[section], ...values, source: "patient", created_at: now(), updated_at: now() });
  }
  save();
  return latency(undefined);
}
const defaults: Record<string, Record<string, unknown>> = {
  conditions: { code: null, clinical_status: "active", onset_date: null, is_critical: false },
  allergies: { reaction: null, criticality: "low" },
  medications: { dosage_text: null, status: "active", start_date: null },
  immunizations: { vaccine_code: "AUTRE", dose_number: null, facility: null },
};
export async function deleteItem(section: Section, id: string) {
  for (const rec of Object.values(state.records)) {
    const list = rec[section] as unknown as { id: string; source: string; patient_id: string }[];
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) {
      if (list[i].source !== "patient" || !isOwner(list[i].patient_id)) deny();
      list.splice(i, 1); save();
      return latency(undefined);
    }
  }
}

// documents: kept in memory for this tab (files are never uploaded anywhere)
const blobs = new Map<string, string>();
export async function uploadDocument(patientId: string, f: { name: string; mimeType: string; size?: number; title: string; kind: string; webFile?: Blob; uri: string }) {
  if (!isOwner(patientId)) deny();
  const path = `${patientId}/${newId()}-${f.name}`;
  blobs.set(path, f.webFile ? URL.createObjectURL(f.webFile) : f.uri);
  state.records[patientId].documents.unshift({ id: newId(), patient_id: patientId, title: f.title, kind: f.kind, storage_path: path,
    mime_type: f.mimeType, size_bytes: f.size ?? null, source: "patient", created_at: now() });
  save();
  return latency(undefined, 300);
}
export async function documentUrl(path: string) {
  const u = blobs.get(path);
  if (!u) throw new DemoError("Aperçu : le fichier n'est conservé que pendant la session où il a été ajouté.");
  return u;
}

// ------------------------------------------------------------------ emergency card
export async function emergencyTokens(patientId: string) {
  if (!isOwner(patientId)) deny();
  return latency(state.tokens.filter((t) => t.patient_id === patientId).map(({ token: _t, ...rest }) => rest).reverse());
}
export async function createEmergencyToken(patientId: string) {
  if (!isOwner(patientId)) deny();
  state.tokens.forEach((t) => { if (t.patient_id === patientId && !t.revoked_at) t.revoked_at = now(); });
  const t: Token = { id: newId(), token: randomToken(32), patient_id: patientId, created_at: now(),
    expires_at: new Date(Date.now() + 365 * DAY).toISOString(), revoked_at: null };
  state.tokens.push(t);
  log(patientId, "emergency_card_created"); save();
  return latency({ token: t.token, id: t.id, expires_at: t.expires_at });
}
export async function revokeEmergencyTokens(patientId: string) {
  if (!isOwner(patientId)) deny();
  state.tokens.forEach((t) => { if (t.patient_id === patientId && !t.revoked_at) t.revoked_at = now(); });
  log(patientId, "emergency_card_revoked"); save();
  return latency(undefined);
}
export async function emergencyLookup(token: string) {
  const t = state.tokens.find((x) => x.token === token);
  if (!t) return latency({ status: "not_found" as const });
  if (t.revoked_at || t.expires_at <= now()) {
    log(t.patient_id, "emergency_access_denied", null, true, "emergency_scan"); save();
    return latency({ status: (t.revoked_at ? "revoked" : "expired") as "revoked" | "expired" });
  }
  const r = state.records[t.patient_id];
  log(t.patient_id, "emergency_access", null, true, "emergency_scan"); save();
  const born = new Date(`${r.patient.birth_date}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age--;
  return latency({
    status: "ok" as const,
    data: {
      first_name: r.patient.given_name, age_years: age, blood_group: r.patient.blood_group,
      critical_allergies: r.allergies.filter((a) => a.criticality === "high").map((a) => ({ substance: a.substance, reaction: a.reaction })),
      critical_conditions: r.conditions.filter((c) => c.is_critical && c.clinical_status === "active").map((c) => ({ display: c.display })),
      current_medications: r.medications.filter((m) => m.status === "active").map((m) => ({ name: m.name, dosage: m.dosage_text })),
      emergency_contact: { name: r.patient.emergency_contact_name, phone: r.patient.emergency_contact_phone },
    },
  });
}

// ------------------------------------------------------------------ consent
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
export async function createConsentCode() {
  const a = me();
  if (!a?.patientId) deny();
  const raw = randomToken(8, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
  const c: Consent = { id: newId(), patient_id: a!.patientId!, code: raw, practitioner_id: null, granted_at: null,
    expires_at: new Date(Date.now() + DAY).toISOString(), revoked_at: null, created_at: now() };
  state.consents.unshift(c);
  log(c.patient_id, "consent_code_created"); save();
  return latency({ consent_id: c.id, code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expires_at: c.expires_at });
}
export async function claimConsentCode(code: string, reason: string) {
  const a = me();
  const prac = a?.role === "clinician" ? myPractitioner(a.userId) : undefined;
  if (!prac) deny();
  if (!reason.trim()) throw new DemoError("a reason is required");
  const c = state.consents.find((x) => x.code === normCode(code) && !x.practitioner_id && !x.revoked_at && x.expires_at > now());
  if (!c) { log(null, "consent_claim_failed", reason); save(); throw new DemoError("invalid or expired code"); }
  Object.assign(c, { practitioner_id: prac!.id, granted_at: now(), code: null });
  log(c.patient_id, "consent_granted", reason); save();
  return latency({ consent_id: c.id, patient_id: c.patient_id, expires_at: c.expires_at });
}
export async function revokeConsent(id: string) {
  const c = state.consents.find((x) => x.id === id);
  if (!c || !isOwner(c.patient_id)) deny();
  c!.revoked_at = now(); c!.code = null;
  log(c!.patient_id, "consent_revoked"); save();
  return latency(undefined);
}
export async function myConsents(patientId: string | null) {
  const id = patientId ?? me()?.patientId;
  if (!id || !isOwner(id)) deny();
  return latency(state.consents.filter((c) => c.patient_id === id).map((c) => {
    const p = practitioners.find((x) => x.id === c.practitioner_id);
    const status = c.revoked_at ? "revoked" : c.expires_at <= now() ? "expired" : c.granted_at ? "active" : "pending";
    return { id: c.id, practitioner_name: p?.name ?? null, practitioner_facility: p?.facility ?? null, granted_at: c.granted_at,
      expires_at: c.expires_at, revoked_at: c.revoked_at, created_at: c.created_at, status };
  }));
}
export async function clinicianPatients() {
  const a = me();
  const prac = a?.role === "clinician" ? myPractitioner(a.userId) : undefined;
  if (!prac) return latency([]);
  return latency(state.consents.filter((c) => c.practitioner_id === prac.id && c.granted_at && !c.revoked_at && c.expires_at > now()).map((c) => {
    const p = state.records[c.patient_id].patient;
    return { consent_id: c.id, patient_id: p.id, given_name: p.given_name, family_name: p.family_name, birth_date: p.birth_date,
      sex: p.sex, region: p.region, granted_at: c.granted_at!, expires_at: c.expires_at };
  }));
}
export async function addEncounter(patientId: string, reason: string, notes: string | null, observations: { type: string; value?: string; value_text?: string; unit: string }[]) {
  const a = me();
  const prac = a?.role === "clinician" ? myPractitioner(a.userId) : undefined;
  if (!prac || !activeConsent(patientId)) deny();
  if (!reason.trim()) throw new DemoError("reason is required");
  const rec = state.records[patientId];
  const encId = newId();
  rec.encounters.unshift({ id: encId, patient_id: patientId, facility: prac!.facility, practitioner_id: prac!.id, practitioner_name: prac!.name,
    date: now(), reason, notes, source: "professional", created_at: now() });
  for (const o of observations) {
    rec.observations.push({ id: newId(), patient_id: patientId, encounter_id: encId, type: o.type as never,
      value: o.value ? Number(o.value) : null, value_text: o.value_text ?? null, unit: o.unit, date: todayIso(), source: "professional" });
  }
  log(patientId, "encounter_added", reason); save();
  return latency(encId);
}

// ------------------------------------------------------------------ AI (pre-written, validated)
const PREVIEW_NOTE: Record<Lang, string> = {
  fr: "Aperçu hors ligne : texte d'exemple rédigé à partir du dossier, vérifié par le même contrôle automatique que l'IA.",
  so: "Muuqaal offline ah: qoraal tusaale ah oo laga sameeyay diiwaanka, lagu hubiyay isla hubinta AI-da.",
  ar: "معاينة دون اتصال: نص مثال مكتوب من الملف، تم فحصه بنفس الفحص الآلي المستخدم للذكاء الاصطناعي.",
  en: "Offline preview: example text written from the record, checked by the same automatic validator as the AI.",
};
const label = (lang: Lang) => `${AI_LABEL[lang]} ${PREVIEW_NOTE[lang]}`;
const tr = (lang: Lang, text: string, code?: string) => translateItem(text, code, lang, G);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const join = (lang: Lang, xs: string[]) => xs.join(lang === "ar" ? "، " : ", ");

function summaryDraft(rec: PatientRecord, lang: Lang) {
  const { input, refMap } = buildSummaryInput(rec, lang, todayIso());
  const refs: string[] = [];
  const parts: string[] = [];
  const T = {
    fr: { age: (n: number) => `Vous avez ${n} ans.`, cond: "Votre dossier indique", all: "Allergie importante", med: "Vous prenez", imm: "Vaccins reçus", preg: (w: number, v: number) => `Vous êtes enceinte de ${w} semaines. ${v} visites prénatales ont été faites.`, high: "L'équipe de santé a classé votre suivi de grossesse à haut risque." },
    so: { age: (n: number) => `Waxaad tahay ${n} sano.`, cond: "Diiwaankaagu wuxuu muujinayaa", all: "Xasaasiyad", med: "Daawooyinka aad qaadato", imm: "Tallaalada aad qaadatay", preg: (w: number, v: number) => `Waxaad uur leedahay ${w} toddobaad. ${v} booqasho uur ayaa la sameeyay.`, high: "Kooxda caafimaadku waxay u qaybisay la socodka uurkaaga khatar sare." },
    ar: { age: (n: number) => `عمرك ${n} سنة.`, cond: "يشير ملفك إلى", all: "حساسية", med: "الأدوية التي تتناولها", imm: "اللقاحات التي تلقيتها", preg: (w: number, v: number) => `أنت حامل في الأسبوع ${w}. تمت ${v} زيارات متابعة للحمل.`, high: "صنّف الفريق الصحي متابعة حملك عالية الخطورة." },
    en: { age: (n: number) => `You are ${n} years old.`, cond: "Your record shows", all: "Allergy", med: "You take", imm: "Vaccines received", preg: (w: number, v: number) => `You are ${w} weeks pregnant. ${v} antenatal visits have been done.`, high: "The health team classified your pregnancy follow-up as high risk." },
  }[lang];
  parts.push(T.age(input.age_years));
  if (input.conditions.length) { parts.push(`${T.cond}: ${join(lang, input.conditions.map((c) => tr(lang, c.display, c.code)))}.`); refs.push(...input.conditions.map((c) => c.ref)); }
  if (input.allergies.length) { parts.push(`${T.all}: ${join(lang, input.allergies.map((a) => tr(lang, a.substance)))}.`); refs.push(...input.allergies.map((a) => a.ref)); }
  if (input.medications.length) {
    parts.push(`${T.med}: ${join(lang, input.medications.map((m) => lang === "fr" && m.dosage ? `${m.name} (${m.dosage})` : tr(lang, m.name)))}.`);
    refs.push(...input.medications.map((m) => m.ref));
  }
  if (input.immunizations.length) {
    const names = uniq(input.immunizations.map((i) => tr(lang, i.name, i.code)));
    parts.push(`${T.imm}: ${join(lang, names.slice(0, 6))}.`);
    refs.push(...input.immunizations.map((i) => i.ref));
  }
  if (input.pregnancy) {
    parts.push(T.preg(input.pregnancy.gestational_weeks, input.pregnancy.antenatal_visits_done));
    if (input.pregnancy.risk_level === "high") parts.push(T.high);
    refs.push(input.pregnancy.ref);
  }
  return { input, refMap, draft: JSON.stringify({ summary: parts.join(" "), source_refs: refs }) };
}

const summaryCache = new Map<string, unknown>();
export async function summary(lang: Lang) {
  const a = me();
  if (!a?.patientId) deny();
  const key = `${a!.patientId}:${lang}`;
  if (summaryCache.has(key)) return latency({ ...(summaryCache.get(key) as object), cached: true }, 200);
  const rec = state.records[a!.patientId!];
  log(rec.patient.id, "record_view");
  const { input, refMap, draft } = summaryDraft(rec, lang);
  const ctx = buildContext(itemsFromSummaryInput(input), input, input.medications.map((m) => m.dosage));
  const res = validateDraft(draft, ctx, G, { textField: "summary", requireRefs: true, maxWords: 150 });
  log(rec.patient.id, "ai_summary");
  let out;
  if (!res.ok) {
    state.rejections.unshift({ id: newId(), patient_id: rec.patient.id, function_name: "summarize-record", language: lang, draft, reason: res.reason, created_at: now() });
    out = { status: "unavailable", summary: SUMMARY_FALLBACK[lang], source_refs: [], ref_map: {}, label: label(lang), language: lang };
  } else {
    out = { status: "ok", summary: res.text, source_refs: res.source_refs, ref_map: Object.fromEntries(res.source_refs.map((r) => [r, refMap[r]])),
      label: label(lang), language: lang, created_at: now() };
  }
  save();
  summaryCache.set(key, out);
  return latency({ ...out, cached: false }, 900);
}

type Intent = "allergies" | "medications" | "conditions" | "visit" | "child_vaccines" | "vaccines" | "share" | "emergency" | "advice" | "unknown";
function intentOf(q: string): Intent {
  const n = normalize(q);
  const has = (...w: string[]) => w.some((x) => n.includes(normalize(x)));
  if (has("arreter", "arrêter", "stop", "augmenter", "diminuer", "dose", "grave", "serious", "dangereux", "joojin", "إيقاف", "أوقف", "خطير", "should i", "dois je", "est ce normal", "is it normal")) return "advice";
  if (has("allerg", "xasaasiyad", "حساسية")) return "allergies";
  if (has("medicament", "médicament", "traitement", "medicine", "medication", "daawo", "دواء", "أدوية")) return "medications";
  if (has("enfant", "child", "ilmah", "carruur", "طفل")) return "child_vaccines";
  if (has("vaccin", "vaccine", "tallaal", "لقاح")) return "vaccines";
  if (has("visite", "rendez", "visit", "booqash", "زيارة", "موعد")) return "visit";
  if (has("maladie", "condition", "xanuun", "مرض", "أمراض")) return "conditions";
  if (has("partager", "share", "wadaag", "مشاركة", "medecin", "doctor")) return "share";
  if (has("urgence", "emergency", "degdeg", "طوارئ", "qr")) return "emergency";
  return "unknown";
}

const A = {
  fr: { all: "Votre dossier indique une allergie à", meds: "Vous prenez actuellement", cond: "Votre dossier indique", visit: (d: string, w: number) => `Votre prochaine visite prénatale est prévue le ${d} (semaine ${w}).`, novisit: "Aucune visite prénatale à venir n'est enregistrée dans votre dossier.", child: (v: string, s: string) => `Prochain vaccin : ${v} (${s}).`, alldone: "Tous les vaccins prévus à ce jour sont faits.", vacc: "Vaccins enregistrés", none: "Je ne trouve pas cette information dans votre dossier.", share: "Ouvrez l'onglet « Partager » et créez un code valable 24 heures. Montrez-le au professionnel de santé : il ne pourra voir votre dossier qu'avec ce code.", emergency: "Ouvrez l'onglet « Urgence » pour créer votre carte avec code QR. Un soignant peut la scanner en cas d'urgence ; chaque scan est enregistré.", unknown: "Je peux retrouver dans votre dossier vos allergies, vos médicaments, vos maladies, vos visites prénatales et les vaccins de vos enfants.", st: { overdue: "en retard", due: "à faire maintenant", upcoming: "à venir" } },
  so: { all: "Diiwaankaagu wuxuu muujinayaa xasaasiyad", meds: "Daawooyinka aad hadda qaadato", cond: "Diiwaankaagu wuxuu muujinayaa", visit: (d: string, w: number) => `Booqashadaada uurka ee xigta waa ${d} (toddobaadka ${w}).`, novisit: "Diiwaankaaga kuma jirto booqasho uur oo soo socota.", child: (v: string, s: string) => `Tallaalka xiga: ${v} (${s}).`, alldone: "Dhammaan tallaalada ilaa maanta la qorsheeyay waa la sameeyay.", vacc: "Tallaalada la diiwaangeliyay", none: "Macluumaadkan kuma helin diiwaankaaga.", share: "Fur qaybta \"La wadaag\" oo samee koodh 24 saacadood shaqaynaya. Tus xirfadlaha caafimaadka.", emergency: "Fur qaybta \"Degdeg\" si aad u samaysato kaarka QR-ka. Iskaan kasta waa la qoraa.", unknown: "Waxaan diiwaankaaga ka heli karaa xasaasiyadda, daawooyinka, xanuunada, booqashooyinka uurka iyo tallaalada carruurta.", st: { overdue: "dib u dhacay", due: "hadda", upcoming: "soo socda" } },
  ar: { all: "يشير ملفك إلى حساسية من", meds: "الأدوية التي تتناولها حالياً", cond: "يشير ملفك إلى", visit: (d: string, w: number) => `زيارتك القادمة لمتابعة الحمل مقررة في ${d} (الأسبوع ${w}).`, novisit: "لا توجد زيارة متابعة حمل قادمة مسجلة في ملفك.", child: (v: string, s: string) => `اللقاح القادم: ${v} (${s}).`, alldone: "تم إعطاء جميع اللقاحات المقررة حتى اليوم.", vacc: "اللقاحات المسجلة", none: "لم أجد هذه المعلومة في ملفك.", share: "افتح تبويب «مشاركة» وأنشئ رمزاً صالحاً لمدة 24 ساعة، ثم أظهره للأخصائي الصحي.", emergency: "افتح تبويب «الطوارئ» لإنشاء بطاقتك برمز QR. يتم تسجيل كل مسح.", unknown: "يمكنني العثور في ملفك على الحساسية والأدوية والأمراض وزيارات الحمل ولقاحات أطفالك.", st: { overdue: "متأخر", due: "حان موعده", upcoming: "قادم" } },
  en: { all: "Your record shows an allergy to", meds: "You currently take", cond: "Your record shows", visit: (d: string, w: number) => `Your next antenatal visit is planned for ${d} (week ${w}).`, novisit: "No upcoming antenatal visit is recorded in your record.", child: (v: string, s: string) => `Next vaccine: ${v} (${s}).`, alldone: "All vaccines planned so far are done.", vacc: "Recorded vaccines", none: "I can't find this information in your record.", share: "Open the \"Share\" tab and create a code valid for 24 hours. Show it to the health professional.", emergency: "Open the \"Emergency\" tab to create your card with a QR code. Every scan is logged.", unknown: "I can find your allergies, medicines, conditions, antenatal visits and your children's vaccines in your record.", st: { overdue: "overdue", due: "due now", upcoming: "upcoming" } },
};

export async function assistant(messages: { role: string; content: string }[], language: string) {
  const lang = (["fr", "so", "ar", "en"].includes(language) ? language : "fr") as Lang;
  const a = me();
  if (!a?.patientId) deny();
  const rec = state.records[a!.patientId!];
  const kids = rec.children.map((c) => ({ record: state.records[c.id] })).filter((k) => k.record);
  const ctx = buildAssistantContext(rec, kids, snapshot.schedule as unknown as ScheduleEntry[], lang, todayIso());
  log(rec.patient.id, "ai_assistant"); save();
  const q = messages[messages.length - 1]?.content ?? "";
  const intent = intentOf(q);
  const L = A[lang];
  const reply = (kind: string, answer: string, refs: string[] = [], screen = "none") => ({ kind, answer, source_refs: refs, screen });
  let draft: ReturnType<typeof reply>;
  switch (intent) {
    case "advice":
      return latency({ kind: "out_of_scope", answer: ASSISTANT_OUT_OF_SCOPE[lang], source_refs: [], ref_map: {}, screen: "none", label: label(lang), language: lang }, 700);
    case "allergies":
      draft = ctx.input.allergies.length
        ? reply("answer", `${L.all} ${join(lang, ctx.input.allergies.map((x) => tr(lang, x.substance)))}.`, ctx.input.allergies.map((x) => x.ref), "allergies")
        : reply("not_in_record", L.none); break;
    case "medications":
      draft = ctx.input.medications.length
        ? reply("answer", `${L.meds}: ${join(lang, ctx.input.medications.map((m) => lang === "fr" && m.dosage ? `${m.name} (${m.dosage})` : tr(lang, m.name)))}.`, ctx.input.medications.map((m) => m.ref), "medications")
        : reply("not_in_record", L.none); break;
    case "conditions":
      draft = ctx.input.conditions.length
        ? reply("answer", `${L.cond}: ${join(lang, ctx.input.conditions.map((c) => tr(lang, c.display, c.code)))}.`, ctx.input.conditions.map((c) => c.ref), "conditions")
        : reply("not_in_record", L.none); break;
    case "visit": {
      const v = ctx.visits.find((x) => x.status === "planned" && x.date >= todayIso());
      draft = v && ctx.input.pregnancy ? reply("answer", L.visit(v.date, v.gestational_weeks ?? 0), [ctx.input.pregnancy.ref, v.ref], "maternal") : reply("not_in_record", L.novisit, [], "maternal");
      break;
    }
    case "child_vaccines":
    case "vaccines": {
      const child = ctx.children.find((c) => c.next_vaccines.length) ?? ctx.children[0];
      if (child) {
        const n = child.next_vaccines[0];
        if (!n) { draft = reply("answer", L.alldone, [child.ref], "children"); break; }
        const vr = child.vaccines.find((x) => x.name === n.name && x.dose === n.dose);
        draft = reply("answer", L.child(tr(lang, n.name), L.st[n.status as "overdue" | "due" | "upcoming"] ?? n.status), [child.ref, ...(vr ? [vr.ref] : [])], "children");
      } else if (ctx.input.immunizations.length) {
        draft = reply("answer", `${L.vacc}: ${join(lang, uniq(ctx.input.immunizations.map((i) => tr(lang, i.name, i.code))))}.`, ctx.input.immunizations.map((i) => i.ref), "immunizations");
      } else draft = reply("not_in_record", L.none);
      break;
    }
    case "share": draft = reply("app_help", L.share, [], "share"); break;
    case "emergency": draft = reply("app_help", L.emergency, [], "emergency_card"); break;
    default: draft = reply("not_in_record", L.unknown);
  }
  // same validator as the record-assistant Edge Function
  const items: ValidationItem[] = [
    ...itemsFromSummaryInput(ctx.input),
    ...ctx.visits.map((v) => ({ ref: v.ref, text: "" })),
    ...ctx.encounters.map((e) => ({ ref: e.ref, text: e.reason })),
    ...ctx.children.flatMap((c) => [{ ref: c.ref, text: "" }, ...c.vaccines.map((v) => ({ ref: v.ref, text: v.name }))]),
  ];
  const vctx = buildContext(items, ctx, ctx.input.medications.map((m) => m.dosage));
  const raw = JSON.stringify(draft);
  const res = validateDraft(raw, vctx, G, { textField: "answer", requireRefs: draft.kind === "answer", maxWords: 120 });
  if (!res.ok) {
    state.rejections.unshift({ id: newId(), patient_id: rec.patient.id, function_name: "record-assistant", language: lang, draft: raw, reason: res.reason, created_at: now() });
    save();
    return latency({ kind: "fallback", answer: ASSISTANT_FALLBACK[lang], source_refs: [], ref_map: {}, screen: "none", label: label(lang), language: lang }, 700);
  }
  return latency({ kind: draft.kind, answer: res.text, source_refs: res.source_refs,
    ref_map: Object.fromEntries(res.source_refs.map((r) => [r, ctx.refMap[r]])), screen: draft.screen, label: label(lang), language: lang }, 900);
}

export async function rejections() {
  if (me()?.role !== "admin") deny();
  return latency(state.rejections);
}

export async function dashboard(region: string | null) {
  const r = me()?.role;
  if (r !== "ministry_viewer" && r !== "admin") deny();
  const d = (snapshot.dashboards as Record<string, Record<string, unknown>>)[region ?? "ALL"];
  if (!d) deny();
  return latency({ ...d, generated_at: now() }, 300);
}
