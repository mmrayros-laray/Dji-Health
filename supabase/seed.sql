-- =============================================================================
-- DjiHealth demo — SYNTHETIC SEED DATA ONLY (CLAUDE.md §2.1)
-- Every person, phone number and facility below is invented.
--   * No national ID numbers are stored anywhere.
--   * Phone numbers use the unallocated "+253 00 00 .." pattern.
--   * Facility names carry "(démo)".
-- Dates are relative to current_date so the demo story stays fresh.
-- Schedule / programme values are PLACEHOLDERS "à valider par le Ministère" (OPEN_QUESTIONS.md).
-- =============================================================================

create or replace function pg_temp.pid(n int) returns uuid language sql immutable as
  $$ select ('10000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as
  $$ select ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.prac(n int) returns uuid language sql immutable as
  $$ select ('20000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;

-- -----------------------------------------------------------------------------
-- Demo login accounts (password shared by all demo accounts: DjiHealth-demo-2026)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', pg_temp.uid(n), 'authenticated', 'authenticated', email,
       extensions.crypt('DjiHealth-demo-2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('demo_label', label),
       now(), now(), '', '', '', ''
from (values
  (1, 'amina@demo.djihealth.test',    'Amina — patiente enceinte'),
  (2, 'fatouma@demo.djihealth.test',  'Fatouma — mère d''un jeune enfant'),
  (3, 'dr.hassan@demo.djihealth.test','Dr Hassan — médecin'),
  (4, 'ministere@demo.djihealth.test','Lecteur Ministère'),
  (5, 'admin@demo.djihealth.test',    'Administrateur démo')
) as u(n, email, label);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@demo.djihealth.test';

insert into public.user_roles (user_id, role) values
  (pg_temp.uid(1), 'patient'),
  (pg_temp.uid(2), 'patient'),
  (pg_temp.uid(3), 'clinician'),
  (pg_temp.uid(4), 'ministry_viewer'),
  (pg_temp.uid(5), 'admin');

-- -----------------------------------------------------------------------------
-- Practitioners (only Dr Hassan has a login)
-- -----------------------------------------------------------------------------
insert into public.practitioners (id, user_id, name, role, facility) values
  (pg_temp.prac(1), pg_temp.uid(3), 'Dr Hassan Abdillahi (démo)', 'Médecin généraliste', 'Hôpital Central (démo)'),
  (pg_temp.prac(2), null, 'Hodan Warsama, sage-femme (démo)', 'Sage-femme', 'Centre de santé de Balbala (démo)'),
  (pg_temp.prac(3), null, 'Dr Nima Osman (démo)', 'Pédiatre', 'Hôpital Central (démo)'),
  (pg_temp.prac(4), null, 'Dr Robleh Ainan (démo)', 'Médecin', 'Centre médical d''Ali Sabieh (démo)'),
  (pg_temp.prac(5), null, 'Infirmier Kamil Daoud (démo)', 'Infirmier', 'Centre de santé de Tadjourah (démo)');

-- -----------------------------------------------------------------------------
-- Reference data — PLACEHOLDERS, NOT the official national schedule
-- -----------------------------------------------------------------------------
insert into public.vaccination_schedule (vaccine_code, vaccine_name, dose_number, due_age_weeks, target) values
  ('BCG',   'BCG',                         1,  0, 'child'),
  ('HEPB',  'Hépatite B (naissance)',      1,  0, 'child'),
  ('VPO',   'Polio oral (VPO)',            1,  0, 'child'),
  ('PENTA', 'Pentavalent',                 1,  6, 'child'),
  ('VPO',   'Polio oral (VPO)',            2,  6, 'child'),
  ('PCV',   'Pneumocoque (PCV)',           1,  6, 'child'),
  ('ROTA',  'Rotavirus',                   1,  6, 'child'),
  ('PENTA', 'Pentavalent',                 2, 10, 'child'),
  ('VPO',   'Polio oral (VPO)',            3, 10, 'child'),
  ('PCV',   'Pneumocoque (PCV)',           2, 10, 'child'),
  ('ROTA',  'Rotavirus',                   2, 10, 'child'),
  ('PENTA', 'Pentavalent',                 3, 14, 'child'),
  ('VPO',   'Polio oral (VPO)',            4, 14, 'child'),
  ('PCV',   'Pneumocoque (PCV)',           3, 14, 'child'),
  ('VPI',   'Polio injectable (VPI)',      1, 14, 'child'),
  ('RR',    'Rougeole-Rubéole',            1, 39, 'child'),
  ('RR',    'Rougeole-Rubéole',            2, 78, 'child'),
  ('TD',    'Tétanos-diphtérie (Td)',      1, 16, 'pregnancy'),
  ('TD',    'Tétanos-diphtérie (Td)',      2, 20, 'pregnancy');

insert into public.program_parameters (key, value, unit) values
  ('anc_recommended_visits', 8, 'visites'),
  ('min_cell_size', 5, 'personnes');

-- -----------------------------------------------------------------------------
-- 20 detailed synthetic adults
-- -----------------------------------------------------------------------------
insert into public.patients (id, user_id, given_name, family_name, birth_date, sex, blood_group, preferred_language,
                             region, emergency_contact_name, emergency_contact_phone)
select pg_temp.pid(n), u, g, f, (current_date - make_interval(years => y, days => d))::date, s, b, l, r, cn,
       '+253 00 00 ' || lpad((10 + n)::text, 2, '0') || ' ' || lpad((20 + n)::text, 2, '0')
from (values
  ( 1, pg_temp.uid(1), 'Amina',       'Robleh Kassim',     29,  40, 'female', 'O+',  'so', 'Balbala',        'Ayan Robleh (sœur)'),
  ( 2, pg_temp.uid(2), 'Fatouma',     'Guedi Abdi',        32, 120, 'female', 'A+',  'fr', 'Djibouti-Ville', 'Abdi Guedi (mari)'),
  ( 3, null,           'Moussa',      'Ali Daoud',         58,  10, 'male',   'B+',  'fr', 'Djibouti-Ville', 'Safia Ali (épouse)'),
  ( 4, null,           'Halima',      'Youssouf Omar',     45, 200, 'female', 'A-',  'so', 'Ali Sabieh',     'Omar Youssouf (frère)'),
  ( 5, null,           'Abdourahman', 'Said Elmi',         23,  75, 'male',   'O+',  'ar', 'Tadjourah',      'Said Elmi (père)'),
  ( 6, null,           'Kadra',       'Bouh Hassan',       27, 310, 'female', 'B+',  'fr', 'Obock',          'Hassan Bouh (mari)'),
  ( 7, null,           'Ibrahim',     'Mahamoud Ahmed',    64,  15, 'male',   'AB+', 'so', 'Dikhil',         'Ahmed Mahamoud (fils)'),
  ( 8, null,           'Saada',       'Ismail Houssein',   35, 160, 'female', 'O-',  'so', 'Balbala',        'Houssein Ismail (mari)'),
  ( 9, null,           'Omar',        'Djama Farah',       40,  90, 'male',   'A+',  'fr', 'Djibouti-Ville', 'Hawa Djama (épouse)'),
  (10, null,           'Hibo',        'Aden Waberi',       22, 230, 'female', 'O+',  'so', 'Tadjourah',      'Aden Waberi (père)'),
  (11, null,           'Ali',         'Barkad Nour',       51,  55, 'male',   'B-',  'fr', 'Ali Sabieh',     'Nour Barkad (fils)'),
  (12, null,           'Zahra',       'Mohamed Assoweh',   30, 140, 'female', 'A+',  'ar', 'Obock',          'Mohamed Assoweh (mari)'),
  (13, null,           'Yacin',       'Osman Dirieh',      33,  20, 'male',   'O+',  'fr', 'Dikhil',         'Osman Dirieh (père)'),
  (14, null,           'Fardoussa',   'Ahmed Miganeh',     38, 300, 'female', 'B+',  'fr', 'Djibouti-Ville', 'Ahmed Miganeh (mari)'),
  (15, null,           'Idriss',      'Hamadou Ali',       60, 100, 'male',   'A+',  'fr', 'Tadjourah',      'Ali Hamadou (fils)'),
  (16, null,           'Deka',        'Abdillahi Robleh',  26,  45, 'female', 'O+',  'so', 'Balbala',        'Robleh Abdillahi (mari)'),
  (17, null,           'Houmed',      'Mohamed Kamil',     47, 180, 'male',   'O+',  'ar', 'Obock',          'Kamil Mohamed (frère)'),
  (18, null,           'Asma',        'Daher Ibrahim',     41, 250, 'female', 'AB-', 'fr', 'Ali Sabieh',     'Ibrahim Daher (mari)'),
  (19, null,           'Mahdi',       'Ali Boulaleh',      36,  65, 'male',   'B+',  'so', 'Dikhil',         'Ali Boulaleh (père)'),
  (20, null,           'Roukia',      'Hassan Ali',        55, 130, 'female', 'A+',  'ar', 'Djibouti-Ville', 'Ali Hassan (fils)')
) as t(n, u, g, f, y, d, s, b, l, r, cn);

-- -----------------------------------------------------------------------------
-- 6 synthetic children (patients without login, linked to a guardian)
-- -----------------------------------------------------------------------------
insert into public.patients (id, given_name, family_name, birth_date, sex, blood_group, preferred_language, region,
                             emergency_contact_name, emergency_contact_phone)
select pg_temp.pid(100 + n), g, f, current_date - age_days, s, b, 'fr', r, cn,
       '+253 00 00 ' || lpad((10 + guardian)::text, 2, '0') || ' ' || lpad((20 + guardian)::text, 2, '0')
from (values
  (1, 'Ilyas',  'Abdi Guedi',       548, 'male',   'A+',      'Djibouti-Ville', 'Fatouma Guedi Abdi (mère)', 2),
  (2, 'Hawa',   'Abdi Guedi',      1490, 'female', 'O+',      'Djibouti-Ville', 'Fatouma Guedi Abdi (mère)', 2),
  (3, 'Nasra',  'Houssein Ismail',   91, 'female', 'unknown', 'Balbala',        'Saada Ismail Houssein (mère)', 8),
  (4, 'Elmi',   'Miganeh Ahmed',    740, 'male',   'B+',      'Djibouti-Ville', 'Fardoussa Ahmed Miganeh (mère)', 14),
  (5, 'Samira', 'Robleh Abdillahi', 212, 'female', 'O+',      'Balbala',        'Deka Abdillahi Robleh (mère)', 16),
  (6, 'Bilal',  'Ibrahim Daher',     24, 'male',   'unknown', 'Ali Sabieh',     'Asma Daher Ibrahim (mère)', 18)
) as t(n, g, f, age_days, s, b, r, cn, guardian);

insert into public.children (child_patient_id, guardian_patient_id, relationship) values
  (pg_temp.pid(101), pg_temp.pid(2), 'mother'),
  (pg_temp.pid(102), pg_temp.pid(2), 'mother'),
  (pg_temp.pid(103), pg_temp.pid(8), 'mother'),
  (pg_temp.pid(104), pg_temp.pid(14), 'mother'),
  (pg_temp.pid(105), pg_temp.pid(16), 'mother'),
  (pg_temp.pid(106), pg_temp.pid(18), 'mother');

-- -----------------------------------------------------------------------------
-- Conditions (ICD-10 codes). source = professional unless noted.
-- -----------------------------------------------------------------------------
insert into public.conditions (patient_id, code, display, clinical_status, onset_date, is_critical, source) values
  (pg_temp.pid(1),  'D64.9', 'Anémie',                    'active',   current_date - 60,   false, 'professional'),
  (pg_temp.pid(2),  'J45',   'Asthme',                    'active',   current_date - 3650, false, 'professional'),
  (pg_temp.pid(3),  'E11',   'Diabète de type 2',         'active',   current_date - 2900, true,  'professional'),
  (pg_temp.pid(3),  'I10',   'Hypertension artérielle',   'active',   current_date - 2100, false, 'professional'),
  (pg_temp.pid(4),  'I10',   'Hypertension artérielle',   'active',   current_date - 1500, false, 'professional'),
  (pg_temp.pid(5),  'J45',   'Asthme',                    'active',   current_date - 5000, false, 'professional'),
  (pg_temp.pid(6),  'D64.9', 'Anémie',                    'active',   current_date - 40,   false, 'professional'),
  (pg_temp.pid(7),  'E11',   'Diabète de type 2',         'active',   current_date - 4000, true,  'professional'),
  (pg_temp.pid(7),  'I10',   'Hypertension artérielle',   'active',   current_date - 3000, false, 'professional'),
  (pg_temp.pid(8),  'D57',   'Drépanocytose',             'active',   current_date - 12000, true, 'professional'),
  (pg_temp.pid(9),  'G40',   'Épilepsie',                 'active',   current_date - 7000, true,  'professional'),
  (pg_temp.pid(11), 'I10',   'Hypertension artérielle',   'active',   current_date - 900,  false, 'professional'),
  (pg_temp.pid(12), 'J45',   'Asthme',                    'active',   current_date - 4000, false, 'patient'),
  (pg_temp.pid(14), 'E11',   'Diabète de type 2',         'active',   current_date - 1200, true,  'professional'),
  (pg_temp.pid(15), 'I10',   'Hypertension artérielle',   'active',   current_date - 2500, false, 'professional'),
  (pg_temp.pid(15), 'E11',   'Diabète de type 2',         'active',   current_date - 1800, true,  'professional'),
  (pg_temp.pid(16), 'D64.9', 'Anémie',                    'resolved', current_date - 700,  false, 'professional'),
  (pg_temp.pid(17), 'J45',   'Asthme',                    'active',   current_date - 6000, false, 'professional'),
  (pg_temp.pid(18), 'I10',   'Hypertension artérielle',   'active',   current_date - 1100, false, 'professional'),
  (pg_temp.pid(20), 'E11',   'Diabète de type 2',         'active',   current_date - 3300, true,  'professional'),
  (pg_temp.pid(20), 'D64.9', 'Anémie',                    'active',   current_date - 200,  false, 'professional'),
  (pg_temp.pid(102),'J45',   'Asthme',                    'active',   current_date - 400,  false, 'professional');

-- -----------------------------------------------------------------------------
-- Allergies
-- -----------------------------------------------------------------------------
insert into public.allergies (patient_id, substance, reaction, criticality, source) values
  (pg_temp.pid(1),  'Pénicilline', 'Urticaire et gonflement du visage', 'high', 'professional'),
  (pg_temp.pid(4),  'Aspirine',    'Crise d''asthme',                   'high', 'professional'),
  (pg_temp.pid(5),  'Arachide',    'Gonflement de la gorge',            'high', 'professional'),
  (pg_temp.pid(9),  'Sulfamides',  'Éruption cutanée sévère',           'high', 'professional'),
  (pg_temp.pid(13), 'Pénicilline', 'Démangeaisons',                     'low',  'patient'),
  (pg_temp.pid(18), 'Latex',       'Rougeurs et démangeaisons',         'high', 'professional'),
  (pg_temp.pid(2),  'Arachide',    'Démangeaisons de la bouche',        'low',  'patient');

-- -----------------------------------------------------------------------------
-- Medications (MedicationStatement)
-- -----------------------------------------------------------------------------
insert into public.medications (patient_id, name, dosage_text, status, start_date, source) values
  (pg_temp.pid(1),  'Fer + acide folique',      '1 comprimé par jour',        'active',    current_date - 60,   'professional'),
  (pg_temp.pid(2),  'Salbutamol inhalateur',    '2 bouffées si besoin',       'active',    current_date - 3000, 'professional'),
  (pg_temp.pid(3),  'Metformine',               '500 mg deux fois par jour',  'active',    current_date - 2800, 'professional'),
  (pg_temp.pid(3),  'Amlodipine',               '5 mg une fois par jour',     'active',    current_date - 2000, 'professional'),
  (pg_temp.pid(4),  'Énalapril',                '10 mg une fois par jour',    'active',    current_date - 1400, 'professional'),
  (pg_temp.pid(5),  'Salbutamol inhalateur',    '2 bouffées si besoin',       'active',    current_date - 4000, 'professional'),
  (pg_temp.pid(6),  'Fer + acide folique',      '1 comprimé par jour',        'active',    current_date - 40,   'professional'),
  (pg_temp.pid(7),  'Metformine',               '850 mg deux fois par jour',  'active',    current_date - 3900, 'professional'),
  (pg_temp.pid(7),  'Amlodipine',               '10 mg une fois par jour',    'active',    current_date - 2900, 'professional'),
  (pg_temp.pid(8),  'Acide folique',            '5 mg une fois par jour',     'active',    current_date - 5000, 'professional'),
  (pg_temp.pid(9),  'Carbamazépine',            '200 mg deux fois par jour',  'active',    current_date - 6900, 'professional'),
  (pg_temp.pid(10), 'Fer + acide folique',      '1 comprimé par jour',        'active',    current_date - 20,   'professional'),
  (pg_temp.pid(11), 'Amlodipine',               '5 mg une fois par jour',     'active',    current_date - 850,  'professional'),
  (pg_temp.pid(12), 'Salbutamol inhalateur',    '2 bouffées si besoin',       'active',    current_date - 3900, 'patient'),
  (pg_temp.pid(14), 'Metformine',               '500 mg deux fois par jour',  'active',    current_date - 1100, 'professional'),
  (pg_temp.pid(15), 'Énalapril',                '10 mg une fois par jour',    'active',    current_date - 2400, 'professional'),
  (pg_temp.pid(15), 'Metformine',               '500 mg deux fois par jour',  'active',    current_date - 1700, 'professional'),
  (pg_temp.pid(16), 'Fer + acide folique',      '1 comprimé par jour',        'completed', current_date - 700,  'professional'),
  (pg_temp.pid(17), 'Salbutamol inhalateur',    '2 bouffées si besoin',       'active',    current_date - 5900, 'professional'),
  (pg_temp.pid(18), 'Amlodipine',               '5 mg une fois par jour',     'active',    current_date - 1000, 'professional'),
  (pg_temp.pid(20), 'Metformine',               '1000 mg deux fois par jour', 'active',    current_date - 3200, 'professional'),
  (pg_temp.pid(20), 'Fer + acide folique',      '1 comprimé par jour',        'active',    current_date - 190,  'professional'),
  (pg_temp.pid(12), 'Paracétamol',              '500 mg si douleur',          'active',    current_date - 30,   'patient');

-- -----------------------------------------------------------------------------
-- Pregnancies (4) + antenatal visits
-- -----------------------------------------------------------------------------
insert into public.pregnancies (id, patient_id, lmp_date, edd_date, status, risk_level) values
  ('30000000-0000-4000-a000-000000000001', pg_temp.pid(1),  current_date - 168, current_date - 168 + 280, 'active', 'standard'),
  ('30000000-0000-4000-a000-000000000002', pg_temp.pid(6),  current_date - 224, current_date - 224 + 280, 'active', 'high'),
  ('30000000-0000-4000-a000-000000000003', pg_temp.pid(10), current_date - 70,  current_date - 70 + 280,  'active', 'standard'),
  ('30000000-0000-4000-a000-000000000004', pg_temp.pid(12), current_date - 126, current_date - 126 + 280, 'active', 'standard');

-- Amina: 3 visits done, 5 planned (toward the placeholder target of 8)
insert into public.antenatal_visits (pregnancy_id, visit_number, date, status, gestational_weeks, bp, weight_kg, notes, facility)
select '30000000-0000-4000-a000-000000000001', n, current_date - 168 + ga * 7,
       case when ga * 7 <= 168 then 'done' else 'planned' end, ga, bp, w, notes,
       'Centre de santé de Balbala (démo)'
from (values
  (1,  9, '110/70', 58.0, 'Première visite. Bilan sanguin demandé.'),
  (2, 16, '112/72', 59.4, 'Anémie notée au bilan. Fer + acide folique commencé. Vaccin Td dose 1.'),
  (3, 22, '108/70', 61.0, 'Bonne évolution. Échographie normale.'),
  (4, 26, null, null, null),
  (5, 30, null, null, null),
  (6, 34, null, null, null),
  (7, 36, null, null, null),
  (8, 38, null, null, null)
) as v(n, ga, bp, w, notes);

insert into public.antenatal_visits (pregnancy_id, visit_number, date, status, gestational_weeks, bp, weight_kg, notes, facility)
values
  ('30000000-0000-4000-a000-000000000002', 1, current_date - 224 + 84,  'done', 12, '128/84', 66.0, 'Tension à surveiller.', 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000002', 2, current_date - 224 + 140, 'done', 20, '134/88', 68.2, 'Grossesse classée à haut risque par le médecin.', 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000002', 3, current_date - 224 + 196, 'done', 28, '130/86', 70.1, null, 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000002', 4, current_date - 224 + 238, 'planned', 34, null, null, null, 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000003', 1, current_date - 70 + 63,   'done', 9,  '105/68', 52.5, 'Première visite.', 'Centre de santé de Tadjourah (démo)'),
  ('30000000-0000-4000-a000-000000000003', 2, current_date - 70 + 112,  'planned', 16, null, null, null, 'Centre de santé de Tadjourah (démo)'),
  ('30000000-0000-4000-a000-000000000004', 1, current_date - 126 + 70,  'done', 10, '115/75', 63.0, null, 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000004', 2, current_date - 126 + 112, 'done', 16, '116/74', 64.1, null, 'Centre de santé d''Obock (démo)'),
  ('30000000-0000-4000-a000-000000000004', 3, current_date - 126 + 140, 'planned', 20, null, null, null, 'Centre de santé d''Obock (démo)');

-- -----------------------------------------------------------------------------
-- Immunizations
-- -----------------------------------------------------------------------------
-- Adults
insert into public.immunizations (patient_id, vaccine_code, vaccine_name, date_given, dose_number, facility, source) values
  (pg_temp.pid(1),  'TD', 'Tétanos-diphtérie (Td)', current_date - 168 + 112, 1, 'Centre de santé de Balbala (démo)', 'professional'),
  (pg_temp.pid(6),  'TD', 'Tétanos-diphtérie (Td)', current_date - 224 + 112, 1, 'Centre de santé d''Obock (démo)', 'professional'),
  (pg_temp.pid(6),  'TD', 'Tétanos-diphtérie (Td)', current_date - 224 + 140, 2, 'Centre de santé d''Obock (démo)', 'professional'),
  (pg_temp.pid(12), 'TD', 'Tétanos-diphtérie (Td)', current_date - 126 + 112, 1, 'Centre de santé d''Obock (démo)', 'professional'),
  (pg_temp.pid(2),  'TD', 'Tétanos-diphtérie (Td)', current_date - 1800, 2, 'Maternité Centrale (démo)', 'professional'),
  (pg_temp.pid(19), 'TD', 'Tétanos-diphtérie (Td)', current_date - 400, 1, 'Centre de santé de Dikhil (démo)', 'patient');

-- Children: every scheduled dose given on time, EXCEPT the gaps listed below, and only doses already due.
--   Ilyas (101, 18 months): Rougeole-Rubéole dose 1 missed  -> overdue; dose 2 due now.
--   Nasra (103, 13 weeks) : 14-week doses not yet due     -> "next vaccine in ~1 week".
--   Samira (105, 7 months): 14-week doses missed           -> overdue.
--   Bilal (106, 3 weeks)  : birth doses only.
insert into public.immunizations (patient_id, vaccine_code, vaccine_name, date_given, dose_number, facility, source)
select c.id, s.vaccine_code, s.vaccine_name, c.birth_date + s.due_age_weeks * 7 + 3, s.dose_number,
       case when c.region = 'Balbala' then 'Centre de santé de Balbala (démo)'
            when c.region = 'Ali Sabieh' then 'Centre médical d''Ali Sabieh (démo)'
            else 'Hôpital Central (démo)' end,
       'professional'
from public.patients c
join public.vaccination_schedule s on s.target = 'child'
where c.id in (select child_patient_id from public.children)
  and c.birth_date + s.due_age_weeks * 7 + 3 <= current_date
  and not (c.id = pg_temp.pid(101) and s.vaccine_code = 'RR')
  and not (c.id = pg_temp.pid(105) and s.due_age_weeks = 14);

-- -----------------------------------------------------------------------------
-- Encounters & observations
-- -----------------------------------------------------------------------------
insert into public.encounters (id, patient_id, facility, practitioner_id, date, reason, notes, source) values
  ('40000000-0000-4000-a000-000000000001', pg_temp.pid(1), 'Centre de santé de Balbala (démo)', pg_temp.prac(2),
     current_date - 168 + 63,  'Consultation prénatale', 'Première visite de grossesse.', 'professional'),
  ('40000000-0000-4000-a000-000000000002', pg_temp.pid(1), 'Centre de santé de Balbala (démo)', pg_temp.prac(2),
     current_date - 168 + 112, 'Consultation prénatale', 'Résultat du bilan : hémoglobine basse.', 'professional'),
  ('40000000-0000-4000-a000-000000000003', pg_temp.pid(1), 'Centre de santé de Balbala (démo)', pg_temp.prac(2),
     current_date - 168 + 154, 'Consultation prénatale', 'Échographie du deuxième trimestre.', 'professional'),
  ('40000000-0000-4000-a000-000000000004', pg_temp.pid(2), 'Hôpital Central (démo)', pg_temp.prac(1),
     current_date - 95, 'Crise d''asthme légère', 'Amélioration après inhalation.', 'professional'),
  ('40000000-0000-4000-a000-000000000005', pg_temp.pid(101), 'Hôpital Central (démo)', pg_temp.prac(3),
     current_date - 120, 'Visite de suivi pédiatrique', 'Croissance régulière.', 'professional'),
  ('40000000-0000-4000-a000-000000000006', pg_temp.pid(3), 'Hôpital Central (démo)', pg_temp.prac(1),
     current_date - 30, 'Suivi diabète et tension', null, 'professional'),
  ('40000000-0000-4000-a000-000000000007', pg_temp.pid(9), 'Hôpital Central (démo)', pg_temp.prac(1),
     current_date - 210, 'Renouvellement de traitement', null, 'professional'),
  ('40000000-0000-4000-a000-000000000008', pg_temp.pid(11), 'Centre médical d''Ali Sabieh (démo)', pg_temp.prac(4),
     current_date - 75, 'Contrôle de la tension', null, 'professional'),
  ('40000000-0000-4000-a000-000000000009', pg_temp.pid(15), 'Centre de santé de Tadjourah (démo)', pg_temp.prac(5),
     current_date - 50, 'Suivi diabète', null, 'professional'),
  ('40000000-0000-4000-a000-000000000010', pg_temp.pid(2), 'Clinique de la Corniche (démo)', null,
     current_date - 400, 'Consultation dentaire', 'Déclaré par la patiente.', 'patient');

insert into public.observations (patient_id, encounter_id, type, value, value_text, unit, date, source) values
  (pg_temp.pid(1), '40000000-0000-4000-a000-000000000002', 'hemoglobin', 9.8,  null, 'g/dL', current_date - 168 + 112, 'professional'),
  (pg_temp.pid(1), '40000000-0000-4000-a000-000000000003', 'hemoglobin', 10.6, null, 'g/dL', current_date - 168 + 154, 'professional'),
  (pg_temp.pid(1), '40000000-0000-4000-a000-000000000003', 'blood_pressure', null, '108/70', 'mmHg', current_date - 168 + 154, 'professional'),
  (pg_temp.pid(3), '40000000-0000-4000-a000-000000000006', 'glucose', 1.42, null, 'g/L', current_date - 30, 'professional'),
  (pg_temp.pid(3), '40000000-0000-4000-a000-000000000006', 'blood_pressure', null, '138/86', 'mmHg', current_date - 30, 'professional'),
  (pg_temp.pid(11), '40000000-0000-4000-a000-000000000008', 'blood_pressure', null, '142/90', 'mmHg', current_date - 75, 'professional'),
  (pg_temp.pid(15), '40000000-0000-4000-a000-000000000009', 'glucose', 1.6, null, 'g/L', current_date - 50, 'professional');

-- Child growth (weight for age) — synthetic values
insert into public.observations (patient_id, type, value, unit, date, source)
select pg_temp.pid(101), 'weight', w, 'kg', (current_date - 548) + wk * 7, 'professional'
from (values (0, 3.3), (6, 4.7), (10, 5.6), (14, 6.3), (26, 7.7), (39, 8.7), (52, 9.5), (65, 10.1), (75, 10.7)) as g(wk, w);
insert into public.observations (patient_id, type, value, unit, date, source)
select pg_temp.pid(102), 'weight', w, 'kg', (current_date - 1490) + wk * 7, 'professional'
from (values (0, 3.1), (14, 5.9), (52, 8.9), (104, 11.4), (156, 13.6), (208, 15.4)) as g(wk, w);
insert into public.observations (patient_id, type, value, unit, date, source)
select pg_temp.pid(103), 'weight', w, 'kg', (current_date - 91) + wk * 7, 'professional'
from (values (0, 3.0), (6, 4.3), (10, 5.1)) as g(wk, w);
insert into public.observations (patient_id, type, value, unit, date, source)
select pg_temp.pid(105), 'weight', w, 'kg', (current_date - 212) + wk * 7, 'professional'
from (values (0, 2.9), (6, 4.1), (10, 4.9), (26, 6.4)) as g(wk, w);

-- =============================================================================
-- Synthetic statistical cohort — only to give the Ministry dashboard realistic
-- volumes. Pseudonymous placeholders ("Cohorte Synthétique-0001"), no logins.
-- Deterministic thanks to setseed().
-- =============================================================================
select setseed(0.2026);

create temporary table cohort_adults as
select gen_random_uuid() as id, n,
       case when r < 0.44 then 'Djibouti-Ville' when r < 0.66 then 'Balbala' when r < 0.76 then 'Ali Sabieh'
            when r < 0.86 then 'Tadjourah' when r < 0.95 then 'Dikhil' else 'Obock' end as region,
       case when random() < 0.52 then 'female' else 'male' end as sex,
       (current_date - ((18 + floor(random() * 57)) * 365 + floor(random() * 365))::int) as birth_date
from (select n, random() as r from generate_series(1, 1400) n) x;

insert into public.patients (id, given_name, family_name, birth_date, sex, blood_group, preferred_language, region, is_cohort)
select id, 'Cohorte', 'Synthétique-' || lpad(n::text, 4, '0'), birth_date, sex,
       (array['O+','O+','O+','A+','A+','B+','B+','AB+','O-','A-'])[1 + floor(random() * 10)::int],
       (array['fr','so','so','ar','fr'])[1 + floor(random() * 5)::int], region, true
from cohort_adults;

insert into public.conditions (patient_id, code, display, clinical_status, onset_date, is_critical, source)
select id, code, display, 'active', current_date - floor(random() * 3000)::int, crit, 'professional'
from cohort_adults
cross join (values ('I10', 'Hypertension artérielle', 0.14, false), ('E11', 'Diabète de type 2', 0.09, true),
                   ('J45', 'Asthme', 0.05, false), ('D64.9', 'Anémie', 0.08, false),
                   ('G40', 'Épilepsie', 0.012, true), ('D57', 'Drépanocytose', 0.006, true),
                   ('A15', 'Tuberculose', 0.02, false)) as c(code, display, p, crit)
-- per-(person, condition) pseudo-random draw (a bare random() here would be evaluated once per condition)
where ('x' || substr(md5(cohort_adults.id::text || c.code), 1, 8))::bit(32)::bigint / 4294967296.0 < c.p;

-- Under-5 children, each linked to a female cohort adult in the same region
create temporary table cohort_children as
select gen_random_uuid() as id, a.id as guardian, a.region,
       current_date - floor(random() * 1800)::int as birth_date,
       case when random() < 0.5 then 'female' else 'male' end as sex
from cohort_adults a
where a.sex = 'female' and a.birth_date > current_date - 45 * 365 and random() < 0.75;

insert into public.patients (id, given_name, family_name, birth_date, sex, blood_group, region, is_cohort)
select id, 'Cohorte', 'Enfant-' || lpad(row_number() over ()::text, 4, '0'), birth_date, sex, 'unknown', region, true
from cohort_children;
insert into public.children (child_patient_id, guardian_patient_id) select id, guardian from cohort_children;

-- Coverage drops for later doses and is lower in remote regions (synthetic pattern, not real data)
insert into public.immunizations (patient_id, vaccine_code, vaccine_name, date_given, dose_number, facility, source)
select c.id, s.vaccine_code, s.vaccine_name, c.birth_date + s.due_age_weeks * 7 + floor(random() * 20)::int, s.dose_number,
       'Centre de santé (démo)', 'professional'
from cohort_children c
join public.vaccination_schedule s on s.target = 'child'
where c.birth_date + s.due_age_weeks * 7 + 20 <= current_date
  and random() < (0.97 - s.due_age_weeks * 0.0035
                  - case c.region when 'Obock' then 0.14 when 'Dikhil' then 0.08 when 'Tadjourah' then 0.06 else 0 end);

-- Pregnancies: active (for the trimester chart) and completed (for ANC completion)
create temporary table cohort_preg as
select gen_random_uuid() as id, a.id as patient_id, a.region,
       case when random() < 0.4 then 'active' else 'completed' end as status
from cohort_adults a
where a.sex = 'female' and a.birth_date > current_date - 44 * 365 and random() < 0.40;

insert into public.pregnancies (id, patient_id, lmp_date, edd_date, status, risk_level)
select id, patient_id, lmp, lmp + 280, status, case when random() < 0.15 then 'high' else 'standard' end
from (select *, case when status = 'active' then current_date - (14 + floor(random() * 255))::int
                     else current_date - (300 + floor(random() * 380))::int end as lmp
      from cohort_preg) p;

insert into public.antenatal_visits (pregnancy_id, visit_number, date, status, gestational_weeks)
select p.id, v, pg.lmp_date + (8 + v * 4) * 7, 'done', 8 + v * 4
from cohort_preg p
join public.pregnancies pg on pg.id = p.id
cross join lateral generate_series(1, greatest(1, least(8, floor(5 + random() * 5)::int
                 - case p.region when 'Obock' then 2 when 'Dikhil' then 1 else 0 end))) v
where pg.lmp_date + (8 + v * 4) * 7 <= current_date;
