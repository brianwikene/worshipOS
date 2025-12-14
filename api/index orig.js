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

//

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

// ---- SAMPLE DATA ENDPOINT ----
app.get("/services", async (req, res) => {
  try {
    const { org_id, start_date, end_date } = req.query;

    if (!org_id) {
      return res.status(400).json({ error: "org_id is required" });
    }

    const result = await pool.query(
      `
      select
        sg.id as service_group_id,
        sg.group_date,
        sg.name as service_name,
        sg.context_id,

        si.id as service_instance_id,
        si.service_time,
        si.campus_id
      from service_groups sg
      join service_instances si
        on si.service_group_id = sg.id
      where sg.org_id = $1
        and ($2::date is null or sg.group_date >= $2::date)
        and ($3::date is null or sg.group_date <= $3::date)
      order by
        sg.group_date desc,
        sg.name asc,
        si.service_time asc
      `,
      [org_id, start_date ?? null, end_date ?? null]
    );

    const groups = new Map();

    for (const row of result.rows) {
      if (!groups.has(row.service_group_id)) {
        groups.set(row.service_group_id, {
          service_group_id: row.service_group_id,
          group_date: row.group_date,
          service_name: row.service_name,
          context_id: row.context_id,
          instances: [],
        });
      }

      groups.get(row.service_group_id).instances.push({
        service_instance_id: row.service_instance_id,
        service_time: row.service_time,
        campus_id: row.campus_id,
      });
    }

    res.json(Array.from(groups.values()));
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
        sg.id as service_group_id,
        sg.group_date,
        sg.name as service_name,
        sg.context_id,
        sg.org_id
      FROM service_instances si
      JOIN service_groups sg ON si.service_group_id = sg.id
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

// ---- START SERVER ----
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Worship OS API running at http://localhost:${PORT}`);
});
