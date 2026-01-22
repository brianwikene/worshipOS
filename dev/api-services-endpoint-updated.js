// /dev/api-services-endpoint-updated.js
// Updated GET /services endpoint with campus information
// Replace your existing /services endpoint with this

app.get('/services', async (req, res) => {
  try {
    const { org_id } = req.query;
    
    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' });
    }

    // Updated query to include campus information
    const result = await pool.query(`
      SELECT 
        sg.id as group_id,
        sg.group_date,
        sg.name as group_name,
        c.name as context_name,
        si.id as instance_id,
        si.service_time,
        si.campus_id,
        camp.name as campus_name
      FROM service_groups sg
      LEFT JOIN contexts c ON sg.context_id = c.id
      JOIN service_instances si ON si.service_group_id = sg.id
      LEFT JOIN campuses camp ON si.campus_id = camp.id
      WHERE sg.org_id = $1
      ORDER BY sg.group_date ASC, si.service_time ASC
    `, [org_id]);

    // Group by service_group_id
    const grouped = result.rows.reduce((acc, row) => {
      const existingGroup = acc.find(g => g.id === row.group_id);
      
      const instance = {
        id: row.instance_id,
        service_time: row.service_time,
        campus_id: row.campus_id,
        campus_name: row.campus_name
      };

      if (existingGroup) {
        existingGroup.instances.push(instance);
      } else {
        acc.push({
          id: row.group_id,
          group_date: row.group_date,
          name: row.group_name,
          context_name: row.context_name || 'Unknown',
          instances: [instance]
        });
      }

      return acc;
    }, []);

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
