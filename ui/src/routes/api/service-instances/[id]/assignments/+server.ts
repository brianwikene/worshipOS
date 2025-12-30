// src/routes/api/service-instances/[id]/assignments/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

async function assertInstanceInChurch(instanceId: string, churchId: string): Promise<boolean> {
  const check = await pool.query(
    `
    SELECT 1
    FROM service_instances si
    JOIN service_groups sg ON sg.id = si.service_group_id
    WHERE si.id = $1 AND sg.church_id = $2
    `,
    [instanceId, churchId]
  );
  return (check.rowCount ?? 0) > 0;
}

export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;
  const body = await event.request.json();
  const { role_id, person_id, status, is_lead, notes } = body;

  if (!role_id) {
    throw error(400, 'role_id is required');
  }

  const ok = await assertInstanceInChurch(instanceId, churchId);
  if (!ok) {
    throw error(404, 'Service instance not found');
  }

  const result = await pool.query(
    `INSERT INTO service_assignments
      (church_id, service_instance_id, role_id, person_id, status, is_lead, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      churchId,
      instanceId,
      role_id,
      person_id,
      status || 'pending',
      is_lead || false,
      notes
    ]
  );

  return json(result.rows[0], {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
