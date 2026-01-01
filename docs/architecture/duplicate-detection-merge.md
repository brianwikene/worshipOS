# Duplicate Detection & Merge System

## Design Principles

1. **The system never lies** - All history is preserved; merges are reversible
2. **Soft before hard** - Link as possible duplicate before merging
3. **Explainable** - Every match has human-readable reasons
4. **MVP-first** - Smallest useful system that is safe

---

## 1. Data Model

### 1.1 Person Table Additions

```sql
-- Add to existing people table
ALTER TABLE people ADD COLUMN IF NOT EXISTS
  canonical_id UUID REFERENCES people(id) ON DELETE SET NULL;
  -- Points to the "survivor" record after merge. NULL = this is canonical.

ALTER TABLE people ADD COLUMN IF NOT EXISTS
  merged_at TIMESTAMPTZ;
  -- When this record was merged into another. NULL = active record.

ALTER TABLE people ADD COLUMN IF NOT EXISTS
  legal_first_name VARCHAR(100);
  -- Legal name for official documents (birth certificate, background checks)

ALTER TABLE people ADD COLUMN IF NOT EXISTS
  legal_last_name VARCHAR(100);
  -- Legal name for official documents

-- Index for finding merged records
CREATE INDEX idx_people_canonical ON people(canonical_id) WHERE canonical_id IS NOT NULL;
CREATE INDEX idx_people_merged ON people(merged_at) WHERE merged_at IS NOT NULL;
```

### 1.2 IdentityLink Table (Soft Links)

```sql
CREATE TABLE identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),

  -- The two people being linked (person_a_id < person_b_id to prevent duplicates)
  person_a_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  -- Link status
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  -- 'suggested' = system detected, pending review
  -- 'confirmed' = admin confirmed as same person (pre-merge)
  -- 'not_match' = admin confirmed NOT same person
  -- 'merged' = these records have been merged

  -- Scoring & explanation
  confidence_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
  match_reasons JSONB NOT NULL DEFAULT '[]',
  -- Example: [{"field": "email", "reason": "Exact email match", "weight": 40}]

  -- Detection metadata
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by VARCHAR(50) NOT NULL DEFAULT 'system',
  -- 'system' = auto-detected, 'import:filename' = during import, 'manual' = admin created

  -- Review metadata
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES people(id),
  review_notes TEXT,

  -- Prevent re-suggesting after "not a match"
  suppressed_until TIMESTAMPTZ, -- NULL = not suppressed, timestamp = don't re-suggest until

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT identity_links_ordered CHECK (person_a_id < person_b_id),
  CONSTRAINT identity_links_unique UNIQUE (church_id, person_a_id, person_b_id),
  CONSTRAINT identity_links_status CHECK (status IN ('suggested', 'confirmed', 'not_match', 'merged'))
);

CREATE INDEX idx_identity_links_church ON identity_links(church_id);
CREATE INDEX idx_identity_links_person_a ON identity_links(person_a_id);
CREATE INDEX idx_identity_links_person_b ON identity_links(person_b_id);
CREATE INDEX idx_identity_links_pending ON identity_links(church_id, status)
  WHERE status IN ('suggested', 'confirmed');
```

### 1.3 MergeEvent Table (Audit Log)

```sql
CREATE TABLE merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),

  -- The merge operation
  survivor_id UUID NOT NULL REFERENCES people(id),
  -- The record that remains active

  merged_ids UUID[] NOT NULL,
  -- Array of person IDs that were merged into survivor (can merge multiple at once)

  -- Complete snapshot for undo
  merged_snapshots JSONB NOT NULL,
  -- Full copy of each merged record at time of merge:
  -- { "uuid-1": { "first_name": "...", "contact_methods": [...], ... }, ... }

  -- Field resolution decisions
  field_resolutions JSONB NOT NULL,
  -- Which fields came from which source:
  -- { "first_name": {"source": "survivor", "value": "John"},
  --   "email": {"source": "uuid-merged", "value": "john@example.com"} }

  -- Audit trail
  performed_by UUID NOT NULL REFERENCES people(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT, -- Optional admin note

  -- Undo tracking
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES people(id),
  undo_reason TEXT,

  -- Link back to identity_link that triggered this (optional)
  identity_link_id UUID REFERENCES identity_links(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merge_events_church ON merge_events(church_id);
CREATE INDEX idx_merge_events_survivor ON merge_events(survivor_id);
CREATE INDEX idx_merge_events_merged ON merge_events USING GIN(merged_ids);
CREATE INDEX idx_merge_events_recent ON merge_events(church_id, performed_at DESC);
```

