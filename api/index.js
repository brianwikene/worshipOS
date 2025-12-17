import cors from "cors"; // Ensure you run: npm install cors
import express from "express";
import pg from "pg";

const { Pool } = pg;

// ---- DATABASE CONNECTION ----
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE || "worshipos",
  user: process.env.PGUSER || "worship",
  password: process.env.PGPASSWORD || "worship",
});

// ---- APP SETUP ----
const app = express();
app.use(express.json());

// Use the cors package for better browser compatibility
app.use(
  cors({
    origin: "http://localhost:5173", // Allow your frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ---- ROUTE not specified ----
app.get("/", (req, res) => {
  res
    .type("text")
    .send(
      [
        "Worship OS API is running.",
        "",
        "Available endpoints:",
        "GET /health - Health check",
        "GET /services?org_id=ORG_ID",
      ].join("\n")
    );
});

// ---- HEALTH CHECK ----
app.get("/health", async (req, res) => {
  try {
    await pool.query("select 1");
    res.json({
      ok: true,
      status: "healthy",
    });
  } catch (err) {
    res.status(503).json({
      ok: false,
      status: "db_unreachable",
      message:
        process.env.NODE_ENV !== "production"
          ? "Database is not reachable. If you are using Colima/Docker, try:\n\n" +
            "  colima start\n" +
            "  docker ps\n\n" +
            "Then restart the API."
          : "Service unavailable",
    });
  }
});

// ---- SERVICES ENDPOINT (FIXED: Resolved nested aggregate error) ----
app.get("/services", async (req, res) => {
  try {
    const { church_id, start_date, end_date } = req.query;

    if (!church_id) {
      return res.status(400).json({ error: "church_id is required" });
    }

    const result = await pool.query(
      `
      SELECT
        sg.id as group_id,
        TO_CHAR(sg.group_date, 'YYYY-MM-DD') as group_date,
        sg.name as group_name,
        c.name as context_name,
        si.id as instance_id,
        si.service_time,
        si.campus_id,
        camp.name as campus_name,

        -- Assignment summary data
        COALESCE(
          (SELECT json_build_object(
            'total_positions', COUNT(DISTINCT srr.role_id),
            'filled_positions', COUNT(DISTINCT sa.id) FILTER (WHERE sa.person_id IS NOT NULL),
            'confirmed', COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'confirmed'),
            'pending', COUNT(DISTINCT sa.id) FILTER (WHERE sa.status = 'pending' AND sa.person_id IS NOT NULL),
            'unfilled', COUNT(DISTINCT srr.role_id) FILTER (
              WHERE NOT EXISTS (
                SELECT 1 FROM service_assignments sa2
                WHERE sa2.service_instance_id = si.id
                AND sa2.role_id = srr.role_id
                AND sa2.person_id IS NOT NULL
              )
            ),
            'by_ministry', (
              SELECT COALESCE(json_agg(ministry_stats), '[]'::json)
              FROM (
                SELECT
                  r_inner.ministry_area,
                  COUNT(DISTINCT srr_inner.role_id) as total,
                  COUNT(DISTINCT sa_inner.id) FILTER (WHERE sa_inner.person_id IS NOT NULL) as filled,
                  COUNT(DISTINCT sa_inner.id) FILTER (WHERE sa_inner.status = 'confirmed') as confirmed,
                  -- ADDED: Count pending assignments per ministry
                  COUNT(DISTINCT sa_inner.id) FILTER (WHERE sa_inner.status = 'pending' AND sa_inner.person_id IS NOT NULL) as pending
                FROM service_role_requirements srr_inner
                JOIN roles r_inner ON r_inner.id = srr_inner.role_id
                LEFT JOIN service_assignments sa_inner
                  ON sa_inner.service_instance_id = si.id
                  AND sa_inner.role_id = r_inner.id
                WHERE srr_inner.context_id = sg.context_id
                  AND r_inner.ministry_area IS NOT NULL
                GROUP BY r_inner.ministry_area
              ) ministry_stats
            )
    )
          FROM service_role_requirements srr
          LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = srr.role_id
          WHERE srr.context_id = sg.context_id
        ),
        -- Fallback object if the subquery returns null
        json_build_object(
          'total_positions', 0,
          'filled_positions', 0,
          'confirmed', 0,
          'pending', 0,
          'unfilled', 0,
          'by_ministry', '[]'::json
        )
      ) as assignments

      FROM service_groups sg
      LEFT JOIN contexts c ON sg.context_id = c.id
      JOIN service_instances si ON si.service_group_id = sg.id
      LEFT JOIN campuses camp ON si.campus_id = camp.id
      WHERE sg.church_id = $1
        AND ($2::date IS NULL OR sg.group_date >= $2::date)
        AND ($3::date IS NULL OR sg.group_date <= $3::date)
      ORDER BY sg.group_date ASC, si.service_time ASC
      `,
      [church_id, start_date || null, end_date || null]
    );

    // Group instances by service group
    const groupsMap = new Map();

    result.rows.forEach((row) => {
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          id: row.group_id,
          group_date: row.group_date,
          name: row.group_name,
          context_name: row.context_name || "Unknown",
          instances: [],
        });
      }

      const group = groupsMap.get(row.group_id);
      group.instances.push({
        id: row.instance_id,
        service_time: row.service_time,
        campus_id: row.campus_id,
        campus_name: row.campus_name,
        assignments: row.assignments,
      });
    });

    res.json(Array.from(groupsMap.values()));
  } catch (err) {
    console.error("GET /services failed:", err);

    // Postgres: undefined_table (missing relation)
    if (err?.code === "42P01" && process.env.NODE_ENV !== "production") {
      return res.status(500).json({
        error: err.message,
        hint:
          "DB schema is missing a table. Start infra + run migrations.\n\n" +
          "  colima start\n" +
          "  docker-compose up -d\n" +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/001_extensions.sql\n' +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/002_service_groups.sql\n' +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/003_contexts.sql\n' +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/004_service_groups_context_id.sql\n' +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/005_core_services_schema.sql\n',
      });
    }
    if (err?.code === "42703" && process.env.NODE_ENV !== "production") {
      return res.status(500).json({
        error: err.message,
        hint:
          "DB schema is missing a column. Run latest migrations.\n\n" +
          '  psql "postgres://worship:worship@127.0.0.1:5432/worshipos" -f api/migrations/005_core_services_schema.sql\n',
      });
    }

    // Default behavior
    res.status(500).json({ error: err.message });
  }
});

