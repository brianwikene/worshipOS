// src/routes/api/authors/+server.ts
import { db } from '$lib/server/db';
import { authors } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { and, eq, ilike } from 'drizzle-orm';
import type { RequestHandler } from './$types'; // <--- 1. Import the generated type

// 2. Use 'export const' to apply the RequestHandler type
export const GET: RequestHandler = async ({ url, locals }) => {
	const { church } = locals;

	// Now TypeScript knows 'church' exists because we updated app.d.ts!
	if (!church) return json([]);

	const query = url.searchParams.get('q') || '';
	if (query.length < 2) return json([]);

	const results = await db
		.select({
			id: authors.id,
			name: authors.name
		})
		.from(authors)
		.where(and(eq(authors.church_id, church.id), ilike(authors.name, `%${query}%`)))
		.limit(5);

	return json(results);
};
