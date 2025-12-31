// src/routes/api/families/[id]/address/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// PUT - Create or update family address
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: familyId } = event.params;
  const body = await event.request.json();
  const { line1, line2, city, state, postal_code, country = 'US', label } = body;

  // Check family exists
  const familyResult = await pool.query(
    'SELECT id, primary_address_id FROM families WHERE id = $1 AND church_id = $2',
    [familyId, churchId]
  );

  if (familyResult.rows.length === 0) {
    throw error(404, 'Family not found');
  }

  const family = familyResult.rows[0];

  if (family.primary_address_id) {
    // Update existing address
    const result = await pool.query(
      `UPDATE addresses
       SET line1 = $1, line2 = $2, city = $3, state = $4, postal_code = $5, country = $6, label = $7
       WHERE id = $8 AND church_id = $9
       RETURNING *`,
      [line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null, family.primary_address_id, churchId]
    );
    return json(result.rows[0]);
  } else {
    // Create new address and link to family
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const addressResult = await client.query(
        `INSERT INTO addresses (church_id, line1, line2, city, state, postal_code, country, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [churchId, line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null]
      );

      const newAddress = addressResult.rows[0];

      await client.query(
        'UPDATE families SET primary_address_id = $1 WHERE id = $2',
        [newAddress.id, familyId]
      );

      await client.query('COMMIT');
      return json(newAddress, { status: 201 });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

// DELETE - Remove family address
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: familyId } = event.params;

  // Get family with address
  const familyResult = await pool.query(
    'SELECT id, primary_address_id FROM families WHERE id = $1 AND church_id = $2',
    [familyId, churchId]
  );

  if (familyResult.rows.length === 0) {
    throw error(404, 'Family not found');
  }

  const family = familyResult.rows[0];

  if (!family.primary_address_id) {
    return json({ success: true, message: 'No address to delete' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Unlink from family
    await client.query(
      'UPDATE families SET primary_address_id = NULL WHERE id = $1',
      [familyId]
    );

    // Delete the address
    await client.query(
      'DELETE FROM addresses WHERE id = $1 AND church_id = $2',
      [family.primary_address_id, churchId]
    );

    await client.query('COMMIT');
    return json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};
