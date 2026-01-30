import { db } from '$lib/server/db';
import { authors } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { and, eq, ilike } from 'drizzle-orm'; // <--- IMPORT THESE OPERATORS

export async function GET({ url, locals }) {
	const { church } = locals;
	if (!church) return json([]);

	const query = url.searchParams.get('q') || '';
	if (query.length < 2) return json([]);

	const results = await db
		.select({
			id: authors.id,
			name: authors.name
		})
		.from(authors)
		.where(
			and(
				// <--- USE DIRECTLY
				eq(authors.church_id, church.id),
				ilike(authors.name, `%${query}%`)
			)
		)
		.limit(5);

	return json(results);
}
