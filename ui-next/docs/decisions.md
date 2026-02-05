# Architecture Decisions

Micro decision log. Add 3-6 lines each time direction changes.

---

## 2026-02-04 Logging Infrastructure
Decision: Add RID-based request tracking + conditional debug logging.
Why: "button does nothing" bugs are invisible without correlation IDs.
Files: `$lib/server/diag.ts`, `$lib/server/log.ts`, `hooks.server.ts`
Next: Use `?debug=1` to trace any request; errors always logged.

## 2026-02-04 Gatherings Model
Decision: Keep `gatherings` as date-buckets, `plans` as time-slot instances.
Why: Supports multi-service weekends, VBS, special events.
Schema: `gatherings.id` → `plans.gathering_id` (1:many)
Next: Stabilize routing; ensure service layer (`listGatherings`, `getGatheringById`) is the single source of truth.

## 2026-02-04 Client Error Capture
Decision: Install global `window.onerror` + `unhandledrejection` handlers.
Why: Silent client failures (broken buttons) now show in server terminal.
Endpoint: `POST /api/_diag/client-error`
Next: Consider persisting to `error_events` table for production visibility.

---

## Template

```md
## YYYY-MM-DD Topic
Decision: <what you chose>
Why: <the driver>
Files/Schema: <what changed>
Next: <immediate follow-up>
```
