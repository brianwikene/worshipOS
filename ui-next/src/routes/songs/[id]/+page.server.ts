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

	return { song, churchName: church.name };
};

export const actions: Actions = {
	updateSong: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();

		// 1. Update the Song Record (Master)
		await db
			.update(songs)
			.set({
				title: data.get('title') as string,
				original_key: data.get('key') as string,
				tempo: data.get('tempo') as string,
				ccli_number: data.get('ccli') as string,
				performance_notes: data.get('performance_notes') as string,
				content: data.get('content') as string,
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
			await db.delete(song_authors).where(eq(song_authors.song_id, params.id));

			// C. Insert new links (FIX: Removed church_id and id)
			if (finalAuthorIds.length > 0) {
				await db.insert(song_authors).values(
					finalAuthorIds.map((authorId, index) => ({
						song_id: params.id,
						author_id: authorId,
						sequence: index
					}))
				);
			}
		}

		return { success: true };
	},

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
				// FIX: Saving Key and Content properly now
				key: data.get('key') as string,
				content: data.get('content') as string,
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
