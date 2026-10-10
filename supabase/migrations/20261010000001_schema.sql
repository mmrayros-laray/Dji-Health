-- DjiHealth demo — core schema (FHIR-aligned). CLAUDE.md §4.
-- SYNTHETIC DATA ONLY. Every patient row carries is_synthetic = true (enforced by a CHECK).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('patient', 'clinician', 'ministry_viewer', 'admin');
-- Who entered a clinical item: shown in the UI as "déclaré par le patient" / "saisi par un professionnel".
create type public.record_source as enum ('patient', 'professional');

-- ---------------------------------------------------------------------------
-- Identity & roles
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now()
);

-- FHIR Practitioner
create table public.practitioners (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  role       text not null,                 -- e.g. 'Médecin généraliste', 'Sage-femme'
  facility   text not null,
  created_at timestamptz not null default now()
);

-- FHIR Patient. Children are patients too (user_id null, linked through public.children).
create table public.patients (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid unique references auth.users (id) on delete set null,
  given_name              text not null,
  family_name             text not null,
  birth_date              date not null,
  sex                     text not null check (sex in ('female', 'male', 'other', 'unknown')),
  blood_group             text not null default 'unknown'
                            check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  preferred_language      text not null default 'fr' check (preferred_language in ('fr', 'so', 'ar', 'en')),
  region                  text not null check (region in
                            ('Djibouti-Ville','Balbala','Ali Sabieh','Tadjourah','Obock','Dikhil','Arta')),
  emergency_contact_name  text,
  emergency_contact_phone text,
  -- Synthetic statistical cohort used only to give the Ministry dashboard realistic volumes.
  is_cohort               boolean not null default false,
  is_synthetic            boolean not null default true check (is_synthetic),
  created_at              timestamptz not null default now()
);
create index on public.patients (region);

-- Patient + RelatedPerson
create table public.children (
  child_patient_id    uuid not null references public.patients (id) on delete cascade,
  guardian_patient_id uuid not null references public.patients (id) on delete cascade,
  relationship        text not null default 'mother',
  primary key (child_patient_id, guardian_patient_id),
  check (child_patient_id <> guardian_patient_id)
);
create index on public.children (guardian_patient_id);