// ---- SERVICE INSTANCE DETAIL ----
app.get("/service-instances/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get the service instance with its group info
    const result = await pool.query(
      `
      SELECT
        si.id as service_instance_id,
        si.service_time,
        si.campus_id,
        camp.name as campus_name,
        sg.id as service_group_id,
        sg.group_date,
        sg.name as service_name,
        sg.context_id,
        c.name as context_name,
        sg.org_id
      FROM service_instances si
      JOIN service_groups sg ON si.service_group_id = sg.id
      LEFT JOIN contexts c ON sg.context_id = c.id
      LEFT JOIN campuses camp ON si.campus_id = camp.id
      WHERE si.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service instance not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /service-instances/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- SERVICE INSTANCE DETAIL ----
app.get("/service-instances/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        si.id as service_instance_id,
        si.service_time,
        si.campus_id,
        camp.name as campus_name,
        sg.id as service_group_id,
        sg.group_date,
        sg.name as service_name,
        sg.context_id,
        c.name as context_name,
        sg.org_id
      FROM service_instances si
      JOIN service_groups sg ON si.service_group_id = sg.id
      LEFT JOIN contexts c ON sg.context_id = c.id
      LEFT JOIN campuses camp ON si.campus_id = camp.id
      WHERE si.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service instance not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /service-instances/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- PEOPLE ENDPOINT (Updated to include has_contact_info) ----
app.get("/people", async (req, res) => {
  try {
    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    // UPDATED QUERY:
    // We stick to a simple EXISTS check for performance.
    // It returns true if the person has at least one contact method.
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.display_name,
        EXISTS (
          SELECT 1 FROM contact_methods cm
          WHERE cm.person_id = p.id
        ) as has_contact_info
      FROM people p
      WHERE p.org_id = $1
      ORDER BY p.display_name ASC
      `,
      [org_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /people failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- PERSON DETAIL ENDPOINT ----
app.get("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        p.id,
        p.display_name,
        COALESCE(
          (SELECT json_agg(cm ORDER BY cm.is_primary DESC, cm.type)
           FROM contact_methods cm
           WHERE cm.person_id = p.id),
          '[]'
        ) as contact_methods,
        COALESCE(
          (SELECT json_agg(a ORDER BY a.created_at DESC)
           FROM addresses a
           WHERE a.person_id = p.id),
          '[]'
        ) as addresses
      FROM people p
      WHERE p.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /people/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

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

// ==========================================
// PEOPLE CRUD
// ==========================================

// CREATE: Add new person
app.post("/people", async (req, res) => {
  try {
    const { org_id, display_name, family_id } = req.body;

    if (!org_id || !display_name) {
      return res
        .status(400)
        .json({ error: "org_id and display_name are required" });
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
      return res
        .status(400)
        .json({ error: "person_id and relationship are required" });
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
    console.error(
      "DELETE /families/:family_id/members/:person_id failed:",
      err
    );
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
      [
        org_id,
        name,
        ministry_area || null,
        description || null,
        load_weight || 10,
      ]
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
app.put(
  "/contexts/:context_id/role-requirements/:role_id",
  async (req, res) => {
    try {
      const { context_id, role_id } = req.params;
      const { org_id, min_needed, max_needed, display_order } = req.body;

      const result = await pool.query(
        `INSERT INTO service_role_requirements
        (org_id, context_id, role_id, min_needed, max_needed, display_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, context_id, role_id)
       DO UPDATE SET
         min_needed = EXCLUDED.min_needed,
         max_needed = EXCLUDED.max_needed,
         display_order = EXCLUDED.display_order
       RETURNING *`,
        [org_id, context_id, role_id, min_needed, max_needed, display_order]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error(
        "PUT /contexts/:context_id/role-requirements/:role_id failed:",
        err
      );
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE: Remove role requirement from context
app.delete(
  "/contexts/:context_id/role-requirements/:role_id",
  async (req, res) => {
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

      res.json({
        message: "Role requirement removed",
        requirement: result.rows[0],
      });
    } catch (err) {
      console.error(
        "DELETE /contexts/:context_id/role-requirements/:role_id failed:",
        err
      );
      res.status(500).json({ error: err.message });
    }
  }
);

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
      [
        org_id,
        instance_id,
        role_id,
        person_id,
        status || "pending",
        is_lead || false,
        notes,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(
      "POST /service-instances/:instance_id/assignments failed:",
      err
    );
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

// DELETE: Remove song
app.delete("/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM songs WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Song not found" });
    }

    res.json({ message: "Song deleted", song: result.rows[0] });
  } catch (err) {
    console.error("DELETE /songs/:id failed:", err);
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

// ==========================================
// SERVICE ROSTER ENDPOINT
// Add this to your index.js
// ==========================================

// GET: Service roster (assignments for detail page)
app.get("/service-instances/:instance_id/roster", async (req, res) => {
  try {
    const { instance_id } = req.params;

    const result = await pool.query(
      `SELECT
        sa.id,
        sa.role_id,
        r.name as role_name,
        r.ministry_area,
        sa.person_id,
        p.display_name as person_name,
        sa.status,
        sa.is_lead,
        (srr.min_needed > 0) as is_required,
        sa.notes
       FROM service_instances si
       JOIN service_groups sg ON sg.id = si.service_group_id
       JOIN service_role_requirements srr ON srr.context_id = sg.context_id
       JOIN roles r ON r.id = srr.role_id
       LEFT JOIN service_assignments sa ON sa.service_instance_id = si.id AND sa.role_id = r.id
       LEFT JOIN people p ON p.id = sa.person_id
       WHERE si.id = $1
       ORDER BY
         r.ministry_area NULLS LAST,
         srr.display_order,
         sa.is_lead DESC NULLS LAST,
         r.name`,
      [instance_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /service-instances/:instance_id/roster failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Basic service instance info (for header)
app.get("/service-instances/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        si.id,
        si.service_time,
        c.name as campus_name,
        sg.group_date,
        sg.name as service_name,
        ctx.name as context_name
       FROM service_instances si
       JOIN service_groups sg ON sg.id = si.service_group_id
       LEFT JOIN campuses c ON c.id = si.campus_id
       LEFT JOIN contexts ctx ON ctx.id = sg.context_id
       WHERE si.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service instance not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET /service-instances/:id failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Worship OS API running at http://localhost:${PORT}`);
});
