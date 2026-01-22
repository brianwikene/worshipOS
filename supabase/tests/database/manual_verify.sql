-- /supabase/tests/database/manual_verify.sql
-- 1. Setup: Clean slate
TRUNCATE public.care_cases RESTART IDENTITY CASCADE;

-- 2. Create a "Leader" User
INSERT INTO auth.users (id, email) VALUES
('11111111-1111-1111-1111-111111111111', 'leader@test.com')
ON CONFLICT (id) DO NOTHING;

-- 3. Create a Case assigned to that Leader
INSERT INTO public.care_cases (title, assigned_to)
VALUES ('Confidential Leader Task', '11111111-1111-1111-1111-111111111111');

-- TEST A: Can the Leader see it?
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT 'TEST A: Leader View (Should see 1 row)' as check_name;
SELECT title FROM public.care_cases;

-- TEST B: Can a Random User see it?
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; -- Different ID

SELECT 'TEST B: Intruder View (Should be EMPTY)' as check_name;
SELECT title FROM public.care_cases;
