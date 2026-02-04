import { db } from '$lib/server/db';
import { teams } from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) return { teams: [] };

	const allTeams = await db.query.teams.findMany({
		where: eq(teams.church_id, church.id),
		with: {
			members: {
				columns: {
					person_id: true
				}
			}
		},
		orderBy: (teams, { asc }) => [asc(teams.name)]
	});

	return {
		teams: allTeams.map((t) => {
			// Count unique people
			const uniquePeople = new Set(t.members.map((m) => m.person_id));
			return {
				...t,
				memberCount: uniquePeople.size
			};
		})
	};
};
