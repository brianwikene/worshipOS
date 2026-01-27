-- Care RLS: only 'care' and 'pastor' memberships can read/write Care
BEGIN;

-- Enable RLS only on Care tables
ALTER TABLE "public"."care_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."care_notes" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent-ish)
DROP POLICY IF EXISTS care_cases_read ON "public"."care_cases";
DROP POLICY IF EXISTS care_cases_write ON "public"."care_cases";
DROP POLICY IF EXISTS care_notes_read ON "public"."care_notes";
DROP POLICY IF EXISTS care_notes_write ON "public"."care_notes";

-- Read: care + pastor
CREATE POLICY care_cases_read
ON "public"."care_cases"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "public"."church_memberships" m
    WHERE m.user_id = auth.uid()
      AND m.church_id = "public"."care_cases".church_id
      AND m.role IN ('care','pastor')
  )
);

CREATE POLICY care_notes_read
ON "public"."care_notes"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "public"."church_memberships" m
    WHERE m.user_id = auth.uid()
      AND m.church_id = "public"."care_notes".church_id
      AND m.role IN ('care','pastor')
  )
);

-- Write: care + pastor
CREATE POLICY care_cases_write
ON "public"."care_cases"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."church_memberships" m
    WHERE m.user_id = auth.uid()
      AND m.church_id = "public"."care_cases".church_id
      AND m.role IN ('care','pastor')
  )
);

CREATE POLICY care_notes_write
ON "public"."care_notes"
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "public"."church_memberships" m
    WHERE m.user_id = auth.uid()
      AND m.church_id = "public"."care_notes".church_id
      AND m.role IN ('care','pastor')
  )
);

COMMIT;
