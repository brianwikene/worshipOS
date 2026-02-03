import { db } from '$lib/server/db';
import { teams } from '$lib/server/db/schema';
import { fail, type Actions } from '@sveltejs/kit';

// Define the expected shape of the data
interface TeamImportItem {
	name: string;
	roles: string[];
}

export const actions = {
	bulkCreateTeams: async ({ request, locals }) => {
		// 1. Auth Check
		const { church } = locals;
		if (!church) {
			return fail(401, { error: 'No tenant context found.' });
		}

		// 2. Parse Data
		const formData = await request.formData();
		const rawJson = formData.get('json_data') as string;

		if (!rawJson) {
			return fail(400, { error: 'No data provided.' });
		}

		let items: TeamImportItem[] = [];
		try {
			items = JSON.parse(rawJson);
		} catch {
			return fail(400, { error: 'Invalid JSON data.' });
		}

		if (items.length === 0) {
			return fail(400, { error: 'List is empty.' });
		}

		// 3. Database Insertion
		let createdCount = 0;

		try {
			for (const item of items) {
				const roleString =
					item.roles && item.roles.length > 0 ? `Roles: ${item.roles.join(', ')}` : '';

				await db.insert(teams).values({
					church_id: church.id,
					name: item.name,
					type: 'ministry', // Default to ministry for bulk import
					description: roleString // Storing roles here for now!
				});
				createdCount++;
			}
		} catch (err) {
			console.error(err);
			return fail(500, { error: 'Database error occurred during import.' });
		}

		return { success: true, count: createdCount };
	}
} satisfies Actions;
