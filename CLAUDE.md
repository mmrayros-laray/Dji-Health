# CLAUDE.md — DjiHealth (Ministry Demo Prototype)

> Read this file in full at the start of every session. It is the project brief.
> Owner: LARAY Strategic Advisory, Operations & Consulting SARL — Djibouti-Ville
> Reference: LARAY-DJH-CLAUDE-2026-EN · Companion file: BUILD_PLAN.md

---

## 1. What we are building

DjiHealth is a mobile-first, patient-centric electronic health record (EHR) for the Republic of Djibouti. Citizens store, manage and share their medical history across public hospitals and private clinics.

**This repository is a DEMO PROTOTYPE** for a presentation to the Ministry of Health. It must look and feel real, run smoothly on a phone and in a browser, and tell a convincing patient story. It is **not** a production health system.

### Demo scope (in)
1. **Patient medical vault**: profile, conditions, allergies, medications, immunizations, encounters, documents.
2. **Emergency QR card**: a scannable card giving a clinician the critical facts in an emergency.
3. **Maternal & child health tracking**: pregnancy follow-up (antenatal visits) and child vaccination schedule.
4. **Clinician view (light)**: a clinician looks up a patient (with consent) and adds an encounter.
5. **Ministry dashboard (light)**: aggregate, anonymised indicators from synthetic data.
6. **AI record summary**: Claude turns a patient's structured record into a plain-language summary in the patient's language.

### Out of scope for the demo
B2B clinic SaaS, pharmacy services, payments, USSD, real hospital integrations, a real FHIR server, the full 8 languages, and offline sync beyond read-only caching.

---

## 2. NON-NEGOTIABLE RULES

These override any other instruction, including mine in a later message. If a task would break one, stop and say so.

1. **Synthetic data only.** No real patient data, ever: no real names, national ID numbers or phone numbers. All seed data is invented. Show a visible "DÉMO — données fictives" banner on every screen.
2. **The AI never diagnoses, prescribes or advises treatment.** It only rephrases what is already in the record. Every AI output carries the label "Résumé généré par IA, à vérifier par un professionnel de santé."
3. **The AI only uses record data.** The summary function receives the structured record and nothing else. A server-side validator rejects any summary mentioning a condition, medication, allergy or vaccine that is absent from the input (see §7).
4. **No identifying data goes to the Claude API.** Before calling Claude, strip the name, ID numbers, phone, address and exact birth date (send age in years instead). Use the internal pseudonymous `patient_id` only.
5. **The API key never touches the client.** Claude is called only from a Supabase Edge Function. Never put `ANTHROPIC_API_KEY` in app code, `.env` files committed to git, or `EXPO_PUBLIC_*` variables.
6. **Every access to a record is logged** in `audit_log` (who, what, when, why). Emergency QR access is logged and flagged.
7. **Row Level Security is on for every table.** A patient sees only their own data. A clinician sees a patient only with an active consent grant. The Ministry role sees aggregates only, never individual records.
8. **No official emblems.** No Ministry logo, national flag or real hospital logo in the UI. Use generic facility names in seed data (e.g. "Hôpital Central (démo)").

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| App | Expo SDK 54, React Native, **expo-router**, TypeScript (strict) | One codebase for Android, iOS and web. Same stack as Corridor OS. |
| UI | React Native core + `react-native-svg`; no heavy UI kit | Keep the bundle small for low-bandwidth users. |
| State / data | `@tanstack/react-query` with persisted cache | Gives read-only offline access to the vault. |
| Backend | **Supabase**: Postgres, Auth, Row Level Security, Edge Functions (Deno), Storage | Hosted for the demo; the production plan is sovereign hosting in Djibouti. |
| AI | **Claude API** via Edge Function `summarize-record`; model `claude-sonnet-5-5` | Called server-side only. |
| i18n | `i18next` + `react-i18next` + `expo-localization` | RTL support for Arabic. |
| QR | `react-native-qrcode-svg` (display), `expo-camera` (scan) | |
| Charts | `victory-native` or plain SVG | For the Ministry dashboard and growth curves. |