### 1.4 PersonAlias Table (Name Variations)

```sql
-- Track all name variations for a person (for matching and display)
CREATE TABLE person_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  alias_type VARCHAR(20) NOT NULL,
  -- 'legal', 'preferred', 'maiden', 'nickname', 'typo', 'merged'

  first_name VARCHAR(100),
  last_name VARCHAR(100),

  -- Where this alias came from
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  -- 'manual', 'merge:uuid', 'import:filename'

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT person_aliases_type CHECK (
    alias_type IN ('legal', 'preferred', 'maiden', 'nickname', 'typo', 'merged')
  )
);

CREATE INDEX idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX idx_person_aliases_name ON person_aliases(church_id, LOWER(last_name), LOWER(first_name));
```

---

## 2. Duplicate Finder Algorithm

### 2.1 Candidate Generation (Blocking)

To avoid O(n²) comparisons, we use "blocking" - only compare records that share a blocking key.

```typescript
// Blocking keys for a person - generates multiple keys per person
function generateBlockingKeys(person: Person): string[] {
  const keys: string[] = [];

  // 1. Soundex of last name (catches Wikene/Wilkene)
  if (person.last_name) {
    keys.push(`soundex:${soundex(person.last_name)}`);
  }

  // 2. First 3 chars of last name + first char of first name
  if (person.last_name && person.first_name) {
    keys.push(`prefix:${person.last_name.slice(0,3).toLowerCase()}${person.first_name[0].toLowerCase()}`);
  }

  // 3. Email domain (people often have multiple emails at same domain)
  for (const cm of person.contact_methods || []) {
    if (cm.type === 'email') {
      const domain = cm.value.split('@')[1]?.toLowerCase();
      if (domain && !isCommonDomain(domain)) {
        keys.push(`email_domain:${domain}`);
      }
    }
  }

  // 4. Phone number (last 7 digits, normalized)
  for (const cm of person.contact_methods || []) {
    if (cm.type === 'phone') {
      const digits = cm.value.replace(/\D/g, '').slice(-7);
      if (digits.length === 7) {
        keys.push(`phone:${digits}`);
      }
    }
  }

  // 5. Family membership (same family = worth checking)
  for (const familyId of person.family_ids || []) {
    keys.push(`family:${familyId}`);
  }

  return [...new Set(keys)]; // dedupe
}

const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
function isCommonDomain(domain: string): boolean {
  return COMMON_DOMAINS.includes(domain);
}
```

### 2.2 Scoring System

