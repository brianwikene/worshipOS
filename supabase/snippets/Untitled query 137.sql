-- 1. CLEANUP DATA FIRST (The Children)
-- We wipe the care cases so they stop referencing the user.
TRUNCATE public.care_cases, public.tend_signals RESTART IDENTITY CASCADE;

-- 2. CLEANUP USER SECOND (The Parent)
-- Now it is safe to delete the user because no cases are pointing to them.
DELETE FROM auth.users WHERE email = 'pastor@worship.os';

-- 3. RECREATE USER (With the Fixed ID)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, 
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
  created_at, updated_at, confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- The Fixed ID
  'authenticated',
  'authenticated',
  'pastor@worship.os',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  ''
);

-- 4. RECREATE DATA
INSERT INTO public.care_cases (title, status, sensitivity_level, assigned_to) 
VALUES (
  'Hospital Visit - Jen Doe', 
  'open', 
  'normal',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' -- Matches the ID above
);

INSERT INTO public.tend_signals (signal_type, severity, data) VALUES
('Volunteer Fatigue', 'warning', '{"name": "Sarah Jones", "weeks_served": 6}');