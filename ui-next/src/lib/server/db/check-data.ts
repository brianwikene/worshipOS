import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { campuses, churches } from './schema';
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) throw new Error('No DB URL');

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema: { campuses, churches } });

const main = async () => {
	const allChurches = await db.query.churches.findMany();
	console.log('Churches:', allChurches);

	const allCampuses = await db.query.campuses.findMany();
	console.log('Campuses:', allCampuses);

	await client.end();
};

main();
