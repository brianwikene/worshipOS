-- /supabase/tests/database/01_security.sql
BEGIN;
SELECT plan(4); -- We are running 4 tests

-- 1. Setup: Create two fake users (Leader and Member)
SELECT tests.create_supabase_user('leader');
SELECT tests.create_supabase_user('member');

-- 2. Setup: Insert a Care Case assigned to the LEADER
INSERT INTO public.care_cases (title, assigned_to)
VALUES ('Confidential Meeting', tests.get_supabase_uid('leader'));

-- 3. TEST: Can the LEADER see it? (Should be YES)
SELECT tests.authenticate_as('leader');
SELECT results_eq(
    $$ SELECT title FROM public.care_cases $$,
    $$ VALUES ('Confidential Meeting') $$,
    'Leader should see their own case'
);

-- 4. TEST: Can the MEMBER see it? (Should be NO)
SELECT tests.authenticate_as('member');
SELECT is_empty(
    $$ SELECT * FROM public.care_cases $$,
    'Member should NOT see the leaders case'
);

-- 5. TEST: Can the MEMBER see TEND signals? (Should be YES)
-- First, insert a signal (as postgres/superuser so we have permission to write)
SET ROLE postgres;
INSERT INTO public.tend_signals (signal_type) VALUES ('Overworked');

-- Switch back to member
SELECT tests.authenticate_as('member');
SELECT results_eq(
    $$ SELECT signal_type FROM public.tend_signals $$,
    $$ VALUES ('Overworked') $$,
    'Member SHOULD see tend signals (broad visibility)'
);

SELECT * FROM finish();
ROLLBACK;
