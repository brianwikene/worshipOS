// ==========================================
// FAMILIES ENDPOINTS
// Add these to your index.js
// ==========================================

// ---- GET ALL FAMILIES ----
app.get("/families", async (req, res) => {
  try {
    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const result = await pool.query(
      `
      SELECT 
        f.id,
        f.name,
        f.notes,
        f.is_active,
        COUNT(DISTINCT fm.person_id) FILTER (WHERE fm.is_active = true) as active_members,
        COUNT(DISTINCT fm.person_id) FILTER (
          WHERE fm.relationship IN ('child', 'foster_child') 
          AND fm.is_active = true
        ) as active_children,
        COUNT(DISTINCT fm.person_id) FILTER (
          WHERE fm.relationship = 'foster_child' 
          AND fm.is_active = true
        ) as active_foster_children,
        json_agg(
          json_build_object(
            'id', p.id,
            'display_name', p.display_name
          ) ORDER BY p.display_name
        ) FILTER (WHERE fm.is_primary_contact = true) as primary_contacts
      FROM families f
      LEFT JOIN family_members fm ON fm.family_id = f.id
      LEFT JOIN people p ON p.id = fm.person_id AND fm.is_primary_contact = true
      WHERE f.org_id = $1
      GROUP BY f.id, f.name, f.notes, f.is_active
      ORDER BY f.name
      `,
      [org_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /families failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- GET FAMILY DETAIL WITH ROSTER ----
app.get("/families/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get family info
    const familyResult = await pool.query(
      `
      SELECT 
        f.id,
        f.name,
        f.notes,
        f.is_active,
        f.org_id,
        a.street,
        a.city,
        a.state,
        a.postal_code
      FROM families f
      LEFT JOIN addresses a ON a.id = f.primary_address_id
      WHERE f.id = $1
      `,
      [id]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: "Family not found" });
    }

    const family = familyResult.rows[0];

    // Get family members
    const membersResult = await pool.query(
      `
      SELECT 
        fm.id as membership_id,
        p.id as person_id,
        p.display_name,
        fm.relationship,
        fm.is_active,
        fm.is_temporary,
        fm.is_primary_contact,
        TO_CHAR(fm.start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(fm.end_date, 'YYYY-MM-DD') as end_date,
        fm.notes
      FROM family_members fm
      JOIN people p ON p.id = fm.person_id
      WHERE fm.family_id = $1
      ORDER BY 
        CASE fm.relationship
          WHEN 'parent' THEN 1
          WHEN 'guardian' THEN 2
          WHEN 'spouse' THEN 3
          WHEN 'child' THEN 4
          WHEN 'foster_child' THEN 5
          ELSE 6
        END,
        p.display_name
      `,
      [id]
    );

    family.members = membersResult.rows;

    res.json(family);
  } catch (err) {
    console.error("GET /families/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});
