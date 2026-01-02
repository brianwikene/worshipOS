// src/routes/api/gatherings/[id]/roster/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: instanceId } = event.params;

  const result = await pool.query(
    `SELECT
      sa.id,
      r.id as role_id,
      r.name as role_name,
      r.ministry_area,
      sa.person_id,
      p.display_name as person_name,
      COALESCE(sa.status, 'unfilled') as status,
      COALESCE(sa.is_lead, false) as is_lead,
      (srr.min_needed > 0) as is_required,
      sa.notes
     FROM service_instances si
     JOIN service_groups sg ON sg.id = si.service_group_id
     JOIN service_role_requirements srr ON srr.context_id = sg.context_id
     JOIN roles r ON r.id = srr.role_id
     LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = r.id
     LEFT JOIN people p ON p.id = sa.person_id
     WHERE si.id = $1
       AND sg.church_id = $2
     ORDER BY
       r.ministry_area NULLS LAST,
       srr.display_order,
       sa.is_lead DESC NULLS LAST,
       r.name`,
    [instanceId, churchId]
  );

  return json(result.rows, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};
