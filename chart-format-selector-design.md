# CHART FORMAT SELECTOR - WORSHIPTOOLS STYLE
# UX Pattern for Song Input & Display
# =====================================================

## WHAT WORSHIPTOOLS DOES (from screenshot)

### FORMAT OPTIONS:
**SOURCE:**
- ☑️ Chord Chart (selected in screenshot)
  - User Community source

**FORMAT:**
- ○ 1 Column
- ● 2 Columns (selected)
- ○ Lyrics

**FORMAT SETTINGS:**
- Capo: [0]
- Chart Type: [Standard ▼]

**SONG SETTINGS:**
- Edit Song →
- Key: [F ▼]
- Tempo: [-] [+] [Reset]

---

## OUR IMPLEMENTATION PLAN

### Phase 1: Chart Display Formats

When viewing/printing a song chart, offer these formats:

#### 1. **Two Column (Worship Leader View)**
```
┌──────────────────┬──────────────────┐
│ Verse 1          │ Chorus           │
│ C        G/B     │      C       G   │
│ You are here...  │ Way maker...     │
│   F         C    │ Am7         F    │
│ I worship You... │ Promise keeper...│
├──────────────────┼──────────────────┤
│ Verse 2          │ Bridge           │
│ ...              │ ...              │
└──────────────────┴──────────────────┘
```
**Best for:** Worship leaders who need to see flow at a glance

#### 2. **One Column (Musicians View)**
```
┌───────────────────────────────────┐
│ Verse 1                           │
│ C                G/B       Am7    │
│ You are here, moving in our midst│
│      F              C             │
│ I worship You, I worship You      │
│                                   │
│ Chorus                            │
│       C             G             │
│ Way maker, miracle worker         │
│ Am7              F                │
│ Promise keeper, light...          │
└───────────────────────────────────┘
```
**Best for:** Band members with music stands

#### 3. **Lyrics Only (ProPresenter)**
```
┌───────────────────────────────────┐
│ VERSE 1                           │
│ You are here, moving in our midst│
│ I worship You, I worship You      │
│                                   │
│ CHORUS                            │
│ Way maker, miracle worker         │
│ Promise keeper, light in darkness │
│ My God, that is who You are      │
└───────────────────────────────────┘
```
**Best for:** Projection/slides operators

#### 4. **Chord-only (Advanced Musicians)**
```
┌───────────────────────────────────┐
│ Verse:  C - G/B - Am7 - F - C    │
│ Chorus: C - G - Am7 - F - C/E - G│
│ Bridge: C - G - Am7 - F          │
│                                   │
│ Structure: V1, C, V2, C, B, C, C │
└───────────────────────────────────┘
```
**Best for:** Skilled players who just need the progression

---

## UI MOCKUP: Format Selector Modal

When viewing/editing a song, have a "Format" button:

```
┌─────────────────────────────────────────┐
│ Way Maker                    [Format ▼] │
├─────────────────────────────────────────┤
│ ○ Two Columns (Worship Leader)          │
│   Best for quick reference during       │
│   leading worship                        │
│                                          │
│ ● One Column (Musicians)                 │
│   Standard chord chart format            │
│                                          │
│ ○ Lyrics Only (Slides)                   │
│   For ProPresenter/projection            │
│                                          │
│ ○ Chords Only (Lead Sheet)               │
│   For advanced musicians                 │
│                                          │
│ ─────────────────────────────────        │
│                                          │
│ TRANSPOSE                                │
│ From: [C ▼]  To: [G ▼]  [Apply]         │
│                                          │
│ CAPO                                     │
│ Fret: [0 ▼]                              │
│                                          │
│ [Cancel]  [Preview]  [Print PDF]        │
└─────────────────────────────────────────┘
```

---

## DATABASE SCHEMA ADDITION

Store user/org preferences for default format:

```sql
-- Add to song_arrangements or create preferences table
CREATE TABLE chart_display_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  person_id uuid REFERENCES people(id), -- NULL = org default
  
  -- Display preferences
  default_format text DEFAULT 'one_column', -- 'one_column', 'two_column', 'lyrics_only', 'chords_only'
  show_chords boolean DEFAULT true,
  show_lyrics boolean DEFAULT true,
  
  -- Print preferences
  font_size int DEFAULT 12, -- pt
  page_size text DEFAULT 'letter', -- 'letter', 'a4'
  margins_inches decimal DEFAULT 0.5,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT unique_person_chart_prefs UNIQUE(org_id, person_id)
);
```

