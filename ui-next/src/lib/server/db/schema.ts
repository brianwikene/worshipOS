import { relations } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';

// --- ENUMS ---

export const userRoleEnum = pgEnum('user_role', [
	'org_owner', // Billing, Tenant destruction
	'admin', // Global settings
	'staff', // Pastoral, Planning
	'coordinator', // Team Leader
	'volunteer', // Schedule access
	'user' // Base level
]);

export const planStatusEnum = pgEnum('plan_status', [
	'draft', // Editing freely
	'locked', // Finalized for Sunday
	'completed' // History
]);

export const planSegmentEnum = pgEnum('plan_segment', ['pre', 'core', 'post']);

export const teamDeclinePolicyEnum = pgEnum('team_decline_policy', [
	'no_action', // Just mark as declined.
	'reopen_position' // Create a "Needed Position" (The Hole)
]);

export const teamTypeEnum = pgEnum('team_type', [
	'ministry',
	'small_group',
	'kinship',
	'outreach',
	'demographic'
]);

export const planPersonStatusEnum = pgEnum('plan_person_status', [
	'pending',
	'confirmed',
	'declined'
]);

export const planItemTypeEnum = pgEnum('plan_item_type', [
	'header',
	'song',
	'sermon',
	'announcement',
	'prayer',
	'reading',
	'media',
	'offering',
	'communion',
	'baptism',
	'dedication',
	'other'
]);

export const addressTypeEnum = pgEnum('address_type', [
	'home',
	'work',
	'mailing',
	'vacation', // Snowbirds / Seasonal
	'school', // College kids
	'meeting', // Small groups / Coffee shops
	'business', // Vendors / Contacts
	'other'
]);

// --- TENANCY & CORE TABLES ---

