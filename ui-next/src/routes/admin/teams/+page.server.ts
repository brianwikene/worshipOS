import { db } from '$lib/server/db';
import { team_members, teams } from '$lib/server/db/schema';
import { eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) return { teams: [] };

	const allTeams = await db.query.teams.findMany({
		where: eq(teams.church_id, church.id),
		with: {
			members: {
				// 1. FILTER: Only get members who are NOT archived (deleted_at is null)
				where: isNull(team_members.deleted_at),
				columns: {
					person_id: true // We only need the ID to count heads
				}
			}
		},
		orderBy: (teams, { asc }) => [asc(teams.name)]
	});

	return {
		teams: allTeams.map((t) => {
			// 2. COUNT HEADS: Use a Set to remove duplicates
			// If Brian has 3 roles, he appears 3 times in 'members', but only once in 'uniquePeople'
			const uniquePeople = new Set(t.members.map((m) => m.person_id));

			return {
				...t,
				memberCount: uniquePeople.size
			};
		})
	};
};
