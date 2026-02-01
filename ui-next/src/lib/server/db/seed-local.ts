import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { churches, people } from './schema';

if (!process.env.DATABASE_URL) {
	throw new Error('❌ DATABASE_URL is missing from .env');
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const main = async () => {
	console.log('🌱 Seeding Localhost Church...');

	try {
		const churchId = uuidv4();
		await db.insert(churches).values({
			id: churchId,
			name: 'WorshipNext Church',
			domain: 'localhost:5174', // Matches your dev server
			subdomain: 'worshipnext'
		});

		// Create an Admin User so you can see the dashboard
		await db.insert(people).values({
			church_id: churchId,
			first_name: 'Local',
			last_name: 'Admin',
			email: 'admin@localhost',
			role: 'admin'
		});

		console.log('✅ Created "WorshipNext Church" for localhost:5174');
	} catch (e) {
		console.error('❌ Seed Failed:', e);
	} finally {
		await client.end();
	}
};

main();