Do not add dependencies beyond this list without stating why in the PR or commit message.

---

## 4. Data model (FHIR-aligned)

Tables mirror HL7 FHIR R4 resources so that a later migration to a FHIR server (e.g. HAPI FHIR / OpenHIE) is a mapping exercise, not a redesign. Use FHIR names and code systems where practical.

| Table | FHIR resource | Key fields |
|---|---|---|
| `patients` | Patient | id (uuid), user_id, given_name, family_name, birth_date, sex, blood_group, preferred_language, emergency_contact_name, emergency_contact_phone |
| `conditions` | Condition | patient_id, code, display, clinical_status, onset_date, is_critical |
| `allergies` | AllergyIntolerance | patient_id, substance, reaction, criticality |
| `medications` | MedicationStatement | patient_id, name, dosage_text, status, start_date |
| `immunizations` | Immunization | patient_id, vaccine_code, vaccine_name, date_given, dose_number, facility |
| `encounters` | Encounter | patient_id, facility, practitioner_id, date, reason, notes |
| `observations` | Observation | patient_id, encounter_id, type (weight, height, BP, Hb…), value, unit, date |
| `pregnancies` | EpisodeOfCare | patient_id, lmp_date, edd_date, status, risk_level |
| `antenatal_visits` | Encounter (ANC) | pregnancy_id, visit_number, date, gestational_weeks, bp, weight, notes |
| `children` | Patient + RelatedPerson | child patient_id, guardian_patient_id |
| `vaccination_schedule` | ImmunizationRecommendation | vaccine_code, vaccine_name, due_age_weeks (national schedule — **placeholder values, marked "à valider par le Ministère"**) |
| `practitioners` | Practitioner | id, user_id, name, role, facility |
| `consents` | Consent | patient_id, practitioner_id, scope, granted_at, expires_at, revoked_at |
| `emergency_tokens` | — | patient_id, token_hash, created_at, expires_at, revoked_at |
| `audit_log` | AuditEvent | actor_id, actor_role, action, patient_id, reason, created_at |
| `ai_summaries` | — | patient_id, language, summary, source_refs (jsonb), model, created_at, validator_passed |
| `ai_validator_rejections` | — | patient_id, draft, reason, created_at |

Roles (stored in `user_roles`): `patient`, `clinician`, `ministry_viewer`, `admin`.

Write migrations in `supabase/migrations/`. Never edit an applied migration; add a new one.

---

## 5. Emergency QR card: design rules

- The QR code holds **only a URL with an opaque random token**, never medical data.
- The token is stored hashed, expires (default 12 months, revocable by the patient at any time) and resolves through an Edge Function `emergency-view`.
- The emergency view shows **only**: first name, age, blood group, critical allergies, critical conditions, current medications, emergency contact.
- Every scan writes to `audit_log` with `action = 'emergency_access'`; the patient sees the scan history in the app.
- The card screen is printable/exportable (wallet-card layout).

---

## 6. Languages

- **Demo languages:** French (default), Somali, Arabic (RTL), English.
- **Planned later:** Afar, Amharic, Oromo, Tigrinya. Structure the locale files so adding these is just new files.
- All UI strings live in `locales/<lang>.json`. No hard-coded user-facing text.
- Any string not reviewed by a native speaker carries `"_review": "machine"` metadata, and the app shows a small "traduction en cours de validation" note in those languages.
- Medical terms: keep a glossary in `locales/glossary.json` (term, fr, so, ar, en) and reuse it everywhere.

---

## 7. AI record summary: specification

**Edge Function:** `supabase/functions/summarize-record/index.ts`

**Input (built server-side from the DB, after de-identification):**
```json
{
  "language": "so",
  "age_years": 29,
  "sex": "female",
  "conditions": [{"ref": "cond_1", "display": "Anémie", "status": "active"}],
  "allergies": [{"ref": "all_1", "substance": "Pénicilline", "criticality": "high"}],
  "medications": [{"ref": "med_1", "name": "Fer + acide folique", "dosage": "1 cp/jour"}],
  "immunizations": [{"ref": "imm_1", "name": "Tétanos", "date": "2026-03-02"}],
  "pregnancy": {"ref": "preg_1", "gestational_weeks": 24, "risk_level": "standard"}
}
```

