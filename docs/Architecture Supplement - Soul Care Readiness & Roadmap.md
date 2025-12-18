# Soul Care Architecture Readiness & Development Roadmap

This document supplements the core architecture by defining the prerequisites and boundaries required before implementing the Soul Care module.

Soul Care is a high-trust feature.
It must be built on proven foundations.

---

## Guiding Principle

If we cannot guarantee data integrity, clarity of meaning, and trust in system behavior,
we must not build Soul Care.

Care built on shaky foundations becomes harm.

---

## Required Foundations (Must Exist First)

### 1. Tenant Isolation (Church as Hard Boundary)
- All participation data scoped by `church_id`
- No cross-tenant inference or aggregation
- Soul Care insights never span churches

Status: REQUIRED BEFORE DEVELOPMENT

---

### 2. Accurate Service & Participation History
- Services must be lockable and truthful
- Planned vs lived reality preserved
- Volunteer participation reflects what actually happened

Soul Care depends on historical truth, not mutable records.

---

### 3. Clear Domain Vocabulary
- One meaning per concept (church, campus, team, role)
- No legacy aliases or ambiguous terms
- Data must mean the same thing everywhere

If leaders can’t trust language, they won’t trust insights.

---

### 4. Authorization & Visibility Boundaries
- Soul Care prompts visible only to appropriate leaders
- Private by default
- Never exposed to general volunteers

Care must be contextual and discreet.

---

## Phase 1: Observation Infrastructure (No Alerts)

Goal: Gather accurate patterns without surfacing them yet.

- Normalize participation events
- Track cadence over time
- Identify rest gaps, declines, overuse patterns
- Validate data accuracy and edge cases

No notifications.
No UI.
No interpretation.

---

## Phase 2: Private Prompts (Human-Initiated)

Goal: Support leaders without automation.

- Private, non-actionable prompts
- Language framed as questions, not warnings
- Manual acknowledgment by leaders
- No required workflows

Example:  
“Joe has served 6 consecutive weeks without a break. You may want to check in.”

---

## Phase 3: Reflection & Discernment Tools

Goal: Support long-term formation.

- Aggregate trends (not individual scoring)
- Ministry-level rhythm health
- Seasonal patterns
- Role sustainability signals

Still no automation of care.
Humans remain responsible.

---

## Explicit Non-Goals

- Predictive modeling of behavior
- Automated pastoral decisions
- Volunteer performance metrics
- Public health dashboards

If requested, these features are declined.

---

## Summary

Soul Care is not a feature to ship quickly.
It is a responsibility to carry carefully.

We build it only when the system can be trusted to tell the truth,
protect dignity,
and support human wisdom.

If those conditions are not met,
we wait.
