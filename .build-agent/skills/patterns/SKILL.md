---
name: patterns
description: >
  Always-on index of cross-cutting UI patterns — status/severity color, truncation +
  tooltip, form validation and loading/empty/error states, RTL icon flip, and
  overflow/filter/sort controls. Use when building any UI with these behaviors, even if
  unnamed.
metadata:
  author: servicenow
  version: '2.0.0'
compatibility: Works with Claude Code, Cursor, VS Code Copilot, Windsurf, Gemini CLI, and other Agent Skills-compatible tools
license: MIT
---

# Pattern Index

---

## Trigger Index

**One-line rules are summaries only — when a trigger fires, load the full pattern file; do not apply from the one-liner alone.**

| Trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Pattern file                         | One-line rule                                                                                                                           | Class      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A field value is shown in color to convey status, severity, urgency, or category                                                                                                                                                                                                                                                                                                                                                                                                               | `references/color-systems.md`        | Semantic class, never literal hue (category palette pending in color-systems.md)                                                        | clean      |
| Any label, title, or value that can overflow its container (variable-length or data-driven text)                                                                                                                                                                                                                                                                                                                                                                                               | `references/truncation-tooltip.md`   | Clamp + tooltip, never font-shrink                                                                                                      | clean      |
| A form field or form-level area shows input validation or error feedback                                                                                                                                                                                                                                                                                                                                                                                                                       | `references/error-and-validation.md` | Inline field message or form-level banner; ARIA required                                                                                | clean      |
| A container can be in a loading, empty, or error state                                                                                                                                                                                                                                                                                                                                                                                                                                         | `references/view-states.md`          | Skeleton at Page/Stage/Pane/Panel scope; spinner at card/component scope; three-question check for empty cause; error: deferred in v0.x | moderate   |
| An icon has directional meaning (arrows, chevrons, send) that must mirror in RTL layouts                                                                                                                                                                                                                                                                                                                                                                                                       | `references/rtl-icon-flip.md`        | Intent triage first — semantic icons flip, literal/non-directional do not                                                               | moderate   |
| A control changes the _data itself_ — narrows, reorders, regroups, or replaces the rows/items on the same page. **NOT:** changes rendering density/columns/layout (→ view-display); free-text input (→ search); navigates to a new URL (→ navigation). **Placement test:** filter = multi-select pills or dropdown (never tabs); sort/group-by = dropdown; dataset-switch = tabs (only valid tab use above a collection); segmented = mutually-exclusive preset views ≤5 options, tabs above 5 | `references/view-controls.md`        | Decision matrix maps control type to affordance                                                                                         | fuzzy      |
| A set of actions, items, tabs, or content exceeds its container's visible budget (>4 actions, items/tabs don't fit, content too tall). Select strategy via `@compositions/SKILL.md` first; then load the matching mechanic: menu → `overflow-menu.md` · show-more/view-all → `overflow-show-more.md` · scroll → `overflow-scroll.md` · truncation+expand → `overflow-truncation.md`                                                                                                            | _(overflow-spec routes to mechanic)_ | `role="menu"` for menus; `aria-expanded` for in-place expansion; overflow indicators for scroll                                         | late-bound |
| _(typography-hierarchy — planned, no file yet)_                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                    | When text scale / weight / hierarchy decisions are needed, this will govern                                                             | gap        |

---

## Cross-cutting pattern references

Component sheets reference these patterns when applicable. The patterns load on-demand — not every component needs every pattern.

| Pattern       | File                                      | When to load                                                        |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Forced colors | `@accessibility`                          | Component has interactive states or color-dependent differentiation |
| i18n / l10n   | `@internationalization` / `@localization` | Component has user-visible label or message text                    |
