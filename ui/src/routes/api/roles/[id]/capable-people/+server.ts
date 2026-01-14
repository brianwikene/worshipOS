// src/routes/api/roles/[id]/capable-people/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Get people who have this role as a capability
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  const supabase = event.locals.supabase;
  if (!churchId) throw error(400, 'Active church is required');

  const { id } = event.params;

  // Supabase join query
  // We want people who have a capability for this role
  let { data, error: dbError } = await supabase
    .from('person_role_capabilities')
    .select(`
        proficiency,
        is_primary,
        person:people!person_id (
            id,
            first_name,
            last_name
        )
    `)
    .eq('role_id', id)
    .eq('church_id', churchId);
    // .order() on joined table is hard in one go without flattened view.
    // We will sort in JS.

  if (dbError) {
      console.error('GET capable-people failed:', dbError);
      throw error(500, 'Failed to list capable people');
  }

  // Filter active people manually since we can't easily filter join "person.is_active=true" AND return the row if true?
  // Actually !inner join would filter.
  // person:people!person_id!inner (...)
  // But let's just filter in JS for simplicity unless dataset is huge.

  // Wait, I should re-fetch with !inner if I want only active people.
  // The original SQL had `AND p.is_active = true`.

  const { data: robustData, error: robustError } = await supabase
    .from('person_role_capabilities')
    .select(`
        proficiency,
        is_primary,
        person:people!person_id!inner (
            id,
            first_name,
            last_name,
            is_active,
            church_id
        )
    `)
    .eq('role_id', id)
    .eq('church_id', churchId)
    .eq('person.is_active', true) // This filters the join because of !inner
    // Wait, Supabase syntax for filtering join is: .eq('people.is_active', true) if alias is people.
    // Here alias is person. So .eq('person.is_active', true).

    // Actually, simple .eq('person.is_active', true) works if inner join.

    // Sort in JS.

  if (robustError) {
     console.error('Robust fetch error', robustError);
     // Fallback to simpler or just throw.
     throw error(500, 'Failed to fetch capable people');
  }

  // Flatten and sort
  const result = (robustData || []).map((row: any) => ({
      id: row.person.id,
      first_name: row.person.first_name,
      last_name: row.person.last_name,
      proficiency: row.proficiency,
      is_primary: row.is_primary
  }));

  result.sort((a: any, b: any) => {
      // ORDER BY prc.is_primary DESC, prc.proficiency DESC, p.last_name, p.first_name
      if (a.is_primary !== b.is_primary) return b.is_primary ? 1 : -1; // true > false
      if (a.proficiency !== b.proficiency) return b.proficiency - a.proficiency;
      if (a.last_name !== b.last_name) return (a.last_name || '').localeCompare(b.last_name || '');
      return (a.first_name || '').localeCompare(b.first_name || '');
  });

  return json(result);
};
