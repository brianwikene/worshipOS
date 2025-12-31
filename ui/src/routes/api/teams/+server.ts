// src/routes/api/teams/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const includeInactive = event.url.searchParams.get('include_inactive') === 'true';
  const includeRoles = event.url.searchParams.get('include_roles') === 'true';

  const result = await pool.query(
    `SELECT id, name, description, color, icon, is_active, display_order
     FROM teams
     WHERE church_id = $1 ${includeInactive ? '' : 'AND is_active = true'}
     ORDER BY display_order, name`,
    [churchId]
  );

  if (includeRoles) {
    // Get roles for each team
    const rolesResult = await pool.query(
      `SELECT id, name, team_id, body_parts, is_active
       FROM roles
       WHERE church_id = $1 AND is_active = true
       ORDER BY name`,
      [churchId]
    );

    // Group roles by team
    const rolesByTeam = rolesResult.rows.reduce((acc: Record<string, any[]>, role) => {
      const teamId = role.team_id || 'unassigned';
      if (!acc[teamId]) acc[teamId] = [];
      acc[teamId].push(role);
      return acc;
    }, {});

    // Attach roles to each team
    const teamsWithRoles = result.rows.map(team => ({
      ...team,
      roles: rolesByTeam[team.id] || []
    }));

    // Add unassigned roles as a virtual team if any exist
    if (rolesByTeam['unassigned']?.length > 0) {
      teamsWithRoles.push({
        id: null,
        name: 'Unassigned',
        description: 'Roles not assigned to a team',
        color: '#9ca3af',
        icon: '❓',
        is_active: true,
        display_order: 999,
        roles: rolesByTeam['unassigned']
      });
    }

    return json(teamsWithRoles);
  }

  return json(result.rows);
};

// POST - Create a new team
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const body = await event.request.json();
  const { name, description, color = '#667eea', icon = '👥' } = body;

  if (!name || name.trim() === '') {
    throw error(400, 'Team name is required');
  }

  // Check for duplicate
  const existing = await pool.query(
    'SELECT id FROM teams WHERE church_id = $1 AND LOWER(name) = LOWER($2)',
    [churchId, name.trim()]
  );

  if (existing.rows.length > 0) {
    throw error(409, 'A team with this name already exists');
  }

  // Get next display order
  const orderResult = await pool.query(
    'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM teams WHERE church_id = $1',
    [churchId]
  );

  const result = await pool.query(
    `INSERT INTO teams (church_id, name, description, color, icon, display_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, color, icon, is_active, display_order`,
    [churchId, name.trim(), description || null, color, icon, orderResult.rows[0].next_order]
  );

  return json(result.rows[0], { status: 201 });
};
