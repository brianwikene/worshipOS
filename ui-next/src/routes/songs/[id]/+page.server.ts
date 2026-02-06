// src/routes/songs/[id]/+page.server.ts

import { db } from '$lib/server/db';
import { authors, song_authors, songs } from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.church) throw error(404, 'Church not found');
	const { church } = locals;

	const song = await db.query.songs.findFirst({
		where: (s, { and, eq }) => and(eq(s.id, params.id), eq(s.church_id, church.id)),
		with: {
			authors: {
				with: { author: true },
				orderBy: (sa, { asc }) => [asc(sa.sequence)]
			},
			arrangements: true
		}
	});

	if (!song) throw error(404, 'Song not found');

	return { song, churchName: church.name };
};

export const actions: Actions = {
	updateSong: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const songId = params.id;
		const data = await request.formData();

		// --- update song ---
		await db
			.update(songs)
			.set({
				title: data.get('title') as string,
				artist: (data.get('artist') as string) || null,
				original_key: data.get('key') as string,
				tempo: data.get('tempo') as string,
				bpm: data.get('bpm') ? parseInt(data.get('bpm') as string) : null,
				time_signature: (data.get('time_signature') as string) || '4/4',
				ccli_number: data.get('ccli') as string,
				copyright: (data.get('copyright') as string) || null,
				youtube_url: (data.get('youtube_url') as string) || null,
				spotify_url: (data.get('spotify_url') as string) || null,
				performance_notes: data.get('performance_notes') as string,
				lyrics: data.get('lyrics') as string,
				content: data.get('content') as string,
				updated_at: new Date()
			})
			.where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		// --- authors ---
		const authorsJson = data.get('authors_json') as string | null;
		if (!authorsJson) return { success: true };

		let incomingAuthors: { id?: string; name: string }[];
		try {
			incomingAuthors = JSON.parse(authorsJson);
		} catch {
			return { success: true };
		}

		const finalAuthorIds: string[] = [];

		for (const authorObj of incomingAuthors) {
			if (authorObj.id) {
				// ensure author belongs to this church
				const existing = await db.query.authors.findFirst({
					where: (a, { and, eq }) => and(eq(a.id, authorObj.id!), eq(a.church_id, church.id))
				});
				if (!existing) throw error(400, 'Invalid author');
				finalAuthorIds.push(authorObj.id);
			} else {
				const [newAuthor] = await db
					.insert(authors)
					.values({
						church_id: church.id,
						name: authorObj.name
					})
					.returning({ id: authors.id });

				finalAuthorIds.push(newAuthor.id);
			}
		}

		// clear existing links (tenant-safe)
		await db
			.delete(song_authors)
			.where(and(eq(song_authors.song_id, songId), eq(song_authors.church_id, church.id)));

		// insert new links (tenant-safe)
		if (finalAuthorIds.length > 0) {
			await db.insert(song_authors).values(
				finalAuthorIds.map((authorId, index) => ({
					church_id: church.id,
					song_id: songId,
					author_id: authorId,
					sequence: index
				}))
			);
		}

		return { success: true };
	},

	deleteSong: async ({ params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const songId = params.id;

		await db.delete(songs).where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		return { success: true };
	},

	archiveSong: async ({ params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const songId = params.id;

		await db
			.update(songs)
			.set({ deleted_at: new Date() })
			.where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		throw redirect(303, '/songs');
	},

	createArrangement: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const parentId = params.id;
		const data = await request.formData();

		// Get parent song to inherit artist
		const parentSong = await db.query.songs.findFirst({
			where: (s, { and, eq }) => and(eq(s.id, parentId), eq(s.church_id, church.id))
		});

		if (!parentSong) throw error(404, 'Parent song not found');

		const versionName = (data.get('version_name') as string) || 'Untitled Version';
		const key = (data.get('key') as string) || parentSong.original_key;
		const content = (data.get('content') as string) || parentSong.content;

		const [arrangement] = await db
			.insert(songs)
			.values({
				church_id: church.id,
				original_song_id: parentId,
				title: parentSong.title,
				arrangement_name: versionName,
				artist: parentSong.artist, // Inherit from parent
				original_key: key,
				tempo: parentSong.tempo,
				bpm: parentSong.bpm,
				time_signature: parentSong.time_signature,
				ccli_number: parentSong.ccli_number,
				content
			})
			.returning({ id: songs.id });

		return { success: true, arrangement };
	},

	updateArrangement: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const data = await request.formData();
		const arrangementId = data.get('arrangement_id') as string;

		if (!arrangementId) throw error(400, 'Arrangement ID required');

		await db
			.update(songs)
			.set({
				arrangement_name: data.get('name') as string,
				content: data.get('content') as string,
				updated_at: new Date()
			})
			.where(
				and(
					eq(songs.id, arrangementId),
					eq(songs.church_id, church.id),
					eq(songs.original_song_id, params.id)
				)
			);

		return { success: true };
	},

	deleteArrangement: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Song ID required');

		const { church } = locals;
		const data = await request.formData();
		const arrangementId = data.get('arrangement_id') as string;

		if (!arrangementId) throw error(400, 'Arrangement ID required');

		await db
			.delete(songs)
			.where(
				and(
					eq(songs.id, arrangementId),
					eq(songs.church_id, church.id),
					eq(songs.original_song_id, params.id)
				)
			);

		return { success: true };
	}
};
