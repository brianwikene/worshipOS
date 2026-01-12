-- Re-assign the "Hospital Visit" case to your specific user ID
UPDATE public.care_cases
SET assigned_to = '5dd88ab5-0e94-4727-b659-4f3770526dc9'
WHERE title = 'Hospital Visit - Jen Doe';