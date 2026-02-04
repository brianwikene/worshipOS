// src/routes/songs/new/+page.server.ts
import { db } from '$lib/server/db';
import { authors, song_authors, songs } from '$lib/server/db/schema';
import { error, redirect } from '@sveltejs/kit'; // <--- Added 'error'
import type { Actions, PageServerLoad } from './$types'; // <--- Added 'PageServerLoad'

export const load: PageServerLoad = async ({ locals }) => {
	// --- THE GUARD CLAUSE ---
	if (!locals.church) {
		throw error(404, 'Church not found');
	}
	const { church } = locals; // TypeScript now knows 'church' is safe!
	return {};
};

export const actions: Actions = {
	// Rename 'create' to 'default'
	create: async ({ request, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		const { church } = locals;
		const data = await request.formData();

		const title = data.get('title') as string;
		const key = data.get('key') as string;
		const tempo = data.get('tempo') as string;
		const notes = data.get('performance_notes') as string;
		const ccli = data.get('ccli') as string;
		const content = data.get('content') as string;

		// 1. Create the Song
		const [newSong] = await db
			.insert(songs)
			.values({
				church_id: church.id,
				title,
				original_key: key,
				tempo,
				performance_notes: notes,
				ccli_number: ccli,
				content
				// REMOVED: author: '' (This was causing the error)
			})
			.returning({ id: songs.id });

		// 2. Handle Authors (The Chips)
		const authorsJson = data.get('authors_json') as string;

		if (authorsJson) {
			const incomingAuthors = JSON.parse(authorsJson) as { id?: string; name: string }[];
			const finalAuthorIds: string[] = [];

			for (const authorObj of incomingAuthors) {
				if (authorObj.id) {
					// Existing author selected
					finalAuthorIds.push(authorObj.id);
				} else {
					// Create new author on the fly
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

			// Link them with sequence
			if (finalAuthorIds.length > 0) {
				await db.insert(song_authors).values(
					finalAuthorIds.map((authorId, index) => ({
						song_id: newSong.id,
						author_id: authorId,
						sequence: index
					}))
				);
			}
		}

		// 3. Redirect to the new song
		throw redirect(303, `/songs/${newSong.id}`);
	}
};
