// src/routes/api/gatherings/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  console.log('cookie active_church_id:', event.cookies.get('active_church_id'));
  console.log('locals.churchId:', event.locals.churchId);
  console.log('request cookie header:', event.request.headers.get('cookie'));

  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const url = event.url;
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');

  let query = event.locals.supabase
    .from('service_groups')
    .select(`
      id,
      group_date,
      name,

      context:contexts(name),
      instances:service_instances(
        id,
        service_time,
        campus:campuses(name)
      )
    `)
    .eq('church_id', churchId)
    .order('group_date', { ascending: true });

  if (startDate) {
    query = query.gte('group_date', startDate);
  }
  if (endDate) {
    query = query.lte('group_date', endDate);
  }

  const { data: groups, error: dbError } = await query;

  if (dbError) {
  console.error('GET /api/gatherings failed:', dbError);
  throw error(500, dbError.message);
}


  // Transform to match expected frontend format
  const formattedGroups = (groups ?? []).map((g: any) => ({
    id: g.id,
    group_date: g.group_date,
    name: g.name,
    context_name: g.context?.name || 'Unknown',
    instances: (g.instances ?? [])
      .sort((a: any, b: any) => String(a.service_time).localeCompare(String(b.service_time)))
      .map((i: any) => ({
        id: i.id,
        service_time: i.service_time,
        campus_name: i.campus?.name ?? null,
        assignments: {
          total_positions: 0,
          filled_positions: 0,
          confirmed: 0,
          pending: 0,
          unfilled: 0,
          by_ministry: []
        }
      }))
  }));

  return json(formattedGroups, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

// POST - Create a new gathering
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const body = await event.request.json().catch(() => ({}));

  const {
    name,           // Gathering name (e.g., "Sunday AM")
    context_id,     // Gathering type ID
    group_date,     // Date in YYYY-MM-DD format
    instances,      // Array of { service_time, campus_id }
    positions       // Array of { role_id, quantity }
  } = body;

  // Validate required fields
  if (!name || !group_date || !instances || instances.length === 0) {
    throw error(400, 'name, group_date, and at least one instance are required');
  }

  // Validate date - allow today or future
  const serviceDate = new Date(group_date + 'T00:00:00');
  const now = new Date();
  const gracePeriod = new Date(now.getTime() - (2 * 60 * 60 * 1000)); // 2 hours ago
  gracePeriod.setHours(0, 0, 0, 0);

  if (serviceDate < gracePeriod) {
    throw error(400, 'Gathering date must be today or in the future');
  }

  // 1. Create the Gathering group
  const { data: group, error: groupError } = await event.locals.supabase
    .from('service_groups')
    .insert({
      church_id: churchId,
      group_date,
      name,
      context_id: context_id || null
    })
    .select('id')
    .single();

  if (groupError) {
    console.error('Error creating Gathering group:', groupError);
    throw error(500, 'Failed to create gathering');
  }

  const groupId = group.id;
  const instanceIds: string[] = [];

  // 2. Create Gathering instances
  for (const inst of instances) {
    const { data: instance, error: instError } = await event.locals.supabase
      .from('service_instances')
      .insert({
        church_id: churchId,
        service_group_id: groupId,
        service_date: group_date,
        service_time: inst.service_time,
        campus_id: inst.campus_id || null
      })
      .select('id')
      .single();

    if (instError) {
      console.error('Error creating instance:', instError);
      // We can't easily rollback via Supabase client without stored procedures
      // We will throw, leaving partial data (groups without instances).
      // TODO: Implement cleaner rollback or use RPC.
      throw error(500, 'Failed to create service instances');
    }
    instanceIds.push(instance.id);
  }

  // 3. Create position assignments (if any)
  if (positions && positions.length > 0) {
    const assignmentsToInsert: any[] = [];
    for (const instanceId of instanceIds) {
      for (const pos of positions) {
        for (let i = 0; i < (pos.quantity || 1); i++) {
          assignmentsToInsert.push({
            church_id: churchId,
            service_instance_id: instanceId,
            role_id: pos.role_id,
            status: 'pending'
          });
        }
      }
    }

    if (assignmentsToInsert.length > 0) {
        const { error: assignError } = await event.locals.supabase
          .from('service_assignments')
          .insert(assignmentsToInsert);

        if (assignError) {
            console.error('Error creating assignments:', assignError);
            // Non-critical (?) but annoying.
        }
    }
  }

  return json({
    success: true,
    group_id: groupId,
    instance_ids: instanceIds,
    message: `Created gathering "${name}" with ${instanceIds.length} instance(s)`
  }, { status: 201 });
};
