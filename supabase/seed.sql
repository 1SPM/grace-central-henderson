-- Grace CRM Comprehensive Seed Data
-- Run this after migrations to populate test data

-- ============================================
-- CHURCH (Required for all foreign keys)
-- ============================================
INSERT INTO churches (id, name, slug, timezone, settings) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Grace Community Church', 'grace-community', 'America/Chicago',
   '{"theme": "light", "features": {"ai_messaging": true, "donations": true}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USERS (Staff/Admin accounts)
-- ============================================
INSERT INTO users (id, church_id, clerk_id, email, first_name, last_name, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'clerk_pastor_john', 'pastor.john@gracechurch.org', 'John', 'Smith', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'clerk_mary_admin', 'mary.admin@gracechurch.org', 'Mary', 'Johnson', 'admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'clerk_tom_staff', 'tom.staff@gracechurch.org', 'Tom', 'Williams', 'staff'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'clerk_sarah_vol', 'sarah.volunteer@gracechurch.org', 'Sarah', 'Davis', 'volunteer')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PEOPLE (Congregation members - 35 diverse records)
-- ============================================
INSERT INTO people (id, church_id, first_name, last_name, email, phone, status, birth_date, join_date, first_visit, tags, family_id, notes) VALUES
  -- Original members
  ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sarah', 'Mitchell', 'sarah.mitchell@email.com', '(555) 123-4567', 'visitor', '1995-03-15', NULL, '2024-12-29', ARRAY['first-time', 'young-adult'], NULL, 'Came with friend Maria. Interested in small groups.'),
  ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'James', 'Peterson', 'james.p@email.com', '(555) 234-5678', 'member', '1988-01-26', '2023-06-15', NULL, ARRAY['volunteer', 'greeter'], NULL, 'Serves on greeting team every 2nd Sunday.'),
  ('00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Maria', 'Garcia', 'maria.garcia@email.com', '(555) 345-6789', 'regular', '1992-07-22', NULL, '2024-08-10', ARRAY['young-adult'], NULL, 'Brought friend Sarah on 12/29.'),
  ('00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Robert', 'Chen', 'robert.chen@email.com', '(555) 456-7890', 'leader', '1975-01-29', '2020-03-01', NULL, ARRAY['elder', 'small-group-leader'], NULL, 'Elder. Leads Tuesday night mens group.'),
  ('00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Emily', 'Johnson', 'emily.j@email.com', '(555) 567-8901', 'inactive', '1988-11-30', '2022-01-10', NULL, ARRAY[]::text[], NULL, 'Hasnt attended in 6 weeks. Last contact was about job stress.'),
  ('00000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Cam', 'Deich', 'cdeichmiller11@gmail.com', '(555) 678-9012', 'member', '1993-01-24', '2021-09-20', NULL, ARRAY['worship-team', 'musician'], NULL, 'Test user for AI email features.'),
  ('00000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Lisa', 'Thompson', 'lisa.t@email.com', '(555) 789-0123', 'visitor', '1984-04-12', NULL, '2025-01-01', ARRAY['first-time', 'family'], 'fam-thompson', 'New Years service visitor. Has 2 kids (ages 5, 8).'),
  ('00000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Michael', 'Brown', 'michael.b@email.com', '(555) 890-1234', 'member', '1975-08-03', '2019-11-15', NULL, ARRAY['deacon', 'finance-team'], NULL, 'Serves on finance committee.'),

  -- People with upcoming birthdays
  ('00000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Amanda', 'Foster', 'amanda.foster@email.com', '(555) 901-2345', 'member', '1985-01-25', '2022-05-20', NULL, ARRAY['womens-ministry', 'prayer-team'], NULL, 'Active in womens Bible study. Great encourager.'),
  ('00000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Kevin', 'Martinez', 'kevin.m@email.com', '(555) 012-3456', 'member', '1990-01-27', '2021-01-22', NULL, ARRAY['tech-team', 'young-professional'], NULL, 'Runs sound booth. Works in IT.'),
  ('00000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Rachel', 'Kim', 'rachel.kim@email.com', '(555) 123-4560', 'member', '1987-01-30', '2025-01-24', NULL, ARRAY['childrens-ministry', 'teacher'], NULL, 'Teaches 3rd grade Sunday school. Very dedicated.'),
  ('00000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Thomas', 'Wright', 'tom.wright@email.com', '(555) 234-5670', 'leader', '1970-12-25', '2018-06-10', NULL, ARRAY['elder', 'missions-team'], NULL, 'Oversees missions committee. Went on 3 mission trips.'),

  -- Recent visitors
  ('00000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'Cam', '1993', 'camd1993@gmail.com', '(555) 345-6780', 'visitor', '1990-02-14', NULL, '2025-01-21', ARRAY['first-time', 'young-family'], NULL, 'Test user for AI email features.'),
  ('00000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'Marcus', 'Taylor', 'marcus.t@email.com', '(555) 456-7801', 'visitor', '1987-09-08', NULL, '2025-01-23', ARRAY['first-time'], NULL, 'Coworker of James Peterson. First church visit in 5 years.'),
  ('00000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'Ashley', 'Robinson', 'ashley.r@email.com', '(555) 567-8902', 'visitor', '1993-05-21', NULL, '2025-01-24', ARRAY['first-time', 'college-student'], NULL, 'Graduate student at local university. Interested in young adults group.'),

  -- Regular attendees becoming members
  ('00000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'Brian', 'Cooper', 'brian.cooper@email.com', '(555) 678-9013', 'regular', '1982-10-30', NULL, '2024-09-15', ARRAY['mens-group'], NULL, 'Been attending regularly for 4 months. Ready for membership class?'),
  ('00000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'Nicole', 'Davis', 'nicole.d@email.com', '(555) 789-0124', 'regular', '1991-01-28', NULL, '2024-10-01', ARRAY['young-adult', 'creative'], NULL, 'Graphic designer. Volunteered for bulletin design.'),

  -- Members with membership anniversaries
  ('00000000-0000-0000-0000-000000000018', '11111111-1111-1111-1111-111111111111', 'Daniel', 'Lee', 'daniel.lee@email.com', '(555) 890-1235', 'member', '1979-06-18', '2023-01-26', NULL, ARRAY['usher', 'parking-team'], NULL, 'Faithful usher. Never misses a Sunday.'),
  ('00000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'Stephanie', 'Moore', 'steph.moore@email.com', '(555) 901-2346', 'member', '1986-01-07', '2022-01-29', NULL, ARRAY['hospitality', 'events-team'], NULL, 'Coordinates fellowship meals. Amazing cook!'),

  -- First-time givers
  ('00000000-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'Christopher', 'Hall', 'chris.hall@email.com', '(555) 012-3457', 'regular', '1991-03-25', NULL, '2024-11-10', ARRAY['young-professional'], NULL, 'Attending for 2 months. Made first donation last week!'),
  ('00000000-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'Lauren', 'White', 'lauren.w@email.com', '(555) 123-4561', 'member', '1989-08-14', '2023-02-12', NULL, ARRAY['choir', 'worship-team'], NULL, 'Beautiful soprano voice. Joined choir immediately.'),

  -- Inactive members for re-engagement
  ('00000000-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'Andrew', 'Clark', 'andrew.c@email.com', '(555) 234-5671', 'inactive', '1985-01-25', '2021-04-15', NULL, ARRAY[]::text[], NULL, 'Stopped attending after job change. Moved across town.'),
  ('00000000-0000-0000-0000-000000000023', '11111111-1111-1111-1111-111111111111', 'Michelle', 'Young', 'michelle.y@email.com', '(555) 345-6781', 'inactive', '1983-04-02', '2020-08-20', NULL, ARRAY[]::text[], NULL, 'Family health issues. Last contact 2 months ago.'),

  -- Large donors
  ('00000000-0000-0000-0000-000000000024', '11111111-1111-1111-1111-111111111111', 'Richard', 'Anderson', 'richard.a@email.com', '(555) 456-7802', 'member', '1965-11-12', '2015-01-10', NULL, ARRAY['elder', 'major-donor'], NULL, 'Retired business owner. Very generous supporter of missions.'),
  ('00000000-0000-0000-0000-000000000025', '11111111-1111-1111-1111-111111111111', 'Patricia', 'Thomas', 'patricia.t@email.com', '(555) 567-8903', 'member', '1958-07-30', '2017-06-25', NULL, ARRAY['prayer-team', 'major-donor'], NULL, 'Prayer warrior. Supports benevolence fund regularly.'),

  -- Thompson family members
  ('00000000-0000-0000-0000-000000000026', '11111111-1111-1111-1111-111111111111', 'Mark', 'Thompson', 'mark.thompson@email.com', '(555) 789-0125', 'member', '1982-04-18', '2025-01-05', NULL, ARRAY['family'], 'fam-thompson', 'Lisa Thompsons husband. Joined after visiting on New Years.'),
  ('00000000-0000-0000-0000-000000000027', '11111111-1111-1111-1111-111111111111', 'Emma', 'Thompson', NULL, '(555) 789-0125', 'member', '2017-06-10', '2025-01-05', NULL, ARRAY['child', 'kids-ministry'], 'fam-thompson', 'Lisa & Marks daughter, age 8. Loves Sunday school.'),
  ('00000000-0000-0000-0000-000000000028', '11111111-1111-1111-1111-111111111111', 'Ethan', 'Thompson', NULL, NULL, 'member', '2020-03-22', '2025-01-05', NULL, ARRAY['child', 'kids-ministry'], 'fam-thompson', 'Lisa & Marks son, age 5. In preschool class.'),

  -- Additional diverse members
  ('00000000-0000-0000-0000-000000000029', '11111111-1111-1111-1111-111111111111', 'Grace', 'Williams', 'grace.w@email.com', '(555) 111-2222', 'member', '1978-05-15', '2019-02-05', NULL, ARRAY['womens-ministry', 'hospitality'], NULL, 'Hosts monthly womens brunch. Very welcoming.'),
  ('00000000-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'David', 'Park', 'david.park@email.com', '(555) 222-3333', 'member', '1985-09-20', '2020-02-14', NULL, ARRAY['tech-team', 'media'], NULL, 'Runs livestream. Software engineer.'),
  ('00000000-0000-0000-0000-000000000031', '11111111-1111-1111-1111-111111111111', 'Jennifer', 'Scott', 'jen.scott@email.com', '(555) 333-4444', 'regular', '1995-12-08', NULL, '2024-11-17', ARRAY['young-adult'], NULL, 'Moved to town recently. Looking for community.'),
  ('00000000-0000-0000-0000-000000000032', '11111111-1111-1111-1111-111111111111', 'William', 'Harris', 'will.harris@email.com', '(555) 444-5555', 'member', '1960-02-28', '2010-06-20', NULL, ARRAY['elder', 'teaching'], NULL, 'Retired professor. Leads adult Sunday school.'),
  ('00000000-0000-0000-0000-000000000033', '11111111-1111-1111-1111-111111111111', 'Susan', 'Harris', 'susan.harris@email.com', '(555) 444-5556', 'member', '1962-08-14', '2010-06-20', NULL, ARRAY['womens-ministry'], 'fam-harris', 'Williams wife. Active in prayer ministry.'),
  ('00000000-0000-0000-0000-000000000034', '11111111-1111-1111-1111-111111111111', 'Jason', 'Reed', 'jason.reed@email.com', '(555) 555-6666', 'visitor', '1998-04-05', NULL, '2025-01-19', ARRAY['first-time', 'young-adult'], NULL, 'College friend of Ashley. Came together last week.'),
  ('00000000-0000-0000-0000-000000000035', '11111111-1111-1111-1111-111111111111', 'Elizabeth', 'Adams', 'liz.adams@email.com', '(555) 666-7777', 'member', '1972-11-22', '2016-02-20', NULL, ARRAY['choir', 'hospitality'], NULL, 'Alto section leader. Coordinates potlucks.')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SMALL GROUPS
-- ============================================
INSERT INTO small_groups (id, church_id, name, description, leader_id, meeting_day, meeting_time, location, is_active) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Tuesday night mens Bible study and accountability group.', '00000000-0000-0000-0000-000000000004', 'Tuesday', '19:00', 'Room 201', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Community for 20s and 30s. Life, faith, and fellowship.', '00000000-0000-0000-0000-000000000010', 'Thursday', '19:30', 'Coffee House', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Wednesday morning womens Bible study and prayer group.', '00000000-0000-0000-0000-000000000009', 'Wednesday', '09:30', 'Fellowship Hall', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '11111111-1111-1111-1111-111111111111', 'Marriage Matters', 'Monthly gathering for married couples.', '00000000-0000-0000-0000-000000000032', 'Saturday', '18:00', 'Family Life Center', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Fellowship and Bible study for seniors 60+.', '00000000-0000-0000-0000-000000000025', 'Thursday', '10:00', 'Room 105', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GROUP MEMBERSHIPS
-- ============================================
INSERT INTO group_memberships (group_id, person_id) VALUES
  -- Men of Faith
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000002'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000004'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000008'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000012'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000016'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000018'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '00000000-0000-0000-0000-000000000024'),
  -- Young Adults
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000003'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000006'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000010'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000017'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000020'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000030'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '00000000-0000-0000-0000-000000000031'),
  -- Women of Grace
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000009'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000011'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000019'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000021'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000025'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000029'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000033'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '00000000-0000-0000-0000-000000000035'),
  -- Marriage Matters
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000032'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000033'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000007'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '00000000-0000-0000-0000-000000000026'),
  -- Senior Saints
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000025'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000024'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000032'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', '00000000-0000-0000-0000-000000000033')
ON CONFLICT DO NOTHING;

-- ============================================
-- INTERACTIONS (Communication logs)
-- ============================================
INSERT INTO interactions (id, church_id, person_id, type, content, created_by, created_at) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'note', 'First visit! Came with Maria Garcia. Very engaged during service. Asked about small groups.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-12-29 11:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'call', 'Called to check in. Emily shared shes been stressed with job situation. Prayed together.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-12-01 14:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000007', 'note', 'New Years service visitor. Family of 4. Kids enjoyed childrens church.', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-01-01 12:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'note', 'First-time visitor looking for a church home. Recently moved to the area.', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2025-01-21 11:45:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff4', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'note', 'James Petersons coworker. Hasnt been to church in years but seemed very open.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-23 12:15:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff5', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'visit', 'Met Richard for coffee to discuss his vision for missions giving. Very passionate about Southeast Asia.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-15 10:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff6', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'call', 'Called to check on family. Mother still in treatment. Appreciated the prayer.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-10 15:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff7', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'Sent first-time giver thank you email. Christopher replied saying he felt called to give.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-18 09:00:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff8', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'note', 'Graduate student interested in young adults group. Connected her with Kevin Martinez.', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2025-01-24 12:30:00'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff9', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 'note', 'Brian has been very consistent. Recommended for next membership class.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-20 11:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TASKS
-- ============================================
INSERT INTO tasks (id, church_id, person_id, title, description, due_date, completed, priority, category, assigned_to, created_at) VALUES
  -- Today (Jan 30, 2026)
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Follow up with Sarah Mitchell', 'First-time visitor. Send welcome email and invite to coffee.', '2026-01-30', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-25'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000007', 'Connect Lisa Thompson with kids ministry', 'New visitor with 2 kids. Introduce to childrens pastor.', '2026-01-30', false, 'high', 'follow-up', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-27'),

  -- Tomorrow (Jan 31, 2026)
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'Check in on Emily Johnson', 'Inactive 6 weeks. Last mentioned job stress. Care call needed.', '2026-01-31', false, 'medium', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-20'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', NULL, 'Prepare Q1 giving report', 'Compile giving data for elder meeting.', '2026-01-31', false, 'low', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-25'),

  -- This week (Feb 1-6, 2026)
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'Thank Maria for bringing guest', 'She brought Sarah to service. Send appreciation note.', '2026-02-01', false, 'medium', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'Follow up with Cam 1993', 'First-time visitor looking for church home. Send welcome email.', '2026-02-02', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'Follow up with Marcus Taylor', 'James Petersons coworker. First church visit in 5 years.', '2026-02-03', false, 'high', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'Connect Ashley with young adults', 'Graduate student interested in young adults group.', '2026-02-04', false, 'high', 'follow-up', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'Check on Michelle Youngs family', 'Family health issues. Send care package and follow up.', '2026-02-05', false, 'high', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-25'),

  -- Later (Feb 7+, 2026)
  ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 'Invite Brian Cooper to membership class', 'Regular attender for 4 months. Ready for next step.', '2026-02-08', false, 'medium', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'Thank Christopher Hall for first gift', 'Made first donation last week. Personal thank you.', '2026-02-10', false, 'medium', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-29'),
  ('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'Acknowledge Richard Andersons missions gift', '$5,000 missions gift. Schedule coffee with pastor.', '2026-02-12', false, 'high', 'outreach', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-28'),
  ('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111111', NULL, 'Plan March events calendar', 'Coordinate with ministry leaders for March events.', '2026-02-15', false, 'low', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000022', 'Birthday outreach to Andrew Clark', 'Inactive member. Good re-engagement opportunity.', '2026-02-18', false, 'medium', 'care', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-30'),
  ('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111111', NULL, 'Review volunteer schedule for March', 'Ensure all Sunday positions are filled for March.', '2026-02-20', false, 'medium', 'admin', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-01-30'),

  -- Completed task example
  ('22222222-2222-2222-2222-222222222216', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Welcome James Peterson to volunteer team', 'Signed up for greeting team. Onboard him this week.', '2026-01-28', true, 'medium', 'follow-up', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-22')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PRAYER REQUESTS
-- ============================================
INSERT INTO prayer_requests (id, church_id, person_id, content, is_private, is_answered, testimony, created_at, updated_at) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'Please pray for guidance in my job search. Feeling overwhelmed.', false, false, NULL, '2024-12-15', '2024-12-15'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Thankful for my mothers successful surgery. Praying for quick recovery.', false, false, NULL, '2024-12-28', '2024-12-28'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 'Wisdom needed for a difficult family decision.', true, true, 'God provided clarity through counsel from Pastor and peace in prayer.', '2024-11-10', '2024-12-20'),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'Urgent prayer for my mother Dorothy. Stage 3 cancer diagnosis.', false, false, NULL, '2025-01-24', '2025-01-24'),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', 'Pray for our missionaries in Southeast Asia. Facing challenges.', false, false, NULL, '2025-01-20', '2025-01-20'),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 'Prayer for my daughter starting college next fall.', false, false, NULL, '2025-01-19', '2025-01-19'),
  ('33333333-3333-3333-3333-333333333307', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000031', 'Adjusting to new city. Pray for community and friendships.', false, false, NULL, '2025-01-15', '2025-01-15')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CALENDAR EVENTS
-- ============================================
INSERT INTO calendar_events (id, church_id, title, description, start_date, end_date, all_day, location, category) VALUES
  -- Week of Jan 25-31, 2026
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service with communion', '2026-01-25 10:00:00', '2026-01-25 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', 'Newcomers Lunch', 'Welcome lunch for new visitors', '2026-01-25 12:00:00', '2026-01-25 13:30:00', false, 'Fellowship Hall', 'event'),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', 'Elder Meeting', 'Monthly elders meeting', '2026-01-26 18:00:00', '2026-01-26 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-01-27 19:00:00', '2026-01-27 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-01-28 09:30:00', '2026-01-28 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444406', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-01-28 18:30:00', '2026-01-28 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444407', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship and lunch', '2026-01-29 10:00:00', '2026-01-29 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444408', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-01-30 19:30:00', '2026-01-30 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444409', '11111111-1111-1111-1111-111111111111', 'Worship Team Practice', 'Sunday service preparation', '2026-01-31 09:00:00', '2026-01-31 11:00:00', false, 'Main Sanctuary', 'meeting'),

  -- Week of Feb 1-7, 2026
  ('44444444-4444-4444-4444-444444444410', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-01 10:00:00', '2026-02-01 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444411', '11111111-1111-1111-1111-111111111111', 'Super Bowl Fellowship', 'Watch party with food and fellowship', '2026-02-01 17:00:00', '2026-02-01 22:00:00', false, 'Family Life Center', 'event'),
  ('44444444-4444-4444-4444-444444444412', '11111111-1111-1111-1111-111111111111', 'Deacon Meeting', 'Monthly deacons meeting', '2026-02-02 18:30:00', '2026-02-02 20:00:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444413', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-03 19:00:00', '2026-02-03 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444414', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-04 09:30:00', '2026-02-04 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444415', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-02-04 18:30:00', '2026-02-04 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444416', '11111111-1111-1111-1111-111111111111', 'Prayer Night', 'Monthly corporate prayer gathering', '2026-02-05 19:00:00', '2026-02-05 20:30:00', false, 'Chapel', 'service'),
  ('44444444-4444-4444-4444-444444444417', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-05 10:00:00', '2026-02-05 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444418', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-06 19:30:00', '2026-02-06 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444419', '11111111-1111-1111-1111-111111111111', 'Marriage Matters', 'Monthly couples workshop', '2026-02-07 18:00:00', '2026-02-07 20:00:00', false, 'Family Life Center', 'small-group'),

  -- Week of Feb 8-14, 2026
  ('44444444-4444-4444-4444-444444444420', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-08 10:00:00', '2026-02-08 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444421', '11111111-1111-1111-1111-111111111111', 'Membership Class', 'New members orientation - Session 1', '2026-02-08 13:00:00', '2026-02-08 15:00:00', false, 'Room 105', 'event'),
  ('44444444-4444-4444-4444-444444444422', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-10 19:00:00', '2026-02-10 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444423', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-11 09:30:00', '2026-02-11 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444424', '11111111-1111-1111-1111-111111111111', 'Youth Group', 'Wednesday night youth gathering', '2026-02-11 18:30:00', '2026-02-11 20:00:00', false, 'Youth Center', 'small-group'),
  ('44444444-4444-4444-4444-444444444425', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-12 10:00:00', '2026-02-12 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444426', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-13 19:30:00', '2026-02-13 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444427', '11111111-1111-1111-1111-111111111111', 'Valentines Dinner', 'Couples date night dinner', '2026-02-14 18:00:00', '2026-02-14 21:00:00', false, 'Fellowship Hall', 'event'),

  -- Week of Feb 15-21, 2026
  ('44444444-4444-4444-4444-444444444428', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-15 10:00:00', '2026-02-15 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444429', '11111111-1111-1111-1111-111111111111', 'Membership Class', 'New members orientation - Session 2', '2026-02-15 13:00:00', '2026-02-15 15:00:00', false, 'Room 105', 'event'),
  ('44444444-4444-4444-4444-444444444430', '11111111-1111-1111-1111-111111111111', 'Finance Committee', 'Quarterly budget review', '2026-02-16 18:00:00', '2026-02-16 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444431', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-17 19:00:00', '2026-02-17 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444432', '11111111-1111-1111-1111-111111111111', 'Women of Grace', 'Weekly womens study - Prayer Warriors', '2026-02-18 09:30:00', '2026-02-18 11:00:00', false, 'Fellowship Hall', 'small-group'),
  ('44444444-4444-4444-4444-444444444433', '11111111-1111-1111-1111-111111111111', 'Community Outreach', 'Food bank volunteer day', '2026-02-21 09:00:00', '2026-02-21 13:00:00', false, 'City Food Bank', 'event'),

  -- Week of Feb 22-28, 2026
  ('44444444-4444-4444-4444-444444444434', '11111111-1111-1111-1111-111111111111', 'Sunday Service', 'Weekly worship service', '2026-02-22 10:00:00', '2026-02-22 11:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444435', '11111111-1111-1111-1111-111111111111', 'Baptism Service', 'Quarterly baptism celebration', '2026-02-22 12:30:00', '2026-02-22 13:30:00', false, 'Main Sanctuary', 'service'),
  ('44444444-4444-4444-4444-444444444436', '11111111-1111-1111-1111-111111111111', 'Elder Meeting', 'Monthly elders meeting', '2026-02-23 18:00:00', '2026-02-23 19:30:00', false, 'Conference Room', 'meeting'),
  ('44444444-4444-4444-4444-444444444437', '11111111-1111-1111-1111-111111111111', 'Men of Faith', 'Weekly mens Bible study - Book of James', '2026-02-24 19:00:00', '2026-02-24 20:30:00', false, 'Room 201', 'small-group'),
  ('44444444-4444-4444-4444-444444444438', '11111111-1111-1111-1111-111111111111', 'Ash Wednesday Service', 'Beginning of Lenten season', '2026-02-25 19:00:00', '2026-02-25 20:00:00', false, 'Chapel', 'service'),
  ('44444444-4444-4444-4444-444444444439', '11111111-1111-1111-1111-111111111111', 'Senior Saints', 'Weekly seniors fellowship', '2026-02-26 10:00:00', '2026-02-26 12:00:00', false, 'Room 105', 'small-group'),
  ('44444444-4444-4444-4444-444444444440', '11111111-1111-1111-1111-111111111111', 'Young Adults', 'Weekly young adults gathering', '2026-02-27 19:30:00', '2026-02-27 21:00:00', false, 'Coffee House', 'small-group'),
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'Church Work Day', 'Spring cleaning and maintenance', '2026-02-28 08:00:00', '2026-02-28 12:00:00', false, 'Church Campus', 'event')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ATTENDANCE
-- ============================================
INSERT INTO attendance (id, church_id, person_id, event_id, event_type, event_name, date, checked_in_at) VALUES
  -- January 19 Sunday Service
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:45:00'),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:30:00'),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:50:00'),
  ('55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 09:35:00'),
  ('55555555-5555-5555-5555-555555555505', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000034', NULL, 'sunday', 'Sunday Service', '2025-01-19', '2025-01-19 10:00:00'),
  -- January 26 Sunday Service (more attendees)
  ('55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:45:00'),
  ('55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:55:00'),
  ('55555555-5555-5555-5555-555555555508', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:30:00'),
  ('55555555-5555-5555-5555-555555555509', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:50:00'),
  ('55555555-5555-5555-5555-555555555510', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:35:00'),
  ('55555555-5555-5555-5555-555555555511', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:40:00'),
  ('55555555-5555-5555-5555-555555555512', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:48:00'),
  ('55555555-5555-5555-5555-555555555513', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:52:00'),
  ('55555555-5555-5555-5555-555555555514', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:25:00'),
  ('55555555-5555-5555-5555-555555555515', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', NULL, 'sunday', 'Sunday Service', '2025-01-26', '2025-01-26 09:20:00'),
  -- Small group attendance
  ('55555555-5555-5555-5555-555555555516', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:00:00'),
  ('55555555-5555-5555-5555-555555555517', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 18:55:00'),
  ('55555555-5555-5555-5555-555555555518', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', NULL, 'small-group', 'Men of Faith', '2025-01-21', '2025-01-21 19:05:00'),
  ('55555555-5555-5555-5555-555555555519', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', NULL, 'small-group', 'Young Adults', '2025-01-23', '2025-01-23 19:30:00'),
  ('55555555-5555-5555-5555-555555555520', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', NULL, 'small-group', 'Young Adults', '2025-01-23', '2025-01-23 19:25:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GIVING (Donations)
-- ============================================
INSERT INTO giving (id, church_id, person_id, amount, fund, date, method, is_recurring, note) VALUES
  -- Regular recurring tithes
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-12', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 500.00, 'tithe', '2025-01-05', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666605', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 500.00, 'tithe', '2025-01-19', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666606', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 150.00, 'tithe', '2025-01-05', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666607', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 100.00, 'missions', '2025-01-05', 'online', false, NULL),
  ('66666666-6666-6666-6666-666666666608', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 75.00, 'offering', '2025-01-05', 'cash', false, NULL),
  -- First-time givers
  ('66666666-6666-6666-6666-666666666609', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 50.00, 'tithe', '2025-01-17', 'online', false, 'First gift! Welcome gift from Christopher.'),
  ('66666666-6666-6666-6666-666666666610', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 25.00, 'offering', '2025-01-22', 'card', false, 'First-time visitor first gift.'),
  ('66666666-6666-6666-6666-666666666611', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000016', 100.00, 'tithe', '2025-01-23', 'online', false, 'Brians first tithe - becoming more committed!'),
  -- Large gifts (major donors)
  ('66666666-6666-6666-6666-666666666612', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 5000.00, 'missions', '2025-01-21', 'check', false, 'Year-end missions gift from Richard Anderson.'),
  ('66666666-6666-6666-6666-666666666613', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 2500.00, 'building', '2025-01-14', 'bank', false, 'Building fund contribution.'),
  ('66666666-6666-6666-6666-666666666614', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', 1500.00, 'benevolence', '2025-01-19', 'check', false, 'Patricias quarterly benevolence gift.'),
  ('66666666-6666-6666-6666-666666666615', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', 2000.00, 'missions', '2025-01-24', 'online', false, 'Thomas Wright - missions trip sponsorship.'),
  -- Monthly recurring givers
  ('66666666-6666-6666-6666-666666666616', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 200.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666617', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', 150.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666618', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 300.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666619', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000018', 175.00, 'tithe', '2025-01-01', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666620', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000021', 125.00, 'tithe', '2025-01-01', 'online', true, NULL),
  -- Various fund donations
  ('66666666-6666-6666-6666-666666666621', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000019', 50.00, 'benevolence', '2025-01-10', 'cash', false, NULL),
  ('66666666-6666-6666-6666-666666666622', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000017', 40.00, 'offering', '2025-01-17', 'card', false, NULL),
  ('66666666-6666-6666-6666-666666666623', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 75.00, 'tithe', '2025-01-17', 'online', false, NULL),
  ('66666666-6666-6666-6666-666666666624', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000026', 200.00, 'tithe', '2025-01-21', 'online', false, 'Mark Thompson - new member first gift.'),
  ('66666666-6666-6666-6666-666666666625', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 175.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666626', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000030', 100.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666627', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', 400.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666628', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000033', 200.00, 'tithe', '2025-01-12', 'check', false, NULL),
  ('66666666-6666-6666-6666-666666666629', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000035', 150.00, 'tithe', '2025-01-19', 'online', true, NULL),
  ('66666666-6666-6666-6666-666666666630', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 1000.00, 'tithe', '2025-01-05', 'bank', true, 'Monthly tithe')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CAMPAIGNS (Fundraising)
-- ============================================
INSERT INTO campaigns (id, church_id, name, description, goal_amount, start_date, end_date, fund, is_active) VALUES
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', 'Building Fund 2025', 'Funds for sanctuary renovation and new HVAC system.', 150000.00, '2025-01-01', '2025-12-31', 'building', true),
  ('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111111', 'Southeast Asia Missions', 'Support missionaries in Thailand and Vietnam.', 50000.00, '2025-01-01', '2025-06-30', 'missions', true),
  ('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111111', 'Benevolence Emergency Fund', 'Help families in crisis with rent, utilities, and food.', 20000.00, '2025-01-01', '2025-12-31', 'benevolence', true),
  ('77777777-7777-7777-7777-777777777704', '11111111-1111-1111-1111-111111111111', 'Youth Summer Camp', 'Send youth to summer camp scholarships.', 10000.00, '2025-02-01', '2025-05-31', 'other', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PLEDGES
-- ============================================
INSERT INTO pledges (id, church_id, person_id, campaign_id, amount, frequency, start_date, end_date, fund, status, notes) VALUES
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', '77777777-7777-7777-7777-777777777701', 24000.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$2000/month for building fund'),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', '77777777-7777-7777-7777-777777777702', 12000.00, 'quarterly', '2025-01-01', '2025-06-30', 'missions', 'active', 'Passionate about SE Asia missions'),
  ('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', '77777777-7777-7777-7777-777777777703', 6000.00, 'monthly', '2025-01-01', '2025-12-31', 'benevolence', 'active', '$500/month benevolence'),
  ('88888888-8888-8888-8888-888888888804', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000012', '77777777-7777-7777-7777-777777777702', 6000.00, 'one-time', '2025-01-01', '2025-01-31', 'missions', 'completed', 'Missions trip sponsorship'),
  ('88888888-8888-8888-8888-888888888805', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', '77777777-7777-7777-7777-777777777701', 6000.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$500/month building pledge'),
  ('88888888-8888-8888-8888-888888888806', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', '77777777-7777-7777-7777-777777777701', 3600.00, 'monthly', '2025-01-01', '2025-12-31', 'building', 'active', '$300/month as finance team member')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONATION BATCHES (Sunday collections)
-- ============================================
INSERT INTO donation_batches (id, church_id, batch_date, batch_name, status, total_cash, total_checks, total_amount, check_count, created_by, closed_by, closed_at, notes) VALUES
  ('99999999-9999-9999-9999-999999999901', '11111111-1111-1111-1111-111111111111', '2025-01-05', 'Sunday Collection Jan 5', 'reconciled', 250.00, 1650.00, 1900.00, 4, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-06 10:00:00', 'First Sunday of 2025'),
  ('99999999-9999-9999-9999-999999999902', '11111111-1111-1111-1111-111111111111', '2025-01-12', 'Sunday Collection Jan 12', 'reconciled', 175.00, 1100.00, 1275.00, 3, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-13 10:00:00', NULL),
  ('99999999-9999-9999-9999-999999999903', '11111111-1111-1111-1111-111111111111', '2025-01-19', 'Sunday Collection Jan 19', 'closed', 325.00, 2500.00, 2825.00, 5, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2025-01-20 10:00:00', 'Strong giving week'),
  ('99999999-9999-9999-9999-999999999904', '11111111-1111-1111-1111-111111111111', '2025-01-26', 'Sunday Collection Jan 26', 'open', 150.00, 500.00, 650.00, 2, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, NULL, 'In progress')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BATCH ITEMS (Individual items in batches)
-- ============================================
INSERT INTO batch_items (id, batch_id, person_id, amount, method, fund, check_number, memo) VALUES
  -- Jan 5 batch
  ('aaaaaa01-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1234', NULL),
  ('aaaaaa02-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000008', 150.00, 'check', 'tithe', '5678', NULL),
  ('aaaaaa03-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000024', 1000.00, 'check', 'tithe', '9012', 'Monthly tithe'),
  ('aaaaaa04-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000006', 75.00, 'cash', 'offering', NULL, NULL),
  ('aaaaaa05-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', NULL, 175.00, 'cash', 'offering', NULL, 'Anonymous cash'),
  -- Jan 12 batch
  ('aaaaaa06-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000032', 400.00, 'check', 'tithe', '3456', NULL),
  ('aaaaaa07-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000033', 200.00, 'check', 'tithe', '3457', NULL),
  ('aaaaaa08-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1235', NULL),
  ('aaaaaa09-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999902', NULL, 175.00, 'cash', 'offering', NULL, 'Loose plate'),
  -- Jan 19 batch
  ('aaaaaa10-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000004', 500.00, 'check', 'tithe', '1236', NULL),
  ('aaaaaa11-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000025', 1500.00, 'check', 'benevolence', '7890', 'Quarterly gift'),
  ('aaaaaa12-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000019', 50.00, 'cash', 'benevolence', NULL, NULL),
  ('aaaaaa13-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', NULL, 275.00, 'cash', 'offering', NULL, 'Loose plate'),
  ('aaaaaa14-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999903', '00000000-0000-0000-0000-000000000008', 500.00, 'check', 'building', '5679', 'Building fund')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RECURRING GIVING
-- ============================================
INSERT INTO recurring_giving (id, church_id, person_id, amount, frequency, fund, next_date, status) VALUES
  ('bbbbbb01-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 250.00, 'weekly', 'tithe', '2025-01-26', 'active'),
  ('bbbbbb02-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 150.00, 'weekly', 'tithe', '2025-01-26', 'active'),
  ('bbbbbb03-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 200.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb04-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', 150.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb05-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 300.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb06-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 1000.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb07-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000029', 175.00, 'monthly', 'tithe', '2025-02-01', 'active'),
  ('bbbbbb08-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000030', 100.00, 'monthly', 'tithe', '2025-02-01', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SCHEDULED MESSAGES
-- ============================================
INSERT INTO scheduled_messages (id, church_id, person_id, channel, subject, body, scheduled_for, status, source_type, source_agent, ai_generated, created_by) VALUES
  -- Birthday messages
  ('cccccc01-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 'email', 'Happy Birthday, Cam!', 'Dear Cam,\n\nWishing you a wonderful birthday filled with Gods blessings! We are so grateful for you and your gifts on the worship team.\n\nMay this year bring you closer to Gods purpose for your life.\n\nWith love,\nGrace Community Church', '2025-01-24 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc02-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000009', 'both', 'Happy Birthday Tomorrow, Amanda!', 'Dear Amanda,\n\nJust a note to let you know were thinking of you as your special day approaches! Your heart for prayer and encouragement blesses so many.\n\nHave a blessed birthday!\n\nGrace Community Church', '2025-01-25 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc03-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'email', 'Birthday Blessings, James!', 'Dear James,\n\nHappy birthday! Thank you for your faithful service on the greeting team. Your warm welcome makes such a difference to everyone who walks through our doors.\n\nMay God bless you abundantly this year!\n\nGrace Community Church', '2025-01-26 09:00:00', 'scheduled', 'birthday', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Membership anniversary messages
  ('cccccc04-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 'email', 'Celebrating 1 Year Together!', 'Dear Rachel,\n\nCan you believe its been a year since you joined our church family? We are so blessed to have you, especially your dedication to our childrens ministry.\n\nThank you for being part of Grace Community Church!\n\nWith gratitude,\nPastor John', '2025-01-24 10:00:00', 'scheduled', 'anniversary', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc05-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000018', 'email', 'Happy 2-Year Anniversary!', 'Dear Daniel,\n\nTwo years ago you became part of our family, and we couldnt be more grateful! Your faithful service as an usher has been such a blessing.\n\nThank you for your commitment to Grace Community Church.\n\nBlessings,\nPastor John', '2025-01-26 10:00:00', 'scheduled', 'anniversary', 'life-event-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Donation thank you messages
  ('cccccc06-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'email', 'Thank You for Your Generous Missions Gift', 'Dear Richard,\n\nThank you for your extraordinary gift of $5,000 to our missions fund. Your generosity will help support missionaries around the world.\n\nYour heart for missions is truly inspiring.\n\nWith deep gratitude,\nPastor John', '2025-01-21 14:00:00', 'sent', 'donation', 'donation-processing-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc07-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'Thank You for Your First Gift!', 'Dear Christopher,\n\nThank you so much for your generous gift! Were honored that you chose to support Grace Community Church.\n\nYour giving helps us serve our community.\n\nBlessings,\nGrace Community Church', '2025-01-17 15:00:00', 'sent', 'donation', 'donation-processing-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Welcome/follow-up messages
  ('cccccc08-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'email', 'Welcome to Grace Community Church!', 'Dear Cam,\n\nIt was wonderful to have you visit us! We hope you felt at home and experienced Gods presence with us.\n\nWed love to help you get connected. Our newcomers lunch is this Sunday after service.\n\nWarmly,\nPastor John', '2025-01-22 10:00:00', 'sent', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc09-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'both', 'Great to Meet You, Marcus!', 'Hi Marcus,\n\nIt was great to have you visit! James mentioned youre his coworker - were so glad he invited you.\n\nHope to see you again soon!\n\nPastor John', '2025-01-24 10:00:00', 'scheduled', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cccccc10-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000015', 'email', 'Welcome, Ashley! Info About Young Adults', 'Hi Ashley,\n\nWelcome to Grace Community Church! I heard youre interested in our young adults group.\n\nWe meet every Thursday at 7:30 PM at the Coffee House downtown. Kevin Martinez leads the group.\n\nSee you soon!\nPastor John', '2025-01-25 10:00:00', 'scheduled', 'follow_up', 'new-member-agent', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  -- Drip campaign messages
  ('cccccc11-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000026', 'email', 'Getting Connected at Grace', 'Hi Mark,\n\nIts been a week since you joined our church family - welcome again! We want to help you get connected.\n\nHere are some ways to get involved:\n- Join a small group\n- Serve on a team\n- Attend our monthly fellowship dinner\n\nLet us know how we can help!\n\nBlessings,\nGrace Community Church', '2025-01-26 09:00:00', 'scheduled', 'drip_campaign', 'new-member-agent', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MESSAGE ARCHIVE (Sent messages history)
-- ============================================
INSERT INTO message_archive (id, church_id, person_id, scheduled_message_id, channel, direction, subject, body, sent_at, delivered_at, opened_at, provider, external_id, status) VALUES
  ('dddddd01-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'cccccc06-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Thank You for Your Generous Missions Gift', 'Dear Richard,\n\nThank you for your extraordinary gift of $5,000...', '2025-01-21 14:00:00', '2025-01-21 14:01:00', '2025-01-21 16:30:00', 'resend', 'msg_abc123', 'opened'),
  ('dddddd02-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'cccccc07-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Thank You for Your First Gift!', 'Dear Christopher,\n\nThank you so much for your generous gift...', '2025-01-17 15:00:00', '2025-01-17 15:01:00', '2025-01-17 18:00:00', 'resend', 'msg_def456', 'opened'),
  ('dddddd03-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'cccccc08-cccc-cccc-cccc-cccccccccccc', 'email', 'outbound', 'Welcome to Grace Community Church!', 'Dear Cam,\n\nIt was wonderful to have you visit us...', '2025-01-22 10:00:00', '2025-01-22 10:01:00', '2025-01-22 11:15:00', 'resend', 'msg_ghi789', 'opened'),
  ('dddddd04-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', NULL, 'email', 'outbound', 'We Miss You, Emily', 'Dear Emily,\n\nWeve noticed youve been away for a while. We wanted to reach out...', '2025-01-10 09:00:00', '2025-01-10 09:01:00', NULL, 'resend', 'msg_jkl012', 'delivered'),
  ('dddddd05-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', NULL, 'email', 'outbound', 'Thinking of You', 'Dear Michelle,\n\nWe heard about your mothers health situation...', '2025-01-12 10:00:00', '2025-01-12 10:01:00', '2025-01-12 14:30:00', 'resend', 'msg_mno345', 'opened')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- INBOUND MESSAGES (Replies)
-- ============================================
INSERT INTO inbound_messages (id, church_id, person_id, channel, from_address, subject, body, ai_category, ai_sentiment, ai_suggested_response, ai_confidence, status, in_reply_to, received_at) VALUES
  ('eeeeee01-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000013', 'email', 'camd1993@gmail.com', 'Re: Welcome to Grace Community Church!', 'Thank you so much for the warm welcome! Yes, I would love to attend the newcomers lunch this Sunday. Is there anything I should bring?\n\nAlso, do you have a womens Bible study? Id love to get connected with other women in the church.\n\nThanks,\nCam', 'question', 'positive', 'Great to hear from you! No need to bring anything to the newcomers lunch - just yourself! And yes, we have a wonderful womens Bible study that meets Wednesday mornings at 9:30 AM. Amanda Foster leads it and would love to have you join.', 0.92, 'new', 'dddddd03-dddd-dddd-dddd-dddddddddddd', '2025-01-22 13:00:00'),
  ('eeeeee02-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 'email', 'richard.a@email.com', 'Re: Thank You for Your Generous Missions Gift', 'Pastor John,\n\nThank you for the kind note. I feel strongly led to support our missionaries, especially the team in Southeast Asia.\n\nI would love to meet and discuss how the church is supporting missions work. Could we schedule a lunch next week?\n\nRichard', 'other', 'positive', 'Richard, thank you so much for your heart for missions! I would be honored to meet with you. How about Tuesday or Wednesday of next week? Looking forward to our conversation!', 0.88, 'new', 'dddddd01-dddd-dddd-dddd-dddddddddddd', '2025-01-21 18:00:00'),
  ('eeeeee03-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'sms', '(555) 567-8901', NULL, 'Hi Pastor, sorry I havent been around. Work has been really hard and Im struggling. Could use some prayer.', 'prayer_request', 'negative', 'Emily, thank you for reaching out. Im so sorry to hear youre struggling. Youre not alone - were here for you. Can I call you this week? Wed love to pray with you.', 0.95, 'flagged', NULL, '2025-01-23 15:30:00'),
  ('eeeeee04-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000014', 'sms', '(555) 456-7801', NULL, 'Hey, thanks for the message! Church was different than I expected - in a good way. James said theres a mens group? When does that meet?', 'question', 'positive', 'So glad you enjoyed your visit, Marcus! Yes, we have a great mens group called Men of Faith that meets Tuesdays at 7 PM in Room 201. Robert Chen leads it and James is a regular. Would you like James to bring you next week?', 0.91, 'new', NULL, '2025-01-24 10:30:00'),
  ('eeeeee05-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'email', 'michelle.y@email.com', 'Prayer Request - Urgent', 'Dear Pastor,\n\nI need to ask for urgent prayer. My mother was just diagnosed with cancer and were all in shock. The doctors say its stage 3.\n\nI know I havent been to church in a while but I dont know where else to turn. Could the prayer team pray for her? Her name is Dorothy Young.\n\nThank you,\nMichelle', 'prayer_request', 'urgent', 'Dear Michelle, Im so sorry to hear about your mothers diagnosis. Please know that you and Dorothy are in our prayers right now. Im adding her to our prayer chain immediately. Can I call you today?', 0.97, 'flagged', NULL, '2025-01-24 08:30:00'),
  ('eeeeee06-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000020', 'email', 'chris.hall@email.com', 'Re: Thank You for Your First Gift!', 'Thanks for the note! Happy to support the church. Quick question - is there a way to set up automatic monthly giving? Id like to be more consistent.', 'question', 'positive', 'Great question, Christopher! Yes, you can set up recurring giving through our online portal at give.gracechurch.org. Just select Make this recurring when you enter your gift. If you need any help, our finance team can assist.', 0.93, 'new', 'dddddd02-dddd-dddd-dddd-dddddddddddd', '2025-01-18 09:45:00'),
  ('eeeeee07-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000006', 'email', 'cdeichmiller11@gmail.com', 'Re: Happy Birthday!', 'Thank you so much for the birthday wishes! I feel so blessed to be part of this church family. See you Sunday!', 'thanks', 'positive', 'Youre so welcome! Were blessed to have you. Looking forward to seeing you Sunday!', 0.96, 'read', NULL, '2025-01-24 11:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DAILY DIGESTS
-- ============================================
INSERT INTO daily_digests (id, church_id, user_id, digest_date, priority_tasks, people_to_contact, messages_to_send, birthdays_today, follow_ups_due, ai_summary, ai_recommendations, generated_at, viewed_at) VALUES
  ('ffffff01-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2025-01-24',
   '[{"id": "22222222-2222-2222-2222-222222222203", "title": "Check in on Emily Johnson", "priority": "medium"}, {"id": "22222222-2222-2222-2222-222222222209", "title": "Check on Michelle Youngs family", "priority": "high"}]',
   '[{"id": "00000000-0000-0000-0000-000000000005", "name": "Emily Johnson", "reason": "Inactive member reached out"}, {"id": "00000000-0000-0000-0000-000000000023", "name": "Michelle Young", "reason": "Urgent prayer request"}]',
   '[{"id": "cccccc01-cccc-cccc-cccc-cccccccccccc", "personName": "Cam Deich", "type": "birthday"}, {"id": "cccccc04-cccc-cccc-cccc-cccccccccccc", "personName": "Rachel Kim", "type": "anniversary"}]',
   '[{"id": "00000000-0000-0000-0000-000000000006", "name": "Cam Deich"}]',
   '[{"id": "00000000-0000-0000-0000-000000000013", "name": "Cam 1993", "daysSinceVisit": 3}, {"id": "00000000-0000-0000-0000-000000000014", "name": "Marcus Taylor", "daysSinceVisit": 1}]',
   'Today requires attention to pastoral care. Michelle Youngs urgent prayer request about her mothers cancer diagnosis should be prioritized. Emily Johnson also reached out after being inactive. Two birthdays today (Cam Deich) and Rachel Kims 1-year membership anniversary. Good day for visitor follow-up with 2 recent visitors.',
   '["Call Michelle Young immediately regarding her mothers diagnosis", "Follow up with Emily Johnson - she reached out about work struggles", "Send birthday greeting to Cam Deich", "Acknowledge Rachel Kims 1-year anniversary", "Plan visitor follow-up for Marcus Taylor"]',
   '2025-01-24 06:00:00', '2025-01-24 08:15:00')
ON CONFLICT DO NOTHING;

-- ============================================
-- DRIP CAMPAIGNS
-- ============================================
INSERT INTO drip_campaigns (id, church_id, name, description, trigger_type, is_active, created_by) VALUES
  ('11112222-1111-2222-1111-222211112222', '11111111-1111-1111-1111-111111111111', 'New Visitor Welcome Sequence', 'Automated welcome series for first-time visitors over 30 days.', 'new_visitor', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112223', '11111111-1111-1111-1111-111111111111', 'New Member Onboarding', 'Help new members get connected in their first 60 days.', 'new_member', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112224', '11111111-1111-1111-1111-111111111111', 'First-Time Giver Follow-up', 'Thank and encourage first-time givers.', 'donation', true, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('11112222-1111-2222-1111-222211112225', '11111111-1111-1111-1111-111111111111', 'Re-engagement Campaign', 'Reach out to inactive members.', 'manual', false, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DRIP CAMPAIGN STEPS
-- ============================================
INSERT INTO drip_campaign_steps (id, campaign_id, step_number, delay_days, delay_hours, channel, subject, body, use_ai_personalization) VALUES
  -- New Visitor Welcome Sequence
  ('22223333-2222-3333-2222-333322223331', '11112222-1111-2222-1111-222211112222', 1, 0, 2, 'email', 'Welcome to Grace Community Church!', 'Dear {{first_name}},\n\nThank you for visiting Grace Community Church! We hope you felt welcome and experienced Gods love with us.\n\nWed love to help you get connected. Feel free to reach out with any questions.\n\nBlessings,\nPastor John', true),
  ('22223333-2222-3333-2222-333322223332', '11112222-1111-2222-1111-222211112222', 2, 3, 0, 'email', 'Getting to Know Grace Church', 'Hi {{first_name}},\n\nWe wanted to share a bit more about who we are and what we believe. At Grace Community Church, we...\n\nHope to see you again soon!', false),
  ('22223333-2222-3333-2222-333322223333', '11112222-1111-2222-1111-222211112222', 3, 7, 0, 'both', 'An Invitation Just for You', 'Hi {{first_name}},\n\nWed love to invite you to our Newcomers Lunch this Sunday! Its a great way to meet others and learn about ways to get involved.\n\nNo RSVP needed - just come!', true),
  ('22223333-2222-3333-2222-333322223334', '11112222-1111-2222-1111-222211112222', 4, 14, 0, 'email', 'Find Your Place at Grace', 'Hi {{first_name}},\n\nWere so glad youve been visiting! Here are some ways to get more connected:\n\n- Small Groups\n- Serving Teams\n- Classes\n\nLet us know how we can help!', false),
  ('22223333-2222-3333-2222-333322223335', '11112222-1111-2222-1111-222211112222', 5, 30, 0, 'email', 'Checking In', 'Hi {{first_name}},\n\nIts been a month since your first visit. How are you doing? Wed love to hear from you and answer any questions.\n\nWere here for you!', true),
  -- New Member Onboarding
  ('22223333-2222-3333-2222-333322223336', '11112222-1111-2222-1111-222211112223', 1, 0, 1, 'email', 'Welcome to the Family!', 'Dear {{first_name}},\n\nCongratulations on becoming a member of Grace Community Church! Were so excited to have you as part of our family.\n\nHeres what to expect in your first few weeks...', true),
  ('22223333-2222-3333-2222-333322223337', '11112222-1111-2222-1111-222211112223', 2, 7, 0, 'email', 'Getting Connected - Week 1', 'Hi {{first_name}},\n\nIts been a week since you joined! Here are some ways to get connected:\n\n- Join a Small Group\n- Sign up to serve\n- Attend our next fellowship event', false),
  ('22223333-2222-3333-2222-333322223338', '11112222-1111-2222-1111-222211112223', 3, 30, 0, 'email', 'One Month Check-In', 'Hi {{first_name}},\n\nCan you believe its been a month already? How has your experience been so far? Wed love to hear from you!', true),
  ('22223333-2222-3333-2222-333322223339', '11112222-1111-2222-1111-222211112223', 4, 60, 0, 'email', 'Two Month Milestone', 'Hi {{first_name}},\n\nYouve been part of our church family for two months now! We hope youre feeling at home.\n\nHave you found a small group or serving opportunity yet? Let us know how we can help!', false),
  -- First-Time Giver Follow-up
  ('22223333-2222-3333-2222-333322223340', '11112222-1111-2222-1111-222211112224', 1, 0, 0, 'email', 'Thank You for Your Gift!', 'Dear {{first_name}},\n\nThank you for your generous gift to Grace Community Church! Your giving helps us serve our community and share Gods love.\n\nWere so grateful for you!', true),
  ('22223333-2222-3333-2222-333322223341', '11112222-1111-2222-1111-222211112224', 2, 7, 0, 'email', 'Your Impact at Grace', 'Hi {{first_name}},\n\nWe wanted to share how your giving is making a difference. This month, your generosity helped us...\n\nThank you for partnering with us!', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DRIP CAMPAIGN ENROLLMENTS
-- ============================================
INSERT INTO drip_campaign_enrollments (id, campaign_id, person_id, current_step, status, enrolled_at, completed_at, next_message_at) VALUES
  -- Visitor welcome sequence enrollments
  ('33334444-3333-4444-3333-444433334441', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000013', 2, 'active', '2025-01-21 12:00:00', NULL, '2025-01-28 12:00:00'),
  ('33334444-3333-4444-3333-444433334442', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000014', 1, 'active', '2025-01-23 12:00:00', NULL, '2025-01-26 12:00:00'),
  ('33334444-3333-4444-3333-444433334443', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000015', 1, 'active', '2025-01-24 12:00:00', NULL, '2025-01-27 12:00:00'),
  ('33334444-3333-4444-3333-444433334444', '11112222-1111-2222-1111-222211112222', '00000000-0000-0000-0000-000000000034', 1, 'active', '2025-01-19 12:00:00', NULL, '2025-01-22 12:00:00'),
  -- New member onboarding enrollments
  ('33334444-3333-4444-3333-444433334445', '11112222-1111-2222-1111-222211112223', '00000000-0000-0000-0000-000000000026', 2, 'active', '2025-01-05 10:00:00', NULL, '2025-02-04 10:00:00'),
  ('33334444-3333-4444-3333-444433334446', '11112222-1111-2222-1111-222211112223', '00000000-0000-0000-0000-000000000007', 1, 'active', '2025-01-05 10:00:00', NULL, '2025-01-12 10:00:00'),
  -- First-time giver enrollments
  ('33334444-3333-4444-3333-444433334447', '11112222-1111-2222-1111-222211112224', '00000000-0000-0000-0000-000000000020', 2, 'active', '2025-01-17 15:00:00', NULL, '2025-01-24 15:00:00'),
  ('33334444-3333-4444-3333-444433334448', '11112222-1111-2222-1111-222211112224', '00000000-0000-0000-0000-000000000016', 1, 'active', '2025-01-23 12:00:00', NULL, '2025-01-30 12:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- GIVING STATEMENTS (Year-end tax statements)
-- ============================================
INSERT INTO giving_statements (id, church_id, person_id, year, total_amount, by_fund, generated_at, sent_at, sent_method) VALUES
  ('44445555-4444-5555-4444-555544445551', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000024', 2024, 48000.00, '{"tithe": 24000, "missions": 15000, "building": 9000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445552', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000025', 2024, 18000.00, '{"tithe": 12000, "benevolence": 6000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445553', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 2024, 13000.00, '{"tithe": 13000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445554', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000004', 2024, 26000.00, '{"tithe": 26000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445555', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000008', 2024, 15600.00, '{"tithe": 10400, "missions": 3200, "building": 2000}', '2025-01-15 10:00:00', '2025-01-16 09:00:00', 'email'),
  ('44445555-4444-5555-4444-555544445556', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000032', 2024, 9600.00, '{"tithe": 9600}', '2025-01-15 10:00:00', NULL, 'print')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- END OF SEED DATA
-- ============================================
-- Run this file with: psql -f seed.sql
-- Or in Supabase dashboard: SQL Editor > paste and run