---

## RENDERING ENGINE

### HTML/CSS Templates

**Two Column Layout:**
```html
<div class="chart-two-column">
  <div class="column">
    <section class="verse">
      <h3>Verse 1</h3>
      <div class="line">
        <div class="chords">C      G/B     Am7</div>
        <div class="lyrics">You are here, moving...</div>
      </div>
    </section>
  </div>
  <div class="column">
    <section class="chorus">
      <h3>Chorus</h3>
      <div class="line">
        <div class="chords">C       G</div>
        <div class="lyrics">Way maker...</div>
      </div>
    </section>
  </div>
</div>
```

**CSS:**
```css
.chart-two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  font-family: 'Courier New', monospace;
}

.line {
  margin-bottom: 0.5rem;
}

.chords {
  color: #c00;
  font-weight: bold;
  white-space: pre;
}

.lyrics {
  color: #000;
  margin-top: -0.25rem;
}
```

---

## ADVANCED FEATURES (Future)

### 1. **Chart Type Selector**
Like WorshipTools' "Standard" dropdown:
- Standard (traditional chord chart)
- Nashville Numbers (1-5-6m-4)
- Lead Sheet (compact)
- Chord Symbols Only

### 2. **Capo Calculator**
```
Original Key: C
Capo: 3
Play: A shapes
Display: Shows both
```

### 3. **Tempo Adjuster**
```
Original: 72 BPM
Adjust: [-] [+]
New: 80 BPM
```

### 4. **Printing Options**
```
□ Include song info (artist, CCLI)
□ Include structure guide
□ Include notes
□ Page numbers
```

---

## USER WORKFLOW

### Scenario 1: Worship Leader preparing for Sunday
1. Opens "Way Maker" song detail
2. Clicks "Format" → Selects "Two Column"
3. Clicks "Print PDF"
4. Saves to tablet for Sunday morning

### Scenario 2: Band member needs chart
1. Receives email: "You're scheduled for Dec 21"
2. Clicks link → Goes to service detail
3. Sees setlist with "Way Maker"
4. Clicks "📄" icon → Downloads one-column chart
5. Prints and adds to binder

### Scenario 3: Slides operator
1. Goes to service detail for Sunday
2. Clicks "Lyrics Only View"
3. Sees clean lyrics without chords
4. Copies to ProPresenter

---

## IMPLEMENTATION PRIORITY

When you're ready to build this:

**Phase 1 (Basic):**
1. ✅ Store sections with chords (done!)
2. ✅ Store arrangements (done!)
3. [ ] Render one-column format (HTML)
4. [ ] Add "View Chart" button to service songs

**Phase 2 (Formats):**
5. [ ] Add format selector modal
6. [ ] Implement two-column layout
7. [ ] Implement lyrics-only view
8. [ ] Implement chords-only view

**Phase 3 (PDF):**
9. [ ] HTML → PDF conversion
10. [ ] Print formatting
11. [ ] Download/email charts

**Phase 4 (Advanced):**
12. [ ] Transposition in real-time
13. [ ] Capo calculator
14. [ ] Nashville numbers
15. [ ] User preferences storage

---

## WHY THIS MATTERS

**Different roles need different views:**
- **Worship Leader:** Quick reference (2-column)
- **Musicians:** Full detail (1-column)
- **Slides Operator:** Lyrics only
- **Advanced Players:** Chords only

**This solves:**
- "Can you send me the chart in PDF?"
- "I need this in a different key"
- "Can I get just the lyrics for ProPresenter?"
- "Do you have a lead sheet version?"

**One source, many formats** → No more maintaining separate files!

---

## NEXT STEPS

When you're ready (not now, but future):
1. I'll create the HTML/CSS chart renderer
2. Build the format selector component
3. Add transposition logic
4. Implement PDF generation

For now, focus on:
- ✅ Schema is ready
- ✅ Sample data (Way Maker) is loaded
- 🎯 Next: Build song detail page to view/edit sections

Sound good?
