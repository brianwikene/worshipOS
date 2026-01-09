-- =====================================================
-- WorshipOS Complete Updated Schema
-- Generated: December 2025
-- This is the complete schema WITH fixes applied
-- =====================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Organizations (multi-tenancy root)
CREATE TABLE orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- People (members, volunteers, staff)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL
);

-- Contexts (service types: Sunday Morning, Wednesday Night, etc.)
CREATE TABLE contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    UNIQUE (org_id, name)
);

-- Campuses (physical locations)
CREATE TABLE campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (org_id, name)
);

-- =====================================================
-- ROLES & CAPABILITIES
-- =====================================================

-- Roles (Worship Leader, Sound Tech, Greeter, etc.)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    load_weight INTEGER DEFAULT 10 NOT NULL,
    UNIQUE (org_id, name)
);

-- Person's capabilities for specific roles
CREATE TABLE person_role_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id),
    proficiency SMALLINT DEFAULT 3 NOT NULL CHECK (proficiency IS NULL OR (proficiency >= 1 AND proficiency <= 5)),
    is_primary BOOLEAN DEFAULT false NOT NULL,
    is_approved BOOLEAN DEFAULT true NOT NULL,
    notes TEXT,
    verified_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (person_id, role_id)
);

-- Service role requirements (how many of each role needed per context)
CREATE TABLE service_role_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    context_id UUID NOT NULL REFERENCES contexts(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    min_needed INTEGER DEFAULT 1 NOT NULL,
    max_needed INTEGER,
    UNIQUE (context_id, role_id)
);

-- =====================================================
-- SERVICES & SCHEDULING
-- =====================================================

-- Service Groups (represents a service on a specific date, e.g., "Sunday Dec 14")
CREATE TABLE service_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    group_date DATE NOT NULL,
    name TEXT NOT NULL,
    context_id UUID REFERENCES contexts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Service Instances (specific service times within a group, e.g., 9am, 11am)
CREATE TABLE service_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    service_group_id UUID REFERENCES service_groups(id) ON DELETE SET NULL,
    campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,  -- ADDED: Fixed schema mismatch
    service_date DATE NOT NULL,
    service_time TIME WITHOUT TIME ZONE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Team assignments for service instances
CREATE TABLE service_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    service_instance_id UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    status TEXT DEFAULT 'scheduled' NOT NULL,
    UNIQUE (service_instance_id, person_id, role_id)
);

-- =====================================================
-- WORSHIP & SONGS
-- =====================================================

-- Songs
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ccli_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Song Variants (different arrangements/keys of same song)
CREATE TABLE song_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_key TEXT,
    tempo INTEGER,
    time_signature TEXT,
    content JSONB DEFAULT '{}'::jsonb NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Service Items (songs and other elements in service order)
CREATE TABLE service_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    service_instance_id UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    song_variant_id UUID REFERENCES song_variants(id),
    notes TEXT
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Service lookups
CREATE INDEX idx_service_groups_org_date ON service_groups(org_id, group_date);
CREATE INDEX idx_service_instances_group ON service_instances(service_group_id);
CREATE INDEX idx_service_instances_campus ON service_instances(campus_id);  -- ADDED
CREATE INDEX idx_service_instances_org_date ON service_instances(org_id, service_date);  -- ADDED

-- Team assignments
CREATE INDEX idx_service_team_assignments_instance ON service_team_assignments(service_instance_id);

-- Service items
CREATE INDEX idx_service_items_instance_sort ON service_items(service_instance_id, sort_order);

-- Person capabilities
CREATE INDEX idx_person_role_capabilities_person ON person_role_capabilities(person_id);
CREATE INDEX idx_person_role_capabilities_role ON person_role_capabilities(role_id);

-- =====================================================
-- SAMPLE SEED DATA (for testing)
-- =====================================================

-- Uncomment to insert test data:

/*
-- Create organization
INSERT INTO orgs (id, name) VALUES 
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Mountain Vineyard Church');

-- Create campuses
INSERT INTO campuses (org_id, name, location) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Main Campus', 'Auburn, WA'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'North Campus', 'Federal Way, WA');

-- Create contexts
INSERT INTO contexts (org_id, name, description) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Sunday Morning', 'Main worship service'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Wednesday Night', 'Midweek service');

-- Create roles
INSERT INTO roles (org_id, name, load_weight) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Worship Leader', 20),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Vocalist', 10),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Sound Tech', 15),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Greeter', 5);

-- Create people
INSERT INTO people (org_id, display_name) VALUES
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Brian Wikene'),
    ('a8c2c7ab-836a-4ef1-a373-562e20babb76', 'Heather Wikene');

-- Assign capabilities
INSERT INTO person_role_capabilities (org_id, person_id, role_id, proficiency, is_primary)
SELECT 
    'a8c2c7ab-836a-4ef1-a373-562e20babb76',
    p.id,
    r.id,
    5,
    true
FROM people p, roles r
WHERE p.display_name = 'Brian Wikene' 
  AND r.name = 'Worship Leader';

-- Create upcoming services
INSERT INTO service_groups (org_id, group_date, name, context_id)
SELECT 
    'a8c2c7ab-836a-4ef1-a373-562e20babb76',
    CURRENT_DATE + interval '1 week',
    'Sunday Morning',
    c.id
FROM contexts c
WHERE c.name = 'Sunday Morning';

-- Create service instances (9am and 11am)
WITH latest_group AS (
    SELECT id FROM service_groups 
    WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'
    ORDER BY created_at DESC LIMIT 1
),
main_campus AS (
    SELECT id FROM campuses 
    WHERE org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'
      AND name = 'Main Campus'
)
INSERT INTO service_instances (org_id, service_group_id, campus_id, service_date, service_time, name)
SELECT 
    'a8c2c7ab-836a-4ef1-a373-562e20babb76',
    lg.id,
    mc.id,
    CURRENT_DATE + interval '1 week',
    '09:00:00',
    '9:00 AM Service'
FROM latest_group lg, main_campus mc
UNION ALL
SELECT 
    'a8c2c7ab-836a-4ef1-a373-562e20babb76',
    lg.id,
    mc.id,
    CURRENT_DATE + interval '1 week',
    '11:00:00',
    '11:00 AM Service'
FROM latest_group lg, main_campus mc;
*/
