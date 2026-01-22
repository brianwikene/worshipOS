// /docs/ai-prompts/accessibility-tooling.md
# Accessibility Tooling (MVP) — WorshipOS

This document defines the automated tooling posture for WorshipOS MVP.

We follow:
- Accessible-by-construction baseline (semantic + keyboard-first)
- Entire MVP surface covered (no exceptions)
- Workflow: Generate → Manual → Automated → Ship
- WCAG 2.2 AA is a north star, not a per-release compliance claim
- WCAG escalation triggers: External requirement / Complexity threshold / Signal accumulation

---

## Tooling Stack (MVP)

**Chosen posture:** Minimal, discipline-first tooling.

### Always-on (static checks)
- Lint rules that catch structural accessibility violations early
- Framework warnings treated as signal, not noise

### On-demand (runtime audits)
- Runtime audits (e.g., axe) are used at milestones or when triggers fire
- Not run for every PR by default

---

## CI Policy: Blockers vs Warnings

### CI Blockers (must fix before merge)
- Non-semantic interactive elements (no div-clickables)
- Missing labels on inputs (no placeholder-only labeling)
- Keyboard-inaccessible primary controls in any flow
- Focus trap bugs in modals/dialogs (if used)

### CI Warnings (allowed, but tracked)
- Contrast edge cases (unless clearly unreadable)
- Suboptimal ARIA usage that does not break functionality
- Imperfect landmarks/headings that do not block navigation
- Non-critical screen reader enhancements

**Rule:** repeated warnings across PRs count toward the Signal Accumulation trigger.

---

## When to Run Runtime Audits

Run on-demand runtime audits when:
- Adding complex UI patterns (tables, drag/drop, custom calendars, rich editors)
- Repeated warnings appear in PRs
- Preparing a milestone release
- External requirement trigger fires (WCAG AA needed)

---

## Definition of Done Reference

See:
- `docs/decision-prompts.md`
- `docs/decision-log-template.md`
- `docs/ai-prompts/accessibility-ui-generation.md`
- MVP Accessibility DoD (Baseline)
