// /ui/src/routes/api/admin/duplicates/scan/+server.ts
// POST /api/admin/duplicates/scan - Trigger duplicate detection scan

import { findDuplicates, saveDetectedDuplicates } from '$lib/server/duplicates/detector';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/admin/duplicates/scan
 * Trigger a duplicate detection scan
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  // Parse request body
  let minScore = 50;
  let limit = 500;

  try {
    const body = await request.json();
    if (body.min_score) minScore = Math.max(1, Math.min(100, parseInt(body.min_score, 10)));
    if (body.limit) limit = Math.max(1, Math.min(1000, parseInt(body.limit, 10)));
  } catch {
    // Use defaults if body parsing fails
  }

  try {
    const startTime = Date.now();

    // Find duplicates
    const candidates = await findDuplicates(locals.supabase, churchId, {
      minScore,
      limit,
      includeExisting: false
    });

    // Save to database
    const savedCount = await saveDetectedDuplicates(locals.supabase, churchId, candidates, 'system');


    const duration = Date.now() - startTime;

    return json({
      success: true,
      new_candidates: savedCount,
      total_found: candidates.length,
      scan_duration_ms: duration
    });
  } catch (err) {
    console.error('POST /api/admin/duplicates/scan failed:', err);
    throw error(500, 'Failed to run duplicate scan');
  }
};
