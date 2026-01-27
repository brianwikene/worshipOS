import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const people = pgTable(
	'people',
	{
		id: uuid('id').defaultRandom().primaryKey(),

		churchId: uuid('church_id').notNull(),
		displayName: text('display_name').notNull(),

		firstName: text('first_name'),
		lastName: text('last_name'),

		isActive: boolean('is_active').default(true).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(t) => ({
		idxPeopleChurch: index('idx_people_church').on(t.churchId),
		idxPeopleChurchActive: index('idx_people_church_active').on(t.churchId, t.isActive),
		idxPeopleDisplayName: index('idx_people_display_name').on(t.displayName)
	})
);