```typescript
interface MatchReason {
  field: string;
  reason: string;
  weight: number;
  details?: string;
}

interface MatchResult {
  personA: string;
  personB: string;
  score: number;
  reasons: MatchReason[];
}

function scorePair(a: Person, b: Person): MatchResult {
  const reasons: MatchReason[] = [];

  // === EXACT MATCHES (high confidence) ===

  // Email exact match (strongest signal)
  const aEmails = getEmails(a).map(e => e.toLowerCase());
  const bEmails = getEmails(b).map(e => e.toLowerCase());
  const sharedEmails = aEmails.filter(e => bEmails.includes(e));
  if (sharedEmails.length > 0) {
    reasons.push({
      field: 'email',
      reason: 'Exact email match',
      weight: 45,
      details: sharedEmails[0]
    });
  }

  // Phone exact match
  const aPhones = getPhones(a).map(normalizePhone);
  const bPhones = getPhones(b).map(normalizePhone);
  const sharedPhones = aPhones.filter(p => bPhones.includes(p));
  if (sharedPhones.length > 0) {
    reasons.push({
      field: 'phone',
      reason: 'Exact phone match',
      weight: 40,
      details: sharedPhones[0]
    });
  }

  // === NAME MATCHING ===

  // Last name exact
  if (a.last_name && b.last_name) {
    if (a.last_name.toLowerCase() === b.last_name.toLowerCase()) {
      reasons.push({
        field: 'last_name',
        reason: 'Exact last name match',
        weight: 15
      });
    } else if (jaroWinkler(a.last_name, b.last_name) > 0.9) {
      reasons.push({
        field: 'last_name',
        reason: 'Similar last name (possible typo)',
        weight: 10,
        details: `${a.last_name} ≈ ${b.last_name}`
      });
    }
  }

  // First name exact or nickname
  if (a.first_name && b.first_name) {
    if (a.first_name.toLowerCase() === b.first_name.toLowerCase()) {
      reasons.push({
        field: 'first_name',
        reason: 'Exact first name match',
        weight: 10
      });
    } else if (areNicknames(a.first_name, b.first_name)) {
      reasons.push({
        field: 'first_name',
        reason: 'Known nickname pair',
        weight: 8,
        details: `${a.first_name} ↔ ${b.first_name}`
      });
    }
  }

  // Goes-by contains last name detection ("AJ Jordan" where last name is "Jordan")
  const goesByIssue = detectGoesByLastNameIssue(a, b);
  if (goesByIssue) {
    reasons.push(goesByIssue);
  }

  // === ADDRESS MATCHING ===
  const addressMatch = compareAddresses(a, b);
  if (addressMatch) {
    reasons.push(addressMatch);
  }

  // === FAMILY MATCHING ===
  if (shareFamily(a, b)) {
    reasons.push({
      field: 'family',
      reason: 'Same family membership',
      weight: 5,
      details: 'Both in same family group'
    });
  }

  // === CALCULATE FINAL SCORE ===
  const totalWeight = reasons.reduce((sum, r) => sum + r.weight, 0);
  const score = Math.min(100, totalWeight);

  return {
    personA: a.id,
    personB: b.id,
    score,
    reasons
  };
}
```

### 2.3 Goes-By / Last Name Detection

This catches "AJ Jordan Jordan" cases where the goes_by field contains the last name.

```typescript
function detectGoesByLastNameIssue(a: Person, b: Person): MatchReason | null {
  // Check if one person's goes_by contains the other's last name
  // This catches: "AJ Jordan" (goes_by) vs "Armani Jordan" (full name)

  const checks = [
    { goesByPerson: a, fullPerson: b },
    { goesByPerson: b, fullPerson: a }
  ];

  for (const { goesByPerson, fullPerson } of checks) {
    const goesBy = goesByPerson.goes_by?.toLowerCase() || '';
    const lastName = fullPerson.last_name?.toLowerCase() || '';
    const firstName = fullPerson.first_name?.toLowerCase() || '';

    if (!goesBy || !lastName) continue;

    // Split goes_by into parts
    const goesByParts = goesBy.split(/\s+/);

    for (const part of goesByParts) {
      // Exact match
      if (part === lastName) {
        // Check if first part of goes_by matches first name or its initial
        const goesByFirst = goesByParts[0];
        if (goesByFirst === firstName ||
            goesByFirst === firstName[0] ||
            areNicknames(goesByFirst, firstName)) {
          return {
            field: 'goes_by',
            reason: 'Goes-by appears to include last name',
            weight: 25,
            details: `"${goesByPerson.goes_by}" matches "${fullPerson.first_name} ${fullPerson.last_name}"`
          };
        }
      }

      // Fuzzy match for typos (Jrdan vs Jordan)
      if (jaroWinkler(part, lastName) > 0.85 && part.length >= 3) {
        const goesByFirst = goesByParts[0];
        if (areNicknames(goesByFirst, firstName) ||
            goesByFirst[0] === firstName[0]) {
          return {
            field: 'goes_by',
            reason: 'Goes-by may include misspelled last name',
            weight: 20,
            details: `"${part}" ≈ "${lastName}"`
          };
        }
      }
    }
  }

  return null;
}

// Common nickname mappings
const NICKNAMES: Record<string, string[]> = {
  'william': ['will', 'bill', 'billy', 'willy', 'liam'],
  'robert': ['rob', 'bob', 'bobby', 'robbie'],
  'james': ['jim', 'jimmy', 'jamie'],
  'michael': ['mike', 'mikey', 'mick'],
  'elizabeth': ['liz', 'lizzy', 'beth', 'betty', 'eliza'],
  'jennifer': ['jen', 'jenny', 'jenn'],
  'katherine': ['kate', 'katie', 'kathy', 'kat'],
  'christopher': ['chris', 'topher'],
  'anthony': ['tony', 'ant'],
  'armani': ['aj', 'mani'],
  'alexander': ['alex', 'al', 'xander'],
  'benjamin': ['ben', 'benji', 'benny'],
  'daniel': ['dan', 'danny'],
  'joseph': ['joe', 'joey'],
  'joshua': ['josh'],
  'matthew': ['matt', 'matty'],
  'nicholas': ['nick', 'nicky'],
  'richard': ['rick', 'ricky', 'dick'],
  'samuel': ['sam', 'sammy'],
  'thomas': ['tom', 'tommy'],
  'margaret': ['maggie', 'meg', 'peggy', 'marge'],
  'patricia': ['pat', 'patty', 'trish'],
  'rebecca': ['becky', 'becca'],
  'stephanie': ['steph', 'stephie'],
  'victoria': ['vicky', 'tori'],
};

function areNicknames(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();

  if (n1 === n2) return true;

  // Check direct mappings
  for (const [formal, nicks] of Object.entries(NICKNAMES)) {
    const allNames = [formal, ...nicks];
    if (allNames.includes(n1) && allNames.includes(n2)) {
      return true;
    }
  }

  // Check if one is initial of the other
  if (n1.length === 1 && n2.startsWith(n1)) return true;
  if (n2.length === 1 && n1.startsWith(n2)) return true;

  // Check if one is prefix of other (min 2 chars)
  if (n1.length >= 2 && n2.startsWith(n1)) return true;
  if (n2.length >= 2 && n1.startsWith(n2)) return true;

  return false;
}
```

