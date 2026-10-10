# DEPLOY.md — deploy the DjiHealth demo from the dashboards

About 20 minutes, mostly in the browser. You need accounts on **Supabase** (free tier), **Vercel** (Hobby tier), and a **Claude Console** API key for the AI features.

The web app is only the front end. It needs a Supabase project (database, logins, server functions) behind it, so do **Part 1 before Part 2**.

---

## Part 1 — Supabase (the backend)

### 1.1 Create the project
1. Go to https://supabase.com/dashboard → **New project**.
2. Name: `djihealth-demo`. Set a strong database password and store it in a password manager.
3. Region: the closest available to Djibouti (e.g. *Frankfurt* or *Paris*). The demo uses synthetic data only; sovereign hosting comes after the demo.
4. Click **Create new project** and wait about 2 minutes until it's ready.

### 1.2 Create the database (tables, security rules, functions)
1. Left menu → **SQL Editor** → **New query**.
2. Open the repository on GitHub and copy the files below **one at a time, in this order**. Paste each one, click **Run**, and wait for "Success" before moving on:
   1. `supabase/migrations/20261010000001_schema.sql`
   2. `supabase/migrations/20261010000002_security.sql`
   3. `supabase/migrations/20261010000003_functions.sql`
   4. `supabase/migrations/20261010000004_ministry.sql`
   5. `supabase/migrations/20261010000005_storage.sql`
3. Then run `supabase/seed.sql` (synthetic data: the 5 demo logins, 26 patients and the statistical cohort). It takes a few seconds.
4. Check: **Table Editor → patients** shows about 1,680 rows, and **Authentication → Users** shows 5 `@demo.djihealth.test` users.

> If a file fails, do not run the next one: copy the error message and fix it first. Re-running a file that already succeeded gives "already exists" errors. To start over cleanly, create a fresh project.

### 1.3 Lock down sign-ups
1. **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up". Only the seeded demo accounts can log in.
2. Leave the Email provider **enabled** (the demo accounts use email + password).

### 1.4 Copy the public keys (needed for Vercel)
**Project Settings → API** (or **Data API**):
- **Project URL**, e.g. `https://abcdefghijkl.supabase.co`
- **anon / public** key (a long `eyJ…` string, or `sb_publishable_…`)

Never copy the **service_role** / secret key into Vercel or the app.

### 1.5 Deploy the server functions (emergency QR page, AI summary, AI assistant)
These three functions can't be pasted into the dashboard easily (they share code), so use the Supabase command line once, from your computer:

```bash
git clone https://github.com/mmrayros-laray/Dji-Health.git
cd Dji-Health
npx supabase login                                   # opens the browser
npx supabase link --project-ref abcdefghijkl         # the ID in your Project URL
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # your Claude key, stored server-side only
npx supabase functions deploy emergency-view summarize-record record-assistant
```

Check: **Edge Functions** in the dashboard lists the 3 functions, and **Edge Functions → Secrets** lists `ANTHROPIC_API_KEY`.
`emergency-view` must stay public (no login needed when a responder scans the QR); the `supabase/config.toml` in the repo already sets this.

---

## Part 2 — Vercel (the web app)

### 2.1 Import the repository
1. Go to https://vercel.com/new.
2. Under **Import Git Repository**, connect GitHub if asked and pick **mmrayros-laray/Dji-Health** → **Import**.
   *Not listed?* Click **Adjust GitHub App Permissions** and give Vercel access to the repository.

### 2.2 Build settings
On the "Configure Project" screen:

| Setting | Value |
|---|---|
| Project Name | `dji-health` (this becomes `dji-health.vercel.app`) |
| Framework Preset | **Other** |
| Root Directory | `./` |
| Build Command | `npx expo export --platform web` (already set by `vercel.json`) |
| Output Directory | `dist` (already set by `vercel.json`) |
| Install Command | leave default (`npm install`) |

