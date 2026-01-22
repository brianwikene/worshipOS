// /docs/adr/WorshipOS_Tenancy_and_Architecture_Promises.md
# WorshipOS — Tenancy & Architecture Promises

This document captures the **explicit promises** we made about data isolation, security boundaries, and system behavior. These are not implementation notes; they are **invariants**. If an implementation ever violates these, the implementation is wrong.

---

## 1. The Tenant Boundary (Hard Security Boundary)

**Promise:** A *church* is the hard isolation boundary.

- Every tenant-owned row **must** include `church_id`.
- No query may return, mutate, or infer data across different `church_id` values.
- Backups, restores, exports, and billing operate at the `church_id` boundary.
- If two churches have identical data (same names, same roles, same dates), they are still completely isolated.

**Corollary:** Any table without `church_id` is either:
- global/reference data, or
- incorrectly modeled.

---

## 2. Authorization vs Isolation (Never Confuse These)

**Promise:** Authorization scopes never replace tenant isolation.

- `church_id` = isolation boundary (security)
- `campus_id` = authorization/visibility scope (UX + permissions)

A user seeing less data does **not** mean the data is isolated. Isolation happens *before* authorization.

---

## 3. Campus Is a Scope, Not a Tenant

**Promise:** Campuses are *subsets* of a church, never tenants.

- All campuses belong to exactly one `church_id`.
- Data may be filtered by `campus_id`, but never partitioned into separate tenants.
- Removing a campus does not affect tenant integrity.

---

## 4. Tenant Key Everywhere (Defense in Depth)

**Promise:** Every tenant-owned table redundantly carries `church_id`, even if derivable.

Why:
- Prevents accidental cross-tenant joins
- Makes queries safer and faster
- Makes bugs obvious instead of silent

This is intentional duplication in service of safety.

---

## 5. Views Must Tell the Truth

**Promise:** Views may not lie about column semantics.

- A view exposing `church_id` must name it `church_id`.
- Legacy aliases (`org_id`) are not permitted.
- Views are dropped and recreated during semantic changes; never partially mutated.

---

## 6. API Contract Integrity

**Promise:** API parameters reflect the true domain language.

- The API speaks `church_id`, not legacy names.
- User-facing errors and documentation use the same language as the schema.
- Temporary parameters (pre-auth) are clearly marked as transitional.

---

## 7. Migration Authority

**Promise:** The database schema is defined only by migrations.

- Ad-hoc SQL is forbidden in production paths.
- Migrations are idempotent or safely guarded.
- `schema_migrations` is the source of truth for DB state.

---

## 8. Views Are Source-Controlled Artifacts

**Promise:** View definitions live in the repo.

- Views are recreated from canonical SQL files.
- No manual editing in prod databases.
- If a view breaks, the fix is committed, not hot-patched.

---

## 9. No Dual Vocabulary

**Promise:** There is exactly one term for each concept.

- `church_id` means tenant.
- `campus_id` means scope.
- Deprecated terms are fully removed, not tolerated.

Dual vocabulary creates silent bugs and future migrations. We eliminate it decisively.

---

## 10. The North Star Test

Any change must pass this question:

> *If this code were run by two churches with identical data, could either church observe the other in any way?*

If the answer is anything but **no**, the change violates WorshipOS promises.

---

## Status

- Tenant isolation: **ENFORCED**
- Legacy `org_id`: **ELIMINATED**
- Views aligned: **YES**
- API language aligned: **YES**

This document is the contract. Implementations may evolve. These promises do not.
