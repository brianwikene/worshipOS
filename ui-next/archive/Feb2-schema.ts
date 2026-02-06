import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';

// --- ENUMS ---
export const teamTypeEnum = pgEnum('team_type', [
	'ministry',
	'small_group',
	'kinship',
	'outreach',
	'demographic'
]);

export const roleEnum = pgEnum('user_role', ['user', 'volunteer', 'leader', 'pastor', 'admin']);

export const planPersonStatusEnum = pgEnum('plan_person_status', [
	'pending',
	'confirmed',
	'declined'
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

// --- 1. CORE ENTITIES (No Dependencies) ---
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

export const authors = pgTable('authors', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull()
});

// --- 2. PARENT ENTITIES ---
export const families = pgTable('families', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	address_street: text('address_street'),
	address_city: text('address_city'),
	address_state: text('address_state'),
	address_zip: text('address_zip'),
	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const teams = pgTable('teams', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(),
	type: text('type').default('ministry').notNull(),
	description: text('description'),
	created_at: timestamp('created_at').defaultNow()
});

export const campuses = pgTable(
	'campuses',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		church_id: uuid('church_id')
			.notNull()
			.references(() => churches.id),
		name: text('name').notNull(),
		location: text('location'),
		timezone: text('timezone').default('America/Los_Angeles').notNull(),
		created_at: timestamp('created_at').defaultNow(),
		deleted_at: timestamp('deleted_at')
	},
	(t) => [
		index('campuses_church_idx').on(t.church_id),
		index('campuses_church_deleted_idx').on(t.church_id, t.deleted_at)
	]
);

export const songs = pgTable('songs', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	title: text('title').notNull(),
	original_key: text('original_key'),
	tempo: text('tempo'),
	time_signature: text('time_signature').default('4/4'),
	ccli_number: text('ccli_number'),
	performance_notes: text('performance_notes'),
	content: text('content'),
	lyrics: text('lyrics'),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow()
});

// --- 3. DEPENDENT ENTITIES ---
export const people = pgTable('people', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),

	first_name: text('first_name').notNull(),
	last_name: text('last_name').notNull(),
	preferred_name: text('preferred_name'),
	gender: text('gender'),
	email: text('email'),
	phone: text('phone'),
	avatar_url: text('avatar_url'),

	occupation: text('occupation'),
	bio: text('bio'),
	capacity_note: text('capacity_note'),

	household_role: text('household_role'),
	is_household_primary: boolean('is_household_primary').default(false),
	family_id: uuid('family_id').references(() => families.id),

	user_id: uuid('user_id'),
	role: text('role').default('user').notNull(),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const arrangements = pgTable('arrangements', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	song_id: uuid('song_id')
		.notNull()
		.references(() => songs.id),
	name: text('name').notNull(),
	key: text('key'),
	bpm: text('bpm'),
	content: text('content'),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow()
});

export const song_authors = pgTable('song_authors', {
	id: uuid('id').defaultRandom().primaryKey(),
	song_id: uuid('song_id')
		.notNull()
		.references(() => songs.id),
	author_id: uuid('author_id')
		.notNull()
		.references(() => authors.id),
	sequence: integer('sequence').default(0)
});

// --- PLANNING & EVENTS ---

export const gathering_types = pgTable('gathering_types', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	name: text('name').notNull(), // e.g. "Sunday Morning", "Special Event"
	description: text('description'),
	deleted_at: timestamp('deleted_at')
});

export const series = pgTable('series', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	title: text('title').notNull(), // e.g. "The Book of Mark"
	description: text('description'),
	start_date: timestamp('start_date'),
	end_date: timestamp('end_date'),
	artwork_url: text('artwork_url'),
	created_at: timestamp('created_at').defaultNow()
});

