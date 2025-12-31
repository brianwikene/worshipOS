// src/routes/api/addresses/[id]/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// GET - Get a single address
export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  const result = await pool.query(
    `SELECT id, person_id, line1, line2, street, city, state, region,
            postal_code, country, label, lat, lng, timezone, created_at
     FROM addresses
     WHERE id = $1 AND church_id = $2`,
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Address not found');
  }

  return json(result.rows[0]);
};

// PUT - Update an address
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;
  const body = await event.request.json();
  const { line1, line2, street, city, state, region, postal_code, country, label, lat, lng, timezone } = body;

  // Check address exists
  const existing = await pool.query(
    'SELECT id FROM addresses WHERE id = $1 AND church_id = $2',
    [id, churchId]
  );

  if (existing.rows.length === 0) {
    throw error(404, 'Address not found');
  }

  // Build dynamic update query
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (line1 !== undefined) {
    updates.push(`line1 = $${paramIndex++}`);
    values.push(line1 || null);
  }
  if (line2 !== undefined) {
    updates.push(`line2 = $${paramIndex++}`);
    values.push(line2 || null);
  }
  if (street !== undefined) {
    updates.push(`street = $${paramIndex++}`);
    values.push(street || null);
  }
  if (city !== undefined) {
    updates.push(`city = $${paramIndex++}`);
    values.push(city || null);
  }
  if (state !== undefined) {
    updates.push(`state = $${paramIndex++}`);
    values.push(state || null);
  }
  if (region !== undefined) {
    updates.push(`region = $${paramIndex++}`);
    values.push(region || null);
  }
  if (postal_code !== undefined) {
    updates.push(`postal_code = $${paramIndex++}`);
    values.push(postal_code || null);
  }
  if (country !== undefined) {
    updates.push(`country = $${paramIndex++}`);
    values.push(country || null);
  }
  if (label !== undefined) {
    updates.push(`label = $${paramIndex++}`);
    values.push(label || null);
  }
  if (lat !== undefined) {
    updates.push(`lat = $${paramIndex++}`);
    values.push(lat);
  }
  if (lng !== undefined) {
    updates.push(`lng = $${paramIndex++}`);
    values.push(lng);
  }
  if (timezone !== undefined) {
    updates.push(`timezone = $${paramIndex++}`);
    values.push(timezone || null);
  }

  if (updates.length === 0) {
    throw error(400, 'No fields to update');
  }

  values.push(id, churchId);

  const result = await pool.query(
    `UPDATE addresses
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND church_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return json(result.rows[0]);
};

// DELETE - Delete an address
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id } = event.params;

  // Check if address is used as primary_address for a family
  const familyCheck = await pool.query(
    'SELECT id, name FROM families WHERE primary_address_id = $1 AND church_id = $2',
    [id, churchId]
  );

  if (familyCheck.rows.length > 0) {
    // Unlink from family before deleting
    await pool.query(
      'UPDATE families SET primary_address_id = NULL WHERE primary_address_id = $1',
      [id]
    );
  }

  const result = await pool.query(
    'DELETE FROM addresses WHERE id = $1 AND church_id = $2 RETURNING id',
    [id, churchId]
  );

  if (result.rows.length === 0) {
    throw error(404, 'Address not found');
  }

  return json({ success: true });
};
