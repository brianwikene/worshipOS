import { db } from '$lib/server/db';
import { gathering_types, templates } from '$lib/server/db/schema';
import { error, fail, type Actions } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// Fetch Types with their Templates attached
	const types = await db.query.gathering_types.findMany({
		where: and(eq(gathering_types.church_id, church.id), isNull(gathering_types.deleted_at)),
		with: {
			// You need to add this relation to schema.ts relations section to make this work!
			// For now, we'll fetch separate and combine if relations aren't set up yet,
			// OR we just fetch types here and fetch templates separately.
		}
	});

	// Simple fetch for now
	const allTemplates = await db.query.templates.findMany({
		where: eq(templates.church_id, church.id)
	});

	return { types, allTemplates };
};

export const actions = {
	createType: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);
		const data = await request.formData();
		const name = data.get('name') as string;

		await db.insert(gathering_types).values({
			church_id: church.id,
			name
		});
		return { success: true };
	},

	createTemplate: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);
		const data = await request.formData();
		const name = data.get('name') as string;
		const typeId = data.get('type_id') as string;
		const isPartial = data.get('is_partial') === 'on';

		await db.insert(templates).values({
			church_id: church.id,
			gathering_type_id: typeId || null,
			name,
			is_partial: isPartial,
			data: '[]' // Empty item list to start
		});
		return { success: true };
	},

	deleteTemplate: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		await db.delete(templates).where(eq(templates.id, id));
	}
} satisfies Actions;
