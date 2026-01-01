# Architecture: Future Authorization System

> **Status**: Design Document (Not Yet Implemented)
>
> **Last Updated**: 2024-12-30
>
> **Purpose**: Document the planned authorization system to ensure current schema decisions support future implementation.

---

## Overview

WorshipOS will need role-based access control (RBAC) that:

1. Controls who can view/edit different parts of the system
2. Supports multi-campus organizations
3. Allows ministry-area-based ownership
4. Scales from small single-site churches to large multi-campus organizations

This document describes the **intended** authorization model. No auth system exists yet, but schema decisions are being made to support this future state.

---

## Key Distinction: Service Roles vs System Roles

### Service Roles (Current - `roles` table)
**What you DO in a service**

- "I play guitar"
- "I lead worship"
- "I run sound"
- Used for **scheduling**: Who can fill a position on Sunday?

### System Roles (Future - `system_roles` table)
**What you can ACCESS in the system**

- "I can edit worship planning"
- "I'm a campus administrator"
- "I can view but not edit"
- Used for **authorization**: Who can see/change this data?

> **Important**: These are intentionally separate. A guitarist doesn't automatically get system access. An admin doesn't need to play guitar to manage the system.

---

## Intended Hierarchy

```
Church (Organization)
  └── Campus (Location)
       └── Ministry Area (worship, pastoral, kids, tech, etc.)
            └── Section (within a service)
```

### Permission Inheritance

Permissions flow down the hierarchy:

| Role Level | Can Access |
|------------|------------|
| Church Admin | Everything in the church |
| Campus Admin | Everything at their campus(es) |
| Ministry Lead | Their ministry area, all campuses |
| Section Editor | Specific sections they're assigned |
| Scheduler | Create/edit schedules and assignments |
| Viewer | Read-only access |
| Volunteer | Own assignments, confirm/decline |

---

## Planned Database Schema

### System Roles

```sql
-- DO NOT CREATE YET - For planning only

CREATE TABLE system_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),

  -- Identity
  name TEXT NOT NULL,                   -- 'church_admin', 'campus_admin', 'worship_lead'
  display_name TEXT NOT NULL,           -- 'Church Administrator'
  description TEXT,

  -- Hierarchy
  parent_role_id UUID REFERENCES system_roles(id),

  -- Scope type
  scope_type TEXT NOT NULL DEFAULT 'church',
  -- 'church' = church-wide role
  -- 'campus' = scoped to specific campus(es)
  -- 'ministry' = scoped to specific ministry area(s)

  -- Flags
  is_system BOOLEAN DEFAULT false,      -- Built-in vs custom
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_church_system_role UNIQUE (church_id, name)
);
```

### Permissions

```sql
-- DO NOT CREATE YET - For planning only

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL UNIQUE,            -- 'service.view', 'service.edit', 'service.lock'
  display_name TEXT NOT NULL,           -- 'View Services'
  description TEXT,

  -- Categorization
  resource_type TEXT NOT NULL,          -- 'service', 'template', 'song', 'person', 'report'
  action TEXT NOT NULL,                 -- 'view', 'create', 'edit', 'delete', 'lock', 'approve'

  -- For UI grouping
  category TEXT                         -- 'Services', 'People', 'Songs', 'Admin'
);

-- Seed permissions (examples)
-- INSERT INTO permissions (name, display_name, resource_type, action, category) VALUES
--   ('service.view', 'View Services', 'service', 'view', 'Services'),
--   ('service.edit', 'Edit Services', 'service', 'edit', 'Services'),
--   ('service.lock', 'Lock Services', 'service', 'lock', 'Services'),
--   ('service.complete', 'Complete Services', 'service', 'complete', 'Services'),
--   ('section.worship.edit', 'Edit Worship Sections', 'section', 'edit', 'Services'),
--   ('section.message.edit', 'Edit Message Sections', 'section', 'edit', 'Services'),
--   ('template.create', 'Create Templates', 'template', 'create', 'Templates'),
--   ('song.create', 'Add Songs', 'song', 'create', 'Songs'),
--   ('person.view', 'View People', 'person', 'view', 'People'),
--   ('person.edit', 'Edit People', 'person', 'edit', 'People'),
--   ('report.ccli', 'Run CCLI Reports', 'report', 'view', 'Reports'),
--   ('admin.roles', 'Manage Roles', 'admin', 'edit', 'Admin');
```

### Role-Permission Mapping

```sql
-- DO NOT CREATE YET - For planning only

CREATE TABLE system_role_permissions (
  system_role_id UUID NOT NULL REFERENCES system_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  PRIMARY KEY (system_role_id, permission_id)
);
```

### Person-Role Assignments

```sql
-- DO NOT CREATE YET - For planning only

CREATE TABLE person_system_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID NOT NULL REFERENCES people(id),
  system_role_id UUID NOT NULL REFERENCES system_roles(id),

  -- Scope constraints (optional narrowing)
  campus_id UUID REFERENCES campuses(id),           -- NULL = all campuses
  ministry_area_id UUID REFERENCES ministry_areas(id), -- NULL = all ministries

  -- Validity period
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,                              -- NULL = indefinite

  -- Audit
  granted_by UUID REFERENCES people(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_by UUID REFERENCES people(id),
  revoked_at TIMESTAMPTZ,

  CONSTRAINT unique_person_role_scope UNIQUE (person_id, system_role_id, campus_id, ministry_area_id)
);
```

---

## Default System Roles

When a church is provisioned, these roles should be auto-created:

