import { db } from '$lib/server/db';
import { arrangements, authors, song_authors, songs } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	const song = await db.query.songs.findFirst({
		where: (s, { and, eq }) => and(eq(s.id, params.id), eq(s.church_id, church.id)),
		with: {
			arrangements: true,
			// Fetch authors via the junction table
			authors: {
				with: {
					author: true
				}
			}
		}
	});

	if (!song) error(404, 'Song not found');

	return { song };
};

export const actions: Actions = {
	updateSong: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();

		const title = data.get('title') as string;
		const author = data.get('author') as string; // Legacy Text Fallback
		const key = data.get('key') as string;
		const tempo = data.get('tempo') as string;
		const notes = data.get('performance_notes') as string; // <--- NEW
		const ccli = data.get('ccli') as string;
		const content = data.get('content') as string;

		await db
			.update(songs)
			.set({
				title,
				author,
				original_key: key,
				tempo: tempo,
				performance_notes: notes, // <--- SAVE IT
				ccli_number: ccli,
				content,
				updated_at: new Date()
			})
			.where(and(eq(songs.id, params.id), eq(songs.church_id, church.id)));

		// 2. HANDLE AUTHORS
		const authorsJson = data.get('authors_json') as string;
		if (authorsJson) {
			let incomingAuthors: { id?: string; name: string }[];
			try {
				incomingAuthors = JSON.parse(authorsJson);
			} catch {
				// Invalid JSON - skip author processing
				return { success: true };
			}

			// A. Resolve IDs (Create new authors if they have no ID)
			const finalAuthorIds: string[] = [];

			for (const authorObj of incomingAuthors) {
				if (authorObj.id) {
					finalAuthorIds.push(authorObj.id);
				} else {
					// It's a new name! Create it.
					// Check if it already exists by name first (case insensitive safety)
					// ... (omitted for brevity, but good practice) ...

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

			// B. Nuclear Option: Clear existing links for this song
			await db.delete(song_authors).where(eq(song_authors.song_id, params.id));

			// C. Insert new links with SEQUENCE
			if (finalAuthorIds.length > 0) {
				await db.insert(song_authors).values(
					finalAuthorIds.map((authorId, index) => ({
						song_id: params.id,
						author_id: authorId,
						sequence: index // <--- 0, 1, 2... THIS SAVES THE ORDER
					}))
				);
			}
		}

		return { success: true };
	},

	// ... keep other actions (deleteSong, createArrangement, etc.) as they were
	createArrangement: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();

		await db.insert(arrangements).values({
			church_id: church.id,
			song_id: params.id,
			name: data.get('version_name') as string,
			key: data.get('key') as string,
			content: data.get('content') as string
		});
		return { success: true };
	},
	updateArrangement: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const id = data.get('arrangement_id') as string;

		await db
			.update(arrangements)
			.set({
				name: data.get('name') as string,
				updated_at: new Date()
			})
			.where(and(eq(arrangements.id, id), eq(arrangements.church_id, church.id)));

		return { success: true };
	},

	deleteArrangement: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		await db
			.delete(arrangements)
			.where(
				and(
					eq(arrangements.id, data.get('arrangement_id') as string),
					eq(arrangements.church_id, church.id)
				)
			);
		return { success: true };
	},

	deleteSong: async ({ params, locals }) => {
		const { church } = locals;
		await db.delete(songs).where(and(eq(songs.id, params.id), eq(songs.church_id, church.id)));
		return { success: true };
	}
};