### 2.4 Full Detection Pipeline

```typescript
interface DuplicateCandidate {
  personId: string;
  matchedPersonId: string;
  score: number;
  reasons: MatchReason[];
}

async function findDuplicatesForChurch(
  churchId: string,
  options: {
    minScore?: number;      // Default 50
    limit?: number;         // Default 100
    includeExisting?: boolean; // Include already-linked pairs
  } = {}
): Promise<DuplicateCandidate[]> {
  const { minScore = 50, limit = 100, includeExisting = false } = options;

  // 1. Load all active people for church
  const people = await loadActivePeople(churchId);

  // 2. Build blocking index
  const blockingIndex = new Map<string, Person[]>();
  for (const person of people) {
    const keys = generateBlockingKeys(person);
    for (const key of keys) {
      if (!blockingIndex.has(key)) {
        blockingIndex.set(key, []);
      }
      blockingIndex.get(key)!.push(person);
    }
  }

  // 3. Generate candidate pairs (from blocking)
  const candidatePairs = new Set<string>();
  for (const [key, blocked] of blockingIndex) {
    if (blocked.length < 2 || blocked.length > 50) continue; // Skip too large blocks

    for (let i = 0; i < blocked.length; i++) {
      for (let j = i + 1; j < blocked.length; j++) {
        const [idA, idB] = [blocked[i].id, blocked[j].id].sort();
        candidatePairs.add(`${idA}:${idB}`);
      }
    }
  }

  // 4. Load existing identity links (to exclude or include)
  const existingLinks = await loadExistingLinks(churchId);
  const existingPairs = new Set(
    existingLinks.map(l => `${l.person_a_id}:${l.person_b_id}`)
  );

  // 5. Score each candidate pair
  const results: DuplicateCandidate[] = [];
  const personMap = new Map(people.map(p => [p.id, p]));

  for (const pairKey of candidatePairs) {
    // Skip if already linked (unless includeExisting)
    if (!includeExisting && existingPairs.has(pairKey)) continue;

    const [idA, idB] = pairKey.split(':');
    const personA = personMap.get(idA)!;
    const personB = personMap.get(idB)!;

    const match = scorePair(personA, personB);

    if (match.score >= minScore) {
      results.push({
        personId: idA,
        matchedPersonId: idB,
        score: match.score,
        reasons: match.reasons
      });
    }
  }

  // 6. Sort by score descending, limit results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
```

---

## 3. UI Flow

### 3.1 Duplicate Review Dashboard

