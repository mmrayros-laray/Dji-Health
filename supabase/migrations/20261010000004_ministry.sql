-- DjiHealth demo — Ministry dashboard (M7). Aggregates ONLY, with small-cell suppression (< 5).
-- The views live in a private schema that is not exposed through the API; the only entry point is
-- public.ministry_dashboard(), which checks the caller's role and suppresses small groups.

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

create or replace view analytics.child_population as
  select p.id, p.region, p.birth_date,
         ((current_date - p.birth_date) / 7)::int as age_weeks
  from public.patients p
  join public.children c on c.child_patient_id = p.id
  where p.birth_date > current_date - interval '5 years';

create or replace view analytics.vaccination_coverage as
  select cp.region, s.vaccine_code, s.vaccine_name, s.dose_number, s.due_age_weeks,
         count(*)::int as eligible,
         count(*) filter (where exists (
           select 1 from public.immunizations i
           where i.patient_id = cp.id and i.vaccine_code = s.vaccine_code
             and coalesce(i.dose_number, 1) = s.dose_number))::int as vaccinated
  from analytics.child_population cp
  -- eligible once the dose is due + 4 weeks of grace
  join public.vaccination_schedule s on s.target = 'child' and cp.age_weeks >= s.due_age_weeks + 4
  group by cp.region, s.vaccine_code, s.vaccine_name, s.dose_number, s.due_age_weeks;

create or replace view analytics.active_pregnancies as
  select p.region,
         case when (current_date - pg.lmp_date) / 7 < 14 then 1
              when (current_date - pg.lmp_date) / 7 < 28 then 2
              else 3 end as trimester
  from public.pregnancies pg join public.patients p on p.id = pg.patient_id
  where pg.status = 'active';

create or replace view analytics.anc_followup as
  select p.region, pg.id,
         (select count(*) from public.antenatal_visits v where v.pregnancy_id = pg.id and v.status = 'done')::int as visits_done
  from public.pregnancies pg join public.patients p on p.id = pg.patient_id
  where pg.status = 'completed' and pg.edd_date > current_date - interval '24 months';

create or replace view analytics.active_conditions as
  select p.region, c.code, c.display
  from public.conditions c join public.patients p on p.id = c.patient_id
  where c.clinical_status = 'active';

revoke all on all tables in schema analytics from public, anon, authenticated;

-- A cell is reported only if it (and its complement, when given) is 0 or >= 5.
create or replace function analytics.reportable(n int, complement int default null)
returns boolean language sql immutable as $$
  select (n = 0 or n >= 5) and (complement is null or complement = 0 or complement >= 5)
$$;

create or replace function public.ministry_dashboard(p_region text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, analytics as $$
declare
  v_min int := 5;
  v_recommended int := (select value::int from public.program_parameters where key = 'anc_recommended_visits');
  v_out jsonb;
begin
  if coalesce(public.current_app_role()::text, '') not in ('ministry_viewer', 'admin') then
    raise exception 'access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'region', p_region,
    'min_cell_size', v_min,
    'synthetic', true,
    'regions', (select jsonb_agg(r order by r) from (select distinct region as r from public.patients) x),

    'total_enrolled', (select case when analytics.reportable(n) then n end
                       from (select count(*)::int n from public.patients
                             where p_region is null or region = p_region) t),

    'enrolled_by_region', coalesce((
      select jsonb_agg(jsonb_build_object(
               'region', region,
               'count', case when analytics.reportable(n) then n end,
               'suppressed', not analytics.reportable(n)) order by n desc)
      from (select region, count(*)::int n from public.patients
            where p_region is null or region = p_region group by region) t), '[]'),

    'vaccination_coverage', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vaccine_code', vaccine_code, 'vaccine_name', vaccine_name, 'dose_number', dose_number,
               'eligible', case when analytics.reportable(e) then e end,
               'vaccinated', case when analytics.reportable(v, e - v) and analytics.reportable(e) then v end,
               'coverage_pct', case when analytics.reportable(v, e - v) and analytics.reportable(e) and e > 0
                                    then round(100.0 * v / e, 1) end,
               'suppressed', not (analytics.reportable(v, e - v) and analytics.reportable(e)))
             order by due_age_weeks, vaccine_code, dose_number)
      from (select vaccine_code, vaccine_name, dose_number, due_age_weeks,
                   sum(eligible)::int e, sum(vaccinated)::int v
            from analytics.vaccination_coverage
            where p_region is null or region = p_region
            group by vaccine_code, vaccine_name, dose_number, due_age_weeks) t), '[]'),

    'pregnancies_by_trimester', (
      select jsonb_agg(jsonb_build_object(
               'trimester', tr,
               'count', case when analytics.reportable(n) then n end,
               'suppressed', not analytics.reportable(n)) order by tr)
      from (select tr, (select count(*)::int from analytics.active_pregnancies ap
                        where ap.trimester = tr and (p_region is null or ap.region = p_region)) n
            from generate_series(1, 3) tr) t),

    'anc_completion', (
      select jsonb_build_object(
               'recommended_visits', v_recommended,
               'recommended_visits_status', 'à valider par le Ministère',
               'eligible', case when analytics.reportable(e) then e end,
               'complete', case when analytics.reportable(c, e - c) and analytics.reportable(e) then c end,
               'pct', case when analytics.reportable(c, e - c) and analytics.reportable(e) and e > 0
                           then round(100.0 * c / e, 1) end,
               'suppressed', not (analytics.reportable(c, e - c) and analytics.reportable(e)))
      from (select count(*)::int e, count(*) filter (where visits_done >= v_recommended)::int c
            from analytics.anc_followup where p_region is null or region = p_region) t),

    'top_conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', code, 'display', display,
               'count', case when analytics.reportable(n) then n end,
               'suppressed', not analytics.reportable(n)) order by n desc)
      from (select code, min(display) display, count(*)::int n from analytics.active_conditions
            where p_region is null or region = p_region
            group by code order by count(*) desc limit 5) t), '[]')
  ) into v_out;

  insert into public.audit_log (actor_id, actor_role, action, details)
  values (auth.uid(), public.current_app_role()::text, 'ministry_dashboard_view',
          jsonb_build_object('region', p_region));
  return v_out;
end $$;
grant execute on function public.ministry_dashboard(text) to authenticated;
