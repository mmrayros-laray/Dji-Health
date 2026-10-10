# BUILD_PLAN.md — DjiHealth Ministry Demo

> Companion to CLAUDE.md · Ref. LARAY-DJH-PLAN-2026-EN
> Work through the modules in order. Each module ends with acceptance criteria; don't move on until they pass.
> Each module includes a **prompt to paste into Claude Code**.

**Estimated effort:** 2–4 weeks of evenings · 9 modules · each module ≈ 1–3 sessions

| # | Module | Pillar | Est. sessions |
|---|---|---|---|
| M0 | Project setup | — | 1 |
| M1 | Auth, roles, demo accounts, synthetic data | — | 2 |
| M2 | Patient medical vault | Vault | 3 |
| M3 | Emergency QR card | Emergency | 2 |
| M4 | Maternal & child health | Maternal/child | 3 |
| M5 | Clinician view + consent | Professional portal | 2 |
| M6 | AI record summary | AI | 2 |
| M7 | Ministry dashboard | Ministry | 2 |
| M8 | Polish, languages, demo script | — | 2 |

> **Status:** see `STATUS.md` for what is built and verified in this repository.

---

## Before you start (once)

1. Create accounts: **GitHub**, **Supabase** (free tier is enough), **Claude Console** (API key, for M6 only).
2. Install Node.js LTS and the Supabase CLI on your computer (or use Claude Code on the web with a GitHub repo).
3. Create an empty GitHub repo `djihealth-demo`, and put `CLAUDE.md` and `BUILD_PLAN.md` at its root.
4. Open the repo in Claude Code.

---

## M0 — Project setup

**Goal:** an empty, running Expo app connected to Supabase, with branding and i18n wired.

**Tasks**
- Expo SDK 54 + expo-router + TypeScript strict.
- Supabase project initialised locally (`supabase init`); client in `lib/supabase.ts` using env vars.
- i18next with `fr`, `so`, `ar`, `en`; RTL switching for Arabic.
- Theme file with the LARAY colours and typography from CLAUDE.md §8.
- A home screen with the "DÉMO — données fictives" banner and a language switcher.

**Acceptance criteria**
- `npx expo start` runs on web and on a phone via Expo Go.
- Switching to Arabic flips the layout to RTL.
- `npx tsc --noEmit` passes.

---

## M1 — Auth, roles, demo accounts, synthetic data

**Goal:** the full data model, security rules and believable fake data.

**Tasks**
- Migrations for every table in CLAUDE.md §4, plus `user_roles`.
- RLS policies for each role (patient = own data; clinician = consented patients; ministry_viewer = aggregate views only; admin).
- Audit-log helper (DB function) called on every record read.
- Demo sign-in screen with four one-tap demo accounts: **Amina (patient, pregnant)**, **Fatouma (patient, mother of a toddler)**, **Dr. Hassan (clinician)**, **Ministry viewer**.
- `seed.sql`: 20 synthetic patients across Djibouti-Ville, Balbala, Ali Sabieh, Tadjourah, Obock and Dikhil; realistic conditions (anaemia, diabetes, hypertension, asthma), allergies, medications, encounters, immunizations; 4 pregnancies; 6 children of various ages.
- `OPEN_QUESTIONS.md` started (e.g. "national vaccination schedule — to be validated by the Ministry").

**Acceptance criteria**
- `supabase db reset` loads everything without errors.
- Logged in as Amina, a query for another patient's data returns nothing (RLS works).
- Every seeded name is clearly invented; no real ID formats.

---

## M2 — Patient medical vault

**Goal:** the patient's core record, beautifully presented.

**Tasks**
- Vault home: profile card (photo placeholder, age, blood group) and tiles for Conditions, Allergies, Medications, Vaccinations, Visits, Documents.
- A detail screen per section, with simple add/edit for patient-reported items (marked "déclaré par le patient" vs "saisi par un professionnel").
- Document upload to Supabase Storage (images/PDF, e.g. a lab result).
- An "Accès à mon dossier" screen listing the audit log (who viewed the record and when).
- Read-only offline cache via persisted react-query.

**Acceptance criteria**
- Amina's full record displays in all four languages.
- In airplane mode, a previously opened vault still displays (read-only).
- The access history shows entries.

---

## M3 — Emergency QR card

**Goal:** the most memorable moment of the demo.

**Tasks**
- Edge Function `emergency-view` per CLAUDE.md §5 (token → minimal emergency data, logged).
- Patient screen: wallet-style card with QR, name, blood group, plus buttons to regenerate, revoke and download/print.
- Public route `emergency/[token]` showing the emergency view in large, high-contrast type, in French by default with a language toggle.
- Scan notification in the patient's access history ("Votre carte d'urgence a été consultée").

