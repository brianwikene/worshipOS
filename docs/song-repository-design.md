# SONG REPOSITORY & CHORD CHART SYSTEM
# Planning Center / WorshipTeams.com style functionality
# =====================================================

## CONCEPT OVERVIEW
Songs need more than metadata - they need full lyrical/musical content:
- Verse/chorus structure
- Lyrics with chord placement
- Multiple arrangements (acoustic vs full band)
- Transposition capabilities
- Print-ready formatting
- Integration into service orders

---

## DATABASE SCHEMA

### SONG_SECTIONS Table
Store verses, choruses, bridges, etc.

```sql
CREATE TABLE song_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  
  -- Section identity
  section_type text NOT NULL, -- 'verse', 'chorus', 'bridge', 'pre_chorus', 'tag', 'intro', 'outro'
  section_number int, -- v1, v2, v3 or NULL for unique sections like chorus
  label text, -- "Verse 1", "Chorus", "Bridge"
  
  -- Content
  lyrics text NOT NULL, -- Plain lyrics
  chords jsonb, -- Chord placement data (see format below)
  
  -- Metadata
  display_order int NOT NULL,
  notes text, -- "Male vocal", "Build", "Quiet"
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_song_sections_song ON song_sections(song_id, display_order);

-- Chord placement format (JSONB):
/*
{
  "lines": [
    {
      "lyrics": "You are here, moving in our midst",
      "chords": [
        {"position": 0, "chord": "C"},
        {"position": 12, "chord": "G/B"},
        {"position": 23, "chord": "Am7"}
      ]
    },
    {
      "lyrics": "I worship You, I worship You",
      "chords": [
        {"position": 2, "chord": "F"},
        {"position": 14, "chord": "C"}
      ]
    }
  ]
}
*/
```

### SONG_ARRANGEMENTS Table
Different ways to play the same song

```sql
CREATE TABLE song_arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  
  -- Arrangement details
  name text NOT NULL, -- "Standard", "Acoustic", "Extended Intro", "Simplified"
  description text,
  
  -- Musical details
  key text, -- Can override song default
  bpm int, -- Can override song default
  time_signature text, -- "4/4", "6/8", "3/4"
  
  -- Structure (order of sections)
  structure jsonb NOT NULL, -- Array of section IDs in order
  
  -- Metadata
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES people(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_song_arrangement_name UNIQUE(song_id, name)
);

CREATE INDEX idx_song_arrangements_song ON song_arrangements(song_id);

-- Structure format (JSONB):
/*
{
  "flow": [
    {"section_id": "verse1-uuid", "repeat": 1},
    {"section_id": "chorus-uuid", "repeat": 1},
    {"section_id": "verse2-uuid", "repeat": 1},
    {"section_id": "chorus-uuid", "repeat": 2},
    {"section_id": "bridge-uuid", "repeat": 1},
    {"section_id": "chorus-uuid", "repeat": 2, "notes": "Tag ending"}
  ]
}
*/
```

### SERVICE_INSTANCE_SONGS Extended
Link specific arrangements to services

```sql
-- Add columns to existing table:
ALTER TABLE service_instance_songs 
  ADD COLUMN arrangement_id uuid REFERENCES song_arrangements(id),
  ADD COLUMN transpose_steps int DEFAULT 0, -- +2 = up 2 half steps, -1 = down 1
  ADD COLUMN custom_structure jsonb; -- Override arrangement structure for this service

COMMENT ON COLUMN service_instance_songs.transpose_steps IS 'Transpose from arrangement key';
COMMENT ON COLUMN service_instance_songs.custom_structure IS 'Custom section order for this specific service';
```

---

## CHORD CHART EDITOR UI

### Input Format Options

**Option 1: ChordPro Format** (Industry standard, easy to type)
```
[C]You are here, [G/B]moving in our [Am7]midst
I [F]worship You, I [C]worship You
```

**Option 2: Inline Markdown Style**
```
You are here, moving in our midst
C           G/B         Am7

I worship You, I worship You
  F             C
```

**Option 3: Visual Editor** (Click to place chords)
- Text input with chord buttons above
- Click position → select chord → places marker

### Storage Strategy
Store as structured JSON for:
- Easy transposition
- Multiple rendering formats
- Search/indexing of lyrics

---

## RENDERING FORMATS

### 1. **Musician Chart** (Chords + Lyrics)
```
Way Maker - Key of G - 72 BPM

Verse 1:
C                    G/B              Am7
You are here, moving in our midst
         F                  C
I worship You, I worship You

Chorus:
      C                G
Way maker, miracle worker
Am7              F
Promise keeper, light in the darkness
   C/E        G
My God, that is who You are
```

