import 'dotenv/config'; // <--- Loads your .env file
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import * as schema from './schema';
import { campuses, churches, families, people } from './schema';

// Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
	throw new Error('❌ DATABASE_URL is missing from .env');
}

// Create a standalone connection for seeding
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

const main = async () => {
	console.log('🌱 Starting Seed...');

	try {
		// 1. Create the Church (Tenant)
		const churchId = uuidv4();
		console.log('... Creating Church: Mountain Vineyard');
		await db.insert(churches).values({
			id: churchId,
			name: 'Mountain Vineyard',
			subdomain: 'mountain'
		});

		// 2. Create the Main Campus
		const campusId = uuidv4();
		console.log('... Creating Campus: Main Campus');
		await db.insert(campuses).values({
			id: campusId,
			church_id: churchId,
			name: 'Main Campus',
			location: '1234 Vineyard Lane'
		});

		// 3. Create YOUR Family (Household)
		const familyId = uuidv4();
		console.log('... Creating Family: The Wikene Family');
		await db.insert(families).values({
			id: familyId,
			church_id: churchId,
			name: 'The Wikene Family',
			address_city: 'Lake Morton-Berrydale',
			address_state: 'WA'
		});

		// 4. Create YOU (The Admin Person)
		console.log('... Creating Person: Brian Wikene');
		await db.insert(people).values({
			church_id: churchId,
			family_id: familyId,
			first_name: 'Brian',
			last_name: 'Wikene',
			email: 'bwikene@example.com', // LOGIN EMAIL
			occupation: 'Software Engineer',
			bio: 'Building WorshipOS to help the church.',
			capacity_note: 'Available for deep work.'
		});

		console.log('✅ Seed Complete!');
	} catch (e) {
		console.error('❌ Seed Failed:', e);
	} finally {
		// Close the connection so the script exits
		await client.end();
	}
};

main();
