// ui/src/lib/server/db.ts
// Database connection pool for SvelteKit server-side operations

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
	host: process.env.PGHOST || 'localhost',
	port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
	database: process.env.PGDATABASE || 'worshipos',
	user: process.env.PGUSER || 'worship',
	password: process.env.PGPASSWORD || 'worship'
});

export { pool };

export async function query<T = unknown>(
	text: string,
	params?: unknown[]
): Promise<pg.QueryResult<T>> {
	return pool.query<T>(text, params);
}

export async function queryOne<T = unknown>(
	text: string,
	params?: unknown[]
): Promise<T | null> {
	const result = await pool.query<T>(text, params);
	return result.rows[0] ?? null;
}

export async function queryMany<T = unknown>(
	text: string,
	params?: unknown[]
): Promise<T[]> {
	const result = await pool.query<T>(text, params);
	return result.rows;
}
