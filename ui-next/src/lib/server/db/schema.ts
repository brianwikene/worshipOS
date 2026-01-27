import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// ==========================================
// 0. TENANCY ( The Isolation Layer )
// ==========================================
export const churches = pgTable('churches', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull(),
	subdomain: text('subdomain').unique(), // e.g. "mountain-vineyard"

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

// ==========================================
// 1. SONGS (The Content)
// ==========================================
export const songs = pgTable('songs', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	title: text('title').notNull(),
	author: text('author'),
	ccli_number: text('ccli_number'),
	copyright_year: text('copyright_year'),
	original_key: text('original_key'),
	tempo: text('tempo'),
	time_signature: text('time_signature').default('4/4'),
	lyrics: text('lyrics'),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

// ==========================================
// 2. CONNECTIONS (People, Families, Teams)
// ==========================================

export const people = pgTable('people', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

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

	family_id: uuid('family_id'),
	user_id: uuid('user_id'),

	created_at: timestamp('created_at').defaultNow(),
	updated_at: timestamp('updated_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const families = pgTable('families', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	name: text('name').notNull(),
	address_street: text('address_street'),
	address_city: text('address_city'),
	address_state: text('address_state'),
	address_zip: text('address_zip'),

	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const relationships = pgTable('relationships', {
	id: uuid('id').defaultRandom().primaryKey(),
	// We don't strictly need church_id here if both people have it,
	// but it helps RLS policies performance.
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
	// Linked to person, so tenant is implied, but let's be safe for RLS
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

export const teams = pgTable('teams', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	name: text('name').notNull(),
	description: text('description'),
	is_secure: boolean('is_secure').default(false),
	requires_background_check: boolean('requires_background_check').default(false),

	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

export const team_members = pgTable('team_members', {
	id: uuid('id').defaultRandom().primaryKey(),
	// Derived from Team, but adding church_id makes querying "All my church's team members" faster
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
	deleted_at: timestamp('deleted_at')
});

// ==========================================
// 3. PASTORAL CONTEXT (Care & Tend)
// ==========================================

export const care_notes = pgTable('care_notes', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	person_id: uuid('person_id')
		.notNull()
		.references(() => people.id),
	author_user_id: uuid('author_user_id'),
	content: text('content').notNull(),
	category: text('category'),
	visibility: text('visibility').default('admin_only'),

	created_at: timestamp('created_at').defaultNow(),
	deleted_at: timestamp('deleted_at')
});

// ==========================================
// 4. GATHERINGS (The Moment)
// ==========================================
export const campuses = pgTable('campuses', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	name: text('name').notNull(),
	location: text('location'),
	deleted_at: timestamp('deleted_at')
});

export const gatherings = pgTable('gatherings', {
	id: uuid('id').defaultRandom().primaryKey(),
	church_id: uuid('church_id')
		.notNull()
		.references(() => churches.id), // <--- TENANT ISOLATION

	campus_id: uuid('campus_id').references(() => campuses.id),
	title: text('title').notNull(),
	date: text('date').notNull(),
	status: text('status').default('planning'),
	deleted_at: timestamp('deleted_at')
});

export const instances = pgTable('instances', {
	id: uuid('id').defaultRandom().primaryKey(),
	gathering_id: uuid('gathering_id').references(() => gatherings.id),
	name: text('name').default('Sunday Service'),
	start_time: text('start_time').notNull(),
	deleted_at: timestamp('deleted_at')
});

export const plan_items = pgTable('plan_items', {
	id: uuid('id').defaultRandom().primaryKey(),
	instance_id: uuid('instance_id').references(() => instances.id),

	type: text('type').notNull(),
	title: text('title').notNull(),
	duration: text('duration'),
	description: text('description'),
	sequence: jsonb('sequence').notNull().default(0),

	song_id: uuid('song_id').references(() => songs.id),
	person_id: uuid('person_id').references(() => people.id),

	deleted_at: timestamp('deleted_at')
});

// ==========================================
// 5. DRIZZLE RELATIONS (Updated)
// ==========================================
export const churchesRelations = relations(churches, ({ many }) => ({
	people: many(people),
	songs: many(songs),
	gatherings: many(gatherings),
	teams: many(teams)
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
	teamMemberships: many(team_members),
	relationships: many(relationships, { relationName: 'personRelationships' }),
	capabilities: many(person_capabilities),
	careNotes: many(care_notes),
	planItems: many(plan_items)
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
	church: one(churches, {
		fields: [families.church_id],
		references: [churches.id]
	}),
	members: many(people)
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
		relationName: 'relatedPerson'
	})
}));

export const personCapabilitiesRelations = relations(person_capabilities, ({ one }) => ({
	person: one(people, {
		fields: [person_capabilities.person_id],
		references: [people.id]
	})
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
	church: one(churches, {
		fields: [teams.church_id],
		references: [churches.id]
	}),
	members: many(team_members)
}));

export const teamMembersRelations = relations(team_members, ({ one }) => ({
	team: one(teams, {
		fields: [team_members.team_id],
		references: [teams.id]
	}),
	person: one(people, {
		fields: [team_members.person_id],
		references: [people.id]
	})
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
	church: one(churches, {
		fields: [songs.church_id],
		references: [churches.id]
	}),
	planItems: many(plan_items)
}));

export const gatheringsRelations = relations(gatherings, ({ one, many }) => ({
	church: one(churches, {
		fields: [gatherings.church_id],
		references: [churches.id]
	}),
	campus: one(campuses, {
		fields: [gatherings.campus_id],
		references: [campuses.id]
	}),
	instances: many(instances)
}));

export const instancesRelations = relations(instances, ({ one, many }) => ({
	gathering: one(gatherings, {
		fields: [instances.gathering_id],
		references: [gatherings.id]
	}),
	planItems: many(plan_items)
}));

export const planItemsRelations = relations(plan_items, ({ one }) => ({
	instance: one(instances, {
		fields: [plan_items.instance_id],
		references: [instances.id]
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

export const careNotesRelations = relations(care_notes, ({ one }) => ({
	person: one(people, {
		fields: [care_notes.person_id],
		references: [people.id]
	})
}));
