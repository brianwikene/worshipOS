// /dev/service-roster-endpoint.js
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
