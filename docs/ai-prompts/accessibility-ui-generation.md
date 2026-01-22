// /docs/ai-prompts/accessibility-ui-generation.md
# AI Prompts — Accessibility-First UI Generation (WorshipOS)

These prompts are used when generating UI code with Copilot, Claude, or similar AI tools.

They enforce WorshipOS’s **Accessible-by-Construction Baseline**:
- Semantic HTML first
- Keyboard works by default
- Visible, predictable focus
- Labeled inputs
- No focus on page load
- No “UI that lies”

AI output is treated as a **draft**, but these prompts are designed to prevent refactoring.

---

## Core Rule

If AI-generated UI code causes repeated accessibility or framework warnings,
**the prompt is wrong — not the review process**.

Fix the prompt. Regenerate. Do not patch bad structure.

---

## Global Prompt Footer (Always Include)

Paste this at the **end of every UI-related AI request**:

> **WorshipOS Accessibility Definition of Done (MVP Baseline)**
> - Use semantic HTML elements (`button`, `a`, `label`, `input`, `select`, `textarea`, `nav`, `main`, `section`, `header`).
> - No `div` or `span` used as interactive elements.
> - No `role="button"` or `tabindex` hacks unless semantic HTML is impossible (rare; explain if used).
> - Keyboard navigation must work for the entire flow.
> - Focus must be visible and predictable.
> - Do NOT move focus on page load.
> - Inputs must have real labels (placeholder text is not a label).
> - Use ARIA only when semantic HTML cannot express the intent.
> - Output code that already conforms to these rules.

If any rule is violated, regenerate the code.

---

## Prompt — New UI Component

> Generate a Svelte component for the following UI.
>
> **Purpose:**
> [One-sentence description]
>
> **User:**
> A non-technical, potentially stressed church admin.
>
> **Requirements:**
> - Semantic HTML only
> - Native browser behavior by default
> - Full keyboard usability
> - Visible focus styles
> - No auto-focus on load
> - Calm, obvious UI (no visual gimmicks)
>
> **Framework Context:**
> - SvelteKit
> - Tailwind allowed
> - No third-party UI abstractions unless unavoidable
>
> [PASTE GLOBAL PROMPT FOOTER]

---

## Prompt — Form Generation

> Generate a semantic, accessible form.
>
> **Purpose:**
> [What the form does]
>
> **Fields:**
> - [Name + type]
> - [Name + type]
>
> **Validation Rules:**
> [If any]
>
> **Accessibility Requirements:**
> - Every field has an associated `<label>`
> - Required fields are clearly indicated
> - Validation errors are tied to fields (`aria-describedby`)
> - Keyboard-only users can complete the form
> - No focus movement on initial load
>
> **UX Tone:**
> Calm, forgiving, predictable.
>
> [PASTE GLOBAL PROMPT FOOTER]

---

## Prompt — Refactor Existing UI

> Refactor the following UI code to meet WorshipOS’s accessibility baseline.
>
> **Goals:**
> - Replace non-semantic elements with proper semantic HTML
> - Remove div-based interactivity
> - Ensure keyboard-first usability
> - Preserve behavior while fixing structure
>
> [PASTE GLOBAL PROMPT FOOTER]