### 2.3 Environment variables
Open **Environment Variables** on the same screen and add:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | the Project URL from step 1.4 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the anon / public key from step 1.4 |
| `EXPO_PUBLIC_APP_URL` | `https://dji-health.vercel.app` (your project name + `.vercel.app`) |

These values are public by design (they end up in the web page). **Do not add `ANTHROPIC_API_KEY` or the service_role key here.**

### 2.4 Deploy
1. Click **Deploy** and wait 2–4 minutes.
2. Open the URL Vercel shows. If it differs from the `EXPO_PUBLIC_APP_URL` you entered: **Settings → Environment Variables** → correct it → **Deployments** → **⋯** on the latest one → **Redeploy**.
   `EXPO_PUBLIC_*` values are baked in at build time, so **every change needs a redeploy**.

### 2.5 Tell Supabase about the web address
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://dji-health.vercel.app`
- **Redirect URLs**: add `https://dji-health.vercel.app/**`

---

## Part 3 — Check the deployment (5 minutes)

On a phone and on a laptop, open `https://dji-health.vercel.app`:

- [ ] Gold banner **"DÉMO — données fictives"** at the top; switching to **العربية** flips the layout.
- [ ] **Commencer la démo → Amina** opens her record (name, O+, tiles).
- [ ] **Urgence → Créer ma carte**, then scan the QR **with another phone's camera**: the emergency page opens without a login.
- [ ] **Dossier → Voir mon résumé** shows a summary with the label *"Résumé généré par IA…"*. If it shows *"Résumé indisponible"*, check the `ANTHROPIC_API_KEY` secret (step 1.5) and **Edge Functions → summarize-record → Logs**.
- [ ] **Partager → Créer un code**, then in another browser sign in as **Dr Hassan**, enter the code and add a visit.
- [ ] Sign in as **Ministère**: the dashboard shows the charts, and the *Obock* filter shows "< 5" cells.

If all boxes are ticked, run through `DEMO_SCRIPT.md` twice.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Orange "Configuration manquante" notice | `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` missing or misspelled in Vercel → fix and **Redeploy**. |
| "Connexion impossible" on a demo account | `seed.sql` not run, or run before the migrations. Check **Authentication → Users**. |
| Page refresh on `/vault` gives a Vercel 404 | `vercel.json` missing from the deployed commit (it contains the rewrite to `index.html`). |
| QR opens `localhost` | `EXPO_PUBLIC_APP_URL` wrong → fix → **Redeploy**, then create a **new** card (old QR codes keep the old address). |
| Emergency page says "Carte introuvable" for a new card | `emergency-view` function not deployed (step 1.5). |
| AI summary / assistant always unavailable | `ANTHROPIC_API_KEY` secret missing or invalid; see the function logs. Expected for a few seconds after deploying. |
| Build fails on Vercel | Open the build log. Check Node.js 20+ (**Settings → General → Node.js Version**) and that **Framework Preset** is *Other*. |

## Resetting the demo data before a presentation
The cleanest way is a fresh project (Part 1). Otherwise, in **SQL Editor**, this removes everything added during rehearsals and keeps the seeded data (everything created after the seed ran):

```sql
do $$
declare seeded_at timestamptz := (select max(created_at) from public.patients) + interval '1 minute';
begin
  delete from public.audit_log;
  delete from public.ai_summaries;
  delete from public.ai_validator_rejections;
  delete from public.consents;
  delete from public.emergency_tokens;
  delete from public.observations  where created_at > seeded_at;
  delete from public.encounters    where created_at > seeded_at;
  delete from public.conditions    where created_at > seeded_at;
  delete from public.allergies     where created_at > seeded_at;
  delete from public.medications   where created_at > seeded_at;
  delete from public.immunizations where created_at > seeded_at;
  delete from public.documents     where created_at > seeded_at;
end $$;
```

Uploaded files stay in **Storage → documents**; delete them there if needed. Patients should also sign out on their devices: the emergency card is remembered per device.

---
DjiHealth — prototype de démonstration · LARAY Strategic Advisory
