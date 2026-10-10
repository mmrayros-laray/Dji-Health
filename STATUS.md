# STATUS.md — build status (2026-10-10)

All nine modules are implemented. What was **verified** in the build environment is listed explicitly, as is what could not be.

## How it was verified
The cloud build environment had no Docker, so instead of `supabase start` the stack was assembled from the real components:
**Postgres 16 + Supabase Auth (GoTrue v2.180) + PostgREST v12 + the three Edge Functions under Deno 2 + a gateway mimicking Supabase's URL layout**, with a **mock Claude API** (no API key was available). The web build was then driven in Chromium with Playwright.

- `npm test` — 20/20 (de-identification, validator rejects invented facts / advice / wrong doses in fr-so-ar-en, calendars, i18n completeness, glossary sync)
- `npm run test:db` — all RLS/security checks pass on a stub DB **and** on the GoTrue-backed DB
- API end-to-end (whole demo story through the real Auth/PostgREST/Functions): 21/21 on a fresh database
- Browser end-to-end (phone + laptop viewports): 16/16 checks — screenshots reviewed
- `npx tsc --noEmit`, `npx expo lint`, Deno type-check of all Edge Functions, `expo export --platform web`: clean

## Module by module

| Module | Status | Acceptance criteria — evidence |
|---|---|---|
| M0 Setup | ✅ | Web build runs; Arabic flips the document to RTL (browser test); tsc clean. *Not run here: Expo Go on a physical phone.* |
| M1 Data, RLS, seed | ✅ | Migrations + seed load on real GoTrue schema; Amina querying another patient → empty (SQL + PostgREST); 20 invented adults + 6 children + 4 pregnancies, no ID numbers, `+253 00 00 …` phones, `is_synthetic` CHECK. Plus a pseudonymous ~1,650-row cohort for the dashboard. |
| M2 Vault | ✅ | Full record in 4 languages (glossary-translated terms); patient-reported vs professional badges; add/edit/delete own items; access history; **offline**: API blocked → cached vault renders with "Hors ligne" notice. Document upload code path written (Storage policies) — *not exercised here (no Storage server in the sandbox).* |
| M3 Emergency QR | ✅ | QR decoded in test = bare URL + 32-char token, no medical data; anonymous view shows only the §5 fields; revoked → "Carte révoquée"; scans logged + flagged and shown to the patient. *Not tested: scanning with a physical phone camera.* |
| M4 Maternal & child | ✅ | Timeline, ANC progress vs placeholder target, visit detail + weight chart, child calendar (done/due/overdue/upcoming with icon + text), growth chart, reminders; all schedule values from DB tables, listed in OPEN_QUESTIONS.md. |
| M5 Consent | ✅ | No consent → DB refuses (RLS + RPC checks); code single-use, 24 h, revocable; reason mandatory and logged; new encounter visible to the patient as "Saisi par un professionnel". QR scan of the code uses expo-camera — *camera not tested here.* |
| M6 AI summary | ✅ (mock) | Pipeline verified end to end against a mock Claude: payload log contains no names/IDs/phones/regions/birth dates; injected bad draft rejected, stored in `ai_validator_rejections`, never shown; cache = 1/patient/language/hour; Somali & Arabic render. **Needs your API key** to run `npm run ai:eval` (10 patients × 4 languages, real model). |
| AI assistant (addition) | ✅ (mock) | Tool-use agent loop verified with mock; advice question → fixed refusal; user-typed name/phone scrubbed before sending. |
| M7 Dashboard | ✅ | ministry_viewer gets 0 individual rows (tested); cells < 5 → "< 5" (tested, Obock filter); every chart labelled "Données fictives — démonstration"; laptop layout. |
| M8 Polish | 🟡 partial | Done: a11y basics (48 px targets, ≥ 16 px text, labels, icon+text, table view for charts), deploy config (Vercel/Netlify/EAS), DEMO_SCRIPT.md, OPEN_QUESTIONS.md. **Needs you:** native-speaker review of Somali/Arabic, a 200 % font-scale pass on a device, EAS APK build (Expo account), web deployment, two timed rehearsals, the fallback screen recording. |

## Known limitations / notes
- Claude calls disable extended thinking (`thinking: {type: "between_tools"}`) to fit the 400-token budget; the server-side refusal `fallbacks` option is not enabled because it conflicts with that setting — a refusal simply yields the neutral fallback.
- On web, `expo-camera`'s QR scanner loads its decoder from a CDN; it works online. Patients don't need it (only Dr Hassan's "Scanner le QR").
- The emergency card's plain token is stored only on the device that created it (the DB keeps a hash). On a new device the patient creates a new card (the old one is revoked).
- The original BUILD_PLAN.md per-module "Prompt for Claude Code" blocks were omitted from the copy in this repo.