export const templates = pgTable('templates', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	gathering_type_id: uuid('gathering_type_id').references(() => gathering_types.id),
	name: text('name').notNull(), // e.g. "9&11 Standard", "Communion Partial"
	description: text('description'),
	data: text('data'), // JSON blob of the item structure (songs, headers, etc)
	is_partial: boolean('is_partial').default(false) // TRUE = "Baptism Segment", FALSE = "Full Gathering"
});

export const template_items = pgTable(
	'template_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		// Link to the parent table
		template_id: uuid('template_id')
			.notNull()
			.references(() => templates.id),

		type: text('type').notNull(),
		title: text('title').notNull(),
		segment: text('segment').notNull().default('core'),

		duration: text('duration'),
		duration_seconds: integer('duration_seconds').notNull().default(0),
		description: text('description'),

		sequence: integer('sequence').notNull().default(0),

		song_id: uuid('song_id').references(() => songs.id),
		person_id: uuid('person_id').references(() => people.id),
		deleted_at: timestamp('deleted_at')
	},
	// Add the index for speed
	(t) => [index('template_items_idx').on(t.template_id, t.segment, t.sequence)]
);

export const gatherings = pgTable('gatherings', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	campus_id: uuid('campus_id').references(() => campuses.id),
	title: text('title').notNull(),

	// THE BUCKET: The calendar date (anchored to UTC midnight of the campus)
	date: timestamp('date', { withTimezone: true }).notNull(),
	created_at: timestamp('created_at').defaultNow()
});

// --- 4. DEEP DEPENDENCIES ---
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
	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const person_capabilities = pgTable('person_capabilities', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),
	capability: text('capability').notNull(),
	rating: integer('rating').default(3),
	notes: text('notes'),
	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const needs = pgTable('needs', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	person_id: uuid('person_id').references(() => people.id),
	type: text('type').notNull(),
	status: text('status').default('open'),
	description: text('description'),
	is_confidential: boolean('is_confidential').default(true),
	created_at: timestamp('created_at').defaultNow()
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
	status: text('status').default('active'),
	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const plans = pgTable(
	'plans',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		church_id: uuid('church_id')
			.notNull()
			.references(() => churches.id),
		series_id: uuid('series_id').references(() => series.id),
		gathering_id: uuid('gathering_id')
			.notNull()
			.references(() => gatherings.id),

		title: text('title'),

		// OPTIONAL: Only needed if this specific plan is at a different location
		campus_id: uuid('campus_id').references(() => campuses.id),
		starts_at: timestamp('starts_at', { withTimezone: true }).notNull(),

		created_at: timestamp('created_at').defaultNow(),
		deleted_at: timestamp('deleted_at')
	},
	(t) => [
		index('plans_gathering_idx').on(t.gathering_id),
		index('plans_campus_starts_idx').on(t.campus_id, t.starts_at),
		index('plans_church_starts_idx').on(t.church_id, t.starts_at)
	]
);

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
	team_id: uuid('team_id').references(() => teams.id),
	role: text('role'),
	status: planPersonStatusEnum('status').default('pending'),
	created_at: timestamp('created_at').defaultNow()
});

export const plan_items = pgTable(
	'plan_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		plan_id: uuid('plan_id')
			.notNull()
			.references(() => plans.id),
		type: text('type').notNull(),
		title: text('title').notNull(),
		segment: text('segment').notNull().default('core'),
		duration: text('duration'),
		duration_seconds: integer('duration_seconds').notNull().default(0),
		description: text('description'),
		sequence: integer('sequence').notNull().default(0),
		song_id: uuid('song_id').references(() => songs.id),
		person_id: uuid('person_id').references(() => people.id),
		deleted_at: timestamp('deleted_at')
	},
	(t) => [index('plan_items_plan_segment_sequence_idx').on(t.plan_id, t.segment, t.sequence)]
);

export const prayer_requests = pgTable('prayer_requests', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id),
	person_id: uuid('person_id').references(() => people.id),
	content: text('content').notNull(),
	is_private: boolean('is_private').default(false),
	status: text('status').default('open'),
	created_at: timestamp('created_at').defaultNow()
});

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
	date: timestamp('date').defaultNow(),
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

