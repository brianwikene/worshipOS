# Formation Visibility and Permissions

This document describes how formation data is modeled and exposed within WorshipOS.

## Core Principles

- Formation data is **role-scoped**, not person-defining.
- Visibility is **contextual**, not global.
- Interpretation remains **relational**, not algorithmic.

The system is designed to resist misuse even if additional features are added later.

## Formation Records

A formation record represents completion of a specific orientation, class, or training required for a ministry responsibility.

Formation records:
- Do not imply authority
- Do not imply spiritual maturity
- Do not imply readiness to lead
- Are not achievements or badges

## Role-Based Visibility (RBAC)

Formation records are visible only to roles for whom the data is operationally relevant.

Examples:
- Volunteer Coordinators may view formation relevant to scheduling and placement
- Ministry Overseers may view formation required for their teams
- Small Group Leaders may not see unrelated formation data
- General users never see formation data for others

No role has blanket access to all formation data by default.

## Pull-Based Access

Formation data is accessed intentionally and contextually.

- The system does not broadcast formation completion
- There are no notifications or announcements
- Data appears only when a permitted leader views a person record

This protects dignity and prevents social comparison.

## Non-Goals

WorshipOS explicitly will not:
- Auto-approve leadership based on formation
- Rank or score formation completion
- Display formation publicly
- Recommend “next steps” based on formation
- Infer calling, maturity, or trajectory

If a feature request implies any of the above, it should be rejected or redirected.

## Summary

Formation data exists to support safe, aligned ministry—not to define people.

Permissions and visibility rules are a theological constraint, not merely a technical one.
