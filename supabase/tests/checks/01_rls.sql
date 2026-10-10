-- DjiHealth — RLS and security checks (M1, M3, M5, M7 acceptance criteria).
-- Each block impersonates a demo account the same way PostgREST does (role + JWT claims).
-- Any failed ASSERT aborts the run (psql ON_ERROR_STOP).
--   uid 01 Amina (patient, pid 01)      uid 02 Fatouma (patient, pid 02, children 101/102)
--   uid 03 Dr Hassan (clinician)        uid 04 Ministry viewer          uid 05 admin
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function public._test_login(p_user int) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-a000-' || lpad(p_user::text, 12, '0'), 'role', 'authenticated')::text, true);
$$;
grant execute on function public._test_login(int) to authenticated;

-- ---------------------------------------------------------------- Amina ----
begin;
set local role authenticated;
select public._test_login(1);
do $$
declare v jsonb; n int; ok boolean;
begin
  assert (select count(*) from public.patients) = 1, 'Amina must see exactly one patient (herself)';
  assert (select count(*) from public.conditions where patient_id <> '10000000-0000-4000-a000-000000000001') = 0,
    'Amina must not see other patients'' conditions';
  assert (select count(*) from public.medications) = 1, 'Amina sees only her own medication';
  assert (select count(*) from public.audit_log where patient_id <> '10000000-0000-4000-a000-000000000001') = 0,
    'Amina must not see other patients'' audit entries';
  assert (select count(*) from public.ai_validator_rejections) = 0, 'patients cannot read AI rejections';

  -- another patient's record via the API function
  begin
    perform public.get_patient_record('10000000-0000-4000-a000-000000000003');
    raise exception 'Amina could read patient 03';
  exception when insufficient_privilege then null;
  end;

  -- her own record works and is logged
  n := (select count(*) from public.audit_log where action = 'record_view');
  v := public.get_patient_record();
  assert v->'patient'->>'given_name' = 'Amina', 'own record readable';
  assert jsonb_array_length(v->'pregnancies') = 1, 'pregnancy present';
  assert (select count(*) from public.audit_log where action = 'record_view') = n + 1, 'record read is audited';

  -- writes
  begin
    insert into public.conditions (patient_id, display) values ('10000000-0000-4000-a000-000000000003', 'X');
    raise exception 'Amina could write into patient 03';
  exception when insufficient_privilege then null;
  end;
  insert into public.conditions (patient_id, display) values ('10000000-0000-4000-a000-000000000001', 'Migraine');
  assert (select source from public.conditions where display = 'Migraine') = 'patient', 'patient-reported source stamped';
  update public.conditions set display = 'Hacked' where source = 'professional';
  get diagnostics n = row_count;
  assert n = 0, 'patient cannot edit professional entries';

  begin
    insert into public.audit_log (actor_role, action) values ('patient', 'forged');
    raise exception 'audit log is writable by clients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.log_access('10000000-0000-4000-a000-000000000003', 'forged');
    raise exception 'log_access callable by clients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.emergency_lookup('x');
    raise exception 'emergency_lookup callable by clients';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ministry_dashboard();
    raise exception 'patient could read the ministry dashboard';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.patients set given_name = 'X' where id = '10000000-0000-4000-a000-000000000001';
    raise exception 'patient could rename themself';
  exception when insufficient_privilege then null;
  end;
  update public.patients set preferred_language = 'ar' where id = '10000000-0000-4000-a000-000000000003';
  get diagnostics n = row_count;
  assert n = 0, 'patient cannot update another profile';
end $$;
rollback;
\echo '  ✓ patient isolation (Amina)'

-- -------------------------------------------------------------- Fatouma ----
begin;
set local role authenticated;
select public._test_login(2);
do $$ begin
  assert (select count(*) from public.patients) = 3, 'Fatouma sees herself + her 2 children';
  assert (select count(*) from public.immunizations where patient_id = '10000000-0000-4000-a000-000000000101') > 5,
    'Fatouma sees her child''s vaccinations';
  assert (select count(*) from public.patients where id = '10000000-0000-4000-a000-000000000103') = 0,
    'Fatouma cannot see another family''s child';
  assert public.get_patient_record('10000000-0000-4000-a000-000000000101')->'patient'->>'given_name' = 'Ilyas',
    'guardian reads child record';
