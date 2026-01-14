// ui/src/routes/api/songs/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { sanitizeSongPayload } from '$lib/server/songs/input';
import { parseSongText } from '$lib/server/songs/parser';
import { mapSongRow, type SongRow } from '$lib/server/songs/repository';

type SongRowWithArrangements = SongRow & {
  song_arrangements?: Array<{ count: number }>;
};

const SONG_SELECT = `
  id,
  title,
  artist,
  key,
  bpm,
  ccli_number,
  notes,
  source_format,
  raw_text,
  parsed_json,
  created_at,
  updated_at,
  song_arrangements(count)
`;

function normalizeArrangementCount(row: SongRowWithArrangements): SongRow {
  const arrangement_count = Number(row.song_arrangements?.[0]?.count ?? 0);
  const { song_arrangements, ...rest } = row as any;
  return { ...rest, arrangement_count } as SongRow;
}

export const GET: RequestHandler = async ({ locals, url }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const search = url.searchParams.get('search')?.trim() || null;

  let query = locals.supabase
    .from('songs')
    .select(SONG_SELECT)
    .eq('church_id', churchId)
    .is('archived_at', null)
    .order('title', { ascending: true });

  if (search) {
    query = query.or(
      [
        `title.ilike.%${search}%`,
        `artist.ilike.%${search}%`,
        `notes.ilike.%${search}%`,
        `raw_text.ilike.%${search}%`
      ].join(',')
    );
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error('[API] /api/songs GET failed:', dbError);
    throw error(500, 'Failed to load songs');
  }

  const rows = (data ?? []) as SongRowWithArrangements[];
  const normalized = rows.map(normalizeArrangementCount);

  return json(normalized.map(mapSongRow), {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const rawBody = await request.json().catch(() => ({}));
  const payload = sanitizeSongPayload(rawBody);
  if (!payload.title) throw error(400, 'Title is required');

  const parserResult = parseSongText(payload.raw_text ?? '', {
    formatHint: payload.source_format
  });

  const { data: inserted, error: insertError } = await locals.supabase
    .from('songs')
    .insert({
      church_id: churchId,
      title: payload.title,
      artist: payload.artist,
      key: payload.key,
      bpm: payload.bpm,
      ccli_number: payload.ccli_number,
      notes: payload.notes,
      source_format: payload.source_format,
      raw_text: payload.raw_text,
      parsed_json: parserResult
    })
    .select(SONG_SELECT)
    .single();

  if (insertError || !inserted) {
    console.error('[API] /api/songs POST failed:', insertError);
    throw error(500, 'Failed to create song');
  }

  const normalized = normalizeArrangementCount(inserted as SongRowWithArrangements);

  return json(mapSongRow(normalized), {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
