// src/routes/api/services/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const url = event.url;
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  const result = await pool.query(
    `
    SELECT
      sg.id as group_id,
      TO_CHAR(sg.group_date, 'YYYY-MM-DD') as group_date,
      sg.name as group_name,
      c.name as context_name,
      si.id as instance_id,
      si.service_time,
      si.campus_id,
      camp.name as campus_name,
      json_build_object(
        'total_positions', 0,
        'filled_positions', 0,
        'confirmed', 0,
        'pending', 0,
        'unfilled', 0,
        'by_ministry', '[]'::json
      ) as assignments
    FROM service_groups sg
    LEFT JOIN contexts c
      ON c.id = sg.context_id
     AND c.church_id = sg.church_id
    JOIN service_instances si
      ON si.service_group_id = sg.id
     AND si.church_id = sg.church_id
    LEFT JOIN campuses camp
      ON camp.id = si.campus_id
     AND camp.church_id = sg.church_id
    WHERE sg.church_id = $1
      AND ($2::date IS NULL OR sg.group_date >= $2::date)
      AND ($3::date IS NULL OR sg.group_date <= $3::date)
    ORDER BY sg.group_date ASC, si.service_time ASC;
    `,
    [churchId, startDate || null, endDate || null]
  );

  // Group instances by service group
  const groupsMap = new Map<string, {
    id: string;
    group_date: string;
    name: string;
    context_name: string;
    instances: Array<{
      id: string;
      service_time: string;
      campus_id: string | null;
      campus_name: string | null;
      assignments: object;
    }>;
  }>();

  for (const row of result.rows) {
    if (!groupsMap.has(row.group_id)) {
      groupsMap.set(row.group_id, {
        id: row.group_id,
        group_date: row.group_date,
        name: row.group_name,
        context_name: row.context_name || 'Unknown',
        instances: []
      });
    }

    const group = groupsMap.get(row.group_id)!;
    group.instances.push({
      id: row.instance_id,
      service_time: row.service_time,
      campus_id: row.campus_id,
      campus_name: row.campus_name,
      assignments: row.assignments
    });
  }

  return json(Array.from(groupsMap.values()), {
    headers: { 'x-served-by': 'sveltekit' }
  });
};
