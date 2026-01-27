import { db } from '$lib/server/db';
import { songs } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const allSongs = await db.query.songs.findMany({
		orderBy: [desc(songs.updated_at)],
		// We also fetch arrangements to show how many variants exist
		with: {
			arrangements: true
		}
	});

	return { songs: allSongs };
};
