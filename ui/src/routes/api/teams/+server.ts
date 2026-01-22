// /ui/src/routes/api/teams/+server.ts
// src/routes/api/teams/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type RoleRow = {
  id: string;
  name: string;
  team_id: string | null;
  body_parts: unknown;
  is_active: boolean;
};

type TeamRow = {
  id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number | null;
};

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';
  const includeRoles = event.url.searchParams.get('include_roles') === 'true';

  try {
    let query = event.locals.supabase
      .from('teams')
      .select('id, name, description, color, icon, is_active, display_order')
      .eq('church_id', churchId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: teams, error: teamsError } = await query;

    if (teamsError) throw teamsError;

    const teamRows = (teams || []) as TeamRow[];

    if (includeRoles) {
      // Get roles (optionally include inactive)
      let rolesQuery = event.locals.supabase
        .from('roles')
        .select('id, name, team_id, body_parts, is_active')
        .eq('church_id', churchId)
        .order('name', { ascending: true });

      if (!includeInactive) {
        rolesQuery = rolesQuery.eq('is_active', true);
      }

      const { data: roles, error: rolesError } = await rolesQuery;

      if (rolesError) throw rolesError;

      const roleRows = (roles || []) as RoleRow[];

      // Group roles by team
      const rolesByTeam: Record<string, RoleRow[]> = {};
      const unassignedRoles: RoleRow[] = [];

      for (const role of roleRows) {
        if (!role.team_id) {
          unassignedRoles.push(role);
        } else {
          (rolesByTeam[role.team_id] ||= []).push(role);
        }
      }

      // Attach roles to each team
      const teamsWithRoles = teamRows.map((team) => ({
        ...team,
        roles: team.id ? (rolesByTeam[team.id] || []) : []
      }));

      // Add unassigned roles as a virtual team if any exist
      if (unassignedRoles.length > 0) {
        teamsWithRoles.push({
          id: null,
          name: 'Unassigned',
          description: 'Roles not assigned to a team',
          color: '#9ca3af',
          icon: '❓',
          is_active: true,
          display_order: 999,
          roles: unassignedRoles
        });
      }

      // Ensure deterministic order
      teamsWithRoles.sort((a, b) => {
        const ao = a.display_order ?? 1_000_000;
        const bo = b.display_order ?? 1_000_000;
        if (ao !== bo) return ao - bo;
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      });


      return json(teamsWithRoles);
    }

    return json(teamRows);
  } catch (err: any) {
    console.error('[API] /api/teams GET failed:', err);
    throw error(500, err.message || 'Database error');
  }
};

// POST - Create a new team
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const body = await event.request.json().catch(() => ({}));
  const { name, description, color = '#667eea', icon = '👥' } = body;


  if (typeof name !== 'string' || name.trim() === '') {
    throw error(400, 'Team name is required');
  }

  const trimmed = name.trim();

  if (typeof color !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw error(400, 'Invalid color format (hex required)');
  }

  // Allow for a few emojis or short text, but prevent abuse
  if (typeof icon !== 'string' || icon.length > 10) {
    throw error(400, 'Icon must be 10 characters or fewer');
  }

  const desc = typeof description === 'string' ? description.trim() : '';

  // Check for duplicate
  const { data: existing, error: existingError } = await event.locals.supabase
    .from('teams')
    .select('id')
    .eq('church_id', churchId)
    .eq('name', trimmed)
    .maybeSingle();

  if (existingError) {
    console.error('[API] /api/teams POST duplicate check failed:', existingError);
    throw error(500, 'Database error');
  }

  if (existing) {
    throw error(409, 'A team with this name already exists');
  }

  const { data: created, error: insertError } = await event.locals.supabase
    .from('teams')
    .insert({
      church_id: churchId,
      name: trimmed,
      description: desc || null,
      color,
      icon
    })
    .select()
    .single();

  if (insertError) {
    console.error('[API] /api/teams POST failed:', insertError);
    throw error(500, 'Database error');
  }

  return json(created, { status: 201 });
};