// --- RELATIONS (Must be defined AFTER all tables) ---

export const churchesRelations = relations(churches, ({ many }) => ({
	people: many(people),
	songs: many(songs),
	gatherings: many(gatherings),
	teams: many(teams),
	needs: many(needs)
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

export const peopleRelations = relations(people, ({ one, many }) => ({
	church: one(churches, {
		fields: [people.church_id],
		references: [churches.id]
	}),
	family: one(families, {
		fields: [people.family_id],
		references: [families.id]
	}),
	teamMemberships: many(team_members, { relationName: 'person_to_memberships' }),
	relationships: many(relationships, { relationName: 'personRelationships' }),
	capabilities: many(person_capabilities),
	careLogsReceived: many(care_logs, { relationName: 'careLogReceiver' }),
	careLogsAuthored: many(care_logs, { relationName: 'careLogAuthor' }),
	prayerRequests: many(prayer_requests),
	needs: many(needs),
	planItems: many(plan_items),
	personalAddresses: many(addresses)
}));

// ... (skipping unchanged relations)
export const team_membersRelations = relations(team_members, ({ one }) => ({
	person: one(people, {
		fields: [team_members.person_id],
		references: [people.id]
	}),
	team: one(teams, {
		fields: [team_members.team_id],
		references: [teams.id]
	})
}));

export const teamsRelations = relations(teams, ({ many }) => ({
	members: many(team_members),
	locations: many(addresses)
}));

export const campusesRelations = relations(campuses, ({ many }) => ({
	gatherings: many(gatherings),
	physicalAddress: many(addresses)
}));

export const gatheringsRelations = relations(gatherings, ({ one, many }) => ({
	campus: one(campuses, {
		fields: [gatherings.campus_id],
		references: [campuses.id]
	}),
	plans: many(plans)
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
	gathering: one(gatherings, {
		fields: [plans.gathering_id],
		references: [gatherings.id]
	}),
	people: many(plan_people),
	items: many(plan_items)
}));

export const planPeopleRelations = relations(plan_people, ({ one }) => ({
	plan: one(plans, {
		fields: [plan_people.plan_id],
		references: [plans.id]
	}),
	person: one(people, {
		fields: [plan_people.person_id],
		references: [people.id]
	}),
	team: one(teams, {
		fields: [plan_people.team_id],
		references: [teams.id]
	})
}));

export const planItemsRelations = relations(plan_items, ({ one }) => ({
	plan: one(plans, {
		fields: [plan_items.plan_id],
		references: [plans.id]
	}),
	song: one(songs, {
		fields: [plan_items.song_id],
		references: [songs.id]
	}),
	person: one(people, {
		fields: [plan_items.person_id],
		references: [people.id]
	})
}));

export const songsRelations = relations(songs, ({ many }) => ({
	arrangements: many(arrangements),
	authors: many(song_authors)
}));

export const arrangementsRelations = relations(arrangements, ({ one }) => ({
	song: one(songs, {
		fields: [arrangements.song_id],
		references: [songs.id]
	}),
	church: one(churches, {
		fields: [arrangements.church_id],
		references: [churches.id]
	})
}));

export const authorsRelations = relations(authors, ({ many }) => ({
	songs: many(song_authors)
}));

export const songAuthorsRelations = relations(song_authors, ({ one }) => ({
	song: one(songs, { fields: [song_authors.song_id], references: [songs.id] }),
	author: one(authors, { fields: [song_authors.author_id], references: [authors.id] })
}));

export const careLogsRelations = relations(care_logs, ({ one }) => ({
	church: one(churches, {
		fields: [care_logs.church_id],
		references: [churches.id]
	}),
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

export const prayerRequestsRelations = relations(prayer_requests, ({ one }) => ({
	person: one(people, {
		fields: [prayer_requests.person_id],
		references: [people.id]
	})
}));