**Location:** `/admin/duplicates`

```
┌─────────────────────────────────────────────────────────────────┐
│  Potential Duplicates (23 pending review)                       │
├─────────────────────────────────────────────────────────────────┤
│  [Filter: All | High Confidence | Needs Review | Confirmed]     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 95% Match                                        [Review]│   │
│  │ ┌─────────────┐     ┌─────────────┐                     │   │
│  │ │ AJ Jordan   │ <─> │ Armani Jordan │                   │   │
│  │ │ aj@email.com│     │ aj@email.com  │                   │   │
│  │ └─────────────┘     └─────────────────┘                 │   │
│  │ Reasons:                                                │   │
│  │ • Exact email match (aj@email.com)                      │   │
│  │ • Goes-by includes last name ("AJ Jordan" = "Armani J") │   │
│  │ • Same family membership                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 72% Match                                        [Review]│   │
│  │ ┌─────────────┐     ┌─────────────┐                     │   │
│  │ │ Brian Wikene│ <─> │ Brian Wilkene │                   │   │
│  │ │ 555-1234    │     │ 555-1234      │                   │   │
│  │ └─────────────┘     └─────────────────┘                 │   │
│  │ Reasons:                                                │   │
│  │ • Exact phone match (555-1234)                          │   │
│  │ • Similar last name (Wikene ≈ Wilkene)                  │   │
│  │ • Exact first name match                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Review Modal

When clicking [Review], show a side-by-side comparison:

```
┌─────────────────────────────────────────────────────────────────┐
│  Review Potential Duplicate                              [×]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ Person A            │    │ Person B            │            │
│  ├─────────────────────┤    ├─────────────────────┤            │
│  │ Name: AJ Jordan     │    │ Name: Armani Jordan │            │
│  │ Goes by: AJ Jordan  │    │ Goes by: -          │            │
│  │ Email: aj@email.com │    │ Email: aj@email.com │ ✓ Match    │
│  │ Phone: 555-1234     │    │ Phone: 555-1234     │ ✓ Match    │
│  │ Address: 123 Main   │    │ Address: 123 Main St│ ~ Similar  │
│  │ Family: Jordan      │    │ Family: Jordan      │ ✓ Match    │
│  │ Roles: Vocalist     │    │ Roles: -            │            │
│  │ Created: Jan 2024   │    │ Created: Mar 2024   │            │
│  └─────────────────────┘    └─────────────────────┘            │
│                                                                 │
│  Match Reasons:                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ • Exact email match: aj@email.com              (+45)   │    │
│  │ • Goes-by includes last name                   (+25)   │    │
│  │ • Same family membership                       (+5)    │    │
│  │ ──────────────────────────────────────────────────     │    │
│  │   Total Score: 75/100                                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    What would you like to do?            │   │
│  │                                                          │   │
│  │  [Not a Match]     [Link as Possible Dup]    [Merge →]  │   │
│  │                                                          │   │
│  │  □ Don't suggest this pair again                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Merge Wizard

When clicking [Merge →], show field resolution:

```
┌─────────────────────────────────────────────────────────────────┐
│  Merge Records                                    Step 2 of 3   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Choose which values to keep for the merged record:             │
│                                                                 │
│  Survivor Record: ○ AJ Jordan (older)  ● Armani Jordan (newer) │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Field          │ Value A        │ Value B     │ Keep       ││
│  ├────────────────┼────────────────┼─────────────┼────────────┤│
│  │ First Name     │ AJ             │ Armani      │ ● B  ○ A   ││
│  │ Last Name      │ Jordan         │ Jordan      │ (same)     ││
│  │ Goes By        │ AJ Jordan      │ -           │ ● A  ○ B   ││
│  │ Email          │ aj@email.com   │ aj@email.com│ (same)     ││
│  │ Phone          │ 555-1234       │ 555-1234    │ (same)     ││
│  │ Address        │ 123 Main       │ 123 Main St │ ○ A  ● B   ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ⚠ Warning: Person A has service assignments                   │
│     These will be transferred to the merged record.            │
│                                                                 │
│  The non-survivor record will be kept as an alias, preserving: │
│  • Name variations for future matching                         │
│  • Historical reference for service assignments                │
│  • Ability to undo this merge                                  │
│                                                                 │
│  Notes (optional):                                              │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Merged because both records are same person - AJ is        ││
│  │ Armani's nickname                                          ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│            [← Back]                     [Confirm Merge]         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Merge Confirmation

```
┌─────────────────────────────────────────────────────────────────┐
│  Merge Complete                                    Step 3 of 3  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Records merged successfully                                  │
│                                                                 │
│  Merged Record: Armani Jordan                                   │
│  - Preferred Name: AJ                                           │
│  - Email: aj@email.com                                          │
│  - Phone: 555-1234                                              │
│                                                                 │
│  What was transferred:                                          │
│  • 3 service assignments                                        │
│  • 1 role capability                                            │
│  • 1 family membership                                          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ ⓘ This merge can be undone from                            ││
│  │   Admin → Merge History                                    ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│         [View Person]              [Review More Duplicates]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. API Endpoints

