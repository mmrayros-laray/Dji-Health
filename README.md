# DjiHealth — Ministry demo prototype

Mobile-first, patient-centric health record for the Republic of Djibouti — **demonstration prototype, synthetic data only**.
Expo SDK 54 (Android / iOS / web) · Supabase (Postgres + RLS, Auth, Edge Functions, Storage) · Claude API (server-side only).

Read **CLAUDE.md** (the brief and its non-negotiable rules) and **BUILD_PLAN.md** (modules M0–M8). Status: **STATUS.md**. Questions for the Ministry: **OPEN_QUESTIONS.md**. Presentation: **DEMO_SCRIPT.md**.

## What's inside

| Feature | Where |
|---|---|
| Patient vault (conditions, allergies, medicines, vaccines, visits, documents, access history), offline read-only cache | `app/(patient)/vault/` |
| Emergency QR card (opaque hashed token, revocable, printable, flagged audit) + public emergency view | `app/(patient)/emergency-card.tsx`, `app/emergency/[token].tsx`, `supabase/functions/emergency-view` |
| Maternal & child health (pregnancy timeline, ANC visits, weight chart, vaccination calendar, growth chart, reminders) | `app/(patient)/maternal/`, `app/(patient)/children/` |
| Consent sharing (24 h code/QR) + clinician view with logged reason + new encounter | `app/(patient)/share.tsx`, `app/(clinician)/` |
| AI record summary (de-identification → Claude → validator → fallback) | `app/(patient)/summary.tsx`, `supabase/functions/summarize-record` |
| **AI assistant agent** (read-only tools over the de-identified record, same validator, fixed refusal for advice) | `app/(patient)/assistant.tsx`, `supabase/functions/record-assistant` |
| Ministry dashboard (aggregates only, cells < 5 suppressed) | `app/(ministry)/dashboard.tsx`, `supabase/migrations/*_ministry.sql` |
| Admin: AI validator rejections | `app/(admin)/ai-rejections.tsx` |
| 4 languages (fr, so, ar RTL, en) + medical glossary | `locales/` |

## Run it locally

Prerequisites: Node.js LTS, Docker (for the local Supabase stack), and optionally the Expo Go app on an Android phone.

```bash
npm install
npx supabase start                      # local Postgres/Auth/Storage/Functions (Docker)
npx supabase db reset                   # applies migrations + synthetic seed
cp .env.example .env.local              # then paste the "anon key" printed by `supabase start`
```

AI features — the key is a **server secret**, never in the app or in git (CLAUDE.md §2.5):

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > supabase/functions/.env   # git-ignored, local only
npx supabase functions serve --env-file supabase/functions/.env
```

Start the app:

```bash
npx expo start          # press w for web, or scan the QR with Expo Go
```

Demo accounts (one tap on the sign-in screen; password `DjiHealth-demo-2026`):
**Amina** (pregnant patient) · **Fatouma** (mother of a toddler) · **Dr Hassan** (clinician) · **Ministère** (aggregates) · **Administrateur** (AI rejections).

To test the emergency QR from a phone, set `EXPO_PUBLIC_APP_URL` to an address the phone can reach (your computer's LAN IP, or the deployed web URL).

## Checks

```bash
npx tsc --noEmit                        # type-check
npx expo lint                           # lint
npm test                                # AI safety (de-identification, validator), calendars, i18n completeness
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db   # RLS / security checks on the running stack
npm run check:functions                 # type-check Edge Functions (needs Deno)
npm run ai:eval                         # 10 patients × 4 languages through the real Claude + validator (needs secrets, see script header)
```

`npm run test:db` with `STUB=1` and any plain Postgres URL builds a throw-away database (no Docker needed).
Set `DJH_LOG_AI_PAYLOAD=1` in `supabase/functions/.env` to print exactly what is sent to Claude.

## Deploy (demo)

Step-by-step dashboard guide (Supabase + Vercel, no command line except the functions): **DEPLOY.md**. Short version:


1. **Supabase project** (free tier): `npx supabase link --project-ref <ref>` → `npx supabase db push` → run `supabase/seed.sql` in the SQL editor (synthetic data) →
   `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` → `npx supabase functions deploy emergency-view summarize-record record-assistant`.
   In Auth settings keep sign-ups disabled (only seeded demo accounts).
2. **Web** (Vercel or Netlify): set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL` (the site URL), then build with `npx expo export --platform web` (output `dist/`). SPA rewrites are in `vercel.json` and `public/_redirects`.
3. **Android APK**: `npx eas-cli build -p android --profile preview` (needs an Expo account; set the same `EXPO_PUBLIC_*` variables as EAS environment variables).

## Non-negotiables (summary of CLAUDE.md §2)
Synthetic data only, demo banner everywhere · AI never diagnoses or advises, always labelled · AI uses record data only, enforced by a server-side validator · no identifying data sent to Claude · API key only in Supabase secrets · every record access logged · RLS on every table · no official emblems.

---
DjiHealth — prototype de démonstration · LARAY Strategic Advisory