### 2. **Lyrics Only** (ProPresenter/Slides)
```
VERSE 1
You are here, moving in our midst
I worship You, I worship You

CHORUS
Way maker, miracle worker
Promise keeper, light in the darkness
My God, that is who You are
```

### 3. **Lead Sheet** (Compact, one-pager)
```
WAY MAKER - Sinach - Key: G - 72 BPM

V1: C - G/B - Am7 - F - C
    You are here, moving...

C:  C - G - Am7 - F - C/E - G
    Way maker, miracle worker...

V2: [same chords as V1]
    You are here, touching every...

Structure: V1, C, V2, C, B, C, C
```

### 4. **Nashville Number System**
```
Verse: 1 - 5/7 - 6m7 - 4 - 1
Chorus: 1 - 5 - 6m7 - 4 - 1/3 - 5
```

---

## PDF GENERATION

### Technology Options

**Option 1: HTML → PDF (Easiest)**
- Generate beautiful HTML/CSS
- Use `puppeteer` or `pdfkit` to convert
- Full styling control

**Option 2: Direct PDF Generation**
- `pdfkit` library
- More control, steeper learning curve

**Recommendation:** Start with HTML → PDF

### PDF Layouts

**Single Song PDF:**
```
┌─────────────────────────────────────────┐
│  WAY MAKER                    Key: G    │
│  Sinach                       BPM: 72   │
│  CCLI: 7115744               Arr: Std   │
├─────────────────────────────────────────┤
│                                          │
│  VERSE 1                                 │
│  C              G/B          Am7         │
│  You are here, moving in our midst      │
│       F              C                   │
│  I worship You, I worship You            │
│                                          │
│  CHORUS                                  │
│        C             G                   │
│  Way maker, miracle worker               │
│  Am7              F                      │
│  Promise keeper, light in the darkness   │
│     C/E        G                         │
│  My God, that is who You are            │
│                                          │
│  [Additional sections...]                │
│                                          │
│  STRUCTURE: V1, C, V2, C, B, C, C       │
└─────────────────────────────────────────┘
```

**Service Setlist PDF (All Songs):**
```
┌─────────────────────────────────────────┐
│  SUNDAY MORNING WORSHIP                  │
│  December 21, 2025 - 9:00 AM            │
│  Worship Leader: Brian Wikene            │
├─────────────────────────────────────────┤
│                                          │
│  1. WAY MAKER (Key: G)                  │
│     [Full chord chart]                   │
│                                          │
│  2. GOODNESS OF GOD (Key: A → G)        │
│     [Full chord chart]                   │
│                                          │
│  3. GREAT ARE YOU LORD (Key: C)         │
│     [Full chord chart]                   │
└─────────────────────────────────────────┘
```

---

## TRANSPOSITION ENGINE

### Algorithm
```javascript
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeChord(chord, steps) {
  // Parse chord: "Am7/C" → root: "A", modifier: "m7", bass: "C"
  const parts = parseChord(chord);
  
  // Transpose root
  const rootIndex = CHROMATIC.indexOf(parts.root);
  const newIndex = (rootIndex + steps + 12) % 12;
  const newRoot = CHROMATIC[newIndex];
  
  // Transpose bass note if present
  const newBass = parts.bass 
    ? transposeNote(parts.bass, steps)
    : null;
  
  // Rebuild chord
  return buildChord(newRoot, parts.modifier, newBass);
}

function transposeSong(songSections, fromKey, toKey) {
  const steps = getStepsBetweenKeys(fromKey, toKey);
  
  return songSections.map(section => ({
    ...section,
    chords: section.chords.lines.map(line => ({
      ...line,
      chords: line.chords.map(c => ({
        ...c,
        chord: transposeChord(c.chord, steps)
      }))
    }))
  }));
}
```

---

## UI WORKFLOW

### Song Detail Page Flow

**URL:** `/songs/:id`

**Tabs:**
1. **Overview** - Basic info, key, BPM, artist
2. **Sections** - Add/edit verses, choruses, etc.
3. **Arrangements** - Different ways to play it
4. **History** - When/where it was used

### Sections Tab UI
```
┌─────────────────────────────────────────┐
│  SECTIONS                  [+ Add Section]│
├─────────────────────────────────────────┤
│  ▼ Verse 1                       ✏️ 🗑️   │
│     C              G/B          Am7      │
│     You are here, moving in our midst   │
│          F              C                │
│     I worship You, I worship You         │
│                                          │
│  ▼ Chorus                        ✏️ 🗑️   │
│           C             G                │
│     Way maker, miracle worker            │
│     ...                                  │
│                                          │
│  [Drag to reorder]                      │
└─────────────────────────────────────────┘
```