export const churches = pgTable('churches', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	timezone: text('timezone').default('America/Los_Angeles').notNull(),
	subdomain: text('subdomain').unique(),
	domain: text('domain').unique(),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const campuses = pgTable('campuses', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	timezone: text('timezone').default('America/Los_Angeles').notNull(),
	address: text('address'),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const families = pgTable('families', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow()
});

export const people = pgTable('people', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	preferred_campus_id: uuid('preferred_campus_id').references(() => campuses.id),

	first_name: text('first_name').notNull(),
	last_name: text('last_name').notNull(),
	preferred_name: text('preferred_name'),
	gender: text('gender'),
	birthdate: date('birthdate', { mode: 'string' }),

	// Safeguarding
	background_check_cleared: boolean('background_check_cleared').default(false).notNull(),
	background_check_expires_at: timestamp('background_check_expires_at'),

	email: text('email'),
	phone: text('phone'),
	avatar_url: text('avatar_url'),

	occupation: text('occupation'),
	bio: text('bio'),
	capacity_note: text('capacity_note'),

	household_role: text('household_role'),
	is_household_primary: boolean('is_household_primary').default(false),
	family_id: uuid('family_id').references(() => families.id),

	// Auth & Permissions
	user_id: uuid('user_id'),
	role: userRoleEnum('role').default('user').notNull(),
	extra_permissions: text('extra_permissions').array().default([]),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

// --- MUSIC & RESOURCES ---

export const songs = pgTable('songs', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	original_song_id: uuid('original_song_id').references((): AnyPgColumn => songs.id),

	title: text('title').notNull(),
	artist: text('artist'),
	arrangement_name: text('arrangement_name'), // e.g. "Acoustic Version"

	ccli_number: text('ccli_number'),
	copyright: text('copyright'),

	// Musical details
	original_key: text('original_key'),
	bpm: integer('bpm'),
	tempo: text('tempo'),
	time_signature: text('time_signature'),

	// Content
	lyrics: text('lyrics'),
	content: text('content'), // ChordPro
	performance_notes: text('performance_notes'),

	// Media Links (Added)
	youtube_url: text('youtube_url'),
	spotify_url: text('spotify_url'),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const authors = pgTable('authors', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const song_authors = pgTable(
	'song_authors',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		// Added: Tenant Scope
		church_id: uuid('church_id')
			.notNull()
			.references(() => churches.id),

		song_id: uuid('song_id')
			.notNull()
			.references(() => songs.id, { onDelete: 'cascade' }),
		author_id: uuid('author_id')
			.notNull()
			.references(() => authors.id, { onDelete: 'cascade' }),

		sequence: integer('sequence').default(0).notNull()
	},
	(t) => ({
		pk: index('song_author_pk').on(t.song_id, t.author_id)
	})
);

// --- GATHERINGS (PLANS) ---
export const gatherings = pgTable('gatherings', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	campus_id: uuid('campus_id').references(() => campuses.id),
	title: text('title').notNull(),
	date: timestamp('date', { withTimezone: true }).notNull(),
	created_at: timestamp('created_at').defaultNow()
});

export const plans = pgTable('plans', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	campus_id: uuid('campus_id').references(() => campuses.id),
	name: text('name'),
	gathering_id: uuid('gathering_id')
		.notNull()
		.references(() => gatherings.id),
	date: timestamp('date').notNull(),
	status: planStatusEnum('status').default('draft').notNull(),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const plan_items = pgTable('plan_items', {
	id: uuid('id').defaultRandom().primaryKey(),
	// Added: Tenant Scope
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	plan_id: uuid('plan_id')
		.notNull()
		.references(() => plans.id),
	segment: planSegmentEnum('segment').default('core').notNull(),
	type: planItemTypeEnum('type').default('other').notNull(),

	title: text('title').notNull(),
	description: text('description'),
	song_id: uuid('song_id').references(() => songs.id),
	leader_id: uuid('leader_id').references(() => people.id),

	duration: integer('duration').default(0),
	actual_duration: integer('actual_duration'),
	order: integer('order').notNull(),
	is_audible: boolean('is_audible').default(false).notNull(),
	// For pre/post segments: minutes before start (pre) or after end (post)
	// Allows overlapping items instead of sequential timing
	offset_minutes: integer('offset_minutes'),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow()
});

export const plan_needed_positions = pgTable('plan_needed_positions', {
	id: uuid('id').defaultRandom().primaryKey(),

	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	plan_id: uuid('plan_id')
		.notNull()
		.references(() => plans.id),

	team_id: uuid('team_id')
		.notNull()
		.references(() => teams.id),

	capability_id: uuid('capability_id').references(() => capabilities.id),
	role_name: text('role_name'),
	quantity: integer('quantity').default(1).notNull(),
	is_snoozed: boolean('is_snoozed').default(false).notNull(),
	created_at: timestamp('created_at').defaultNow()
});

export const plan_people = pgTable('plan_people', {
	id: uuid('id').defaultRandom().primaryKey(),

	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	plan_id: uuid('plan_id')
		.notNull()
		.references(() => plans.id),

	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),

	role_name: text('role_name').notNull(),
	status: planPersonStatusEnum('status').default('pending').notNull(),

	confirmed_at: timestamp('confirmed_at'),
	confirmed_by_id: uuid('confirmed_by_id').references(() => people.id),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow()
});

// --- TEMPLATES ---

export const templates = pgTable('templates', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	description: text('description'),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const template_items = pgTable('template_items', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	template_id: uuid('template_id')
		.notNull()
		.references(() => templates.id),
	type: text('type').notNull(),
	title: text('title').notNull(),
	segment: text('segment').notNull().default('core'),
	duration_seconds: integer('duration_seconds').notNull().default(0),
	description: text('description'),
	sequence: integer('sequence').notNull().default(0),
	song_id: uuid('song_id').references(() => songs.id),
	person_id: uuid('person_id').references(() => people.id),
	deleted_at: timestamp('deleted_at')
});

// --- TEAMS ---

export const teams = pgTable('teams', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	type: teamTypeEnum('type').notNull(),
	description: text('description'),
	color: text('color'),
	requires_background_check: boolean('requires_background_check').default(false).notNull(),
	provides_rehearsal_access: boolean('provides_rehearsal_access').default(false).notNull(),
	reply_to_person_id: uuid('reply_to_person_id').references(() => people.id),
	decline_policy: teamDeclinePolicyEnum('decline_policy').default('reopen_position').notNull(),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const team_members = pgTable('team_members', {
	id: uuid('id').defaultRandom().primaryKey(),

	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	team_id: uuid('team_id')
		.notNull()
		.references(() => teams.id),

	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),

	role: text('role'),
	created_at: timestamp('created_at').defaultNow()
});

export const capabilities = pgTable('capabilities', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	category: text('category'),
	created_at: timestamp('created_at').defaultNow()
});

export const person_capabilities = pgTable('person_capabilities', {
	id: uuid('id').defaultRandom().primaryKey(),

	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),

	capability_id: uuid('capability_id')
		.notNull()
		.references(() => capabilities.id),

	rating: integer('rating').default(3),
	preference: integer('preference').default(3),
	created_at: timestamp('created_at').defaultNow()
});

// --- CARE & CONNECTIONS ---

export const care_logs = pgTable('care_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),
	author_id: uuid('author_id')
		.notNull()
		.references(() => people.id),
	type: text('type').notNull(),
	content: text('content').notNull(),
	is_private: boolean('is_private').default(false),
	created_at: timestamp('created_at').defaultNow()
});

export const relationships = pgTable('relationships', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),
	related_person_id: uuid('related_person_id')
		.notNull()
		.references(() => people.id),
	type: text('type').notNull(),
	created_at: timestamp('created_at').defaultNow()
});

export const addresses = pgTable('addresses', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	family_id: uuid('family_id').references(() => families.id),
	person_id: uuid('person_id').references(() => people.id),
	team_id: uuid('team_id').references(() => teams.id),
	campus_id: uuid('campus_id').references(() => campuses.id),

	company_name: text('company_name'),
	street: text('street'),
	city: text('city'),
	state: text('state'),
	zip: text('zip'),
	country: text('country').default('US'),

	type: addressTypeEnum('type').default('home'),
	is_primary: boolean('is_primary').default(false),

	description: text('description'),
	start_date: timestamp('start_date'),
	end_date: timestamp('end_date'),

	created_at: timestamp('created_at').defaultNow()
});

