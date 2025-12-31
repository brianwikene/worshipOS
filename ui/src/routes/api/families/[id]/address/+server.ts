// src/routes/api/families/[id]/address/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';

// POST - Create new family address
export const POST: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: familyId } = event.params;
  const body = await event.request.json();
  const { line1, line2, city, state, postal_code, country = 'US', label, is_primary } = body;

  // Check family exists
  const familyResult = await pool.query(
    'SELECT id, primary_address_id FROM families WHERE id = $1 AND church_id = $2',
    [familyId, churchId]
  );

  if (familyResult.rows.length === 0) {
    throw error(404, 'Family not found');
  }

  const family = familyResult.rows[0];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create new address with family_id
    const addressResult = await client.query(
      `INSERT INTO addresses (church_id, family_id, line1, line2, city, state, postal_code, country, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [churchId, familyId, line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null]
    );

    const newAddress = addressResult.rows[0];

    // If this is marked as primary, or if it's the first address, update the family
    if (is_primary || !family.primary_address_id) {
      await client.query(
        'UPDATE families SET primary_address_id = $1 WHERE id = $2',
        [newAddress.id, familyId]
      );
      newAddress.is_primary = true;
    } else {
      newAddress.is_primary = false;
    }

    await client.query('COMMIT');
    return json(newAddress, { status: 201 });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// PUT - Update existing family address (legacy support for single address)
export const PUT: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: familyId } = event.params;
  const body = await event.request.json();
  const { line1, line2, city, state, postal_code, country = 'US', label, address_id, is_primary } = body;

  // Check family exists
  const familyResult = await pool.query(
    'SELECT id, primary_address_id FROM families WHERE id = $1 AND church_id = $2',
    [familyId, churchId]
  );

  if (familyResult.rows.length === 0) {
    throw error(404, 'Family not found');
  }

  const family = familyResult.rows[0];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (address_id) {
      // Update existing address
      const result = await client.query(
        `UPDATE addresses
         SET line1 = $1, line2 = $2, city = $3, state = $4, postal_code = $5, country = $6, label = $7
         WHERE id = $8 AND family_id = $9 AND church_id = $10
         RETURNING *`,
        [line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null, address_id, familyId, churchId]
      );

      if (result.rows.length === 0) {
        throw error(404, 'Address not found');
      }

      // Update primary if requested
      if (is_primary && family.primary_address_id !== address_id) {
        await client.query(
          'UPDATE families SET primary_address_id = $1 WHERE id = $2',
          [address_id, familyId]
        );
      }

      await client.query('COMMIT');
      return json({ ...result.rows[0], is_primary: is_primary || family.primary_address_id === address_id });
    } else if (family.primary_address_id) {
      // Legacy: Update existing primary address
      const result = await client.query(
        `UPDATE addresses
         SET line1 = $1, line2 = $2, city = $3, state = $4, postal_code = $5, country = $6, label = $7, family_id = $8
         WHERE id = $9 AND church_id = $10
         RETURNING *`,
        [line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null, familyId, family.primary_address_id, churchId]
      );
      await client.query('COMMIT');
      return json({ ...result.rows[0], is_primary: true });
    } else {
      // Create new address and link to family (legacy path)
      const addressResult = await client.query(
        `INSERT INTO addresses (church_id, family_id, line1, line2, city, state, postal_code, country, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [churchId, familyId, line1 || null, line2 || null, city || null, state || null, postal_code || null, country, label || null]
      );

      const newAddress = addressResult.rows[0];

      await client.query(
        'UPDATE families SET primary_address_id = $1 WHERE id = $2',
        [newAddress.id, familyId]
      );

      await client.query('COMMIT');
      return json({ ...newAddress, is_primary: true }, { status: 201 });
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// DELETE - Remove family address
export const DELETE: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'X-Church-Id is required');

  const { id: familyId } = event.params;
  const url = new URL(event.request.url);
  const addressId = url.searchParams.get('address_id');

  // Get family with address
  const familyResult = await pool.query(
    'SELECT id, primary_address_id FROM families WHERE id = $1 AND church_id = $2',
    [familyId, churchId]
  );

  if (familyResult.rows.length === 0) {
    throw error(404, 'Family not found');
  }

  const family = familyResult.rows[0];
  const targetAddressId = addressId || family.primary_address_id;

  if (!targetAddressId) {
    return json({ success: true, message: 'No address to delete' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If deleting the primary address, update family to point to another address or null
    if (family.primary_address_id === targetAddressId) {
      // Find another address for this family
      const otherAddressResult = await client.query(
        `SELECT id FROM addresses WHERE family_id = $1 AND id != $2 LIMIT 1`,
        [familyId, targetAddressId]
      );

      const newPrimaryId = otherAddressResult.rows.length > 0 ? otherAddressResult.rows[0].id : null;

      await client.query(
        'UPDATE families SET primary_address_id = $1 WHERE id = $2',
        [newPrimaryId, familyId]
      );
    }

    // Delete the address
    await client.query(
      'DELETE FROM addresses WHERE id = $1 AND church_id = $2',
      [targetAddressId, churchId]
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