**Acceptance criteria**
- Scanning the QR with any phone camera opens the emergency view.
- A revoked token shows "Carte révoquée".
- The QR contains no medical data (verify by decoding it).

---

## M4 — Maternal & child health

**Goal:** show public-health value, which matters most to the Ministry.

**Tasks**
- Pregnancy timeline for Amina: gestational week, expected due date, antenatal visits done/upcoming (show progress toward the recommended number of visits, with the number marked "à valider").
- Visit detail (BP, weight, notes) with a simple weight chart.
- Children section for Fatouma: vaccination calendar (done / due / overdue) driven by `vaccination_schedule`, plus a growth chart (weight for age).
- Gentle in-app reminders ("Prochain vaccin dans 2 semaines"). No push notifications needed for the demo.

**Acceptance criteria**
- Overdue vaccines show clearly in red with text, not colour alone.
- Every schedule value is visibly sourced from the placeholder table and listed in OPEN_QUESTIONS.md.

---

## M5 — Clinician view + consent

**Goal:** show how a doctor uses DjiHealth with the patient's permission.

**Tasks**
- Patient side: "Partager mon dossier" generates a short-lived consent code or QR (e.g. 24 h) for a practitioner.
- Clinician side (Dr. Hassan): enter or scan the consent code, view the record (logged with a reason), and add an encounter with an observation.
- The patient sees the new encounter and the access entry immediately.
- The patient can revoke consent at any time.

**Acceptance criteria**
- Without a valid consent, the clinician cannot see the patient (RLS-enforced, not just hidden in the UI).
- The new encounter appears in the patient's vault, marked "saisi par un professionnel".

---

## M6 — AI record summary (Claude)

**Goal:** the AI feature, safe by design.

**Tasks**
- Set `ANTHROPIC_API_KEY` as a Supabase secret (`supabase secrets set`), **never** in the app.
- Edge Function `summarize-record` exactly per CLAUDE.md §7: server-side de-identification, the system prompt, model `claude-sonnet-5-5`, JSON output, the validator, the fallback, caching and rate limiting.
- Patient screen "Mon résumé": language picker, summary card with the AI label, and tappable source chips linking to the underlying record items.
- An admin-only screen listing `ai_validator_rejections`.
- Test file with 10 seeded patients × 4 languages; log pass/fail.

**Acceptance criteria**
- No name, ID, phone or exact birth date in the payload sent to Claude (log the payload in dev and check).
- A deliberately bad draft (inject one in a test) is rejected and never shown.
- Summaries display correctly in Arabic (RTL) and Somali.

---

## M7 — Ministry dashboard

**Goal:** show the Ministry what national health data could look like.

**Tasks**
- SQL views returning aggregates only (with a minimum group size of 5, to avoid re-identification).
- Dashboard: patients enrolled by region, vaccination coverage by vaccine, pregnancies by trimester, share of pregnancies with complete antenatal follow-up, top 5 chronic conditions.
- Region filter; every chart labelled "Données fictives — démonstration".
- Desktop-friendly layout (the Ministry team will view it on a laptop or projector).

**Acceptance criteria**
- The ministry_viewer role cannot query any individual record (RLS-tested).
- Groups smaller than 5 display as "< 5".

---

## M8 — Polish, languages, demo script

**Goal:** a confident, rehearsed demo.

**Tasks**
- Native-speaker review of the Somali and Arabic strings (by people you choose), then switch reviewed strings to `"_review": "human"`.
- Accessibility pass: 200 % font scale, contrast, screen reader labels.
- Deploy the web version (Expo web export to a static host such as Vercel or Netlify), and build an Android APK with EAS for a phone demo.
- Write `DEMO_SCRIPT.md`: a 7-minute walkthrough. Amina's vault → emergency card scanned by Dr. Hassan → consent and new visit → Amina's AI summary in Somali → Fatouma's child vaccination calendar → Ministry dashboard.
- A fallback recording of the demo (screen capture) in case of connectivity problems at the Ministry.

**Acceptance criteria**
- The full demo script runs end to end in under 7 minutes, twice in a row, without errors.
- OPEN_QUESTIONS.md is complete and ready to hand to the Ministry focal point.

---

## After the demo (not now)

These come only after Ministry endorsement and an agreed legal framework: sovereign hosting in Djibouti, a real FHIR R4 server (OpenHIE architecture), real facility pilots, the remaining languages (Afar, Amharic, Oromo, Tigrinya), USSD access, data-protection impact assessment, and a data-processing agreement covering any AI provider.
