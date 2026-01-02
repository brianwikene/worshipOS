// src/routes/api/gatherings/[id]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `
    SELECT
      si.id,
      si.service_time,
      si.campus_id,
      sg.name AS service_name,
      TO_CHAR(sg.group_date, 'YYYY-MM-DD') AS group_date,
      c.name AS context_name,
      camp.name AS campus_name
    FROM service_instances si
    JOIN service_groups sg
      ON sg.id = si.service_group_id
     AND sg.church_id = si.church_id
    LEFT JOIN contexts c
      ON c.id = sg.context_id
     AND c.church_id = sg.church_id
    LEFT JOIN campuses camp
      ON camp.id = si.campus_id
     AND camp.church_id = sg.church_id
    WHERE si.id = $1
      AND sg.church_id = $2;
    `,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Service instance not found');
  }

  return json(result.rows[0], {
    headers: { 'x-served-by': 'sveltekit' }
  });
};
