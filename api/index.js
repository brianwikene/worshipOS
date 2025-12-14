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
    const result = await pool.query("select now() as now");
    res.json({
      ok: true,
      db_time: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- SERVICES ENDPOINT (FIXED: Resolved nested aggregate error) ----
app.get("/services", async (req, res) => {
  try {
    const { org_id, start_date, end_date } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
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
      WHERE sg.org_id = $1
        AND ($2::date IS NULL OR sg.group_date >= $2::date)
        AND ($3::date IS NULL OR sg.group_date <= $3::date)
      ORDER BY sg.group_date ASC, si.service_time ASC
      `,
      [org_id, start_date || null, end_date || null]
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Worship OS API running at http://localhost:${PORT}`);
});
