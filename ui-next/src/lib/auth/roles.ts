/**
 * RBAC Role Definitions for WorshipOS
 *
 * Roles are hierarchical "bundles" of permissions.
 * Instead of checking 50 individual permissions, assign one role.
 */

// -----------------------------------------------------------------------------
// ROLE DEFINITIONS
// -----------------------------------------------------------------------------

export const ROLES = {
	member: 'user',
	volunteer: 'volunteer',
	coordinator: 'coordinator', // aka "Leader"
	staff: 'staff',
	admin: 'admin',
	org_owner: 'org_owner'
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Role hierarchy (higher index = more permissions)
const ROLE_HIERARCHY: Role[] = ['user', 'volunteer', 'coordinator', 'staff', 'admin', 'org_owner'];

// -----------------------------------------------------------------------------
// PERMISSION DEFINITIONS
// -----------------------------------------------------------------------------

export const PERMISSIONS = {
	// People / Connections
	'people:view_own': 'View own profile',
	'people:view_team': 'View team members',
	'people:view_all': 'View all people',
	'people:edit_own': 'Edit own profile',
	'people:edit_all': 'Edit any person',
	'people:create': 'Create new people',
	'people:delete': 'Archive/delete people',

	// Gatherings / Planning
	'gatherings:view': 'View gatherings',
	'gatherings:create': 'Create gatherings',
	'gatherings:edit': 'Edit gatherings',
	'gatherings:delete': 'Delete gatherings',

	// Plans
	'plans:view_own': 'View plans assigned to self',
	'plans:view_team': 'View team plans',
	'plans:view_all': 'View all plans',
	'plans:edit': 'Edit plans',
	'plans:schedule': 'Schedule volunteers',

	// Songs
	'songs:view': 'View song library',
	'songs:create': 'Add songs',
	'songs:edit': 'Edit songs',
	'songs:delete': 'Delete songs',

	// Teams
	'teams:view_own': 'View own teams',
	'teams:view_all': 'View all teams',
	'teams:manage_own': 'Manage own team members',
	'teams:manage_all': 'Manage all teams',
	'teams:create': 'Create teams',

	// Care
	'care:view_own': 'View care notes about self',
	'care:view_team': 'View care notes for team',
	'care:view_all': 'View all care notes',
	'care:create': 'Create care notes',
	'care:edit': 'Edit care notes',

	// Admin
	'admin:access': 'Access admin panel',
	'admin:settings': 'Modify church settings',
	'admin:users': 'Manage user roles',
	'admin:integrations': 'Manage integrations',

	// Org Owner only
	'org:billing': 'Manage billing',
	'org:delete': 'Delete organization'
} as const;

export type Permission = keyof typeof PERMISSIONS;

// -----------------------------------------------------------------------------
// ROLE -> PERMISSION MAPPING
// -----------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
	user: [
		'people:view_own',
		'people:edit_own',
		'gatherings:view',
		'plans:view_own',
		'songs:view',
		'teams:view_own',
		'care:view_own'
	],

	volunteer: [
		// Inherits user permissions +
		'people:view_own',
		'people:edit_own',
		'gatherings:view',
		'plans:view_own',
		'plans:view_team',
		'songs:view',
		'teams:view_own',
		'care:view_own'
	],

	coordinator: [
		// Team/Ministry Leader
		'people:view_own',
		'people:view_team',
		'people:edit_own',
		'gatherings:view',
		'plans:view_own',
		'plans:view_team',
		'plans:edit',
		'plans:schedule',
		'songs:view',
		'songs:create',
		'songs:edit',
		'teams:view_own',
		'teams:view_all',
		'teams:manage_own',
		'care:view_own',
		'care:view_team',
		'care:create'
	],

	staff: [
		// Church staff - broad access
		'people:view_own',
		'people:view_team',
		'people:view_all',
		'people:edit_own',
		'people:edit_all',
		'people:create',
		'gatherings:view',
		'gatherings:create',
		'gatherings:edit',
		'plans:view_own',
		'plans:view_team',
		'plans:view_all',
		'plans:edit',
		'plans:schedule',
		'songs:view',
		'songs:create',
		'songs:edit',
		'teams:view_own',
		'teams:view_all',
		'teams:manage_own',
		'teams:manage_all',
		'care:view_own',
		'care:view_team',
		'care:view_all',
		'care:create',
		'care:edit'
	],

	admin: [
		// Full access except billing
		'people:view_own',
		'people:view_team',
		'people:view_all',
		'people:edit_own',
		'people:edit_all',
		'people:create',
		'people:delete',
		'gatherings:view',
		'gatherings:create',
		'gatherings:edit',
		'gatherings:delete',
		'plans:view_own',
		'plans:view_team',
		'plans:view_all',
		'plans:edit',
		'plans:schedule',
		'songs:view',
		'songs:create',
		'songs:edit',
		'songs:delete',
		'teams:view_own',
		'teams:view_all',
		'teams:manage_own',
		'teams:manage_all',
		'teams:create',
		'care:view_own',
		'care:view_team',
		'care:view_all',
		'care:create',
		'care:edit',
		'admin:access',
		'admin:settings',
		'admin:users',
		'admin:integrations'
	],

	org_owner: [
		// Everything
		'people:view_own',
		'people:view_team',
		'people:view_all',
		'people:edit_own',
		'people:edit_all',
		'people:create',
		'people:delete',
		'gatherings:view',
		'gatherings:create',
		'gatherings:edit',
		'gatherings:delete',
		'plans:view_own',
		'plans:view_team',
		'plans:view_all',
		'plans:edit',
		'plans:schedule',
		'songs:view',
		'songs:create',
		'songs:edit',
		'songs:delete',
		'teams:view_own',
		'teams:view_all',
		'teams:manage_own',
		'teams:manage_all',
		'teams:create',
		'care:view_own',
		'care:view_team',
		'care:view_all',
		'care:create',
		'care:edit',
		'admin:access',
		'admin:settings',
		'admin:users',
		'admin:integrations',
		'org:billing',
		'org:delete'
	]
};

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
	role: Role | string | null | undefined,
	permission: Permission
): boolean {
	if (!role) return false;
	const permissions = ROLE_PERMISSIONS[role as Role];
	if (!permissions) return false;
	return permissions.includes(permission);
}

