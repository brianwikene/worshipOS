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

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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

// ---- SERVICES ENDPOINT (UPDATED WITH CAMPUS SUPPORT) ----
app.get("/services", async (req, res) => {
  try {
    const groupsMap = new Map();

    result.rows.forEach((row) => {
      // If we haven't seen this group_id yet, initialize it
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          id: row.group_id,
          group_date: row.group_date,
          name: row.group_name,
          context_name: row.context_name || "Unknown",
          instances: [], // Start with empty array
        });
      }

      // 2. Add the instance to the correct group
      const group = groupsMap.get(row.group_id);

      group.instances.push({
        id: row.instance_id,
        service_time: row.service_time,
        campus_id: row.campus_id,
        campus_name: row.campus_name,
      });
    });

    // 3. Convert the Map values back to an array for the JSON response
    const grouped = Array.from(groupsMap.values());

    res.json(grouped);
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

// ---- PEOPLE ENDPOINT ----
app.get("/people", async (req, res) => {
  try {
    const { org_id } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const result = await pool.query(
      `
      SELECT id, display_name
      FROM people
      WHERE org_id = $1
      ORDER BY display_name ASC
      `,
      [org_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /people failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- PERSON DETAIL ENDPOINT (WITH CONTACTS & ADDRESSES) ----
app.get("/people/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        p.id,
        p.display_name,

        -- Bundle all contact methods into a JSON array
        COALESCE(
          (SELECT json_agg(cm ORDER BY cm.is_primary DESC, cm.type)
           FROM contact_methods cm
           WHERE cm.person_id = p.id),
          '[]'
        ) as contact_methods,

        -- Bundle all addresses into a JSON array
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

// ---- START SERVER ----
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Worship OS API running at http://localhost:${PORT}`);
});