### Section Editor Modal
```
┌─────────────────────────────────────────┐
│  Edit Section                      [×]   │
├─────────────────────────────────────────┤
│  Type: [Verse ▼]  Number: [1]          │
│                                          │
│  Lyrics & Chords:                       │
│  ┌───────────────────────────────────┐ │
│  │ [C] You are [G/B] here, [Am7]     │ │
│  │ moving in our midst               │ │
│  │ I [F] worship You, I [C] worship  │ │
│  │                                    │ │
│  └───────────────────────────────────┘ │
│                                          │
│  Input Format: ● ChordPro  ○ Visual    │
│                                          │
│  Notes: ____________________________   │
│                                          │
│  [Cancel]  [Preview]  [Save]           │
└─────────────────────────────────────────┘
```

### Arrangements Tab UI
```
┌─────────────────────────────────────────┐
│  ARRANGEMENTS           [+ New Arrangement]│
├─────────────────────────────────────────┤
│  ● Standard (Key: G)            ✏️ 📄   │
│    V1, C, V2, C, B, C, C                │
│                                          │
│  ○ Acoustic (Key: G)            ✏️ 📄   │
│    V1, C, V2, C (simpler)               │
│                                          │
│  ○ Extended Intro (Key: G)      ✏️ 📄   │
│    Intro, V1, C, V2, C, B, C, C, Tag   │
└─────────────────────────────────────────┘
```

---

## INTEGRATION WITH SERVICES

### Adding Song to Service
When adding to service, prompt:
1. **Which arrangement?** (Standard, Acoustic, etc.)
2. **What key?** (Original or transpose)
3. **Custom structure?** (Skip verse 2, add extra chorus, etc.)

### Service Detail View
Show setlist with quick actions:
```
┌─────────────────────────────────────────┐
│  SETLIST - Dec 21, 9:00 AM              │
├─────────────────────────────────────────┤
│  1. Way Maker (G, Standard)      [📄][✏️]│
│  2. Goodness of God (A, Std)    [📄][✏️]│
│  3. Great Are You (C, Acoustic) [📄][✏️]│
│                                          │
│  [📄 Print All Charts]  [📧 Email Team] │
└─────────────────────────────────────────┘
```

---

## PHASE IMPLEMENTATION

### Phase 1: Core Structure (Immediate)
- [ ] Create `song_sections` table
- [ ] Create `song_arrangements` table
- [ ] Build song detail page
- [ ] Build section editor (ChordPro format)
- [ ] Display chord chart (HTML)

### Phase 2: Arrangements & Transposition (Near term)
- [ ] Arrangement builder UI
- [ ] Transposition engine
- [ ] Link arrangements to services
- [ ] Preview transposed charts

### Phase 3: PDF Generation (Medium term)
- [ ] HTML → PDF conversion
- [ ] Single song PDF
- [ ] Full setlist PDF
- [ ] Print formatting options

### Phase 4: Advanced Features (Long term)
- [ ] Nashville number system
- [ ] Audio/video attachments
- [ ] Notation integration (optional)
- [ ] Mobile app chord view

---

## EXAMPLE: Full Data Model

**Song:** Way Maker

**Metadata (songs table):**
```json
{
  "id": "uuid",
  "title": "Way Maker",
  "artist": "Sinach",
  "key": "G",
  "bpm": 72,
  "ccli_number": "7115744"
}
```

**Sections (song_sections table):**
```json
[
  {
    "id": "v1-uuid",
    "section_type": "verse",
    "section_number": 1,
    "label": "Verse 1",
    "lyrics": "You are here, moving in our midst\nI worship You, I worship You",
    "chords": {
      "lines": [
        {
          "lyrics": "You are here, moving in our midst",
          "chords": [
            {"position": 0, "chord": "C"},
            {"position": 12, "chord": "G/B"},
            {"position": 23, "chord": "Am7"}
          ]
        },
        {
          "lyrics": "I worship You, I worship You",
          "chords": [
            {"position": 2, "chord": "F"},
            {"position": 14, "chord": "C"}
          ]
        }
      ]
    }
  },
  {
    "id": "chorus-uuid",
    "section_type": "chorus",
    "label": "Chorus",
    "lyrics": "Way maker, miracle worker...",
    "chords": {...}
  }
]
```

**Arrangement (song_arrangements table):**
```json
{
  "id": "standard-uuid",
  "name": "Standard",
  "key": "G",
  "structure": {
    "flow": [
      {"section_id": "v1-uuid", "repeat": 1},
      {"section_id": "chorus-uuid", "repeat": 1},
      {"section_id": "v2-uuid", "repeat": 1},
      {"section_id": "chorus-uuid", "repeat": 2}
    ]
  }
}
```

---

## NEXT STEPS

**What should I build first?**

1. **Database schema** for sections & arrangements
2. **Song detail page** with tabs (overview, sections, arrangements)
3. **Section editor** with ChordPro input
4. **Chord chart renderer** (HTML display)

Which would be most useful to start with?