/**
 * Check if a role has ANY of the given permissions
 */
export function hasAnyPermission(
	role: Role | string | null | undefined,
	permissions: Permission[]
): boolean {
	return permissions.some((p) => hasPermission(role, p));
}

/**
 * Check if a role has ALL of the given permissions
 */
export function hasAllPermissions(
	role: Role | string | null | undefined,
	permissions: Permission[]
): boolean {
	return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if roleA is at least as privileged as roleB
 */
export function isAtLeast(role: Role | string | null | undefined, minimumRole: Role): boolean {
	if (!role) return false;
	const roleIndex = ROLE_HIERARCHY.indexOf(role as Role);
	const minIndex = ROLE_HIERARCHY.indexOf(minimumRole);
	if (roleIndex === -1 || minIndex === -1) return false;
	return roleIndex >= minIndex;
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: Role | string | null | undefined): Permission[] {
	if (!role) return [];
	return ROLE_PERMISSIONS[role as Role] || [];
}

/**
 * Get human-readable role name
 */
export function getRoleDisplayName(role: Role | string | null | undefined): string {
	const names: Record<Role, string> = {
		user: 'Member',
		volunteer: 'Volunteer',
		coordinator: 'Coordinator',
		staff: 'Staff',
		admin: 'Admin',
		org_owner: 'Organization Owner'
	};
	return names[role as Role] || 'Unknown';
}

/**
 * Get all available roles for dropdown
 */
export function getAllRoles(): { value: Role; label: string; description: string }[] {
	return [
		{
			value: 'user',
			label: 'Member',
			description: 'Basic access: own profile, public calendar, RSVP'
		},
		{
			value: 'volunteer',
			label: 'Volunteer',
			description: 'Member + team access, schedule, song charts'
		},
		{
			value: 'coordinator',
			label: 'Coordinator',
			description: 'Team leader: schedule volunteers, team events, comms'
		},
		{
			value: 'staff',
			label: 'Staff',
			description: 'Church staff: manage people, gatherings, care'
		},
		{
			value: 'admin',
			label: 'Admin',
			description: 'Full access: settings, integrations, user management'
		},
		{
			value: 'org_owner',
			label: 'Organization Owner',
			description: 'Everything + billing, delete tenant'
		}
	];
}
