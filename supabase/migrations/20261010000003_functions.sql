-- DjiHealth demo — API functions. Every record read goes through a function that writes audit_log (CLAUDE.md §2.6).

-- ---------------------------------------------------------------------------
-- Audit helper (internal: not callable by clients, so entries cannot be forged)
-- ---------------------------------------------------------------------------
create or replace function public.log_access(
  p_patient_id uuid,
  p_action     text,
  p_reason     text default null,
  p_flagged    boolean default false,
  p_details    jsonb default '{}'::jsonb,
  p_actor_role text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, patient_id, reason, flagged, details)
  values (auth.uid(),
          coalesce(p_actor_role, public.current_app_role()::text, 'system'),
          p_action, p_patient_id, p_reason, p_flagged, coalesce(p_details, '{}'::jsonb));
end $$;
revoke execute on function public.log_access(uuid, text, text, boolean, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Full record read (vault, clinician view, AI functions). Logged on every call.
-- ---------------------------------------------------------------------------
create or replace function public.get_patient_record(p_patient_id uuid default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pid  uuid := coalesce(p_patient_id, public.my_patient_id());
  v_role public.app_role := public.current_app_role();
  v_out  jsonb;
begin
  if v_pid is null or not public.can_read_patient(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if v_role = 'clinician' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required for clinician access' using errcode = '22023';
  end if;

  perform public.log_access(v_pid, 'record_view', p_reason);

  select jsonb_build_object(
    'patient', (select to_jsonb(p) - 'user_id' - 'is_cohort' from public.patients p where p.id = v_pid),
    'conditions', coalesce((select jsonb_agg(to_jsonb(c) order by c.is_critical desc, c.onset_date desc nulls last)
                            from public.conditions c where c.patient_id = v_pid), '[]'),
    'allergies', coalesce((select jsonb_agg(to_jsonb(a) order by a.criticality = 'high' desc, a.substance)
                           from public.allergies a where a.patient_id = v_pid), '[]'),
    'medications', coalesce((select jsonb_agg(to_jsonb(m) order by m.status, m.start_date desc nulls last)
                             from public.medications m where m.patient_id = v_pid), '[]'),
    'immunizations', coalesce((select jsonb_agg(to_jsonb(i) order by i.date_given desc)
                               from public.immunizations i where i.patient_id = v_pid), '[]'),
    'encounters', coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('practitioner_name', pr.name)
                                             order by e.date desc)
                            from public.encounters e left join public.practitioners pr on pr.id = e.practitioner_id
                            where e.patient_id = v_pid), '[]'),
    'observations', coalesce((select jsonb_agg(to_jsonb(o) order by o.date)
                              from public.observations o where o.patient_id = v_pid), '[]'),
    'pregnancies', coalesce((select jsonb_agg(to_jsonb(pg) || jsonb_build_object(
                                 'antenatal_visits', coalesce((select jsonb_agg(to_jsonb(v) order by v.visit_number)
                                                               from public.antenatal_visits v where v.pregnancy_id = pg.id), '[]'))
                               order by pg.lmp_date desc)
                             from public.pregnancies pg where pg.patient_id = v_pid), '[]'),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc)
                           from public.documents d where d.patient_id = v_pid), '[]'),
    'children', coalesce((select jsonb_agg(jsonb_build_object('id', cp.id, 'given_name', cp.given_name,
                                   'family_name', cp.family_name, 'birth_date', cp.birth_date, 'sex', cp.sex)
                                 order by cp.birth_date)
                          from public.children ch join public.patients cp on cp.id = ch.child_patient_id
                          where ch.guardian_patient_id = v_pid), '[]'),
    'viewer', jsonb_build_object('role', v_role, 'is_owner', public.is_record_owner(v_pid))
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.get_patient_record(uuid, text) to authenticated;

