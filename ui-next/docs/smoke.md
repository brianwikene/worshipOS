# Smoke Test Checklist

Run after each chunk of work. Check off manually or use as a guide.

## Auth / Tenant
- [ ] `/api/_diag/whoami` (logged in) returns `churchId` + `actorId`
- [ ] `/api/_diag/whoami` (logged out) returns `actorId: anon`
- [ ] `/api/_diag/health` returns `ok: true`

## Gatherings
- [ ] `GET /api/gatherings` returns list with `ok: true`
- [ ] `/gatherings` page loads without error
- [ ] Click a gathering → detail page loads
- [ ] Detail page shows correct gathering title + date

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

## Quick Verify Command

```bash
npm run dev &
sleep 3
curl -s http://localhost:5174/api/_diag/health | grep ok
curl -s http://localhost:5174/api/_diag/whoami | grep rid
kill %1
```
