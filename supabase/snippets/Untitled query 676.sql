-- Enable encryption extension if missing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert the user safely
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'pastor@worship.os',
  crypt('password123', gen_salt('bf')), -- This encrypts the password
  now(), -- Auto-confirm the email
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  ''
);