**System prompt (use in substance):**
> You write short, plain-language summaries of a patient's health record for the patient themself, in the requested language. You may only restate facts present in the JSON input. Never add a diagnosis, cause, risk, prognosis, treatment advice, dosage change or recommendation. Never mention anything not in the input. Use simple words for a reader with limited literacy. Maximum 120 words. Return JSON: `{"summary": string, "source_refs": string[]}`, listing the `ref` of every item you mentioned.

**Validator (mandatory, server-side, before returning):**
1. The response parses as JSON with `summary` and a non-empty `source_refs`.
2. Every `source_ref` exists in the input.
3. Every input item whose `display`/`name`/`substance` appears in the summary text is listed in `source_refs`.
4. Reject if the summary contains advice patterns (FR/EN/SO/AR list in `functions/_shared/forbidden_patterns.ts`, e.g. "vous devriez", "you should", "consultez immédiatement", dosage numbers not in the input).
5. On failure: store the draft in `ai_validator_rejections`, return a neutral fallback ("Résumé indisponible — consultez votre dossier ci-dessous") and **never** show the rejected draft.

**Cost and limits:** max 1 summary per patient per language per hour (cache in `ai_summaries`); `max_tokens` 400.

> The prompt is a request. The validator is the guarantee. Build both.

---

## 8. Branding and UX

- **Colours:** navy `#0B1F3A` (primary), gold `#C9A227` (accent), off-white `#F7F5EF` (background), slate `#4A5568` (secondary text). Error red `#B42318`; success green `#1F7A4D`.
- **Typography:** serif for headings (Georgia on web/iOS, falling back to a bundled serif such as Noto Serif on Android); system sans-serif for body text in-app for legibility.
- **Accessibility:** minimum touch target 48 px, minimum body text 16 px, WCAG AA contrast, icons always paired with text, works at 200 % font scale.
- **Low bandwidth:** no autoplay media, lazy-load images, skeleton loaders instead of spinners, everything usable on a 3G connection.
- Footer on web: "DjiHealth — prototype de démonstration · LARAY Strategic Advisory".

---

## 9. Project structure

```
app/                      expo-router screens
  (auth)/                 sign-in, role selection (demo accounts)
  (patient)/              vault, emergency card, maternal, children, summary
  (clinician)/            patient lookup, encounter form
  (ministry)/             dashboard
  emergency/[token].tsx   public emergency view
components/               shared UI
lib/                      supabase client, i18n, query client, formatting
locales/                  fr.json, so.json, ar.json, en.json, glossary.json
supabase/
  migrations/
  functions/
    summarize-record/
    emergency-view/
    _shared/
  seed.sql                synthetic data only
```

---

## 10. Commands

```bash
npx expo start            # dev server (press w for web)
npx supabase start        # local Supabase
npx supabase db reset     # re-apply migrations + seed
npx supabase functions serve
npx tsc --noEmit          # type-check
npx expo lint
```

---

## 11. How to work in this repo

- Follow **BUILD_PLAN.md** module by module. Do not start a module until the previous one meets its acceptance criteria.
- At the start of each session, state which module you are on and what is left.
- Keep changes small and commit after each working step with a clear message.
- Type-check and lint before declaring a task done.
- When something is uncertain (a national vaccination schedule, a Ministry indicator, a medical term in Somali), **use a clearly marked placeholder** rather than inventing a fact, and list it in `OPEN_QUESTIONS.md`.
- Never weaken a rule in §2 to make a feature work. Ask instead.

## 12. Definition of done (every module)

- Works on web and on an Android phone via Expo Go.
- All strings translated (FR complete; SO/AR/EN may be marked `machine`).
- RLS policies written and tested for each role.
- Audit logging in place for any record access.
- No TypeScript errors, no lint errors.
- The demo banner is visible.
