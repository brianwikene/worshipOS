// /docs/explainers/Explainer - Tech Design Summary.md
# WorshipOS — Technical Design Summary

This document explains how WorshipOS’s pastoral philosophy is enforced technically.

---

## Core Guarantees

### 1. Hard Tenant Isolation
- Each church is a hard security boundary.
- No cross-tenant reads, writes, or inference.
- All data is scoped by `church_id`.

This protects trust and enables safe growth.

---

### 2. Truthful History
- Services move through a lifecycle (draft → published → locked).
- Locked records are immutable.
- Lived reality is appended, not rewritten.

This preserves integrity and auditability.

---

### 3. Authorization vs Isolation
- Isolation happens before permissions.
- Campus, team, and role scopes filter visibility within a church.
- Permissions never replace isolation.

This prevents silent data leaks.

---

### 4. Pattern Awareness Without Automation
- Participation patterns are observational, not prescriptive.
- No automated actions, scoring, or judgments.
- Insights are private, contextual, and human-initiated.

The system supports discernment without attempting to replace it.

---

### 5. Explicit Non-Goals
- No predictive behavioral modeling
- No gamification
- No automated pastoral decisions
- No public behavioral dashboards

If a feature violates these constraints, it is rejected.

---

## Summary

WorshipOS enforces pastoral values through architecture:
truthful data, clear boundaries, limited automation, and respect for human wisdom.

This is a system designed to be trusted.
