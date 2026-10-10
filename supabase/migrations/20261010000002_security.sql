-- DjiHealth demo — Row Level Security. CLAUDE.md §2.7.
--   patient         : own record + records of children they are guardian of
--   clinician       : only patients with an active, unexpired, unrevoked consent
--   ministry_viewer : NO individual rows at all — aggregates via ministry_* functions only
--   admin           : AI validator rejections + audit log; no clinical rows

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create or replace function public.my_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.patients where user_id = auth.uid()
$$;

create or replace function public.my_practitioner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.practitioners p
  join public.user_roles r on r.user_id = p.user_id and r.role = 'clinician'
  where p.user_id = auth.uid()
$$;

create or replace function public.is_guardian_of(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.children c
    where c.child_patient_id = p_patient_id and c.guardian_patient_id = public.my_patient_id()
  )
$$;

-- Patient (or guardian) acting on their own record.
create or replace function public.is_record_owner(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_patient_id is not null
     and public.current_app_role() = 'patient'
     and (p_patient_id = public.my_patient_id() or public.is_guardian_of(p_patient_id))
$$;

create or replace function public.has_active_consent(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consents c
    where c.patient_id = p_patient_id
      and c.practitioner_id = public.my_practitioner_id()
      and c.granted_at is not null
      and c.revoked_at is null
      and c.expires_at > now()
  )
$$;

create or replace function public.can_read_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_record_owner(p_patient_id) or public.has_active_consent(p_patient_id)
$$;

create or replace function public.pregnancy_patient(p_pregnancy_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select patient_id from public.pregnancies where id = p_pregnancy_id
$$;

-- ---------------------------------------------------------------------------
-- Stamp source / recorded_by on clinical inserts based on the caller's role.
-- Seed and service-role writes (auth.uid() is null) keep the values they provide.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_record_source()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public.current_app_role();
begin
  if auth.uid() is null then
    return new;
  end if;
  new.recorded_by := auth.uid();
  if v_role = 'clinician' then
    new.source := 'professional';
    if tg_table_name = 'encounters' then
      new.practitioner_id := public.my_practitioner_id();
    end if;
  else
    new.source := 'patient';
  end if;
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['conditions','allergies','medications','immunizations','encounters',
                           'observations','pregnancies','documents'] loop
    execute format('create trigger stamp_source before insert on public.%I
                    for each row execute function public.stamp_record_source()', t);
  end loop;
  foreach t in array array['conditions','allergies','medications','immunizations','encounters'] loop
    execute format('create trigger touch_updated before update on public.%I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['user_roles','practitioners','patients','children','conditions','allergies',
                           'medications','immunizations','encounters','observations','pregnancies',
                           'antenatal_visits','documents','vaccination_schedule','program_parameters',
                           'consents','emergency_tokens','audit_log','ai_summaries','ai_validator_rejections'] loop
    execute format('alter table public.%I enable row level security', t);
    -- The public QR route never talks to tables directly; it goes through the emergency-view Edge Function.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- user_roles: read own role only. Writes only by migrations/seed/service role.
create policy "own role" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

-- practitioners: directory visible to signed-in patients and clinicians (names appear in access history).
create policy "practitioner directory" on public.practitioners for select to authenticated
  using (public.current_app_role() in ('patient', 'clinician', 'admin'));

-- patients
create policy "read accessible patients" on public.patients for select to authenticated
  using (public.can_read_patient(id));
create policy "patient updates own profile" on public.patients for update to authenticated
  using (id = public.my_patient_id() and public.current_app_role() = 'patient')
  with check (id = public.my_patient_id());
-- Only a few profile columns are patient-editable.
revoke update on public.patients from authenticated;
grant update (preferred_language, emergency_contact_name, emergency_contact_phone, blood_group)
  on public.patients to authenticated;

-- children
create policy "guardian or consented clinician" on public.children for select to authenticated
  using (guardian_patient_id = public.my_patient_id() or public.can_read_patient(child_patient_id));

-- Clinical tables: same shape of policy for each.
do $$
declare t text;
begin
  foreach t in array array['conditions','allergies','medications','immunizations','encounters',
                           'observations','pregnancies','documents'] loop
    execute format($f$
      create policy "read if accessible" on public.%1$I for select to authenticated
        using (public.can_read_patient(patient_id));
      create policy "patient adds own items" on public.%1$I for insert to authenticated
        with check (public.is_record_owner(patient_id) and source = 'patient');
      create policy "consented clinician adds items" on public.%1$I for insert to authenticated
        with check (public.has_active_consent(patient_id) and source = 'professional');
      create policy "patient edits own reported items" on public.%1$I for update to authenticated
        using (public.is_record_owner(patient_id) and source = 'patient')
        with check (public.is_record_owner(patient_id) and source = 'patient');
      create policy "patient deletes own reported items" on public.%1$I for delete to authenticated
        using (public.is_record_owner(patient_id) and source = 'patient');
    $f$, t);
  end loop;
end $$;

-- antenatal visits (via pregnancy)
create policy "read if accessible" on public.antenatal_visits for select to authenticated
  using (public.can_read_patient(public.pregnancy_patient(pregnancy_id)));
create policy "consented clinician adds visits" on public.antenatal_visits for insert to authenticated
  with check (public.has_active_consent(public.pregnancy_patient(pregnancy_id)));

-- reference data: readable by any signed-in user
create policy "read schedule" on public.vaccination_schedule for select to authenticated using (true);
create policy "read parameters" on public.program_parameters for select to authenticated using (true);

-- consents
create policy "patient sees own consents" on public.consents for select to authenticated
  using (public.is_record_owner(patient_id));
create policy "clinician sees consents granted to them" on public.consents for select to authenticated
  using (practitioner_id is not null and practitioner_id = public.my_practitioner_id());
-- Creation, claiming and revocation go through functions (they also write the audit log).

-- emergency tokens: owner may list their cards (hash only). Creation/revocation through functions.
create policy "owner sees own tokens" on public.emergency_tokens for select to authenticated
  using (public.is_record_owner(patient_id));

-- audit log: append-only through SECURITY DEFINER functions.
create policy "patient sees access to own record" on public.audit_log for select to authenticated
  using (public.is_record_owner(patient_id));
create policy "actor sees own actions" on public.audit_log for select to authenticated
  using (actor_id = auth.uid());
create policy "admin sees audit log" on public.audit_log for select to authenticated
  using (public.current_app_role() = 'admin');
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- AI
create policy "owner reads summaries" on public.ai_summaries for select to authenticated
  using (public.is_record_owner(patient_id));
revoke insert, update, delete on public.ai_summaries from authenticated;

create policy "admin reads rejections" on public.ai_validator_rejections for select to authenticated
  using (public.current_app_role() = 'admin');
revoke insert, update, delete on public.ai_validator_rejections from authenticated;

-- Helper functions are callable by signed-in users (they only ever answer about the caller).
revoke execute on function public.stamp_record_source() from public, anon, authenticated;
