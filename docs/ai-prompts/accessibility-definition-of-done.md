# Accessibility — Definition of Done (MVP Baseline)

This DoD enforces WorshipOS’s **Accessible-by-Construction Baseline**.

Applies to:
- All MVP screens (no exceptions)
- All shared UI components
- Human-written and AI-generated code

---

## Non-Negotiable Rules (Blockers)

If any of these fail, the work is **not done**.

### 1. Semantic by Default
- Buttons use `<button>`
- Links use `<a href>`
- Inputs are real form controls
- No div/span click handlers
- No ARIA used to replace correct elements

---

### 2. Keyboard-First Success
- All primary actions reachable by keyboard
- Logical tab order
- No keyboard traps
- Escape closes dialogs/menus (if used)

---

### 3. Focus Behavior
- Focus is always visible
- No focus on page load
- Focus moves only for:
  - Opening/closing dialogs
  - Explicit user action
  - Error correction flows

---

### 4. Labels Are Real
- Every input has a `<label>`
- Placeholder text is **not** a label
- `aria-label` only when visible labels are impossible

---

### 5. Structure Reflects Meaning
- Landmarks used appropriately (`main`, `nav`, etc.)
- Headings follow logical hierarchy
- No decorative misuse of headings

---

### 6. The System Never Lies
- Disabled controls are actually disabled
- Clickable-looking things are clickable
- Loading states block ghost actions

---

## Validation & Errors

- Errors are readable and associated with fields
- Required fields are clearly indicated
- No surprise focus jumps

---

## Manual 2-Minute Check (Required)

Before merge:
1. Complete the flow using keyboard only
2. Confirm focus visibility everywhere
3. Verify labels exist
4. Check nothing “looks interactive” but isn’t

Fail any → not done.

---

## AI Code Rule

If AI-generated code violates this DoD:
- **Regenerate**
- Do not patch structural mistakes

---

## Revisit Criteria

Raise the bar (WCAG AA targeting) when:
- External requirement appears
- Complex UI patterns are introduced
- Repeated accessibility signals accumulate
