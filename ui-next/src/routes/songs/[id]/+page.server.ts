import { db } from '$lib/server/db';
import { authors, song_authors, songs } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// --- GUARD CLAUSE ---
	if (!locals.church) {
		throw error(404, 'Church not found');
	}
	const { church } = locals;
	// --------------------

	const song = await db.query.songs.findFirst({
		where: (s, { and, eq }) => and(eq(s.id, params.id), eq(s.church_id, church.id)),
		with: {
			// Fetch authors via the junction table
			authors: {
				with: {
					author: true
				},
				orderBy: (sa, { asc }) => [asc(sa.sequence)]
			}
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

		// 1. Update the Song Record (Master)
		await db
			.update(songs)
			.set({
				title: data.get('title') as string,
				original_key: data.get('key') as string,
				tempo: data.get('tempo') as string,
				bpm: data.get('bpm') ? parseInt(data.get('bpm') as string) : null,
				time_signature: (data.get('time_signature') as string) || '4/4',
				ccli_number: data.get('ccli') as string,
				performance_notes: data.get('performance_notes') as string,
				lyrics: data.get('lyrics') as string,
				content: data.get('content') as string,
				updated_at: new Date()
			})
			.where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		// 2. HANDLE AUTHORS
		const authorsJson = data.get('authors_json') as string;
		if (authorsJson) {
			let incomingAuthors: { id?: string; name: string }[];
			try {
				incomingAuthors = JSON.parse(authorsJson);
			} catch {
				return { success: true };
			}

			// A. Resolve IDs (Create new authors if they have no ID)
			const finalAuthorIds: string[] = [];

			for (const authorObj of incomingAuthors) {
				if (authorObj.id) {
					finalAuthorIds.push(authorObj.id);
				} else {
					// Create new author if ID is missing
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

			// B. Clear existing links for this song
			await db.delete(song_authors).where(eq(song_authors.song_id, songId));

			// C. Insert new links with sequence for ordering
			if (finalAuthorIds.length > 0) {
				await db.insert(song_authors).values(
					finalAuthorIds.map((authorId, index) => ({
						song_id: songId,
						author_id: authorId,
						sequence: index
					}))
				);
			}
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
	}
};