-- ---------------------------------------------------------------------------
-- Clinical resources
-- ---------------------------------------------------------------------------
create table public.conditions (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  code            text,                                  -- ICD-10
  display         text not null,
  clinical_status text not null default 'active' check (clinical_status in ('active', 'inactive', 'resolved')),
  onset_date      date,
  is_critical     boolean not null default false,
  source          public.record_source not null default 'patient',
  recorded_by     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.conditions (patient_id);

create table public.allergies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  substance   text not null,
  reaction    text,
  criticality text not null default 'low' check (criticality in ('low', 'high', 'unable-to-assess')),
  source      public.record_source not null default 'patient',
  recorded_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.allergies (patient_id);

create table public.medications (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  name        text not null,
  dosage_text text,
  status      text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  start_date  date,
  source      public.record_source not null default 'patient',
  recorded_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.medications (patient_id);

create table public.immunizations (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  vaccine_code text not null,
  vaccine_name text not null,
  date_given   date not null,
  dose_number  int,
  facility     text,
  source       public.record_source not null default 'patient',
  recorded_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.immunizations (patient_id);

create table public.encounters (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  facility        text not null,
  practitioner_id uuid references public.practitioners (id) on delete set null,
  date            timestamptz not null default now(),
  reason          text not null,
  notes           text,
  source          public.record_source not null default 'professional',
  recorded_by     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.encounters (patient_id, date desc);

create table public.observations (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  encounter_id uuid references public.encounters (id) on delete cascade,
  type         text not null check (type in
                 ('weight','height','blood_pressure','hemoglobin','glucose','temperature','muac')),
  value        numeric,          -- numeric observations
  value_text   text,             -- e.g. blood pressure '118/76'
  unit         text,
  date         date not null default current_date,
  source       public.record_source not null default 'professional',
  recorded_by  uuid,
  created_at   timestamptz not null default now(),
  check (value is not null or value_text is not null)
);
create index on public.observations (patient_id, type, date);

-- FHIR EpisodeOfCare (pregnancy follow-up)
create table public.pregnancies (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  lmp_date    date not null,
  edd_date    date not null,
  status      text not null default 'active' check (status in ('active', 'completed', 'ended')),
  risk_level  text not null default 'standard' check (risk_level in ('standard', 'high')),
  source      public.record_source not null default 'professional',
  recorded_by uuid,
  created_at  timestamptz not null default now()
);
create index on public.pregnancies (patient_id);

-- Encounter (ANC). status 'planned' = upcoming appointment.
create table public.antenatal_visits (
  id                uuid primary key default gen_random_uuid(),
  pregnancy_id      uuid not null references public.pregnancies (id) on delete cascade,
  visit_number      int not null,
  date              date not null,
  status            text not null default 'done' check (status in ('done', 'planned')),
  gestational_weeks int,
  bp                text,
  weight_kg         numeric(5, 1),
  notes             text,
  facility          text,
  created_at        timestamptz not null default now(),
  unique (pregnancy_id, visit_number)
);

-- FHIR DocumentReference (files live in Storage bucket 'documents', path '<patient_id>/<uuid>-<name>')
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  title        text not null,
  kind         text not null default 'other' check (kind in ('lab_result','prescription','imaging','report','other')),
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  source       public.record_source not null default 'patient',
  recorded_by  uuid,
  created_at   timestamptz not null default now()
);
create index on public.documents (patient_id);

-- ---------------------------------------------------------------------------
-- Reference data — PLACEHOLDERS to be validated by the Ministry (see OPEN_QUESTIONS.md)
-- ---------------------------------------------------------------------------
-- FHIR ImmunizationRecommendation
create table public.vaccination_schedule (
  id                uuid primary key default gen_random_uuid(),
  vaccine_code      text not null,
  vaccine_name      text not null,
  dose_number       int not null default 1,
  due_age_weeks     int not null,
  target            text not null default 'child' check (target in ('child', 'pregnancy')),
  validation_status text not null default 'à valider par le Ministère',
  source_note       text not null default 'Valeur indicative de démonstration — non officielle',
  unique (vaccine_code, dose_number, target)
);

create table public.program_parameters (
  key               text primary key,
  value             numeric not null,
  unit              text,
  validation_status text not null default 'à valider par le Ministère',
  source_note       text not null default 'Valeur indicative de démonstration — non officielle'
);

-- ---------------------------------------------------------------------------
-- Consent, emergency access, audit
-- ---------------------------------------------------------------------------
-- FHIR Consent. A patient creates a short code (stored hashed); a clinician claims it.
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  practitioner_id uuid references public.practitioners (id) on delete cascade,
  scope           text not null default 'full_record',
  code_hash       text unique,
  granted_at      timestamptz,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.consents (practitioner_id) where revoked_at is null;
create index on public.consents (patient_id);

create table public.emergency_tokens (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  revoked_at timestamptz
);
create index on public.emergency_tokens (patient_id);

-- FHIR AuditEvent. Append-only: no client can insert/update/delete directly.
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,                 -- null for anonymous emergency scans
  actor_role text not null,        -- patient | clinician | ministry_viewer | admin | emergency_scan | system
  action     text not null,        -- record_view | emergency_access | consent_granted | ...
  patient_id uuid references public.patients (id) on delete cascade,
  reason     text,
  flagged    boolean not null default false,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (patient_id, created_at desc);
create index on public.audit_log (actor_id, action, created_at desc);

-- ---------------------------------------------------------------------------
-- AI
-- ---------------------------------------------------------------------------
create table public.ai_summaries (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  language         text not null check (language in ('fr', 'so', 'ar', 'en')),
  summary          text not null,
  source_refs      jsonb not null default '[]'::jsonb,
  -- ref -> {section, id} so the app can link chips to record items without exposing ids to the model
  ref_map          jsonb not null default '{}'::jsonb,
  model            text not null,
  validator_passed boolean not null,
  created_at       timestamptz not null default now()
);
create index on public.ai_summaries (patient_id, language, created_at desc);

create table public.ai_validator_rejections (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients (id) on delete cascade,
  function_name text not null default 'summarize-record',
  language      text,
  draft         text not null,
  reason        text not null,
  created_at    timestamptz not null default now()
);
create index on public.ai_validator_rejections (created_at desc);