### 4.1 List Duplicate Candidates

```
GET /api/admin/duplicates
```

Query params:
- `status`: 'suggested' | 'confirmed' | 'not_match' | 'all' (default: 'suggested')
- `min_score`: number (default: 50)
- `limit`: number (default: 50, max: 200)
- `offset`: number (default: 0)

Response:
```json
{
  "duplicates": [
    {
      "id": "uuid-link",
      "person_a": {
        "id": "uuid-a",
        "display_name": "AJ Jordan",
        "email": "aj@email.com",
        "phone": "555-1234",
        "created_at": "2024-01-15"
      },
      "person_b": {
        "id": "uuid-b",
        "display_name": "Armani Jordan",
        "email": "aj@email.com",
        "phone": "555-1234",
        "created_at": "2024-03-20"
      },
      "confidence_score": 75.00,
      "match_reasons": [
        {"field": "email", "reason": "Exact email match", "weight": 45, "details": "aj@email.com"},
        {"field": "goes_by", "reason": "Goes-by includes last name", "weight": 25},
        {"field": "family", "reason": "Same family membership", "weight": 5}
      ],
      "status": "suggested",
      "detected_at": "2024-03-21T10:00:00Z"
    }
  ],
  "total": 23,
  "limit": 50,
  "offset": 0
}
```

### 4.2 Get Duplicates for Specific Person

```
GET /api/people/:id/duplicates
```

Response: Same structure as above, filtered to pairs including this person.

### 4.3 Run Duplicate Detection (Manual Trigger)

```
POST /api/admin/duplicates/scan
```

Request:
```json
{
  "full_scan": false,  // true = all people, false = only new/updated since last scan
  "min_score": 50
}
```

Response:
```json
{
  "new_candidates": 5,
  "updated_candidates": 2,
  "scan_duration_ms": 1234
}
```

### 4.4 Update Identity Link

```
PUT /api/admin/duplicates/:id
```

Request:
```json
{
  "status": "confirmed",  // or "not_match"
  "review_notes": "Same person, different nicknames",
  "suppress_duration_days": 365  // Only for "not_match" - don't re-suggest for N days
}
```

Response:
```json
{
  "id": "uuid-link",
  "status": "confirmed",
  "reviewed_at": "2024-03-21T11:00:00Z",
  "reviewed_by": "uuid-admin"
}
```

### 4.5 Perform Merge

```
POST /api/admin/duplicates/:id/merge
```

Request:
```json
{
  "survivor_id": "uuid-b",  // Which record to keep
  "field_resolutions": {
    "first_name": "uuid-b",  // Use value from person B
    "goes_by": "uuid-a",     // Use value from person A
    "address": "uuid-b"
  },
  "reason": "Merged because AJ is Armani's nickname"
}
```

Response:
```json
{
  "merge_event_id": "uuid-merge",
  "survivor": {
    "id": "uuid-b",
    "display_name": "Armani Jordan",
    "goes_by": "AJ Jordan",
    ...
  },
  "merged_count": 1,
  "transferred": {
    "service_assignments": 3,
    "role_capabilities": 1,
    "family_memberships": 1
  }
}
```

### 4.6 List Merge History

```
GET /api/admin/merges
```

Query params:
- `limit`: number (default: 50)
- `offset`: number
- `include_undone`: boolean (default: false)

