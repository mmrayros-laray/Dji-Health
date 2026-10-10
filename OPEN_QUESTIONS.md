# OPEN_QUESTIONS.md — DjiHealth demo

> Items that use a **clearly marked placeholder** instead of an official fact (CLAUDE.md §11).
> To hand to the Ministry of Health focal point. Each item says where the placeholder lives so it can be replaced without code changes where possible.

## A. Clinical reference values (Ministry validation required)

| # | Question | Current placeholder | Where |
|---|---|---|---|
| A1 | **National child vaccination schedule** (vaccines, doses, ages). | Indicative EPI-style calendar, every row marked *"à valider par le Ministère"* (table below). | `vaccination_schedule` table (seed). The UI reads it from the DB; no value is hard-coded. |
| A2 | Tetanus-diphtheria (Td) schedule during pregnancy. | Td 1 at 16 weeks of pregnancy, Td 2 at 20 weeks. | `vaccination_schedule` (target = `pregnancy`) |
| A3 | **Recommended number of antenatal visits** used for "progress" and "complete follow-up". | 8 visits | `program_parameters.anc_recommended_visits` |
| A4 | When is a child vaccine "overdue"? | Due date + 28 days | `program_parameters.vaccine_overdue_grace_days` |
| A5 | Definition of the Ministry indicator "complete antenatal follow-up". | Pregnancies completed in the last 24 months with ≥ A3 visits done. | `analytics.anc_followup` view |
| A6 | Definition of "vaccination coverage". | Children < 5 years who reached the dose age + 4 weeks; vaccinated / eligible. | `analytics.vaccination_coverage` view |
| A7 | Growth reference curves (weight-for-age). | Not shown — only the child's own points. Badge "Courbes de référence à ajouter après validation". | `app/(patient)/children/[id].tsx` |
| A8 | Coding systems: ICD-10 for conditions? local vaccine codes? | ICD-10 codes (D64.9, E11, I10, J45, G40, D57, A15); local short vaccine codes (BCG, PENTA, VPO…). | seed + `locales/glossary.json` |

Placeholder schedule (A1/A2):

| Vaccine | Dose | Due age |
|---|---|---|
| BCG | 1 | birth |
| Hépatite B (naissance) | 1 | birth |
| Polio oral (VPO) | 1 / 2 / 3 / 4 | birth / 6 / 10 / 14 weeks |
| Pentavalent | 1 / 2 / 3 | 6 / 10 / 14 weeks |
| Pneumocoque (PCV) | 1 / 2 / 3 | 6 / 10 / 14 weeks |
| Rotavirus | 1 / 2 | 6 / 10 weeks |
| Polio injectable (VPI) | 1 | 14 weeks |
| Rougeole-Rubéole | 1 / 2 | 39 / 78 weeks |
| Td (pregnancy) | 1 / 2 | 16 / 20 weeks of pregnancy |

## B. Emergency card

| # | Question | Current choice |
|---|---|---|
| B1 | Is the emergency data set right? CLAUDE.md §5 fixes it to: first name, age, blood group, critical allergies, critical conditions, current medications, emergency contact. **Should "pregnant" be shown?** It is clinically important in an emergency, but it is not in the approved list, so it is **not** shown. | Not shown |
| B2 | Card validity. | 12 months, revocable at any time; one active card per person. |
| B3 | Which conditions count as "critical"? | Flag `is_critical` set by a professional (seed: diabetes, epilepsy, sickle cell). |
| B4 | Emergency number to display ("appelez les secours"). | Generic wording, no number. |

## C. Consent & privacy

| # | Question | Current choice |
|---|---|---|
| C1 | Consent duration and scope. | Code valid 24 h, single use; access = full record until expiry or revocation. |
| C2 | Should clinicians keep access after the visit (e.g. follow-up)? | No — expires with the code window. |
| C3 | Minimum cell size for published aggregates. | 5 (and complements < 5 also suppressed). |
| C4 | Legal basis, data-protection impact assessment, data-processing agreement with the AI provider, data residency (sovereign hosting in Djibouti). | Out of scope for the demo; demo uses hosted Supabase + Claude API with synthetic data only. |
| C5 | Can a patient see the *name* of the clinician who viewed their record? | Yes (practitioner name shown in "Accès à mon dossier"). |

## D. Languages

| # | Question | Status |
|---|---|---|
| D1 | **Native-speaker review of Somali (`locales/so.json`) and Arabic (`locales/ar.json`)** UI strings. | All machine-drafted, flagged `"_review": "machine"`; the app shows "traduction en cours de validation". English is also machine-flagged. |
| D2 | **Medical glossary** (`locales/glossary.json`): Somali and Arabic terms for conditions, allergens, medicines and vaccines. Least certain: sickle cell (*Cudurka dhiigga ee qaab-gacan*), sulfonamides (*Daawooyinka sulfa*), pentavalent (*Shan-ku-wadaag*), PCV, hepatitis B, measles-rubella in Somali. | Machine-drafted. |
| D3 | Somali and Arabic **forbidden-advice patterns** used by the AI validator (`supabase/functions/_shared/forbidden_patterns.ts`). | Machine-drafted; native review needed so the validator catches advice phrasing reliably. |
| D4 | Free-text in records (reactions, notes, visit reasons) stays in French; only glossary terms are translated. Acceptable? | Yes for the demo. |
| D5 | Afar, Amharic, Oromo, Tigrinya — after the demo. | Structure ready: add `locales/<code>.json` + one line in `lib/i18n.ts`. |

## E. AI

| # | Question | Current choice |
|---|---|---|
| E1 | **AI assistant** ("Assistant DjiHealth") is an addition beyond the original plan: a read-only agent that answers questions *about the patient's own record* with the same validator; requests for advice get a fixed refusal. Is this in scope for the Ministry presentation? | Built, can be hidden by removing the tab. |
| E2 | Model and provider. | `claude-sonnet-5-5` via Supabase Edge Functions; no identifying data sent. |
| E3 | Summary refresh policy. | Max 1 generation per patient per language per hour (cached). |
| E4 | Who reviews validator rejections? | Admin screen "Contrôle de l'IA". |

## F. Product / data

| # | Question | Current choice |
|---|---|---|
| F1 | Regions list. | Djibouti-Ville, Balbala, Ali Sabieh, Tadjourah, Obock, Dikhil (+ Arta allowed in schema, not seeded). |
| F2 | Facility names. | Generic "(démo)" names only. |
| F3 | Synthetic statistical cohort. | ~1,650 pseudonymous rows ("Cohorte Synthétique-0001") so the dashboard shows realistic volumes. All invented. |
