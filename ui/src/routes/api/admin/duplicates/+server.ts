// /ui/src/routes/api/admin/duplicates/+server.ts
// src/routes/api/admin/duplicates/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  // Parse query params
  const status = url.searchParams.get('status') || 'suggested';
  const minScore = parseInt(url.searchParams.get('min_score') || '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // Validate status
  const validStatuses = ['suggested', 'confirmed', 'not_match', 'merged', 'all'];
  if (!validStatuses.includes(status)) {
    throw error(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  let query = locals.supabase
    .from('identity_links')
    .select(`
        id,
        person_a_id,
        person_b_id,
        status,
        confidence_score,
        match_reasons,
        detected_at,
        detected_by,
        reviewed_at,
        reviewed_by,
        review_notes,
        suppressed_until,
        reviewer:people!reviewed_by(display_name),
        person_a:people!person_a_id(
            id, display_name, first_name, last_name, goes_by, created_at,
            contact_methods(type, value)
        ),
        person_b:people!person_b_id(
            id, display_name, first_name, last_name, goes_by, created_at,
            contact_methods(type, value)
        )
    `, { count: 'exact' })
    .eq('church_id', churchId)
    .gte('confidence_score', minScore);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Filter suppressed: (suppressed_until IS NULL OR suppressed_until < now())
  // Supabase doesn't support complex OR logic easily in one .or() for specific fields combined with ANDs
  // But we can filter suppressed_until.
  // Actually, we want to HIDE suppressed ones unless we are listed 'not_match' specifically maybe?
  // The original status='suggested' check usually implies not suppressed.
  // The original SQL: AND (il.suppressed_until IS NULL OR il.suppressed_until < now())
  // If status is 'not_match', suppressed_until might be set.
  // We can use `.or('suppressed_until.is.null,suppressed_until.lt.now()')` but syntax is tricky with dates.
  // Let's optimize: mostly we care about `suggested`.
  // If we just check `suppressed_until` < now OR null.
  // Supabase postgrest-js: .or('suppressed_until.is.null,suppressed_until.lt.' + new Date().toISOString())
  const nowISO = new Date().toISOString();
  query = query.or(`suppressed_until.is.null,suppressed_until.lt.${nowISO}`);

  query = query
    .order('confidence_score', { ascending: false })
    .order('detected_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error: dbError } = await query;

  if (dbError) {
    console.error('GET /api/admin/duplicates failed:', dbError);
    throw error(500, 'Failed to load duplicates');
  }

  // Format response to match original structure
  const duplicates = (data || []).map((row: any) => {
    // Helper to extract first email/phone
    const getContact = (methods: any[], type: string) =>
        methods?.find((m: any) => m.type === type)?.value || null;

    return {
      id: row.id,
      person_a: {
        id: row.person_a?.id,
        display_name: row.person_a?.display_name,
        first_name: row.person_a?.first_name,
        last_name: row.person_a?.last_name,
        goes_by: row.person_a?.goes_by,
        email: getContact(row.person_a?.contact_methods, 'email'),
        phone: getContact(row.person_a?.contact_methods, 'phone'),
        created_at: row.person_a?.created_at
      },
      person_b: {
        id: row.person_b?.id,
        display_name: row.person_b?.display_name,
        first_name: row.person_b?.first_name,
        last_name: row.person_b?.last_name,
        goes_by: row.person_b?.goes_by,
        email: getContact(row.person_b?.contact_methods, 'email'),
        phone: getContact(row.person_b?.contact_methods, 'phone'),
        created_at: row.person_b?.created_at
      },
      confidence_score: row.confidence_score,
      match_reasons: row.match_reasons,
      status: row.status,
      detected_at: row.detected_at,
      detected_by: row.detected_by,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by,
      reviewer_name: row.reviewer?.display_name,
      review_notes: row.review_notes
    };
  });

  return json({
    duplicates,
    total: count || 0,
    limit,
    offset
  });
};