Response:
```json
{
  "merges": [
    {
      "id": "uuid-merge",
      "survivor_id": "uuid-b",
      "survivor_name": "Armani Jordan",
      "merged_names": ["AJ Jordan"],
      "merged_count": 1,
      "performed_by": "Admin Name",
      "performed_at": "2024-03-21T12:00:00Z",
      "reason": "Merged because AJ is Armani's nickname",
      "can_undo": true
    }
  ],
  "total": 15
}
```

### 4.7 Undo Merge

```
POST /api/admin/merges/:id/undo
```

Request:
```json
{
  "reason": "Merge was incorrect - these are actually two different people (twins)"
}
```

Response:
```json
{
  "success": true,
  "restored_people": [
    {
      "id": "uuid-a",
      "display_name": "AJ Jordan"
    }
  ]
}
```

---

## 5. Guardrails

### 5.1 Permissions

```typescript
// Required permissions for duplicate/merge operations
const PERMISSIONS = {
  'duplicates:view': ['admin', 'office_manager'],
  'duplicates:review': ['admin', 'office_manager'],
  'duplicates:merge': ['admin'],  // Only admins can merge
  'merges:undo': ['admin'],       // Only admins can undo
  'merges:view_history': ['admin', 'office_manager']
};
```

### 5.2 Rate Limits

```typescript
const RATE_LIMITS = {
  // Duplicate detection scan
  'POST /api/admin/duplicates/scan': {
    window: '1h',
    max: 5  // Max 5 scans per hour
  },

  // Merge operations
  'POST /api/admin/duplicates/:id/merge': {
    window: '1m',
    max: 10  // Max 10 merges per minute (prevent accidents)
  },

  // Undo operations
  'POST /api/admin/merges/:id/undo': {
    window: '1h',
    max: 20  // Max 20 undos per hour
  }
};
```

### 5.3 Preventing Repeated Suggestions

```sql
-- When marking as "not a match", set suppression period
UPDATE identity_links
SET
  status = 'not_match',
  reviewed_at = now(),
  reviewed_by = $admin_id,
  suppressed_until = now() + interval '1 year'  -- Don't suggest for 1 year
WHERE id = $link_id;

-- When querying for suggestions, exclude suppressed
SELECT * FROM identity_links
WHERE church_id = $church_id
  AND status = 'suggested'
  AND (suppressed_until IS NULL OR suppressed_until < now());
```

### 5.4 Merge Safety Checks

```typescript
async function validateMerge(survivorId: string, mergedIds: string[]): Promise<ValidationResult> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  // Check 1: Don't merge yourself
  if (mergedIds.includes(survivorId)) {
    blockers.push('Cannot merge a person with themselves');
  }

  // Check 2: Already merged records
  for (const id of mergedIds) {
    const person = await getPerson(id);
    if (person.canonical_id) {
      blockers.push(`${person.display_name} has already been merged`);
    }
  }

  // Check 3: Active service assignments (warning only)
  const assignments = await getActiveAssignments(mergedIds);
  if (assignments.length > 0) {
    warnings.push(`${assignments.length} active service assignments will be transferred`);
  }

  // Check 4: Primary contact for families
  const primaryFamilies = await getPrimaryContactFamilies(mergedIds);
  if (primaryFamilies.length > 0) {
    warnings.push(`Primary contact for ${primaryFamilies.length} families`);
  }

  // Check 5: Has login/user account
  const hasAccount = await hasUserAccount(mergedIds);
  if (hasAccount) {
    warnings.push('One or more records has a user login - account will be transferred');
  }

  return {
    valid: blockers.length === 0,
    warnings,
    blockers
  };
}
```

---

## 6. Implementation Order

### Phase 1: Data Foundation (Week 1)
1. Add columns to `people` table (canonical_id, merged_at, legal names)
2. Create `identity_links` table
3. Create `merge_events` table
4. Create `person_aliases` table
5. Write migration to create indexes

### Phase 2: Detection Algorithm (Week 1-2)
1. Implement blocking key generation
2. Implement Jaro-Winkler string similarity
3. Implement nickname matching
4. Implement goes-by/last-name detection
5. Implement scoring system
6. Write unit tests for edge cases

