-- =====================================================
-- WorshipOS Schema Migration
-- Fixes schema mismatches and adds missing tables
-- =====================================================

-- Add missing campus_id column to service_instances
-- This fixes the API query that expects this column
ALTER TABLE service_instances 
ADD COLUMN campus_id UUID;

-- Create campuses table (referenced but doesn't exist)
CREATE TABLE IF NOT EXISTS campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT campuses_org_id_fkey 
        FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT campuses_org_id_name_key 
        UNIQUE (org_id, name)
);

-- Add foreign key constraint for campus_id
ALTER TABLE service_instances
ADD CONSTRAINT service_instances_campus_id_fkey 
    FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL;

-- Add index for campus lookups
CREATE INDEX idx_service_instances_campus 
ON service_instances(campus_id);

-- =====================================================
-- Optional: Clean up redundant fields
-- (Uncomment if you want to remove service_date and name from service_instances)
-- =====================================================

-- These fields are redundant since they're in service_groups
-- ALTER TABLE service_instances DROP COLUMN service_date;
-- ALTER TABLE service_instances DROP COLUMN name;

-- =====================================================
-- Add useful indexes for common queries
-- =====================================================

-- Index for org-based service queries
CREATE INDEX IF NOT EXISTS idx_service_instances_org_date 
ON service_instances(org_id, service_date);

-- =====================================================
-- Verification queries (run these to check your work)
-- =====================================================

-- Check the updated service_instances structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'service_instances'
-- ORDER BY ordinal_position;

-- Check foreign key constraints
-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'service_instances'
--     AND tc.constraint_type = 'FOREIGN KEY';