-- Who accessed my record ("Accès à mon dossier").
create or replace function public.get_access_history(p_patient_id uuid default null, p_limit int default 100)
returns table (id bigint, created_at timestamptz, action text, actor_role text, actor_name text,
               reason text, flagged boolean, is_self boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_pid uuid := coalesce(p_patient_id, public.my_patient_id());
begin
  if not public.is_record_owner(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  return query
    select a.id, a.created_at, a.action, a.actor_role,
           coalesce(pr.name, case when a.actor_role = 'patient' then pa.given_name end) as actor_name,
           a.reason, a.flagged, (a.actor_id = auth.uid()) as is_self
    from public.audit_log a
    left join public.practitioners pr on pr.user_id = a.actor_id
    left join public.patients pa on pa.user_id = a.actor_id
    where a.patient_id = v_pid
    order by a.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;
grant execute on function public.get_access_history(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Emergency QR card (CLAUDE.md §5). The QR holds only <app>/emergency/<token>.
-- ---------------------------------------------------------------------------
create or replace function public.hash_secret(p_secret text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex')
$$;

-- Creates a new card and revokes previous ones (one active card per person). Returns the token ONCE.
create or replace function public.create_emergency_token(p_patient_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pid   uuid := coalesce(p_patient_id, public.my_patient_id());
  v_token text;
  v_row   public.emergency_tokens;
begin
  if not public.is_record_owner(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  update public.emergency_tokens set revoked_at = now()
   where patient_id = v_pid and revoked_at is null;
  -- 192 bits of randomness, URL-safe
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_');
  insert into public.emergency_tokens (patient_id, token_hash)
  values (v_pid, public.hash_secret(v_token)) returning * into v_row;
  perform public.log_access(v_pid, 'emergency_card_created');
  return jsonb_build_object('token', v_token, 'id', v_row.id, 'expires_at', v_row.expires_at);
end $$;
grant execute on function public.create_emergency_token(uuid) to authenticated;

create or replace function public.revoke_emergency_tokens(p_patient_id uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := coalesce(p_patient_id, public.my_patient_id());
  v_n   int;
begin
  if not public.is_record_owner(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  update public.emergency_tokens set revoked_at = now()
   where patient_id = v_pid and revoked_at is null;
  get diagnostics v_n = row_count;
  perform public.log_access(v_pid, 'emergency_card_revoked');
  return v_n;
end $$;
grant execute on function public.revoke_emergency_tokens(uuid) to authenticated;

-- Called ONLY by the emergency-view Edge Function (service role). Returns the minimal emergency data set.
create or replace function public.emergency_lookup(p_token text, p_details jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tok public.emergency_tokens;
  v_p   public.patients;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 100 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_tok from public.emergency_tokens where token_hash = public.hash_secret(p_token);
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_tok.revoked_at is not null or v_tok.expires_at <= now() then
    perform public.log_access(v_tok.patient_id, 'emergency_access_denied', null, true,
      p_details || jsonb_build_object('token_id', v_tok.id,
                                      'why', case when v_tok.revoked_at is not null then 'revoked' else 'expired' end),
      'emergency_scan');
    return jsonb_build_object('status', case when v_tok.revoked_at is not null then 'revoked' else 'expired' end);
  end if;

  select * into v_p from public.patients where id = v_tok.patient_id;
  perform public.log_access(v_p.id, 'emergency_access', null, true,
    p_details || jsonb_build_object('token_id', v_tok.id), 'emergency_scan');

  return jsonb_build_object(
    'status', 'ok',
    'data', jsonb_build_object(
      'first_name', v_p.given_name,
      'age_years', date_part('year', age(current_date, v_p.birth_date))::int,
      'blood_group', v_p.blood_group,
      'critical_allergies', coalesce((select jsonb_agg(jsonb_build_object('substance', a.substance, 'reaction', a.reaction))
                                      from public.allergies a where a.patient_id = v_p.id and a.criticality = 'high'), '[]'),
      'critical_conditions', coalesce((select jsonb_agg(jsonb_build_object('display', c.display))
                                       from public.conditions c
                                       where c.patient_id = v_p.id and c.is_critical and c.clinical_status = 'active'), '[]'),
      'current_medications', coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'dosage', m.dosage_text))
                                       from public.medications m where m.patient_id = v_p.id and m.status = 'active'), '[]'),
      'emergency_contact', jsonb_build_object('name', v_p.emergency_contact_name, 'phone', v_p.emergency_contact_phone)
    )
  );
end $$;
revoke execute on function public.emergency_lookup(text, jsonb) from public, anon, authenticated;
grant execute on function public.emergency_lookup(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Consent (M5). Patient creates a short code; a clinician claims it with a reason.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_consent_code(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.create_consent_code(p_hours int default 24, p_patient_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pid      uuid := coalesce(p_patient_id, public.my_patient_id());
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- no 0/O/1/I/L
  v_code     text := '';
  v_bytes    bytea := extensions.gen_random_bytes(8);
  v_row      public.consents;
begin
  if not public.is_record_owner(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  insert into public.consents (patient_id, code_hash, expires_at)
  values (v_pid, public.hash_secret(v_code), now() + make_interval(hours => least(greatest(p_hours, 1), 72)))
  returning * into v_row;
  perform public.log_access(v_pid, 'consent_code_created', null, false,
                            jsonb_build_object('consent_id', v_row.id, 'hours', p_hours));
  return jsonb_build_object('consent_id', v_row.id,
                            'code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4),
                            'expires_at', v_row.expires_at);
end $$;
grant execute on function public.create_consent_code(int, uuid) to authenticated;

create or replace function public.claim_consent_code(p_code text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prac uuid := public.my_practitioner_id();
  v_row  public.consents;
  v_fail int;
begin
  if v_prac is null then
    raise exception 'clinician role required' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select count(*) into v_fail from public.audit_log
   where actor_id = auth.uid() and action = 'consent_claim_failed' and created_at > now() - interval '10 minutes';
  if v_fail >= 10 then
    raise exception 'too many attempts, try again later' using errcode = '54000';
  end if;

  select * into v_row from public.consents
   where code_hash = public.hash_secret(public.normalize_consent_code(p_code))
     and practitioner_id is null and revoked_at is null and expires_at > now()
   for update;
  if not found then
    perform public.log_access(null, 'consent_claim_failed', p_reason);
    raise exception 'invalid or expired code' using errcode = 'P0002';
  end if;

  update public.consents set practitioner_id = v_prac, granted_at = now(), code_hash = null
   where id = v_row.id;
  perform public.log_access(v_row.patient_id, 'consent_granted', p_reason, false,
                            jsonb_build_object('consent_id', v_row.id));
  return jsonb_build_object('consent_id', v_row.id, 'patient_id', v_row.patient_id, 'expires_at', v_row.expires_at);
end $$;
grant execute on function public.claim_consent_code(text, text) to authenticated;

create or replace function public.revoke_consent(p_consent_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.consents;
begin
  select * into v_row from public.consents where id = p_consent_id;
  if not found or not public.is_record_owner(v_row.patient_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  update public.consents set revoked_at = now(), code_hash = null where id = p_consent_id and revoked_at is null;
  perform public.log_access(v_row.patient_id, 'consent_revoked', null, false,
                            jsonb_build_object('consent_id', p_consent_id));
end $$;
grant execute on function public.revoke_consent(uuid) to authenticated;

-- Consents as seen by the patient (with practitioner names).
create or replace function public.my_consents(p_patient_id uuid default null)
returns table (id uuid, practitioner_name text, practitioner_facility text, granted_at timestamptz,
               expires_at timestamptz, revoked_at timestamptz, created_at timestamptz, status text)
language plpgsql stable security definer set search_path = public as $$
declare v_pid uuid := coalesce(p_patient_id, public.my_patient_id());
begin
  if not public.is_record_owner(v_pid) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  return query
    select c.id, pr.name, pr.facility, c.granted_at, c.expires_at, c.revoked_at, c.created_at,
           case when c.revoked_at is not null then 'revoked'
                when c.expires_at <= now() then 'expired'
                when c.granted_at is null then 'pending'
                else 'active' end
    from public.consents c left join public.practitioners pr on pr.id = c.practitioner_id
    where c.patient_id = v_pid
    order by c.created_at desc
    limit 50;
end $$;
grant execute on function public.my_consents(uuid) to authenticated;

-- Patients the clinician can currently see.
create or replace function public.clinician_patients()
returns table (consent_id uuid, patient_id uuid, given_name text, family_name text, birth_date date,
               sex text, region text, granted_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, p.id, p.given_name, p.family_name, p.birth_date, p.sex, p.region, c.granted_at, c.expires_at
  from public.consents c join public.patients p on p.id = c.patient_id
  where c.practitioner_id = public.my_practitioner_id()
    and c.granted_at is not null and c.revoked_at is null and c.expires_at > now()
  order by c.granted_at desc
$$;
grant execute on function public.clinician_patients() to authenticated;

-- Clinician adds an encounter + observations atomically. Consent is re-checked here.
create or replace function public.add_encounter(
  p_patient_id   uuid,
  p_reason       text,
  p_notes        text default null,
  p_observations jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_prac uuid := public.my_practitioner_id();
  v_fac  text;
  v_enc  uuid;
  v_obs  jsonb;
begin
  if v_prac is null or not public.has_active_consent(p_patient_id) then
    raise exception 'access denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason is required' using errcode = '22023';
  end if;
  select facility into v_fac from public.practitioners where id = v_prac;
  insert into public.encounters (patient_id, facility, practitioner_id, date, reason, notes, source, recorded_by)
  values (p_patient_id, v_fac, v_prac, now(), p_reason, p_notes, 'professional', auth.uid())
  returning id into v_enc;

  for v_obs in select * from jsonb_array_elements(coalesce(p_observations, '[]'::jsonb)) loop
    insert into public.observations (patient_id, encounter_id, type, value, value_text, unit, date, source, recorded_by)
    values (p_patient_id, v_enc, v_obs->>'type', nullif(v_obs->>'value', '')::numeric,
            nullif(v_obs->>'value_text', ''), v_obs->>'unit', current_date, 'professional', auth.uid());
  end loop;

  perform public.log_access(p_patient_id, 'encounter_added', p_reason, false, jsonb_build_object('encounter_id', v_enc));
  return v_enc;
end $$;
grant execute on function public.add_encounter(uuid, text, text, jsonb) to authenticated;

-- Admin: AI validator rejections (RLS also restricts the table to admins).
create or replace function public.admin_ai_rejections(p_limit int default 100)
returns setof public.ai_validator_rejections
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'access denied' using errcode = '42501';
  end if;
  return query select * from public.ai_validator_rejections order by created_at desc limit least(p_limit, 500);
end $$;
grant execute on function public.admin_ai_rejections(int) to authenticated;

-- Internal helpers are not part of the client API.
revoke execute on function public.hash_secret(text) from public, anon, authenticated;