### Phase 3: Basic API (Week 2)
1. `GET /api/admin/duplicates` - list candidates
2. `PUT /api/admin/duplicates/:id` - update status
3. `POST /api/admin/duplicates/scan` - trigger scan
4. Add permission checks

### Phase 4: Merge API (Week 2-3)
1. `POST /api/admin/duplicates/:id/merge` - perform merge
2. Implement related record transfer (assignments, capabilities, etc.)
3. `GET /api/admin/merges` - merge history
4. `POST /api/admin/merges/:id/undo` - undo merge

### Phase 5: Admin UI (Week 3)
1. Duplicate review dashboard (`/admin/duplicates`)
2. Side-by-side comparison modal
3. Merge wizard with field resolution
4. Merge history page

### Phase 6: Polish & Safety (Week 4)
1. Add rate limiting
2. Add audit logging
3. Add suppression for "not a match"
4. Background job for periodic scanning
5. Import integration (scan after imports)

---

## 7. Testing Scenarios

### 7.1 Unit Tests for Detection

```typescript
describe('Duplicate Detection', () => {
  test('detects exact email match', () => {
    const a = { email: 'test@example.com', first_name: 'John', last_name: 'Doe' };
    const b = { email: 'test@example.com', first_name: 'Johnny', last_name: 'Doe' };
    const result = scorePair(a, b);
    expect(result.score).toBeGreaterThan(50);
    expect(result.reasons).toContainEqual(expect.objectContaining({ field: 'email' }));
  });

  test('detects goes-by containing last name', () => {
    const a = { goes_by: 'AJ Jordan', last_name: 'Jordan' };
    const b = { first_name: 'Armani', last_name: 'Jordan' };
    const result = scorePair(a, b);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ field: 'goes_by', reason: expect.stringContaining('last name') })
    );
  });

  test('detects typo in last name', () => {
    const a = { first_name: 'Brian', last_name: 'Wikene' };
    const b = { first_name: 'Brian', last_name: 'Wilkene' };
    const result = scorePair(a, b);
    expect(result.score).toBeGreaterThan(20);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ reason: expect.stringContaining('typo') })
    );
  });

  test('recognizes nicknames', () => {
    expect(areNicknames('William', 'Bill')).toBe(true);
    expect(areNicknames('AJ', 'Armani')).toBe(true);
    expect(areNicknames('Michael', 'Mike')).toBe(true);
    expect(areNicknames('John', 'Jane')).toBe(false);
  });
});
```

### 7.2 Integration Tests for Merge

```typescript
describe('Merge Operations', () => {
  test('merge transfers service assignments', async () => {
    // Setup: Create two people, one with assignments
    const personA = await createPerson({ first_name: 'AJ', last_name: 'Jordan' });
    const personB = await createPerson({ first_name: 'Armani', last_name: 'Jordan' });
    await createAssignment({ person_id: personA.id, role_id: 'vocalist' });

    // Merge A into B
    await performMerge({ survivor_id: personB.id, merged_ids: [personA.id] });

    // Verify assignment transferred
    const assignments = await getAssignments(personB.id);
    expect(assignments).toHaveLength(1);

    // Verify A is marked as merged
    const mergedPerson = await getPerson(personA.id);
    expect(mergedPerson.canonical_id).toBe(personB.id);
    expect(mergedPerson.merged_at).toBeTruthy();
  });

  test('undo merge restores original records', async () => {
    // Setup and merge
    const personA = await createPerson({ first_name: 'AJ' });
    const personB = await createPerson({ first_name: 'Armani' });
    const mergeEvent = await performMerge({ survivor_id: personB.id, merged_ids: [personA.id] });

    // Undo
    await undoMerge(mergeEvent.id);

    // Verify restored
    const restored = await getPerson(personA.id);
    expect(restored.canonical_id).toBeNull();
    expect(restored.merged_at).toBeNull();
  });
});
```

---

## 8. Future Enhancements (Post-MVP)

1. **Machine Learning Scoring** - Train on confirmed matches to improve weights
2. **Batch Merge** - Merge multiple duplicates at once
3. **Auto-Merge** - For very high confidence matches (>95%)
4. **Import Deduplication** - Check for duplicates during import before creating
5. **API for External Systems** - Allow external systems to suggest duplicates
6. **Duplicate Dashboard Widgets** - Show duplicate count on main dashboard