end $$;
rollback;
\echo '  ✓ guardian access (Fatouma)'

-- ------------------------------------------- Clinician without / with consent ----
begin;
set local role authenticated;
select public._test_login(3);
do $$ begin
  assert (select count(*) from public.patients) = 0, 'clinician sees no patient without consent';
  assert (select count(*) from public.conditions) = 0, 'clinician sees no condition without consent';
  assert (select count(*) from public.clinician_patients()) = 0, 'no consented patients yet';
  begin
    perform public.get_patient_record('10000000-0000-4000-a000-000000000001', 'curiosité');
    raise exception 'clinician read a record without consent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_encounter('10000000-0000-4000-a000-000000000001', 'test');
    raise exception 'clinician wrote without consent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_consent_code('AAAA-BBBB', 'urgence');
    raise exception 'bogus consent code accepted';
  exception when no_data_found then null;
  end;
end $$;

-- Amina creates a consent code (switch identity inside the same transaction)
select public._test_login(1);
select set_config('test.code', (public.create_consent_code(24))->>'code', true);

select public._test_login(3);
do $$
declare v jsonb; enc uuid;
begin
  begin
    perform public.claim_consent_code(current_setting('test.code'), '');
    raise exception 'consent claimed without a reason';
  exception when invalid_parameter_value then null;
  end;
  v := public.claim_consent_code(current_setting('test.code'), 'Consultation prénatale');
  assert v->>'patient_id' = '10000000-0000-4000-a000-000000000001', 'consent links to Amina';
  assert (select count(*) from public.patients) = 1, 'clinician now sees exactly one patient';
  begin
    perform public.get_patient_record('10000000-0000-4000-a000-000000000001');
    raise exception 'clinician read without a reason';
  exception when invalid_parameter_value then null;
  end;
  assert public.get_patient_record('10000000-0000-4000-a000-000000000001', 'Consultation prénatale')
           ->'patient'->>'given_name' = 'Amina', 'consented read works';
  assert (select count(*) from public.patients where id = '10000000-0000-4000-a000-000000000002') = 0,
    'consent for Amina does not open Fatouma';
  enc := public.add_encounter('10000000-0000-4000-a000-000000000001', 'Consultation prénatale', 'RAS',
           '[{"type":"weight","value":"62.4","unit":"kg"},{"type":"blood_pressure","value_text":"110/70","unit":"mmHg"}]');
  assert (select source from public.encounters where id = enc) = 'professional', 'encounter marked professional';
  assert (select count(*) from public.observations where encounter_id = enc) = 2, 'observations saved';
  -- a code can only be claimed once
  begin
    perform public.claim_consent_code(current_setting('test.code'), 'again');
    raise exception 'consent code reused';
  exception when no_data_found then null;
  end;
end $$;

-- Amina sees the new encounter + the access entries, then revokes
select public._test_login(1);
do $$ begin
  assert exists (select 1 from public.encounters where reason = 'Consultation prénatale' and source = 'professional'
                 and date > now() - interval '1 minute'), 'patient sees the new encounter immediately';
  assert exists (select 1 from public.get_access_history() where action = 'record_view' and actor_role = 'clinician'
                 and reason = 'Consultation prénatale'), 'access history shows the clinician read with reason';
  perform public.revoke_consent((select id from public.my_consents() where status = 'active' limit 1));
end $$;

select public._test_login(3);
do $$ begin
  assert (select count(*) from public.patients) = 0, 'revoked consent closes access immediately';
end $$;
rollback;
\echo '  ✓ consent: RLS-enforced, reason required, single use, revocable (Dr Hassan)'

