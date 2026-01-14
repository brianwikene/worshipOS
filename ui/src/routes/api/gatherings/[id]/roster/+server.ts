// src/routes/api/gatherings/[id]/roster/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId } = event.params;

  // 1. Get Instance Context ID
  const { data: instance } = await event.locals.supabase
    .from('service_instances')
    .select('service_group_id, group:service_groups(context_id)')
    .eq('id', instanceId)
    .single();

  if (!instance || !instance.group?.context_id) {
      // If no instance or context, just return empty list or error.
      // If 404 on instance, maybe error.
      if (!instance) throw error(404, 'Gathering not found');
      // If context missing, return empty.
      return json([], { headers: { 'x-served-by': 'sveltekit' } });
  }

  const contextId = instance.group.context_id;

  // 2. Fetch Requirements (Role definitions for this service type)
  const { data: requirements } = await event.locals.supabase
    .from('service_role_requirements')
    .select(`
        min_needed, display_order,
        role:roles(id, name, ministry_area)
    `)
    .eq('context_id', contextId)
    .eq('church_id', churchId)
    .order('display_order');

  // 3. Fetch Assignments
  const { data: assignments } = await event.locals.supabase
    .from('service_assignments')
    .select(`
        id, role_id, person_id, status, is_lead, notes,
        person:people(display_name)
    `)
    .eq('service_instance_id', instanceId)
    .eq('church_id', churchId);

  // 4. Merge
  const results: any[] = [];
  const assignmentsByRoleId: Record<string, any[]> = {};
  (assignments || []).forEach((a: any) => {
      if (!assignmentsByRoleId[a.role_id]) assignmentsByRoleId[a.role_id] = [];
      assignmentsByRoleId[a.role_id].push(a);
  });

  (requirements || []).forEach((req: any) => {
      const roleId = req.role.id;
      const roleName = req.role.name;
      const ministryArea = req.role.ministry_area;
      const roleAssignments = assignmentsByRoleId[roleId] || [];
      const required = (req.min_needed || 0) > 0;

      if (roleAssignments.length > 0) {
          roleAssignments.forEach(ass => {
              results.push({
                  id: ass.id,
                  role_id: roleId,
                  role_name: roleName,
                  ministry_area: ministryArea,
                  person_id: ass.person_id,
                  person_name: ass.person?.display_name,
                  status: ass.status || 'unfilled',
                  is_lead: ass.is_lead || false,
                  is_required: required,
                  notes: ass.notes
              });
          });
      } else {
          // Empty slot placeholder
          results.push({
              id: null,
              role_id: roleId,
              role_name: roleName,
              ministry_area: ministryArea,
              person_id: null,
              person_name: null,
              status: 'unfilled',
              is_lead: false,
              is_required: required,
              notes: null
          });
      }
  });

  // Sort
  results.sort((a, b) => {
      if (a.ministry_area !== b.ministry_area) {
          if (!a.ministry_area) return 1;
          if (!b.ministry_area) return -1;
          return a.ministry_area.localeCompare(b.ministry_area);
      }
      if (a.role_name !== b.role_name) return 0; // Already sorted by req order roughly
      if (a.is_lead !== b.is_lead) return (a.is_lead ? -1 : 1);
      return 0;
  });

  return json(results, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};
