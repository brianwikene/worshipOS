import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

dotenv.config();
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const main = async () => {
	console.log('💥 Dropping all tables...');

	// Drop in correct order (children first)
	await db.execute(sql`DROP TABLE IF EXISTS plan_items CASCADE`);
	await db.execute(sql`DROP TABLE IF EXISTS instances CASCADE`);
	await db.execute(sql`DROP TABLE IF EXISTS gatherings CASCADE`);
	await db.execute(sql`DROP TABLE IF EXISTS campuses CASCADE`);
	await db.execute(sql`DROP TABLE IF EXISTS churches CASCADE`);

	console.log('✨ Database clean.');
	process.exit(0);
};

main();
