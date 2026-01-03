import tenants from '../../dev/tenants.json' assert { type: 'json' };

const allowed = new Set(tenants.tenants.map(t => t.id));

function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function tenantMiddleware(req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Later: in prod you’d get this from session/auth.
  const headerVal = req.get('X-Church-Id');

  if (!isDev) {
    return res.status(500).json({ error: 'Tenant resolution not configured for production yet.' });
  }

  if (!headerVal || !isUuid(headerVal)) {
    return res.status(400).json({ error: 'Missing or invalid X-Church-Id header.' });
  }

  if (!allowed.has(headerVal)) {
    return res.status(403).json({ error: 'Unknown/unauthorized tenant in dev tenant list.' });
  }

  req.churchId = headerVal;
  next();
}
