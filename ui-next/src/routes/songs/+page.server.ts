import { db } from '$lib/server/db';
import { songs } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm'; // <--- ADDED 'eq' HERE
import type { Actions, PageServerLoad } from './$types';

// 1. LOAD FUNCTION
export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// Fetch songs for this church
	const allSongs = await db.query.songs.findMany({
		where: (s, { eq }) => eq(s.church_id, church.id),
		orderBy: [desc(songs.updated_at)]
	});

	return { songs: allSongs };
};

// 2. ACTIONS
export const actions: Actions = {
	// RESET LIBRARY (The "Nuclear Option" to fix duplicates)
	resetLibrary: async ({ locals }) => {
		const { church } = locals;
		if (!church) error(401, 'Unauthorized');

		console.log('⚠️ Resetting Library...');

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

		// C. INSERT CLEAN
		try {
			for (const song of seedSongs) {
				await db.insert(songs).values({
					church_id: church.id,
					...song,
					lyrics: 'Lyrics available in public domain.'
				});
			}
			console.log('✅ Library Reset Complete');
			return { success: true };
		} catch (e) {
			console.error('❌ Seed Failed:', e);
			return { success: false, error: e };
		}
	}
};
