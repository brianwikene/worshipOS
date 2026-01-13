import { sanitizeSongPayload } from '$lib/server/songs/input';
import { parseSongText } from '$lib/server/songs/parser';
import { fetchSongById, mapSongRow } from '$lib/server/songs/repository';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const churchId = locals.churchId;
	if (!churchId) throw error(400, 'church_id is required');

	const search = url.searchParams.get('search')?.trim() || null;

	try {
		const result = await pool.query<SongRow>(
			`
      ${SONG_SELECT}
      WHERE s.church_id = $1
        AND s.archived_at IS NULL
        AND (
          $2::text IS NULL
          OR s.title ILIKE '%' || $2 || '%'
          OR s.artist ILIKE '%' || $2 || '%'
          OR s.notes ILIKE '%' || $2 || '%'
          OR s.raw_text ILIKE '%' || $2 || '%'
        )
      ORDER BY LOWER(s.title) ASC, s.created_at DESC
      `,
			[churchId, search]
		);

		return json(result.rows.map(mapSongRow), {
			headers: { 'x-served-by': 'sveltekit' }
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('GET /api/songs failed:', err);
		throw error(500, 'Failed to load songs');
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const churchId = locals.churchId;
	if (!churchId) throw error(400, 'church_id is required');

	const rawBody = await request.json();
	const payload = sanitizeSongPayload(rawBody);
	if (!payload.title) throw error(400, 'Title is required');

	const parserResult = parseSongText(payload.raw_text ?? '', {
		formatHint: payload.source_format
	});

	try {
		const inserted = await pool.query<{ id: string }>(
			`
      INSERT INTO songs (
        church_id,
        title,
        artist,
        "key",
        bpm,
        ccli_number,
        notes,
        source_format,
        raw_text,
        parsed_json
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
      `,
			[
				churchId,
				payload.title,
				payload.artist,
				payload.key,
				payload.bpm,
				payload.ccli_number,
				payload.notes,
				payload.source_format,
				payload.raw_text,
				parserResult
			]
		);

		const song = await fetchSongById(churchId, inserted.rows[0]?.id);
		if (!song) {
			throw error(500, 'Song created but could not be loaded');
		}

		return json(song, {
			status: 201,
			headers: { 'x-served-by': 'sveltekit' }
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('POST /api/songs failed:', err);
		throw error(500, 'Failed to create song');
	}
};

function isHttpError(err: unknown): err is HttpError {
	return typeof err === 'object' && err !== null && 'status' in err;
}
