// This route uses legacy service_* database tables while the API surface and domain language use "gatherings".

// src/routes/api/gatherings/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const url = event.url;
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  const gatheringInstancesResult = await pool.query(
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

  for (const gatheringRow of gatheringInstancesResult.rows) {
    if (!groupsMap.has(gatheringRow.group_id)) {
      groupsMap.set(gatheringRow.group_id, {
        id: gatheringRow.group_id,
        group_date: gatheringRow.group_date,
        name: gatheringRow.group_name,
        context_name: gatheringRow.context_name || 'Unknown',
        instances: []
      });
    }

    const group = groupsMap.get(gatheringRow.group_id)!;
    group.instances.push({
      id: gatheringRow.instance_id,
      service_time: gatheringRow.service_time,
      campus_id: gatheringRow.campus_id,
      campus_name: gatheringRow.campus_name,
      assignments: gatheringRow.assignments
    });
  }

  return json(Array.from(groupsMap.values()), {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

// POST - Create a new service
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const body = await event.request.json();
  const {
    name,           // Service name (e.g., "Sunday AM")
    context_id,     // Service type ID
    group_date,     // Date in YYYY-MM-DD format
    instances,      // Array of { service_time, campus_id }
    positions       // Array of { role_id, quantity }
  } = body;

  // Validate required fields
  if (!name || !group_date || !instances || instances.length === 0) {
    throw error(400, 'name, group_date, and at least one instance are required');
  }

  // Validate date - allow today or future (with 2-hour grace period for timezone flexibility)
  const serviceDate = new Date(group_date + 'T00:00:00');
  const now = new Date();
  const gracePeriod = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
  gracePeriod.setHours(0, 0, 0, 0);

  if (serviceDate < gracePeriod) {
    throw error(400, 'Gathering date must be today or in the future');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the service group
    const groupInsertResult = await client.query(
      `INSERT INTO service_groups (church_id, group_date, name, context_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [churchId, group_date, name, context_id || null]
    );
    const groupId = groupInsertResult.rows[0].id;

    // 2. Create service instances
    const instanceIds: string[] = [];
    for (const inst of instances) {
      const instanceInsertResult = await client.query(
        `INSERT INTO service_instances (church_id, service_group_id, service_date, service_time, campus_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [churchId, groupId, group_date, inst.service_time, inst.campus_id || null]
      );
        instanceIds.push(instanceInsertResult.rows[0].id);
    }

    // 3. Create position assignments for each instance if positions provided
    if (positions && positions.length > 0) {
      for (const instanceId of instanceIds) {
        for (const pos of positions) {
          // Create multiple assignments for the same role based on quantity
          for (let i = 0; i < (pos.quantity || 1); i++) {
            await client.query(
              `INSERT INTO service_assignments (church_id, service_instance_id, role_id, status)
               VALUES ($1, $2, $3, 'pending')`,
              [churchId, instanceId, pos.role_id]
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    return json({
      success: true,
      group_id: groupId,
      instance_ids: instanceIds,
      message: `Created gathering "${name}" with ${instanceIds.length} instance(s)`
    }, { status: 201 });

  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Error creating service:', e);
    throw error(500, e.message || 'Failed to create gathering');
  } finally {
    client.release();
  }
};
