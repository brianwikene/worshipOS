// src/routes/api/addresses/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Get all addresses for the church (optionally filtered by person_id or family)
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const personId = event.url.searchParams.get('person_id');
  const familyId = event.url.searchParams.get('family_id');

  let query = `
    SELECT a.id, a.person_id, a.line1, a.line2, a.city, a.state, a.region,
           a.postal_code, a.country, a.label, a.lat, a.lng, a.timezone,
           a.street, a.created_at
    FROM addresses a
    WHERE a.church_id = $1
  `;
  const params: unknown[] = [churchId];

  if (personId) {
    query += ` AND a.person_id = $2`;
    params.push(personId);
  } else if (familyId) {
    // Get addresses linked to family via primary_address_id
    query = `
      SELECT a.id, a.person_id, a.line1, a.line2, a.city, a.state, a.region,
             a.postal_code, a.country, a.label, a.lat, a.lng, a.timezone,
             a.street, a.created_at
      FROM addresses a
      JOIN families f ON f.primary_address_id = a.id
      WHERE a.church_id = $1 AND f.id = $2
    `;
    params.push(familyId);
  }

  query += ` ORDER BY a.created_at DESC`;

  const result = await pool.query(query, params);
  return json(result.rows);
};

// POST - Create a new address
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const body = await event.request.json();
  const {
    person_id,
    line1,
    line2,
    street,
    city,
    state,
    region,
    postal_code,
    country = 'US',
    label,
    lat,
    lng,
    timezone
  } = body;

  const result = await pool.query(
    `INSERT INTO addresses
       (church_id, person_id, line1, line2, street, city, state, region, postal_code, country, label, lat, lng, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [churchId, person_id || null, line1, line2, street, city, state, region, postal_code, country, label, lat, lng, timezone]
  );

  return json(result.rows[0], { status: 201 });
};
