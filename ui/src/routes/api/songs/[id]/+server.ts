import { json, error } from '@sveltejs/kit';
import type { HttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';
import { sanitizeSongPayload } from '$lib/server/songs/input';
import { parseSongText } from '$lib/server/songs/parser';
import { fetchSongById } from '$lib/server/songs/repository';

export const GET: RequestHandler = async ({ locals, params }) => {
	const churchId = locals.churchId;
	if (!churchId) throw error(400, 'church_id is required');

	const song = await fetchSongById(churchId, params.id);
	if (!song) throw error(404, 'Song not found');

	return json(song, { headers: { 'x-served-by': 'sveltekit' } });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const churchId = locals.churchId;
	if (!churchId) throw error(400, 'church_id is required');

	const rawBody = await request.json();
	const payload = sanitizeSongPayload(rawBody);
	if (!payload.title) throw error(400, 'Title is required');

	const parserResult = parseSongText(payload.raw_text ?? '', {
		formatHint: payload.source_format
	});

	try {
		const updated = await pool.query(
			`
      UPDATE songs
      SET
        title = $3,
        artist = $4,
        "key" = $5,
        bpm = $6,
        ccli_number = $7,
        notes = $8,
        source_format = $9,
        raw_text = $10,
        parsed_json = $11
      WHERE church_id = $1 AND id = $2
      RETURNING id
      `,
			[
				churchId,
				params.id,
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

		if (updated.rowCount === 0) throw error(404, 'Song not found');

		const song = await fetchSongById(churchId, params.id);
		if (!song) throw error(500, 'Song updated but could not be loaded');

		return json(song, { headers: { 'x-served-by': 'sveltekit' } });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('PUT /api/songs/:id failed:', err);
		throw error(500, 'Failed to update song');
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const churchId = locals.churchId;
	if (!churchId) throw error(400, 'church_id is required');

	const result = await pool.query('DELETE FROM songs WHERE church_id = $1 AND id = $2', [
		churchId,
		params.id
	]);

	if (result.rowCount === 0) throw error(404, 'Song not found');

	return new Response(null, { status: 204 });
};

function isHttpError(err: unknown): err is HttpError {
	return typeof err === 'object' && err !== null && 'status' in err;
}