| Role Name | Scope | Description |
|-----------|-------|-------------|
| `church_admin` | church | Full access to everything |
| `campus_admin` | campus | Full access to assigned campus(es) |
| `ministry_lead` | ministry | Manage their ministry area |
| `worship_lead` | ministry | Worship ministry lead (convenience role) |
| `tech_lead` | ministry | Tech ministry lead (convenience role) |
| `scheduler` | church | Create/edit schedules and assignments |
| `volunteer` | church | View own assignments, confirm/decline |
| `viewer` | church | Read-only access |

---

## Current Schema Hooks

The following schema elements are already in place to support future auth:

### 1. Ministry Areas Table
```sql
ministry_areas (
  id, church_id, name, display_name, parent_id, ...
)
```
- Used for section ownership
- Will be used for ministry-scoped permissions

### 2. Template Section Ownership
```sql
template_sections (
  ministry_area_id UUID REFERENCES ministry_areas(id),
  ownership_config JSONB  -- Reserved for future auth config
)
```

### 3. Audit Fields (on all tables)
```sql
created_by UUID REFERENCES people(id),
updated_by UUID REFERENCES people(id),
```
- Every mutation tracks who did it
- Essential for audit logs and accountability

### 4. Campus Scoping
```sql
-- Many tables have:
campus_id UUID REFERENCES campuses(id)  -- NULL = all campuses
```
- Supports campus-level isolation

---

## Authorization Check Pattern

When auth is implemented, checks will follow this pattern:

```typescript
// Pseudocode - not implemented yet

async function canEditSection(
  personId: string,
  sectionId: string
): Promise<boolean> {
  const section = await getSection(sectionId);
  const serviceInstance = await getServiceInstance(section.service_instance_id);

  // 1. Service must not be locked (or user has unlock permission)
  if (serviceInstance.locked_at && !hasPermission(personId, 'service.unlock')) {
    return false;
  }

  // 2. Check section ownership via ministry area
  const ministryAreaId = section.ministry_area_id;

  // 3. User must have edit permission for this ministry area
  return hasMinistryPermission(personId, ministryAreaId, 'section.edit');
}

async function hasMinistryPermission(
  personId: string,
  ministryAreaId: string,
  permission: string
): Promise<boolean> {
  // Check if user has:
  // - church_admin role (can do anything)
  // - ministry_lead role for this ministry area
  // - specific section.edit permission scoped to this ministry

  const roles = await getPersonSystemRoles(personId);

  for (const role of roles) {
    // Church admin can do anything
    if (role.name === 'church_admin') return true;

    // Ministry lead for this area
    if (role.name === 'ministry_lead' && role.ministry_area_id === ministryAreaId) {
      return true;
    }

    // Check explicit permissions
    const permissions = await getRolePermissions(role.system_role_id);
    if (permissions.includes(permission)) {
      // Check scope matches
      if (role.ministry_area_id === null || role.ministry_area_id === ministryAreaId) {
        return true;
      }
    }
  }

  return false;
}
```

---

## Soul Care Permissions

Soul Care / Digital Deacon features will have special permission considerations:

| Permission | Description | Who Should Have It |
|------------|-------------|-------------------|
| `care.notes.view` | View pastoral care notes | Pastoral staff, care team |
| `care.notes.create` | Create care notes | Pastoral staff, care team |
| `care.signals.view` | View automated care signals | Pastoral staff |
| `care.reports.view` | View care analytics | Senior pastor, care director |

> **Privacy First**: Care-related permissions should be restricted by default. Not everyone who can edit services should see pastoral notes.

---

## Implementation Phases

### Phase 0 (Current)
- No auth system
- All logged-in users can do everything
- Schema supports future auth (audit fields, ministry areas, ownership)

### Phase 1 (MVP Auth)
- Basic system roles: admin, editor, viewer
- Church-level only (no campus scoping)
- Simple permission checks

### Phase 2 (Campus Scoping)
- Campus admin roles
- Campus-scoped data access
- Multi-campus permission inheritance

### Phase 3 (Ministry Ownership)
- Ministry lead roles
- Section-level ownership enforcement
- Approval workflows

### Phase 4 (Soul Care)
- Care-specific permissions
- Privacy controls
- Audit logging for sensitive data

---

## Migration Path

When implementing auth:

1. **Create tables**: `system_roles`, `permissions`, `system_role_permissions`, `person_system_roles`

2. **Seed default roles and permissions**

3. **Assign church_admin to existing users** (or require re-assignment)

4. **Add middleware** to check permissions on API routes

5. **Update UI** to hide/show based on permissions

6. **Migrate ownership_config** fields if needed

---

## Questions to Resolve Before Implementation

1. **Delegation**: Can a ministry lead delegate their permissions to someone else temporarily?

2. **Emergency Access**: What happens if the only admin is unavailable?

3. **Invitation Flow**: How do new users get their initial roles?

4. **Cross-Church**: Will users ever belong to multiple churches? (Probably not initially)

5. **Audit Retention**: How long do we keep permission change logs?

6. **API Keys**: Will we have machine-to-machine auth with scoped permissions?

---

## References

- [Schema Migration: 2024-12-30-service-schema-v2.sql](/db/2024-12-30-service-schema-v2.sql)
- [Ministry Areas Seed Data](/db/seed-ministry-areas.sql)
- [Soul Care Roadmap](/docs/soul-care-roadmap.md)

---

> **Note**: This is a design document. Do not implement any of the "DO NOT CREATE YET" SQL until the auth system is ready to be built.