-- ------------------------------------------------------------ Ministry ----
begin;
set local role authenticated;
select public._test_login(4);
do $$
declare v jsonb; bad int;
begin
  assert (select count(*) from public.patients) = 0, 'ministry sees no individual patient';
  assert (select count(*) from public.conditions) = 0, 'ministry sees no individual condition';
  assert (select count(*) from public.immunizations) = 0, 'ministry sees no individual immunization';
  assert (select count(*) from public.pregnancies) = 0, 'ministry sees no individual pregnancy';
  begin
    perform public.get_patient_record('10000000-0000-4000-a000-000000000001', 'stats');
    raise exception 'ministry read an individual record';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from analytics.child_population limit 1;
    raise exception 'ministry can query analytics views directly';
  exception when insufficient_privilege then null;
  end;

  v := public.ministry_dashboard();
  assert (v->>'total_enrolled')::int > 1000, 'dashboard has volume';
  -- no published count between 1 and 4 anywhere in the payload
  select count(*) into bad
  from jsonb_path_query(v, 'strict $.**.count') c where c::text ~ '^\d+$' and c::text::int between 1 and 4;
  assert bad = 0, 'small cells must be suppressed';
  select count(*) into bad
  from jsonb_path_query(v, 'strict $.vaccination_coverage[*].vaccinated') c where c::text ~ '^\d+$' and c::text::int between 1 and 4;
  assert bad = 0, 'small vaccinated cells must be suppressed';

  v := public.ministry_dashboard('Obock');
  assert jsonb_array_length(v->'enrolled_by_region') = 1, 'region filter';
end $$;
rollback;
\echo '  ✓ ministry: aggregates only, small-cell suppression'

-- ----------------------------------------------------------------- Admin ----
begin;
set local role authenticated;
select public._test_login(5);
do $$ begin
  assert (select count(*) from public.patients) = 0, 'admin sees no clinical rows';
  perform public.admin_ai_rejections();
end $$;
rollback;
\echo '  ✓ admin: rejections only, no clinical rows'

-- ------------------------------------------------------------------ Anon ----
begin;
set local role anon;
do $$ begin
  begin
    perform 1 from public.patients limit 1;
    raise exception 'anon can read patients';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
\echo '  ✓ anon: no table access'

-- ------------------------------------------------- Emergency QR card (M3) ----
begin;
set local role authenticated;
select public._test_login(1);
select set_config('test.token', (public.create_emergency_token())->>'token', true);
do $$ begin
  assert length(current_setting('test.token')) >= 32, 'opaque token';
  assert not exists (select 1 from public.emergency_tokens where token_hash = current_setting('test.token')),
    'token is stored hashed';
end $$;
reset role;
set local role service_role;
do $$
declare v jsonb;
begin
  v := public.emergency_lookup(current_setting('test.token'), '{"ua":"test"}');
  assert v->>'status' = 'ok', 'token resolves';
  assert (select array_agg(k order by k) from jsonb_object_keys(v->'data') k)
       = array['age_years','blood_group','critical_allergies','critical_conditions','current_medications',
               'emergency_contact','first_name'], 'emergency view returns only the minimal data set';
  assert v->'data'->>'first_name' = 'Amina' and not (v->'data' ? 'family_name'), 'first name only';
  assert exists (select 1 from public.audit_log where action = 'emergency_access' and flagged
                 and patient_id = '10000000-0000-4000-a000-000000000001'), 'scan is logged and flagged';
  assert public.emergency_lookup('not-a-real-token-but-long-enough-xx')->>'status' = 'not_found', 'unknown token';
end $$;
reset role;
set local role authenticated;
select public._test_login(1);
select public.revoke_emergency_tokens();
reset role;
set local role service_role;
do $$ begin
  assert public.emergency_lookup(current_setting('test.token'))->>'status' = 'revoked', 'revoked card';
end $$;
rollback;
\echo '  ✓ emergency card: hashed token, minimal data, flagged audit, revocation'

drop function public._test_login(int);
