import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * GET /api/families/:id
 * Get family detail with all members
 **************************************************************/
export const GET: RequestHandler = async ({ locals, params }) => {
  const { id } = params;

  // 1. Get Family & Addresses
  let query = locals.supabase
    .from('families')
    .select(`
        id, name, notes, is_active, primary_address_id, created_at, updated_at,
        addresses (*)
    `)
    .eq('id', id)
    .single();

  // OPTIONAL: Filter by church only if picker is active
  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  const { data: family, error: familyError } = await query;

  if (familyError || !family) {
      if (familyError?.code === 'PGRST116' || !family) throw error(404, 'Family not found');
      console.error('GET /api/families/:id failed:', familyError);
      throw error(500, 'Failed to load family');
  }

  // Process addresses order: Primary first, then label, then created_at
  if (family.addresses) {
      family.addresses.sort((a: any, b: any) => {
          if (a.id === family.primary_address_id) return -1;
          if (b.id === family.primary_address_id) return 1;
          if (a.label !== b.label) return (a.label || '').localeCompare(b.label || '');
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      // Add 'is_primary' flag
      family.addresses = family.addresses.map((a: any) => ({
          ...a,
          is_primary: a.id === family.primary_address_id
      }));
  } else {
      family.addresses = [];
  }

  // 2. Get Members
  const { data: members, error: membersError } = await locals.supabase
    .from('family_members')
    .select(`
        id, person_id, relationship, is_active, is_temporary, is_primary_contact, start_date, end_date, notes,
        person:people(display_name, first_name, last_name, goes_by)
    `)
    .eq('family_id', id)
    .order('is_active', { ascending: false });

  if (membersError) {
      console.error('GET /api/families/:id members failed:', membersError);
      throw error(500, 'Failed to load family members');
  }

  // Flatten and Sort Members
  const relationshipOrder: Record<string, number> = {
      'parent': 1, 'guardian': 2, 'spouse': 3, 'child': 4, 'foster_child': 5, 'other': 6
  };

  const flatMembers = (members || []).map((m: any) => ({
      membership_id: m.id,
      person_id: m.person_id,
      display_name: m.person?.display_name,
      first_name: m.person?.first_name,
      last_name: m.person?.last_name,
      goes_by: m.person?.goes_by,
      relationship: m.relationship,
      is_active: m.is_active,
      is_temporary: m.is_temporary,
      is_primary_contact: m.is_primary_contact,
      start_date: m.start_date,
      end_date: m.end_date,
      notes: m.notes
  }));

  flatMembers.sort((a, b) => {
      if (a.is_active !== b.is_active) return (a.is_active ? -1 : 1);
      const orderA = relationshipOrder[a.relationship] || 99;
      const orderB = relationshipOrder[b.relationship] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.display_name || '').localeCompare(b.display_name || '');
  });

  return json({
      ...family,
      members: flatMembers
  }, { headers: { 'x-served
