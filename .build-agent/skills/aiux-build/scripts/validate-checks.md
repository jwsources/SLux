# Component validation checks

Ported from `validate-component.js` (428 lines, pack v2.6.0). **All 30 checks, verbatim in intent.**

**Why this is a checklist and not a `run_script` asset:** the original is `readFileSync(filePath)` plus
substring and regex matching on local source text. It never touches the instance, so there is nothing for
`run_script` to run. Apply these with `fs_grep` + a read of the file, and `run_diagnostics` for type/syntax.

🛑 **Every detector below is a SUBSTRING or REGEX test, not an AST analysis — so each hit is a LEAD, and
each miss is NOT proof.** Several are knowingly crude: *"addEventListener in Render"* fires when both
strings appear anywhere in the file, not when one is inside the other. **Read the file before recording any
verdict**, and say when a hit was a false positive rather than silently dropping it.

**Severity contract:** the original exits non-zero when any **ISSUE** exists; warnings and suggestions do
not fail it. Report counts per severity with the itemised findings — a bare total is theatre.

## ISSUES — must fix (8)

| # | Check | Detector | Fix |
| --- | --- | --- | --- |
| 1 | Missing Lit import | no `from 'lit'` / `from "lit"` | add `import {html, css} from 'lit';` |
| 2 | Invalid base class | none of `extends AIUXWidgetElement`, `extends WithData`, `extends LitElement` | extend the project's base class — see the override below |
| 3 | Missing `render()` | no `render()` | add `render()` returning `` html`` `` |
| 4 | Missing `super()` | `constructor()` present without `super()` | `super()` first line |
| 5 | `server.get()` without AIUXWidgetElement | `this.server.get` present but class extends neither `AIUXWidgetElement` nor `WithData` | `this.server` exists only on those |
| 6 | Async render | `async render()` | `render()` must not be async — hold async data in state |
| 7 | Missing `super.connectedCallback()` | `connectedCallback` present without `super.connectedCallback()` | first line of the callback |
| 8 | Missing `super.disconnectedCallback()` | `disconnectedCallback` present without `super.disconnectedCallback()` | first line of the callback |

## WARNINGS (13)

| # | Check | Detector |
| --- | --- | --- |
| 9 | No reactive properties | neither `static properties` nor `static get properties` |
| 10 | No HTML template | `render()` present but no `` html` `` |
| 11 | Inline styles | `style="` or `style='` |
| 12 | Clickable div without role | (`click` or `@click`) + `<div` + no `role=` |
| 13 | Missing alt text | `<img` without `alt=` |
| 14 | Input without label | `<input` with neither `<label` nor `aria-label` |
| 15 | addEventListener in render | `addEventListener` + `render()` both present → use `@event` in the template |
| 16 | DOM query in render | `querySelector` + `render()` both present → use reactive properties |
| 17 | Missing i18n import | `` html` `` present but no `i18n` imported from `@servicenow/aiux-services` |
| 18 | i18n imported, never used | i18n import present but no `i18n.getMessage` |
| 19 | Missing `disconnectedCallback` | (`addEventListener` or `recordWatcherService`/`subscribe(`) with no `disconnectedCallback` |
| 20 | Window listener not cleaned up | `window.addEventListener` without `removeEventListener` |
| 21 | Record watcher not cleaned up | `recordWatcherService`/`subscribe(` with neither `_unsub` nor `unsubscribe` |

## SUGGESTIONS (9)

| # | Check | Detector |
| --- | --- | --- |
| 22 | Consider AIUXWidgetElement | `extends LitElement` only |
| 23 | No static styles | neither `static styles` nor `static get styles` |
| 24 | Missing `:host` | `static styles` present without `:host` → add `:host { display: block; height: 100%; }` |
| 25 | Hardcoded colours | `static styles` + `/(?:color\|background):\s*(?:#[0-9a-fA-F]{3,8}\b\|(?:rgb\|rgba\|hsl\|hsla)\s*\(\|(?:white\|black\|red\|blue\|green\|gray\|grey)\b)/` **and** no `var(--` anywhere |
| 26 | Inline SVG | `<svg` + `viewBox` → use `<aiux-icon name="…" size="sm">` |
| 27 | Keyboard accessibility | `@click` with no `@keydown`/`@keyup` and no `<button` |
| 28 | Manual `requestUpdate()` | `this.requestUpdate()` — reactive properties update automatically |
| 29 | Bind handlers in constructor | `window.addEventListener` without `/this\._\w+\s*=\s*this\._\w+\.bind\(this\)/` — add/remove need the *same* reference |
| 30 | Hardcoded user-facing string | `` html` `` + no `i18n.getMessage` + any of `/>\s*Loading\s*</`, `Error`, `No items? (found)?`, `Saved?`, `Cancel`, `Submit`, `Delete`, `Retry` in the same `>text<` form |

## ⚠️ PROJECT OVERRIDES — `AGENTS.md` wins over checks 2, 5, 22, 25

- **Base class:** this app's rule is `AIUXElement` from `@servicenow/aiux/aiux-components-core`, **never
  `LitElement`**. The pack's checks look for `AIUXWidgetElement`/`WithData`, so check 2 can pass a file that
  violates the project rule, and flag one that honours it. Grep for the project's base class as well.
- **Styling:** Tailwind + DaisyUI, **no `--now-*` tokens**. So check 25's advice to reach for
  `var(--color-surface)` is right in spirit, but the token family must be the DaisyUI one
  (`--color-base-100`, `--radius-box`) — not Horizon. Hint `aiux-lookalike-daisyui-lit` has the v4→v5
  renames; the daisyUI 4 names are dead.
- **SSR:** add a check the original lacks — browser globals (`window`, `document`, `localStorage`) must be
  guarded by `isServer` from `lit`. See `references/foundation/ssr-safety.md`.
- **Element naming:** custom element tags are prefixed with this app's scope (kebab-cased) to avoid
  colliding with the host or another extension.

## Related

`references/quality/validation-rules.md` and `references/quality/best-practices-checklist.md` (P1–P48) are
the authoritative prose. The ESLint plugins (`@servicenow/eslint-plugin-aiux-{a11y,app,i18n,ssr,style}`)
are installed as devDependencies and enforce much of this — the **user** can run `pnpm lint`; you cannot.
Say that rather than implying you ran it.
