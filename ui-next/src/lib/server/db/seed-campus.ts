import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { churches, campuses } from './schema';

if (!process.env.DATABASE_URL) {
	throw new Error('❌ DATABASE_URL is missing from .env');
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema: { churches, campuses } });

const main = async () => {
	console.log('🌱 Ensuring Main Campus exists...');

	try {
		// 1. Find the Church
		const church = await db.query.churches.findFirst({
			where: eq(churches.domain, 'localhost:5174')
		});

		if (!church) {
			console.error('❌ Church not found! Run seed-local.ts first.');
			return;
		}

		// 2. Check for Campus
		const existingCampus = await db.query.campuses.findFirst({
			where: eq(campuses.church_id, church.id)
		});

		if (existingCampus) {
			console.log('✅ Campus already exists:', existingCampus.name);
		} else {
			// 3. Create Campus
			await db.insert(campuses).values({
				id: uuidv4(),
				church_id: church.id,
				name: 'Main Campus',
				address: '123 Main St'
			});
			console.log('✅ Created "Main Campus"');
		}
	} catch (e) {
		console.error('❌ Campus Seed Failed:', e);
	} finally {
		await client.end();
	}
};

main();
