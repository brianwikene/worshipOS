/**
 * Server-side route guards for RBAC
 *
 * Use these in +page.server.ts or +layout.server.ts load functions
 */

import { error, redirect } from '@sveltejs/kit';
import { hasPermission, isAtLeast, type Permission, type Role } from './roles';

interface GuardContext {
	locals: App.Locals;
	url: URL;
}

/**
 * Require user to be authenticated
 * Redirects to /login if not
 */
export function requireAuth({ locals, url }: GuardContext) {
	if (!locals.person) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}
	return locals.person;
}

/**
 * Require user to have a minimum role level
 * Uses role hierarchy (member < volunteer < coordinator < staff < admin < org_owner)
 */
export function requireRole({ locals, url }: GuardContext, minimumRole: Role) {
	const person = requireAuth({ locals, url });

	if (!isAtLeast(person.role, minimumRole)) {
		throw error(403, {
			message: `Access denied. This page requires ${minimumRole} or higher.`
		});
	}

	return person;
}

/**
 * Require user to have a specific permission
 */
export function requirePermission({ locals, url }: GuardContext, permission: Permission) {
	const person = requireAuth({ locals, url });

	if (!hasPermission(person.role, permission)) {
		throw error(403, {
			message: `Access denied. You don't have the "${permission}" permission.`
		});
	}

	return person;
}

/**
 * Require user to have ANY of the given permissions
 */
export function requireAnyPermission({ locals, url }: GuardContext, permissions: Permission[]) {
	const person = requireAuth({ locals, url });

	const hasAny = permissions.some((p) => hasPermission(person.role, p));
	if (!hasAny) {
		throw error(403, {
			message: `Access denied. You need one of: ${permissions.join(', ')}`
		});
	}

	return person;
}

/**
 * Require user to have ALL of the given permissions
 */
export function requireAllPermissions({ locals, url }: GuardContext, permissions: Permission[]) {
	const person = requireAuth({ locals, url });

	const hasAll = permissions.every((p) => hasPermission(person.role, p));
	if (!hasAll) {
		throw error(403, {
			message: `Access denied. You need all of: ${permissions.join(', ')}`
		});
	}

	return person;
}

/**
 * Check if current user can access admin panel
 */
export function requireAdmin({ locals, url }: GuardContext) {
	return requirePermission({ locals, url }, 'admin:access');
}

/**
 * Check if user can manage a specific team
 * (Either they manage all teams, or they're a coordinator of that team)
 */
export function requireTeamAccess(
	{ locals, url }: GuardContext,
	teamId: string,
	userTeamIds: string[]
) {
	const person = requireAuth({ locals, url });

	// Admins/staff can manage all teams
	if (hasPermission(person.role, 'teams:manage_all')) {
		return person;
	}

	// Coordinators can only manage their own teams
	if (hasPermission(person.role, 'teams:manage_own') && userTeamIds.includes(teamId)) {
		return person;
	}

	throw error(403, {
		message: "Access denied. You can't manage this team."
	});
}