// --- RELATIONS ---

export const peopleRelations = relations(people, ({ one, many }) => ({
	church: one(churches, { fields: [people.church_id], references: [churches.id] }),
	preferredCampus: one(campuses, {
		fields: [people.preferred_campus_id],
		references: [campuses.id]
	}),
	family: one(families, { fields: [people.family_id], references: [families.id] }),
	teamMemberships: many(team_members),
	capabilities: many(person_capabilities),
	relationships: many(relationships, { relationName: 'personRelationships' }),
	relatedToMe: many(relationships, { relationName: 'relatedToMe' }),
	careLogsReceived: many(care_logs, { relationName: 'careLogReceiver' }),
	careLogsAuthored: many(care_logs, { relationName: 'careLogAuthor' }),
	planAssignments: many(plan_people),
	personalAddresses: many(addresses)
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
	family: one(families, { fields: [addresses.family_id], references: [families.id] }),
	person: one(people, { fields: [addresses.person_id], references: [people.id] }),
	team: one(teams, { fields: [addresses.team_id], references: [teams.id] }),
	campus: one(campuses, { fields: [addresses.campus_id], references: [campuses.id] })
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
	church: one(churches, {
		fields: [families.church_id],
		references: [churches.id]
	}),
	members: many(people),
	addresses: many(addresses)
}));

export const teamsRelations = relations(teams, ({ many }) => ({
	members: many(team_members),
	locations: many(addresses)
}));

export const campusesRelations = relations(campuses, ({ many }) => ({
	gatherings: many(gatherings),
	physicalAddress: many(addresses)
}));

export const teamMembersRelations = relations(team_members, ({ one }) => ({
	team: one(teams, { fields: [team_members.team_id], references: [teams.id] }),
	person: one(people, { fields: [team_members.person_id], references: [people.id] })
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
	church: one(churches, { fields: [songs.church_id], references: [churches.id] }),
	authors: many(song_authors),
	// Parent (The Master Chart)
	originalSong: one(songs, {
		fields: [songs.original_song_id],
		references: [songs.id],
		relationName: 'songVariations'
	}),

	// Children (The Arrangements)
	arrangements: many(songs, {
		relationName: 'songVariations'
	})
}));

export const authorsRelations = relations(authors, ({ one }) => ({
	church: one(churches, { fields: [authors.church_id], references: [churches.id] })
}));

export const songAuthorsRelations = relations(song_authors, ({ one }) => ({
	song: one(songs, { fields: [song_authors.song_id], references: [songs.id] }),
	author: one(authors, { fields: [song_authors.author_id], references: [authors.id] })
}));

export const gatheringsRelations = relations(gatherings, ({ one, many }) => ({
	campus: one(campuses, {
		fields: [gatherings.campus_id],
		references: [campuses.id]
	}),
	plans: many(plans) // <--- ENSURE THIS LINE IS HERE
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
	gathering: one(gatherings, {
		fields: [plans.gathering_id],
		references: [gatherings.id]
	}),
	planPeople: many(plan_people),
	items: many(plan_items),
	assignments: many(plan_people),
	neededPositions: many(plan_needed_positions),
	campus: one(campuses, { fields: [plans.campus_id], references: [campuses.id] })
}));

export const planItemsRelations = relations(plan_items, ({ one }) => ({
	plan: one(plans, { fields: [plan_items.plan_id], references: [plans.id] }),
	song: one(songs, { fields: [plan_items.song_id], references: [songs.id] }),
	leader: one(people, { fields: [plan_items.leader_id], references: [people.id] })
}));

export const planNeededPositionsRelations = relations(plan_needed_positions, ({ one }) => ({
	plan: one(plans, { fields: [plan_needed_positions.plan_id], references: [plans.id] }),
	team: one(teams, { fields: [plan_needed_positions.team_id], references: [teams.id] }),
	capability: one(capabilities, {
		fields: [plan_needed_positions.capability_id],
		references: [capabilities.id]
	})
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
	person: one(people, {
		fields: [relationships.person_id],
		references: [people.id],
		relationName: 'personRelationships'
	}),
	relatedPerson: one(people, {
		fields: [relationships.related_person_id],
		references: [people.id],
		relationName: 'relatedToMe'
	})
}));

export const careLogsRelations = relations(care_logs, ({ one }) => ({
	church: one(churches, { fields: [care_logs.church_id], references: [churches.id] }),
	person: one(people, {
		fields: [care_logs.person_id],
		references: [people.id],
		relationName: 'careLogReceiver'
	}),
	author: one(people, {
		fields: [care_logs.author_id],
		references: [people.id],
		relationName: 'careLogAuthor'
	})
}));

export const personCapabilitiesRelations = relations(person_capabilities, ({ one }) => ({
	person: one(people, { fields: [person_capabilities.person_id], references: [people.id] }),
	capability: one(capabilities, {
		fields: [person_capabilities.capability_id],
		references: [capabilities.id]
	})
}));
