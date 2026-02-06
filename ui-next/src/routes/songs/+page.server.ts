import { hasPermission } from '$lib/auth/roles';
import { db } from '$lib/server/db';
import { authors, song_authors, songs } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

// 1. LOAD FUNCTION
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.church) {
		throw error(404, 'Church not found');
	}
	const { church } = locals;

	const filter = url.searchParams.get('filter') || 'active';
	const canDelete = hasPermission(locals.actor?.role, 'songs:delete');

	// Only root songs — arrangements are accessed via their parent
	const allSongs = await db.query.songs.findMany({
		where: (s, { and, eq, isNull: isNul, isNotNull: isNotNul }) => {
			const base = and(eq(s.church_id, church.id), isNul(s.original_song_id));
			if (filter === 'archived') return and(base, isNotNul(s.deleted_at));
			if (filter === 'all') return base;
			return and(base, isNul(s.deleted_at));
		},
		with: {
			authors: {
				with: { author: true }
			}
		},
		orderBy: [desc(songs.updated_at)]
	});

	return { songs: allSongs, canDelete, filter };
};

// 2. ACTIONS
export const actions: Actions = {
	archiveSong: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) throw error(401, 'Unauthorized');
		const data = await request.formData();
		const songId = data.get('song_id') as string;
		if (!songId) throw error(400, 'Song ID required');

		await db
			.update(songs)
			.set({ deleted_at: new Date() })
			.where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		return { success: true };
	},

	restoreSong: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) throw error(401, 'Unauthorized');
		if (!hasPermission(locals.actor?.role, 'songs:delete')) {
			throw error(403, 'Insufficient permissions');
		}
		const data = await request.formData();
		const songId = data.get('song_id') as string;
		if (!songId) throw error(400, 'Song ID required');

		await db
			.update(songs)
			.set({ deleted_at: null })
			.where(and(eq(songs.id, songId), eq(songs.church_id, church.id)));

		return { success: true };
	},

	// SEED LIBRARY (Was resetLibrary)
	seedLibrary: async ({ locals }) => {
		const { church } = locals;
		if (!church) error(401, 'Unauthorized');

		console.log('⚠️ Seeding Library...');

		// A. DELETE ALL (Fixes the 17 duplicates issue)
		await db.delete(songs).where(eq(songs.church_id, church.id));

		// B. SEED DATA
		const seedSongs = [
			{
				title: 'Amazing Grace',
				author: 'John Newton',
				original_key: 'G',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Holy, Holy, Holy',
				author: 'Reginald Heber',
				original_key: 'D',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Be Thou My Vision',
				author: 'Ancient Irish / Hull',
				original_key: 'E',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'It Is Well With My Soul',
				author: 'Horatio Spafford',
				original_key: 'C',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Come Thou Fount of Every Blessing',
				author: 'Robert Robinson',
				original_key: 'D',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Great Is Thy Faithfulness',
				author: 'Thomas Chisholm',
				original_key: 'D',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			},
			{
				title: "All Hail the Power of Jesus' Name",
				author: 'Edward Perronet',
				original_key: 'G',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Crown Him With Many Crowns',
				author: 'Matthew Bridges',
				original_key: 'D',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Blessed Assurance',
				author: 'Fanny Crosby',
				original_key: 'C',
				time_signature: '9/8',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Rock of Ages',
				author: 'Augustus Toplady',
				original_key: 'Bb',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Nothing But the Blood',
				author: 'Robert Lowry',
				original_key: 'G',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'When I Survey the Wondrous Cross',
				author: 'Isaac Watts',
				original_key: 'F',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Christ the Lord Is Risen Today',
				author: 'Charles Wesley',
				original_key: 'C',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Hark! The Herald Angels Sing',
				author: 'Charles Wesley',
				original_key: 'F',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'O Come All Ye Faithful',
				author: 'John Francis Wade',
				original_key: 'G',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Joy to the World',
				author: 'Isaac Watts',
				original_key: 'D',
				time_signature: '2/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'The Doxology',
				author: 'Thomas Ken',
				original_key: 'G',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Fairest Lord Jesus',
				author: 'German Hymn',
				original_key: 'Eb',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'What a Friend We Have in Jesus',
				author: 'Joseph Scriven',
				original_key: 'F',
				time_signature: '4/4',
				ccli_number: 'Public Domain'
			},
			{
				title: 'Turn Your Eyes Upon Jesus',
				author: 'Helen Howarth Lemmel',
				original_key: 'F',
				time_signature: '3/4',
				ccli_number: 'Public Domain'
			}
		];

		// C. INSERT CLEAN — create songs, upsert authors, link via song_authors
		try {
			for (const seed of seedSongs) {
				const { author, ...songData } = seed as any;

				const [newSong] = await db
					.insert(songs)
					.values({
						church_id: church.id,
						...songData,
						content: 'Lyrics available in public domain.'
					})
					.returning({ id: songs.id });

				// Upsert author and link
				if (author) {
					let authorRow = await db.query.authors.findFirst({
						where: (a, { and, eq }) =>
							and(eq(a.church_id, church.id), eq(a.name, author))
					});

					if (!authorRow) {
						[authorRow] = await db
							.insert(authors)
							.values({ church_id: church.id, name: author })
							.returning();
					}

					await db.insert(song_authors).values({
						church_id: church.id,
						song_id: newSong.id,
						author_id: authorRow.id,
						sequence: 0
					});
				}
			}
			console.log('✅ Library Reset Complete');
			return { success: true };
		} catch (e) {
			console.error('❌ Seed Failed:', e);
			return { success: false, error: e };
		}
	}
};
