import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
	throw new Error('❌ DATABASE_URL is missing from .env');
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

// Helper to create dates relative to today
const daysFromNow = (days: number) => {
	const date = new Date();
	date.setDate(date.getDate() + days);
	date.setHours(9, 0, 0, 0); // 9 AM
	return date;
};

const main = async () => {
	console.log('🌱 Starting Comprehensive Seed...\n');

	try {
		// =====================================================
		// 1. GET EXISTING CHURCH (or create if missing)
		// =====================================================
		console.log('📍 Looking for existing "dev" church...');
		let church = await db.query.churches.findFirst({
			where: eq(schema.churches.subdomain, 'dev')
		});

		if (!church) {
			console.log('   Creating "WorshipOS Dev" church...');
			const [newChurch] = await db
				.insert(schema.churches)
				.values({
					name: 'WorshipOS Dev',
					subdomain: 'dev',
					timezone: 'America/Los_Angeles'
				})
				.returning();
			church = newChurch;
		}
		console.log(`   ✓ Church: ${church.name} (${church.id})\n`);

		const churchId = church.id;

		// =====================================================
		// 2. CAMPUSES
		// =====================================================
		console.log('🏛️  Creating Campuses...');
		const campusIds = {
			main: uuidv4(),
			north: uuidv4(),
			online: uuidv4()
		};

		await db.insert(schema.campuses).values([
			{
				id: campusIds.main,
				church_id: churchId,
				name: 'Main Campus',
				address: '1234 Worship Way, Seattle, WA 98101',
				timezone: 'America/Los_Angeles'
			},
			{
				id: campusIds.north,
				church_id: churchId,
				name: 'North Campus',
				address: '5678 Grace Ave, Lynnwood, WA 98036',
				timezone: 'America/Los_Angeles'
			},
			{
				id: campusIds.online,
				church_id: churchId,
				name: 'Online Campus',
				address: 'https://live.worshipos.dev',
				timezone: 'America/Los_Angeles'
			}
		]);
		console.log('   ✓ 3 campuses created\n');

		// =====================================================
		// 3. FAMILIES
		// =====================================================
		console.log('👨‍👩‍👧‍👦 Creating Families...');
		const familyIds = {
			wikene: uuidv4(),
			johnson: uuidv4(),
			chen: uuidv4(),
			martinez: uuidv4(),
			oconnor: uuidv4()
		};

		await db.insert(schema.families).values([
			{ id: familyIds.wikene, church_id: churchId, name: 'The Wikene Family' },
			{ id: familyIds.johnson, church_id: churchId, name: 'The Johnson Family' },
			{ id: familyIds.chen, church_id: churchId, name: 'The Chen Family' },
			{ id: familyIds.martinez, church_id: churchId, name: 'The Martinez Family' },
			{ id: familyIds.oconnor, church_id: churchId, name: "The O'Connor Family" }
		]);
		console.log('   ✓ 5 families created\n');

		// =====================================================
		// 4. PEOPLE
		// =====================================================
		console.log('👥 Creating People...');
		const personIds = {
			brian: uuidv4(),
			sarah: uuidv4(),
			mike: uuidv4(),
			emily: uuidv4(),
			david: uuidv4(),
			lisa: uuidv4(),
			james: uuidv4(),
			maria: uuidv4(),
			kevin: uuidv4(),
			rachel: uuidv4()
		};

		await db.insert(schema.people).values([
			// Admin
			{
				id: personIds.brian,
				church_id: churchId,
				family_id: familyIds.wikene,
				preferred_campus_id: campusIds.main,
				first_name: 'Brian',
				last_name: 'Wikene',
				email: 'brian@worshipos.dev',
				phone: '206-555-0100',
				role: 'admin',
				occupation: 'Software Engineer',
				bio: 'Building WorshipOS to serve the church.',
				capacity_note: 'Available most Sundays',
				household_role: 'Head',
				is_household_primary: true
			},
			// Worship Leader (coordinator role)
			{
				id: personIds.sarah,
				church_id: churchId,
				family_id: familyIds.johnson,
				preferred_campus_id: campusIds.main,
				first_name: 'Sarah',
				last_name: 'Johnson',
				email: 'sarah.johnson@example.com',
				phone: '206-555-0101',
				role: 'coordinator',
				occupation: 'Music Teacher',
				bio: 'Leading worship for 10 years. Loves acoustic arrangements.',
				capacity_note: 'Cannot serve first Sunday of month',
				household_role: 'Head',
				is_household_primary: true
			},
			// Pastor (staff role)
			{
				id: personIds.mike,
				church_id: churchId,
				family_id: familyIds.chen,
				preferred_campus_id: campusIds.main,
				first_name: 'Mike',
				last_name: 'Chen',
				email: 'mike.chen@example.com',
				phone: '206-555-0102',
				role: 'staff',
				occupation: 'Senior Pastor',
				bio: 'Shepherding this community for 15 years.',
				household_role: 'Head',
				is_household_primary: true
			},
			// Volunteers
			{
				id: personIds.emily,
				church_id: churchId,
				family_id: familyIds.martinez,
				preferred_campus_id: campusIds.main,
				first_name: 'Emily',
				last_name: 'Martinez',
				email: 'emily.m@example.com',
				phone: '206-555-0103',
				role: 'volunteer',
				occupation: 'Graphic Designer',
				bio: 'Plays keys and sings backup.',
				capacity_note: 'Available every other week'
			},
			{
				id: personIds.david,
				church_id: churchId,
				family_id: familyIds.oconnor,
				preferred_campus_id: campusIds.north,
				first_name: 'David',
				last_name: "O'Connor",
				email: 'david.oc@example.com',
				phone: '206-555-0104',
				role: 'volunteer',
				occupation: 'Audio Engineer',
				bio: 'Professional sound guy. Runs FOH.'
			},
			{
				id: personIds.lisa,
				church_id: churchId,
				preferred_campus_id: campusIds.main,
				first_name: 'Lisa',
				last_name: 'Park',
				email: 'lisa.park@example.com',
				phone: '206-555-0105',
				role: 'volunteer',
				occupation: 'Nurse',
				bio: 'Plays drums and percussion.'
			},
			{
				id: personIds.james,
				church_id: churchId,
				preferred_campus_id: campusIds.main,
				first_name: 'James',
				last_name: 'Wilson',
				email: 'james.w@example.com',
				phone: '206-555-0106',
				role: 'volunteer',
				occupation: 'Software Developer',
				bio: 'Bass player and occasional acoustic.'
			},
			{
				id: personIds.maria,
				church_id: churchId,
				family_id: familyIds.martinez,
				preferred_campus_id: campusIds.main,
				first_name: 'Maria',
				last_name: 'Martinez',
				email: 'maria.m@example.com',
				phone: '206-555-0107',
				role: 'volunteer',
				bio: 'Vocalist with a heart for worship.',
				household_role: 'Spouse'
			},
			{
				id: personIds.kevin,
				church_id: churchId,
				preferred_campus_id: campusIds.north,
				first_name: 'Kevin',
				last_name: 'Brown',
				email: 'kevin.b@example.com',
				phone: '206-555-0108',
				role: 'coordinator',
				occupation: 'Youth Pastor',
				bio: 'Leads worship at North Campus.'
			},
			{
				id: personIds.rachel,
				church_id: churchId,
				preferred_campus_id: campusIds.online,
				first_name: 'Rachel',
				last_name: 'Kim',
				email: 'rachel.k@example.com',
				phone: '206-555-0109',
				role: 'volunteer',
				occupation: 'Video Producer',
				bio: 'Runs the online campus stream.'
			}
		]);
		console.log('   ✓ 10 people created\n');

		// =====================================================
		// 5. TEAMS
		// =====================================================
		console.log('🎸 Creating Teams...');
		const teamIds = {
			worship: uuidv4(),
			production: uuidv4(),
			vocals: uuidv4(),
			band: uuidv4(),
			prayer: uuidv4()
		};

		await db.insert(schema.teams).values([
			{
				id: teamIds.worship,
				church_id: churchId,
				name: 'Worship Team',
				type: 'ministry',
				description: 'Musicians and vocalists who lead Sunday worship',
				reply_to_person_id: personIds.sarah
			},
			{
				id: teamIds.production,
				church_id: churchId,
				name: 'Production Team',
				type: 'ministry',
				description: 'Sound, lights, and video production'
			},
			{
				id: teamIds.vocals,
				church_id: churchId,
				name: 'Vocal Team',
				type: 'ministry',
				description: 'Backup vocalists and choir'
			},
			{
				id: teamIds.band,
				church_id: churchId,
				name: 'Band',
				type: 'ministry',
				description: 'Instrumentalists'
			},
			{
				id: teamIds.prayer,
				church_id: churchId,
				name: 'Prayer Team',
				type: 'ministry',
				description: 'Intercessory prayer during services'
			}
		]);
		console.log('   ✓ 5 teams created\n');

		// =====================================================
		// 6. TEAM MEMBERS
		// =====================================================
		console.log('🤝 Assigning Team Members...');
		await db.insert(schema.team_members).values([
			// Worship Team
			{ team_id: teamIds.worship, person_id: personIds.sarah, role: 'Worship Leader' },
			{ team_id: teamIds.worship, person_id: personIds.kevin, role: 'Worship Leader' },
			// Band
			{ team_id: teamIds.band, person_id: personIds.emily, role: 'Keys' },
			{ team_id: teamIds.band, person_id: personIds.lisa, role: 'Drums' },
			{ team_id: teamIds.band, person_id: personIds.james, role: 'Bass' },
			// Vocals
			{ team_id: teamIds.vocals, person_id: personIds.maria, role: 'Soprano' },
			{ team_id: teamIds.vocals, person_id: personIds.sarah, role: 'Alto' },
			// Production
			{ team_id: teamIds.production, person_id: personIds.david, role: 'Sound Engineer' },
			{ team_id: teamIds.production, person_id: personIds.rachel, role: 'Video Director' }
		]);
		console.log('   ✓ 9 team memberships created\n');

		// =====================================================
		// 7. CAPABILITIES
		// =====================================================
		console.log('🎯 Creating Capabilities...');
		const capabilityIds = {
			vocals: uuidv4(),
			acousticGuitar: uuidv4(),
			electricGuitar: uuidv4(),
			bass: uuidv4(),
			keys: uuidv4(),
			drums: uuidv4(),
			percussion: uuidv4(),
			soundEngineering: uuidv4(),
			videoProduction: uuidv4()
		};

		await db.insert(schema.capabilities).values([
			{ id: capabilityIds.vocals, church_id: churchId, name: 'Vocals', category: 'Music' },
			{
				id: capabilityIds.acousticGuitar,
				church_id: churchId,
				name: 'Acoustic Guitar',
				category: 'Music'
			},
			{
				id: capabilityIds.electricGuitar,
				church_id: churchId,
				name: 'Electric Guitar',
				category: 'Music'
			},
			{ id: capabilityIds.bass, church_id: churchId, name: 'Bass', category: 'Music' },
			{ id: capabilityIds.keys, church_id: churchId, name: 'Keys', category: 'Music' },
			{ id: capabilityIds.drums, church_id: churchId, name: 'Drums', category: 'Music' },
			{ id: capabilityIds.percussion, church_id: churchId, name: 'Percussion', category: 'Music' },
			{
				id: capabilityIds.soundEngineering,
				church_id: churchId,
				name: 'Sound Engineering',
				category: 'Production'
			},
			{
				id: capabilityIds.videoProduction,
				church_id: churchId,
				name: 'Video Production',
				category: 'Production'
			}
		]);
		console.log('   ✓ 9 capabilities created\n');

		// =====================================================
		// 8. PERSON CAPABILITIES
		// =====================================================
		console.log('🎯 Assigning Person Capabilities...');
		await db.insert(schema.person_capabilities).values([
			{ person_id: personIds.sarah, capability_id: capabilityIds.vocals, rating: 5, preference: 5 },
			{
				person_id: personIds.sarah,
				capability_id: capabilityIds.acousticGuitar,
				rating: 4,
				preference: 3
			},
			{ person_id: personIds.emily, capability_id: capabilityIds.keys, rating: 5, preference: 5 },
			{ person_id: personIds.emily, capability_id: capabilityIds.vocals, rating: 3, preference: 2 },
			{ person_id: personIds.lisa, capability_id: capabilityIds.drums, rating: 5, preference: 5 },
			{
				person_id: personIds.lisa,
				capability_id: capabilityIds.percussion,
				rating: 4,
				preference: 4
			},
			{ person_id: personIds.james, capability_id: capabilityIds.bass, rating: 4, preference: 5 },
			{
				person_id: personIds.james,
				capability_id: capabilityIds.acousticGuitar,
				rating: 3,
				preference: 2
			},
			{
				person_id: personIds.david,
				capability_id: capabilityIds.soundEngineering,
				rating: 5,
				preference: 5
			},
			{
				person_id: personIds.rachel,
				capability_id: capabilityIds.videoProduction,
				rating: 5,
				preference: 5
			},
			{ person_id: personIds.maria, capability_id: capabilityIds.vocals, rating: 4, preference: 5 },
			{ person_id: personIds.kevin, capability_id: capabilityIds.vocals, rating: 4, preference: 4 },
			{
				person_id: personIds.kevin,
				capability_id: capabilityIds.acousticGuitar,
				rating: 4,
				preference: 4
			}
		]);
		console.log('   ✓ 13 person capabilities created\n');

		// =====================================================
		// 9. AUTHORS & SONGS
		// =====================================================
		console.log('🎵 Creating Authors and Songs...');
		const authorIds = {
			hillsong: uuidv4(),
			elevation: uuidv4(),
			bethel: uuidv4(),
			maverick: uuidv4(),
			traditional: uuidv4()
		};

		await db.insert(schema.authors).values([
			{ id: authorIds.hillsong, church_id: churchId, name: 'Hillsong Worship' },
			{ id: authorIds.elevation, church_id: churchId, name: 'Elevation Worship' },
			{ id: authorIds.bethel, church_id: churchId, name: 'Bethel Music' },
			{ id: authorIds.maverick, church_id: churchId, name: 'Maverick City Music' },
			{ id: authorIds.traditional, church_id: churchId, name: 'Traditional' }
		]);

		const songIds = {
			wayMaker: uuidv4(),
			oceans: uuidv4(),
			blessings: uuidv4(),
			goodness: uuidv4(),
			raiseAHallelujah: uuidv4(),
			amazing: uuidv4(),
			holySpirit: uuidv4(),
			greatAreYou: uuidv4()
		};

		await db.insert(schema.songs).values([
			{
				id: songIds.wayMaker,
				church_id: churchId,
				title: 'Way Maker',
				original_key: 'E',
				tempo: '68 BPM',
				bpm: 68,
				time_signature: '4/4',
				ccli_number: '7115744',
				performance_notes: 'Build gradually. Electric guitar swell on bridge.',
				content: 'Verse 1:\nYou are here, moving in our midst...'
			},
			{
				id: songIds.oceans,
				church_id: churchId,
				title: 'Oceans (Where Feet May Fail)',
				original_key: 'D',
				tempo: '66 BPM',
				bpm: 66,
				time_signature: '4/4',
				ccli_number: '6428767',
				performance_notes: 'Start with keys only. Build to full band on final chorus.',
				content: 'Verse 1:\nYou call me out upon the waters...'
			},
			{
				id: songIds.blessings,
				church_id: churchId,
				title: 'The Blessing',
				original_key: 'Bb',
				tempo: '72 BPM',
				bpm: 72,
				time_signature: '4/4',
				ccli_number: '7147007',
				performance_notes: 'Congregational song. Keep it simple.',
				content: 'Verse:\nThe Lord bless you and keep you...'
			},
			{
				id: songIds.goodness,
				church_id: churchId,
				title: 'Goodness of God',
				original_key: 'C',
				tempo: '63 BPM',
				bpm: 63,
				time_signature: '4/4',
				ccli_number: '7117726',
				performance_notes: 'Great closer. Let it breathe.'
			},
			{
				id: songIds.raiseAHallelujah,
				church_id: churchId,
				title: 'Raise a Hallelujah',
				original_key: 'A',
				tempo: '74 BPM',
				bpm: 74,
				time_signature: '4/4',
				ccli_number: '7119315',
				performance_notes: 'High energy opener.'
			},
			{
				id: songIds.amazing,
				church_id: churchId,
				title: 'Amazing Grace (My Chains Are Gone)',
				original_key: 'G',
				tempo: '60 BPM',
				bpm: 60,
				time_signature: '4/4',
				ccli_number: '4768151',
				performance_notes: 'Classic arrangement. Acoustic led.'
			},
			{
				id: songIds.holySpirit,
				church_id: churchId,
				title: 'Holy Spirit',
				original_key: 'D',
				tempo: '73 BPM',
				bpm: 73,
				time_signature: '4/4',
				ccli_number: '6087919',
				performance_notes: 'Intimate moment. Soft dynamics.'
			},
			{
				id: songIds.greatAreYou,
				church_id: churchId,
				title: 'Great Are You Lord',
				original_key: 'G',
				tempo: '80 BPM',
				bpm: 80,
				time_signature: '6/8',
				ccli_number: '6460220',
				performance_notes: 'Good for response time.'
			}
		]);

		// Link songs to authors with sequence
		await db.insert(schema.song_authors).values([
			{ song_id: songIds.wayMaker, author_id: authorIds.maverick, sequence: 0 },
			{ song_id: songIds.oceans, author_id: authorIds.hillsong, sequence: 0 },
			{ song_id: songIds.blessings, author_id: authorIds.elevation, sequence: 0 },
			{ song_id: songIds.goodness, author_id: authorIds.bethel, sequence: 0 },
			{ song_id: songIds.raiseAHallelujah, author_id: authorIds.bethel, sequence: 0 },
			{ song_id: songIds.amazing, author_id: authorIds.traditional, sequence: 0 },
			{ song_id: songIds.holySpirit, author_id: authorIds.hillsong, sequence: 0 },
			{ song_id: songIds.greatAreYou, author_id: authorIds.bethel, sequence: 0 }
		]);
		console.log('   ✓ 5 authors and 8 songs created\n');

		// =====================================================
		// 10. PLANS (formerly Gatherings)
		// =====================================================
		console.log('🗓️  Creating Plans...');

		const planIds: string[] = [];

		// Create plans for the next 4 Sundays
		for (let week = 0; week < 4; week++) {
			// Calculate next Sunday + weeks
			const today = new Date();
			const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
			const planDate = new Date(today);
			planDate.setDate(today.getDate() + daysUntilSunday + week * 7);
			planDate.setHours(9, 0, 0, 0);

			// Create two plans per Sunday (9am and 11am)
			for (const hour of [9, 11]) {
				const planId = uuidv4();
				planIds.push(planId);

				const serviceDate = new Date(planDate);
				serviceDate.setHours(hour, 0, 0, 0);

				await db.insert(schema.plans).values({
					id: planId,
					church_id: churchId,
					campus_id: campusIds.main,
					name: `${hour === 9 ? '9am' : '11am'} Service - Week ${week + 1}`,
					date: serviceDate,
					status: week === 0 ? 'locked' : 'draft'
				});
			}
		}
		console.log('   ✓ 8 plans created\n');

		// =====================================================
		// 11. PLAN ITEMS (for first plan)
		// =====================================================
		console.log('📋 Creating Plan Items...');
		const firstPlanId = planIds[0];

		await db.insert(schema.plan_items).values([
			{
				plan_id: firstPlanId,
				title: 'Way Maker',
				segment: 'pre',
				duration: 360, // 6 minutes in seconds
				order: 0,
				song_id: songIds.wayMaker,
				is_audible: true
			},
			{
				plan_id: firstPlanId,
				title: 'Welcome & Announcements',
				description: 'Pastor Mike welcomes congregation',
				segment: 'core',
				duration: 300, // 5 minutes
				order: 0,
				is_audible: false
			},
			{
				plan_id: firstPlanId,
				title: 'Raise a Hallelujah',
				segment: 'core',
				duration: 330, // 5:30
				order: 1,
				song_id: songIds.raiseAHallelujah,
				is_audible: true
			},
			{
				plan_id: firstPlanId,
				title: 'Goodness of God',
				segment: 'core',
				duration: 360, // 6 minutes
				order: 2,
				song_id: songIds.goodness,
				is_audible: true
			},
			{
				plan_id: firstPlanId,
				title: 'Prayer',
				segment: 'core',
				duration: 180, // 3 minutes
				order: 3,
				is_audible: false
			},
			{
				plan_id: firstPlanId,
				title: 'Message: Created to Worship',
				description: 'Week 1 of The Heart of Worship series',
				segment: 'core',
				duration: 2100, // 35 minutes
				order: 4,
				is_audible: false
			},
			{
				plan_id: firstPlanId,
				title: 'The Blessing',
				segment: 'core',
				duration: 300, // 5 minutes
				order: 5,
				song_id: songIds.blessings,
				is_audible: true
			},
			{
				plan_id: firstPlanId,
				title: 'Benediction',
				segment: 'post',
				duration: 120, // 2 minutes
				order: 0,
				is_audible: false
			}
		]);
		console.log('   ✓ 8 plan items created\n');

		// =====================================================
		// 12. PLAN PEOPLE (assignments)
		// =====================================================
		console.log('👤 Assigning People to Plans...');
		await db.insert(schema.plan_people).values([
			{
				plan_id: firstPlanId,
				person_id: personIds.sarah,
				role_name: 'Worship Leader',
				status: 'confirmed'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.emily,
				role_name: 'Keys',
				status: 'confirmed'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.lisa,
				role_name: 'Drums',
				status: 'pending'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.james,
				role_name: 'Bass',
				status: 'confirmed'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.maria,
				role_name: 'Vocals',
				status: 'confirmed'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.david,
				role_name: 'Sound',
				status: 'confirmed'
			},
			{
				plan_id: firstPlanId,
				person_id: personIds.mike,
				role_name: 'Speaker',
				status: 'confirmed'
			}
		]);
		console.log('   ✓ 7 plan assignments created\n');

		// =====================================================
		// 13. CARE LOGS
		// =====================================================
		console.log('💝 Creating Care Logs...');
		await db.insert(schema.care_logs).values([
			{
				church_id: churchId,
				person_id: personIds.emily,
				author_id: personIds.brian,
				type: 'Check-in',
				content: 'Had coffee with Emily. She mentioned feeling overwhelmed with work lately.',
				is_private: true
			},
			{
				church_id: churchId,
				person_id: personIds.james,
				author_id: personIds.mike,
				type: 'Prayer',
				content:
					'Prayed with James about his job transition. He is interviewing at several companies.',
				is_private: false
			},
			{
				church_id: churchId,
				person_id: personIds.maria,
				author_id: personIds.sarah,
				type: 'Encouragement',
				content:
					'Maria did an amazing job leading the bridge on Sunday. Sent her a thank you note.',
				is_private: false
			}
		]);
		console.log('   ✓ 3 care logs created\n');

		// =====================================================
		// 14. RELATIONSHIPS
		// =====================================================
		console.log('👪 Creating Relationships...');
		await db.insert(schema.relationships).values([
			{
				church_id: churchId,
				person_id: personIds.emily,
				related_person_id: personIds.maria,
				type: 'spouse'
			},
			{
				church_id: churchId,
				person_id: personIds.maria,
				related_person_id: personIds.emily,
				type: 'spouse'
			}
		]);
		console.log('   ✓ 2 relationships created\n');

		// =====================================================
		// DONE!
		// =====================================================
		console.log('═══════════════════════════════════════════════════');
		console.log('✅ SEED COMPLETE!');
		console.log('═══════════════════════════════════════════════════');
		console.log(`\n🌐 Access your app at: http://dev.localhost:5174\n`);
		console.log('📊 Summary:');
		console.log('   • 1 Church (WorshipOS Dev)');
		console.log('   • 3 Campuses');
		console.log('   • 5 Families');
		console.log('   • 10 People (1 admin, 1 pastor, 2 coordinators, 6 volunteers)');
		console.log('   • 5 Teams with 9 memberships');
		console.log('   • 9 Capabilities with 13 person assignments');
		console.log('   • 8 Songs with 5 authors');
		console.log('   • 8 Plans (4 weeks of services)');
		console.log('   • Care logs and relationships\n');
	} catch (e) {
		console.error('❌ Seed Failed:', e);
		throw e;
	} finally {
		await client.end();
	}
};

main();
