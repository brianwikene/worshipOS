BEGIN;

-- 1. PREP PARENT: Ensure service_instances allows composite references
-- We need this UNIQUE constraint to point the new Foreign Keys at it.
ALTER TABLE service_instances
ADD CONSTRAINT unique_instance_church_id UNIQUE (church_id, id);

-- 2. FIX: service_instance_songs (The one missing the column)
ALTER TABLE service_instance_songs ADD COLUMN church_id UUID;

-- Backfill data based on the parent relationship
UPDATE service_instance_songs child
SET church_id = parent.church_id
FROM service_instances parent
WHERE child.service_instance_id = parent.id
AND child.church_id IS NULL;

ALTER TABLE service_instance_songs
  ALTER COLUMN church_id SET NOT NULL;

-- 3. APPLY COMPOSITE KEYS (The "Strict Tenancy" Lock)

-- A. Service Instance Songs
ALTER TABLE service_instance_songs
  ADD CONSTRAINT fk_sis_strict_tenancy
  FOREIGN KEY (church_id, service_instance_id)
  REFERENCES service_instances(church_id, id) ON DELETE CASCADE;

CREATE INDEX idx_sis_church_instance
  ON service_instance_songs(church_id, service_instance_id);

-- B. Service Instance Sections (Column already existed, just adding the lock)
-- Note: We drop the old weak constraint first if it exists, usually named implicitly.
-- For safety, we just add the new strong one.
ALTER TABLE service_instance_sections
  ADD CONSTRAINT fk_sisec_strict_tenancy
  FOREIGN KEY (church_id, service_instance_id)
  REFERENCES service_instances(church_id, id) ON DELETE CASCADE;

-- C. Service Items (Column already existed)
ALTER TABLE service_items
  ADD CONSTRAINT fk_sitems_strict_tenancy
  FOREIGN KEY (church_id, service_instance_id)
  REFERENCES service_instances(church_id, id) ON DELETE CASCADE;

-- D. Service Team Assignments (Column already existed)
ALTER TABLE service_team_assignments
  ADD CONSTRAINT fk_sta_strict_tenancy
  FOREIGN KEY (church_id, service_instance_id)
  REFERENCES service_instances(church_id, id) ON DELETE CASCADE;


-- 4. STATUS CONSTRAINTS (Keeping this from the previous plan)
UPDATE service_assignments
SET status = 'pending'
WHERE status NOT IN ('pending', 'confirmed', 'declined', 'tentative');

ALTER TABLE service_assignments
ADD CONSTRAINT chk_assignment_status_valid
CHECK (status IN ('pending', 'confirmed', 'declined', 'tentative'));

COMMIT;
