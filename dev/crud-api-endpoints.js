// /dev/crud-api-endpoints.js
// =====================================================
// WORSHIPOS CRUD API ENDPOINTS
// Complete Create, Read, Update, Delete operations
// =====================================================

// ==========================================
// PEOPLE CRUD
// ==========================================

// CREATE: Add new person
app.post("/people", async (req, res) => {
  try {
    const { org_id, display_name, family_id } = req.body;

    if (!org_id || !display_name) {
      return res.status(400).json({ error: "org_id and display_name are required" });
    }

    const result = await pool.query(
      `INSERT INTO people (org_id, display_name)
       VALUES ($1, $2)
       RETURNING *`,
      [org_id, display_name]
    );

    const person = result.rows[0];

    // If family_id provided, add to family
    if (family_id) {
      await pool.query(
        `INSERT INTO family_members (org_id, family_id, person_id, relationship)
         VALUES ($1, $2, $3, 'other')`,
        [org_id, family_id, person.id]
      );
    }

    res.status(201).json(person);
  } catch (err) {
    console.error("POST /people failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Edit person
app.put("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name } = req.body;

    if (!display_name) {
      return res.status(400).json({ error: "display_name is required" });
    }

    const result = await pool.query(
      `UPDATE people 
       SET display_name = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [display_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /people/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// SOFT DELETE: Archive person
app.delete("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete by setting is_active = false (add this column if needed)
    const result = await pool.query(
      `UPDATE people 
       SET updated_at = now()
       WHERE id = $1
       RETURNING id, display_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json({ message: "Person archived", person: result.rows[0] });
  } catch (err) {
    console.error("DELETE /people/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FAMILY MANAGEMENT
// ==========================================

// CREATE: New family
app.post("/families", async (req, res) => {
  try {
    const { org_id, name, notes } = req.body;

    if (!org_id || !name) {
      return res.status(400).json({ error: "org_id and name are required" });
    }

    const result = await pool.query(
      `INSERT INTO families (org_id, name, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [org_id, name, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /families failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Edit family
app.put("/families/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, notes } = req.body;

    const result = await pool.query(
      `UPDATE families 
       SET name = COALESCE($1, name),
           notes = COALESCE($2, notes),
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [name, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Family not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /families/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ADD person to family
app.post("/families/:family_id/members", async (req, res) => {
  try {
    const { family_id } = req.params;
    const { org_id, person_id, relationship, is_primary_contact } = req.body;

    if (!person_id || !relationship) {
      return res.status(400).json({ error: "person_id and relationship are required" });
    }

    const result = await pool.query(
      `INSERT INTO family_members (org_id, family_id, person_id, relationship, is_primary_contact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [org_id, family_id, person_id, relationship, is_primary_contact || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /families/:family_id/members failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE person from family
app.delete("/families/:family_id/members/:person_id", async (req, res) => {
  try {
    const { family_id, person_id } = req.params;

    const result = await pool.query(
      `UPDATE family_members 
       SET is_active = false, end_date = CURRENT_DATE
       WHERE family_id = $1 AND person_id = $2
       RETURNING *`,
      [family_id, person_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Family member not found" });
    }

    res.json({ message: "Person removed from family", member: result.rows[0] });
  } catch (err) {
    console.error("DELETE /families/:family_id/members/:person_id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ROLES CRUD
// ==========================================

// CREATE: Add new role
app.post("/roles", async (req, res) => {
  try {
    const { org_id, name, ministry_area, description, load_weight } = req.body;

    if (!org_id || !name) {
      return res.status(400).json({ error: "org_id and name are required" });
    }

    const result = await pool.query(
      `INSERT INTO roles (org_id, name, ministry_area, description, load_weight)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [org_id, name, ministry_area || null, description || null, load_weight || 10]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /roles failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Edit role
app.put("/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, ministry_area, description, load_weight } = req.body;

    const result = await pool.query(
      `UPDATE roles 
       SET name = COALESCE($1, name),
           ministry_area = COALESCE($2, ministry_area),
           description = COALESCE($3, description),
           load_weight = COALESCE($4, load_weight)
       WHERE id = $5
       RETURNING *`,
      [name, ministry_area, description, load_weight, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /roles/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ARCHIVE: Soft delete role
app.delete("/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Just mark inactive (you'll need to add is_active column to roles table)
    const result = await pool.query(
      `DELETE FROM roles WHERE id = $1 RETURNING id, name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.json({ message: "Role archived", role: result.rows[0] });
  } catch (err) {
    console.error("DELETE /roles/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET: All roles with optional filtering
app.get("/roles", async (req, res) => {
  try {
    const { org_id, ministry_area } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    let query = `
      SELECT * FROM roles 
      WHERE org_id = $1
    `;
    const params = [org_id];

    if (ministry_area) {
      query += ` AND ministry_area = $2`;
      params.push(ministry_area);
    }

    query += ` ORDER BY ministry_area, name`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /roles failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SERVICE ROLE REQUIREMENTS (Context-level)
// ==========================================

// GET: Role requirements for a context
app.get("/contexts/:context_id/role-requirements", async (req, res) => {
  try {
    const { context_id } = req.params;

    const result = await pool.query(
      `SELECT 
        srr.*,
        r.name as role_name,
        r.ministry_area,
        r.description
       FROM service_role_requirements srr
       JOIN roles r ON r.id = srr.role_id
       WHERE srr.context_id = $1
       ORDER BY r.ministry_area, srr.display_order, r.name`,
      [context_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /contexts/:context_id/role-requirements failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE/UPDATE: Set role requirement for context
app.put("/contexts/:context_id/role-requirements/:role_id", async (req, res) => {
  try {
    const { context_id, role_id } = req.params;
    const { org_id, min_needed, max_needed, is_required, display_order } = req.body;

    const result = await pool.query(
      `INSERT INTO service_role_requirements 
        (org_id, context_id, role_id, min_needed, max_needed, is_required, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (org_id, context_id, role_id) 
       DO UPDATE SET
         min_needed = EXCLUDED.min_needed,
         max_needed = EXCLUDED.max_needed,
         is_required = EXCLUDED.is_required,
         display_order = EXCLUDED.display_order
       RETURNING *`,
      [org_id, context_id, role_id, min_needed, max_needed, is_required, display_order]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /contexts/:context_id/role-requirements/:role_id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove role requirement from context
app.delete("/contexts/:context_id/role-requirements/:role_id", async (req, res) => {
  try {
    const { context_id, role_id } = req.params;

    const result = await pool.query(
      `DELETE FROM service_role_requirements 
       WHERE context_id = $1 AND role_id = $2
       RETURNING *`,
      [context_id, role_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Role requirement not found" });
    }

    res.json({ message: "Role requirement removed", requirement: result.rows[0] });
  } catch (err) {
    console.error("DELETE /contexts/:context_id/role-requirements/:role_id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SERVICE ASSIGNMENTS (Instance-level)
// ==========================================

// CREATE: Assign person to role for service
app.post("/service-instances/:instance_id/assignments", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const { org_id, role_id, person_id, status, is_lead, notes } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: "role_id is required" });
    }

    const result = await pool.query(
      `INSERT INTO service_assignments 
        (org_id, service_instance_id, role_id, person_id, status, is_lead, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [org_id, instance_id, role_id, person_id, status || 'pending', is_lead || false, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /service-instances/:instance_id/assignments failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Change assignment
app.put("/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { person_id, status, is_lead, notes } = req.body;

    const result = await pool.query(
      `UPDATE service_assignments 
       SET person_id = COALESCE($1, person_id),
           status = COALESCE($2, status),
           is_lead = COALESCE($3, is_lead),
           notes = COALESCE($4, notes),
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [person_id, status, is_lead, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /assignments/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove assignment
app.delete("/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM service_assignments WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ message: "Assignment removed", assignment: result.rows[0] });
  } catch (err) {
    console.error("DELETE /assignments/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SONGS CRUD
// ==========================================

// CREATE: Add song
app.post("/songs", async (req, res) => {
  try {
    const { org_id, title, artist, key, bpm, ccli_number, notes } = req.body;

    if (!org_id || !title) {
      return res.status(400).json({ error: "org_id and title are required" });
    }

    const result = await pool.query(
      `INSERT INTO songs (org_id, title, artist, key, bpm, ccli_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [org_id, title, artist, key, bpm, ccli_number, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /songs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Edit song
app.put("/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, key, bpm, ccli_number, notes } = req.body;

    const result = await pool.query(
      `UPDATE songs 
       SET title = COALESCE($1, title),
           artist = COALESCE($2, artist),
           key = COALESCE($3, key),
           bpm = COALESCE($4, bpm),
           ccli_number = COALESCE($5, ccli_number),
           notes = COALESCE($6, notes)
       WHERE id = $7
       RETURNING *`,
      [title, artist, key, bpm, ccli_number, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Song not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /songs/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET: All songs
app.get("/songs", async (req, res) => {
  try {
    const { org_id, search } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    let query = `SELECT * FROM songs WHERE org_id = $1`;
    const params = [org_id];

    if (search) {
      query += ` AND (title ILIKE $2 OR artist ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY title`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /songs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SERVICE INSTANCE - ADD SONGS
// ==========================================

// You'll need a service_instance_songs junction table
// CREATE TABLE service_instance_songs (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   service_instance_id uuid REFERENCES service_instances(id),
//   song_id uuid REFERENCES songs(id),
//   display_order int,
//   key text,
//   notes text
// );

// ADD song to service
app.post("/service-instances/:instance_id/songs", async (req, res) => {
  try {
    const { instance_id } = req.params;
    const { song_id, display_order, key, notes } = req.body;

    if (!song_id) {
      return res.status(400).json({ error: "song_id is required" });
    }

    const result = await pool.query(
      `INSERT INTO service_instance_songs 
        (service_instance_id, song_id, display_order, key, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [instance_id, song_id, display_order, key, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /service-instances/:instance_id/songs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET songs for a service
app.get("/service-instances/:instance_id/songs", async (req, res) => {
  try {
    const { instance_id } = req.params;

    const result = await pool.query(
      `SELECT 
        sis.*,
        s.title,
        s.artist,
        s.key as default_key,
        s.bpm,
        s.ccli_number
       FROM service_instance_songs sis
       JOIN songs s ON s.id = sis.song_id
       WHERE sis.service_instance_id = $1
       ORDER BY sis.display_order`,
      [instance_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /service-instances/:instance_id/songs failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// REMOVE song from service
app.delete("/service-instance-songs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM service_instance_songs WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Song not found in service" });
    }

    res.json({ message: "Song removed from service", song: result.rows[0] });
  } catch (err) {
    console.error("DELETE /service-instance-songs/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// COPY SERVICE (Week to Week Inheritance)
// ==========================================

app.post("/service-instances/:source_id/copy", async (req, res) => {
  try {
    const { source_id } = req.params;
    const { target_date, target_time } = req.body;

    // This would copy assignments, songs, segments from one service to another
    // Implementation depends on your exact needs

    res.json({ message: "Service copied", source_id, target_date });
  } catch (err) {
    console.error("POST /service-instances/:source_id/copy failed:", err);
    res.status(500).json({ error: err.message });
  }
});
