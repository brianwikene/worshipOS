// /ui/src/routes/api/people/[id]/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * GET /api/people/[id]
 * Fetch a single person's details including contact info & addresses
 **************************************************************/
export const GET: RequestHandler = async ({ locals, params }) => {
  const { id } = params;

  // 1. Fetch Person Base Data
  let query = locals.supabase
    .from('people')
    .select('*')
    .eq('id', id)
    .single();

  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  const { data: person, error: dbError } = await query;

  if (dbError) {
    console.error(`GET /api/people/${id} failed:`, dbError);
    if (dbError.code === 'PGRST116') {
      throw error(404, 'Person not found');
    }
    throw error(500, 'Failed to load person');
  }

  // 2. Fetch Contact Methods
  const { data: contactMethods } = await locals.supabase
    .from('contact_methods')
    .select('*')
    .eq('person_id', id)
    .order('is_primary', { ascending: false });

  // 3. Fetch Addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('*')
    .eq('person_id', id);

  // 4. Fetch Family Addresses (Optional / Stubbed for now)
  // We will stub this empty to prevent the UI from crashing
  // until you migrate the Family logic.
  const familyAddresses: any[] = [];

  // 5. Construct the Response Object that the UI expects
  const response = {
    ...person,
    contact_methods: contactMethods ?? [],
    addresses: addresses ?? [],
    family_addresses: familyAddresses
  };

  return json(response);
};

/**************************************************************
 * PUT /api/people/[id]
 * Update a person's basic info
 **************************************************************/
export const PUT: RequestHandler = async ({ locals, request, params }) => {
  const { id } = params;
  const body = await request.json();
  const { first_name, last_name, goes_by, display_name } = body;

  // Basic Validation
  if (!first_name && !last_name) {
    throw error(400, 'At least first_name or last_name is required');
  }

  // Build Update Object
  const updates: Record<string, any> = {
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
    goes_by: goes_by?.trim() || null,
    // We update display_name if your frontend logic requires it,
    // otherwise a DB trigger usually handles this.
    display_name: display_name?.trim() || ''
  };

  let query = locals.supabase
    .from('people')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  // Safety: If context is set, ensure we only update people in that church
  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error(`PUT /api/people/${id} failed:`, dbError);
    throw error(500, 'Failed to update person');
  }

  return json(data);
};

/**************************************************************
 * DELETE /api/people/[id]
 * Soft-delete a person (set is_active = false)
 **************************************************************/
export const DELETE: RequestHandler = async ({ locals, params }) => {
  const { id } = params;

  // We perform a "Soft Delete" so history is preserved
  let query = locals.supabase
    .from('people')
    .update({ is_active: false })
    .eq('id', id)
    .select() // Return the row so we know it worked
    .single();

  // Safety: Ensure we don't delete someone from the wrong church context
  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error(`DELETE /api/people/${id} failed:`, dbError);
    throw error(500, 'Failed to delete person');
  }

  return json({ success: true, id: data.id });
};
