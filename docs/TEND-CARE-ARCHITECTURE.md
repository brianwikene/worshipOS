// /docs/TEND-CARE-ARCHITECTURE.md
# WorshipOS — TEND/CARE Architecture

## The One Rule

> **TEND notices. CARE responds.**

If a feature proposal violates this sentence, it's either in the wrong module or doing too much too early.

## Quick Reference

| Aspect | TEND | CARE |
|--------|------|------|
| Purpose | Signal layer | Case container |
| Answers | "Who might need attention?" | "What are we doing about this?" |
| Visibility | Broad (leaders, dashboards) | Restricted (need-to-know) |
| Contains | Patterns, thresholds, flags | Notes, ownership, history |
| Sensitivity | Low (no narratives) | High (pastoral content) |
| Persistence | Transient signals | Permanent record |

## The Handoff

```
TEND detects pattern
    ↓
"Create Care Case?" (UI action)
    ↓
Care case created (source = 'tend')
    ↓
TEND's job is done — no further involvement
```

Care outcomes may indirectly affect TEND observations later, but CARE never writes to TEND.

## What This Means for Development

### Schema
- No Care notes in Tend tables
- No Tend tables updated by Care workflows  
- No shared mutable state
- Allowed: `care_cases.source = 'tend'`, `care_cases.source_signal_id`

### Permissions
- TEND can be broadly visible
- CARE must be tightly locked (RLS/RBAC)
- Keep permission logic separate — don't entangle

### UI
- TEND: dashboards, soft flags, nudges
- CARE: case management, notes, follow-up tracking

## Files

- `TEND.md` — Full signal layer documentation
- `CARE.md` — Full case container documentation

## Philosophy

Soul care over logistics. We build for pastors, not project managers.

TEND helps leaders *see*. CARE helps them *act*. The boundary keeps both systems honest.
