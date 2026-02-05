# Smoke Test Checklist

Run after each chunk of work. Check off manually or use as a guide.

## Auth / Tenant
- [ ] `/api/_diag/whoami` (logged in) returns `churchId` + `actorId`
- [ ] `/api/_diag/whoami` (logged out) returns `actorId: anon`
- [ ] `/api/_diag/health` returns `ok: true`

## Gatherings
- [ ] `GET /api/gatherings` returns list with gatherings array
- [ ] `GET /api/gatherings/[id]` returns gathering with plans array
- [ ] `/gatherings` page loads without error
- [ ] Click a gathering → `/gatherings/[id]` detail page loads
- [ ] Detail page shows correct gathering title + date + plans list

## Gathering Order (Read-Only)
- [ ] `GET /api/gatherings/:id/order` returns plans + items
- [ ] `/gatherings/:id/order` renders without error
- [ ] Shows plan title, status, and ordered items

## Rehearse (Read-Only)
- [ ] `GET /api/gatherings/:id/rehearse` returns songs only
- [ ] `/gatherings/:id/rehearse` renders song-only list
- [ ] Shows song number, title, key, artist

## Plans
- [ ] `/gatherings/[id]/plans/[plan_id]` loads
- [ ] Plan items display (if any exist)

## Build Sanity
- [ ] `npm run dev` boots without crash
- [ ] `npm run check` passes (ignore pre-existing schema/seed errors)
- [ ] No red errors in browser console on page load

## Debug Mode
- [ ] Add `?debug=1` to any page → see `[RID:xxx]` logs in terminal
- [ ] Trigger an error → see `[RID:xxx] [ERR]` in terminal with stack

---

## Quick Verify Commands

```bash
# Start dev server (adjust port if needed)
npm run dev &
sleep 5

# Diagnostics
curl -s http://localhost:5174/api/_diag/health | grep ok
curl -s http://localhost:5174/api/_diag/whoami | grep churchId

# Gatherings API
curl -s http://localhost:5174/api/gatherings | grep gatherings
GATHERING_ID=$(curl -s http://localhost:5174/api/gatherings | jq -r '.gatherings[0].id')
curl -s "http://localhost:5174/api/gatherings/$GATHERING_ID" | grep plans

# Cleanup
kill %1
```
