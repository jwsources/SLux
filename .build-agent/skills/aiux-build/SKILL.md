---
name: aiux-build
description: 'Post-scaffold development skill for AIUX apps — build pages, widgets, and components; edit, debug, and audit existing code. Use when the app already exists (aiux.json, pages/) and you need to build, modify, debug, or review it.'
metadata:
  author: servicenow
  version: '2.3.0'
compatibility: Works with Claude Code, Cursor, VS Code Copilot, Windsurf, Gemini CLI, and other Agent Skills-compatible tools
license: MIT
---

<!-- size-justification: This skill consolidates page, widget, component, SSR, styling,
     server-script, chat-integration, observability, extension, and deploy guidance into a
     single orchestrator with 28 reference files. The body cannot be split further without
     losing the mode-router pattern that routes agents to the correct reference subset. -->

# AIUX Build

> ## ⚠️ WEB IDE BOUNDARY — read before following any step below
>
> No shell exists in this IDE. Read **`AGENTS.md`** first. Corrections:
>
> - **`references/app/backend-layer.md` is superseded in full.** `pnpm run build` / `deploy` / `deploy:full`
>   are the **`build`** and **`install`** tools, and both are **user actions** — prepare the change, report it
>   ready, ask the user to run them. Never run either yourself, and never claim a change works because it
>   "would build". `pnpm run dev` has **no equivalent**: after the user installs, use `ui_diagnostics` for a
>   headless render + console + network + DOM capture.
> - **`scripts/validate-component.js` cannot run** (it is a Node CLI). All **30 of its checks** — 8 must-fix,
>   13 warnings, 9 suggestions — are ported to **`scripts/validate-checks.md`**, loadable with
>   `load_skill_resource(skill_name: "aiux-build", file_path: "scripts/validate-checks.md")`. Apply them with
>   `fs_grep` plus a read of the file. **Every detector is a substring/regex test, not AST: a hit is a lead,
>   a miss is not proof** — read the file before recording a verdict. Type and syntax defects belong to
>   `run_diagnostics`, not grep; run it on every file you change. `references/quality/validation-rules.md`
>   and `best-practices-checklist.md` remain the authoritative prose.
> - **`references/app/extensions.md` scaffold lines** (`npx @servicenow/sdk … init`, `pnpm build && deploy`)
>   are void — this project is already scaffolded. Keep its path conventions and nested-layout precedence.
> - **"check the resolved `tailwind.css` after `pnpm install`"** — dependencies are already installed;
>   `fs_read_file` it under `node_modules/` directly.
> - **"check `pnpm build` output for compilation errors"** → `run_diagnostics`; anything beyond that needs
>   the user's build.
> - **Companion skills are activated by name** with `activate_skill`: `ui-discovery`, `accessibility`,
>   `internationalization`, `localization`, and **`migrate-header-config-review`** (that is its registered
>   name — its folder is `migrate-header-config`). Their `references/` files load via `load_skill_resource`.
> - **`AGENTS.md` is authoritative on project conventions** — read it to learn which of the two mutually
>   exclusive app shapes this project is, rather than assuming either:
>
>   | Shape | `aiux.json` | Pages live in | Lifecycle module |
>   | --- | --- | --- | --- |
>   | **Extension** (scaffold default) | no `basename`, no `landing` | `src/extensions/<host_scope>/<host_route_id>/pages/<route>/page.js` | per-host `application.js`, sibling of that host's `pages/` |
>   | **Experience-owning** | `basename` + `landing` | `pages/<route>/page.js` | root `application.js` with `applicationLayout: 'aiux-nav-layout'` |
>
>   **Never both in one project.** Own pages plus `src/extensions/` pages is unsafe, not merely
>   unsupported (STRY64103259) — the own pages get silently wired into a host's experience. Converting
>   from one shape to the other is deliberate and one-way: see the conversion section below.
> - **Import specifiers depend on what `package.json` actually ships** — read it, do not assume. If the app
>   depends on the umbrella `@servicenow/aiux`, use its subpaths (`@servicenow/aiux/aiux-components-core`,
>   `@servicenow/aiux/aiux-services`, `@servicenow/aiux/aiux-components-nav`) rather than the bare package
>   names in the Key Imports table below. The bare form is for widgets resolved by the AIUX import map, and
>   is only valid where those packages are direct dependencies. Copying the table verbatim without
>   checking is a resolution failure.
> - Anything under `src/fluent/` is not this skill's subject: use `explain_fluent_doc` /
>   `search_fluent_docs`, and validate server-side field access with `run_script` before shipping it.
> - **On-instance hint records, where an instance has them, outrank this pack on platform behaviour** —
>   two-tier widget model, `content_hash`, the `maint`-role query filter on `sys_aix_widget`, cross-scope
>   create refusal, what reaches a shadow root, nav-helper ownership, DaisyUI 5 theme-variable renames.
>   Do not cite hint records by name: whether they exist is per-instance. Check `AGENTS.md` for their
>   status in this environment, and otherwise establish platform behaviour with `run_query` /
>   `keyword_search` / `semantic_search` plus a read-only `run_script` probe.
>
> ### WEB IDE — converting an extension app to own its experience
>
> The two shapes in the table above are mutually exclusive, and this IDE has **no shell**, so the normal
> `now-sdk init` route to a fresh experience-owning app is unavailable. Convert by editing source instead.
> This is one-way: do not leave the project half-converted, because the half-way state is the unsafe
> combination STRY64103259 describes.
>
> 1. **Confirm the starting shape** — `AGENTS.md`, then `aiux.json` (`basename`/`landing` present?) and
>    whether `src/extensions/` holds pages.
> 2. **`aiux.json`** — add `basename` (the route segment the app will own, serving `/aiux/<basename>/`) and
>    `landing` (its default route).
> 3. **Create `pages/<route>/page.js`** at the project root — *not* under `src/extensions/`.
> 4. **Create a root `application.js`** exporting `setup()`, with `applicationLayout: 'aiux-nav-layout'`.
> 5. **Remove `src/extensions/` entirely**, including every per-host `application.js`. Coexistence is the
>    hazard; leaving one extension page behind re-creates it.
> 6. **Hand the build and install to the user**, then have them evict the tenant cache — the effect is not
>    immediate, so a stale page is not automatically a bug.
> 7. **Verify on the instance, do not assume:** `run_query` `sys_aix_experience` for `url_suffix` equal to
>    the new `basename`, and confirm `content_hash` is non-empty (empty = no bundle, renders nothing).
>
> ⬜ **Unverified:** the full set of records the install creates for a newly owned experience was documented
> only in an on-instance hint record, which is unavailable here. Enumerate what actually appears with
> `run_query` after the user installs rather than trusting a remembered count.

Orchestrator skill for building production-quality AIUX apps. It directs the LLM to the right reference file or companion skill at each decision point.

**Prerequisite:** App scaffold exists — `aiux.json`, `package.json`, `pages/` directory, and either `pages/layout.js` (simple pattern) or `application.js` (production pattern).

---

## Companion Skills — When to Invoke

These skills must be invoked at the exact moments listed. They are not optional.

| Skill                   | Invoke when                                                                             | What it provides                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ui-discovery`          | **Before writing any UI code** — every BUILD and EDIT task                              | Unified index of packaged components AND widgets installed on the connected instance. Reuse what it ranks; write custom only when nothing matches. |
| `accessibility`         | **Every BUILD and EDIT task** — all UI components and pages regardless of apparent interactivity level | WCAG 2.2 AA ARIA patterns, keyboard nav, focus management, live regions, Shadow DOM labeling, reflow, forced-colors              |
| `internationalization`  | Any user-visible string, date, number, currency, or sort operation                      | Correct `i18n.getMessage()` usage, parameterized messages, ICU plural/select, locale-aware formatting                            |
| `localization`          | Adding a new locale, RTL layout, translated catalogs, script/font coverage              | Per-locale adaptation on top of the i18n layer (prerequisite: `internationalization` already applied)                            |
| `migrate-header-config` | Migrating `headerConfig.js` per-page files into `application.js`                        | Post-migration review: stale comments, CSR/SSR behavior changes, scope problems                                                  |

**Order of operations for BUILD and EDIT tasks:**

1. `ui-discovery` — rank components and widgets, reuse a match or decide to write custom
2. Write the component/page/widget using this skill's references
3. `accessibility` — wire ARIA, keyboard, focus, reflow, and forced-colors (mandatory — not conditional on presence of interactive elements)
4. `internationalization` — wrap all strings, format all locale-sensitive values

> **EDIT tasks included:** Steps 3–4 apply after every EDIT that touches templates or server scripts — not only on net-new BUILD tasks.

---

## Mode Router

**Step 1 — Classify intent.** Do NOT load references yet.

| User intent                                           | Mode        | References to load (after intent is clear)                          |
| ----------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| "Add", "build", "create", "new page/widget/component" | **BUILD**   | `app/pages-cookbook.md` + relevant widget refs                      |
| "Add extension", "extend `<host app>`", "overlay page on `<host>`" | **BUILD (extension)** | `app/extensions.md`                                                 |
| "Change", "update", "edit", "add nav item", "modify"  | **EDIT**    | `app/navigation-patterns.md`, `app/theme-and-config.md`             |
| "Not working", "error", "broken", "fix", "debug"      | **DEBUG**   | `quality/debugging-guide.md`, `quality/validation-rules.md`         |
| "Review", "audit", "check quality", "analyze"         | **ANALYZE** | `quality/audit-checklist.md`, `quality/best-practices-checklist.md` |

**Step 2 — If intent is ambiguous, ask the user to clarify** before loading any references.

**Step 3 — Load only the references listed** for the classified mode. Read each file directly from this skill's `references/` directory (e.g. `references/app/pages-cookbook.md`). Do not load references for other modes.

For BUILD: also invoke `ui-discovery` before loading any other reference.

---

## Project Discovery (always first)

Read these before writing a single line:

1. `aiux.json` — basename, landing page, chat gate
2. `package.json` — dependencies, scripts
3. `theme.js` — color tokens, shape
4. `pages/` directory listing — routing conventions, existing patterns
5. `application.js` or `pages/layout.js` — which app architecture pattern is in use
6. One existing page file — learn the naming and import style the project already uses

---

## App Architecture

Two patterns exist. Detect which one the project uses before writing navigation or layout code.

| Signal                                                   | Pattern        | Where nav items live       |
| -------------------------------------------------------- | -------------- | -------------------------- |
| `pages/layout.js` extends `NavLayout`                    | **Simple**     | `pages/layout.js` loader   |
| `application.js` exports `{ setup, navigate, teardown }` | **Production** | `application.js` `setup()` |

**Simple — `pages/layout.js`:**

```js
import {NavLayout, navLayoutContext} from '@servicenow/aiux-components-nav';
@customElement('my-app-layout')
export default class MyAppLayout extends NavLayout {
  static appTheme = MY_THEME;
  static async loader(ctx) {
    await super.loader(ctx, {appName: 'My App', features: {logo: true}});
    navLayoutContext.set({...navLayoutContext.get(), items: [...]});
  }
}
```

**Production — `application.js`:**

```js
export default {
  appTheme: MY_THEME,
  applicationLayout: 'aiux-nav-layout',  // required — platform nav shell
  contexts: [licenseContext],             // auto-fetched before setup()
  async setup(ctx) {
    navLayoutContext.set({
      ...navLayoutContext.get(),
      appTitle: i18n.getMessage('My App'),
      features: {logo: true, profile: true, chat: ctx.chat?.enabled === true},
      items: [...]
    });
  },
  navigate(navCtx) { return undefined; },
  teardown() { navLayoutContext.set({items: []}); }
};
```

Page filename: `page.js`.

---

## Placement Conventions

| Artifact               | Location                                | Rule                                                   |
| ---------------------- | --------------------------------------- | ------------------------------------------------------ |
| App lifecycle          | `application.js`                        | `setup()`, `navigate()`, `teardown()`, theme, contexts |
| Theme                  | `theme.js`                              | Color tokens, shape — imported by `application.js`     |
| Pages                  | `pages/<route>/page.js`                 | File-based routing                                     |
| Nested layouts         | `pages/<route>/layout.js`               | Scoped context providers                               |
| Extension pages        | `src/extensions/<host>/pages/<route>/page.js` | Overlay on a different host app — see `references/app/extensions.md` |
| Page-scoped components | `pages/<route>/components/`             | Used by one page only                                  |
| Shared components      | `components/`                           | Used by 2+ pages                                       |
| Widgets                | `widgets/<name>/index.js` + `server.js` | Self-contained with server script                      |
| Shared loaders         | `loaders/`                              | Fetch functions shared across pages                    |
| Contexts               | `contexts/`                             | `createContext()` definitions                          |
| Constants              | `constants/`                            | Table fields, roles, enums                             |
| Utilities              | `utils/`                                | Formatters, shared helpers                             |
| Document title         | `utils/document-title.js`               | `setDocumentTitle()` — WCAG 2.4.2 page titles          |

---

## BUILD Mode

### Step 0 — UI Discovery (mandatory gate)

Invoke the `ui-discovery` skill before drafting any plan. It is mandatory, not optional. It returns a suggested component or widget, or nothing if none fits.

### Step 1 — Present Plan (mandatory gate)

Once the discovery gate above has run, present a concise plan to the user:

1. **What you understood** — restate the user's request in your own words
2. **What you will build** — list pages, widgets, components, server scripts, and say explicitly whether each is a reused `ui-discovery` match or new custom code, and why
3. **Navigation changes** — new routes, nav items, layout changes
4. **Data sources** — tables, APIs, server script actions
5. **Styling approach** — theme tokens, DaisyUI components, custom CSS

Wait for user confirmation. If the user corrects or refines, update the plan. Only proceed after approval.

### Step 2 — Adding a Page

If the target page overlays a different, existing host application (`src/extensions/...`) rather than this app's own `pages/` directory, load `references/app/extensions.md` instead and follow its steps. Otherwise:

Load: `references/app/pages-cookbook.md`

1. Detect page type: home / list / record / custom / nested-layout
2. Create `pages/<route>/page.js` extending `AIUXElement`
3. Add `static async loader(ctx)` for data — use `Promise.allSettled` for multiple fetches
4. Add `firstUpdated()` calling `setDocumentTitle(getMessage('Page Name'))` — required for every non-layout page (WCAG 2.4.2)
5. Wire navigation in `application.js` setup() or `pages/layout.js` loader
6. Apply `isServer` guards to any browser API in `connectedCallback`
7. If the page renders any configurable widget (has `@configProperty`), add the `aiux-config-id` attribute on each instance — load `references/config-framework/config-id.md`

### Step 3 — Adding a Widget

Load: `references/widget/component-patterns.md`, `references/widget/server-scripts.md`, `references/widget/decorators.md`, `references/widget/data-fetching.md`

1. Create `widgets/<name>/index.js` + `widgets/<name>/server.js`
2. Apply required decorators: `@customElement`, `@discoverable(true)`, `@name`, `@description`, `@bestFor`, `@server`
3. Implement all four render states: loading (skeleton), error, empty, data
4. Server script: IIFE pattern (see below), `GlideRecordSecure`, `setLimit()`, `gs.getMessage()`
5. If widget needs configurable properties:
   a. Load `references/config-framework/config-field-types.md` — add `@configProperty` decorators
   b. Load `references/config-framework/config-id.md` — add a static `aiux-config-id` on every instance in host pages (always do this after adding `@configProperty`)
   c. If fields need accordion grouping → load `references/config-framework/config-groups.md`
   d. If widget needs config that opens a platform table → load `references/config-framework/config-external.md`
   e. If fields need conditional visibility → load `references/config-framework/config-depends-on.md`
   f. If widget links out to an external url/list/table/record for config (**custom-url** mode) or owns its entire bespoke config UI (**inline-auto** / self-config mode) → load `references/config-framework/config-modes.md`

A file is an AIUX widget when it has all four: `export default` class extending `AIUXWidgetElement` + `@discoverable(true)` + `@customElement` + `@bestFor`.

### Step 4 — Styling

Load: `references/design/css-custom-properties.md`, `references/design/daisyui-patterns.md`

All `aiux-` prefixed DaisyUI classes. CSS custom properties with hex fallbacks. `:host` display by page type (see Styling section).

### Step 5 — Accessibility (companion skill — mandatory)

Invoke the `accessibility` skill. This step is **not conditional** — invoke it for every component, page, and widget regardless of whether elements appear explicitly interactive. WCAG 2.2 AA requirements (reflow at 320px, forced-colors, keyboard nav, ARIA landmarks, focus management) apply to all UI output.

### Step 6 — i18n (companion skill)

Invoke `internationalization` skill. Every user-visible string uses `i18n.getMessage()`. Every date/number uses locale-aware formatting.

### Step 7 — Validate

Run through `references/quality/validation-rules.md` and `references/quality/best-practices-checklist.md`. Fix all violations before presenting output.

---

## EDIT Mode

Load: `references/app/navigation-patterns.md`, `references/app/theme-and-config.md`

### Step 0 — UI Discovery (mandatory gate)

Invoke the `ui-discovery` skill before touching any file. It is mandatory, not optional. It returns a suggested component or widget, or nothing if none fits.

### Step 1 — Make the edit

Using what Step 0 returned, decide whether to reuse the match or write custom code — write custom only when nothing fits.

**After editing**, run these steps in order:

1. Re-invoke `accessibility` companion skill — not BUILD-only; catches regressions in any touched template
2. Re-invoke `internationalization` companion skill — catches any newly hardcoded strings
3. Run `references/quality/validation-rules.md` — full assertion pass against the changed component or widget; fix all Error-severity violations before presenting output

| Edit type           | Read                                    | Change                               | Verify                            |
| ------------------- | --------------------------------------- | ------------------------------------ | --------------------------------- |
| Add nav item        | `application.js` or `pages/layout.js`   | `items[]` array                      | Active state, route path          |
| Change theme        | `theme.js`                              | Token values                         | `appTheme` reference              |
| Add page route      | `pages/` directory                      | New page file + nav                  | No route conflicts                |
| Modify widget data  | `widgets/<name>/index.js` + `server.js` | Both files                           | Action name match, response shape |
| Add context sharing | Layout + consumer page                  | Context definition + provide/consume | `willUpdate` re-provision         |
| Add/edit `@configProperty` | `config-framework/config-field-types.md` | `@configProperty` decorators on component | `aiux-config-id` on all host instances (`config-id.md`) |

---

## DEBUG Mode

Load: `references/quality/debugging-guide.md`

| Symptom                            | Check                           | Fix                                                                      |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| Blank page                         | Console errors, loader return   | Missing `isServer` guard; loader crash                                   |
| Widget shows no data               | Server script                   | Must be `(function(data, options, input) { ... })(data, options, input)` |
| Widget not rendering               | `@customElement` + export       | Missing decorator or wrong base class                                    |
| Nav shell missing                  | `application.js`                | Add `applicationLayout: 'aiux-nav-layout'`                               |
| Data not loading                   | Server script action name       | Action name in `server.get({action})` must match handler                 |
| Styles not applying                | `:host` display, class names    | Missing `display: block`; class typo                                     |
| Properties not updating            | `static properties` declaration | Undeclared reactive property; mutating object without reassignment       |
| Context always default             | Scoped context call             | `detailContext.get(this)` — `this` is required                           |
| Loader crashes on error            | `Promise.allSettled`            | Check `.status === 'fulfilled'` before accessing `.value`                |
| Client fetch 403/401               | Fetch method                    | Use `aiuxFetch` — adds XSRF + auth headers                               |
| L3 tabs stale                      | `willUpdate` in layout          | Re-call `detailContext.provide()` when `loaderData` changes              |
| `setHeaderConfig` silent           | Call timing                     | Call after `super.connectedCallback()`                                   |
| `navigate()` no effect             | Path format                     | App-relative path: `/record/incident/abc` not `/aiux/myapp/...`          |
| `this.server` undefined            | Base class                      | Extend `AIUXWidgetElement`, not `AIUXElement`                            |
| `this` undefined in `client_tools` | Function type                   | Use `function(args) {}` not arrow function in `definition`               |
| i18n raw keys                      | `required_translations`         | Register string in widget metadata                                       |
| Memory leaks                       | `disconnectedCallback`          | Clean up all observers, listeners, timers                                |

---

## ANALYZE Mode

Load: `references/quality/audit-checklist.md`, `references/quality/best-practices-checklist.md`

10-category audit: Structure → Base classes → SSR safety → Styling → i18n → Accessibility → Performance → Security → Observability → Chat integration.

---

## Key Imports

| Import                                                              | From                                    | Purpose                      |
| ------------------------------------------------------------------- | --------------------------------------- | ---------------------------- |
| `html`, `css`, `nothing`, `isServer`                                | `lit`                                   | Templates, styles, SSR guard |
| `customElement`, `property`, `state`, `query`                       | `lit/decorators.js`                     | Lit decorators               |
| `classMap`                                                          | `lit/directives/class-map.js`           | Conditional CSS classes      |
| `repeat`                                                            | `lit/directives/repeat.js`              | Keyed list rendering         |
| `cache`                                                             | `lit/directives/cache.js`               | State-switching templates    |
| `AIUXElement`, `AIUXWidgetElement`, `WithData`, `withWidgetContext` | `@servicenow/aiux-components-core`      | Base classes                 |
| `decorators`, `createContext`, `getHeaders`                         | `@servicenow/aiux-components-core`      | Platform APIs                |
| `configProperty`, `externalConfig`                                  | `@servicenow/aiux-components-core`      | Config decorators (widget)   |
| `elementId`                                                         | `@servicenow/aiux-components-core`      | Config binding — auto-imported by the `aiux-config-id` desugar; import by hand only inside `layout` templates |
| `aiuxFetch`, `fetchDataResource`                                    | `@servicenow/aiux-components-core`      | Client fetch + data broker   |
| `isPluginActive`, `getSystemProperty`, `getLogger`                  | `@servicenow/aiux-components-core`      | Plugin checks, logging       |
| `userContext`, `getAMBService`                                      | `@servicenow/aiux-components-core`      | User context, real-time      |
| `i18n`, `locationService`, `recordWatcherService`                   | `@servicenow/aiux-services`             | Platform services            |
| `navigate`, `getGlobalRouter`                                       | `@servicenow/aiux-client`               | Navigation                   |
| `navLayoutContext`, `setHeaderConfig`, `setPageActions`             | `@servicenow/aiux-components-nav`       | Nav shell                    |
| `lazyImage`                                                         | `@servicenow/aiux-directive-lazy-image` | SSR-safe images              |
| `icon`                                                              | `@servicenow/aiux-directive-icon`       | Icon directive               |
| `createLogger`                                                      | `@servicenow/aiux-observability`        | Server-side logging          |
| `setDocumentTitle`                                                  | `utils/document-title.js`               | Browser tab title (WCAG)     |

---

## Base Classes

| Class                            | Extends             | Use when                                       |
| -------------------------------- | ------------------- | ---------------------------------------------- |
| `AIUXElement`                    | `LitElement`        | Pages, layouts, custom components              |
| `AIUXWidgetElement`              | `AIUXElement`       | Widgets with `this.server`                     |
| `WithData(AIUXWidgetElement)`    | `AIUXWidgetElement` | Widgets that auto-bind `this.data` from server |
| `withWidgetContext(AIUXElement)` | `AIUXElement`       | Chat-integrated widgets                        |

---

## Lit Rules

1. **Extend `AIUXElement` or `AIUXWidgetElement`** — never plain `LitElement`
2. **`static properties = {}`** in JS, `@property()`/`@state()` in TS — declare every mutable property
3. **`classMap`** for conditional classes — `class=${classMap({'btn': true, 'active': isActive})}`
4. **`nothing`** in child/content positions only
5. **Dispatch events** for state owned by parent — `dispatchEvent(new CustomEvent('...', {bubbles: true, composed: true}))`
6. **Reactive state + `classMap`** for visual mutations
7. **Namespace-scoped event names** — `aiux-widget:sort-change`
8. **Event delegation in loops** — `data-*` attributes + single bound handler on container

---

## SSR Golden Rule

```js
import {isServer} from 'lit';

connectedCallback() {
  super.connectedCallback();
  if (!isServer) {
    window.addEventListener('resize', this._onResize);
  }
}
```

Guard in: `constructor`, `connectedCallback`, `render`, `willUpdate`, `static async loader`, module top-level.
No guard needed in: `firstUpdated`, `updated`, `disconnectedCallback`, event handlers.

---

## Server Script (Widget Only)

```js
export default function server(data, _options, input) {
  // data    → response object; assign fields to return them to client
  // _options → widget instance config from page editor
  // input   → params from this.server.get({...})
  // Priority: input > options > hardcoded default
}
```

The build pipeline (Rollup) compiles `export default function` into an IIFE at deploy time.

Client call:

```js
const response = await this.server.get({action: 'getItems', limit: 50});
```

---

## Styling

Load: `references/design/css-custom-properties.md` before writing any CSS.

### `:host` by page type

```js
/* Standard page */    :host { display: block; }
/* List page */        :host { display: contents; }  /* required for aiux-list-connected */
/* Widget */           :host { display: block; height: 100%; }
/* Dashboard/home */   :host { display: block; min-height: 100%; container-type: inline-size; }
```

### Token quick-reference

| Need                   | Token                                  | Tailwind class        |
| ---------------------- | -------------------------------------- | --------------------- |
| Default / primary text | `var(--color-text-primary, #000)`      | `text-text-primary`   |
| Subdued text           | `var(--color-text-secondary, #4d4c4a)` | `text-text-secondary` |
| Card background        | `var(--color-base-100, #fff)`          | `bg-base-100`         |
| Page background        | `var(--color-base-200, #f2f2f2)`       | `bg-base-200`         |
| Border                 | `var(--color-base-300, #e5e7eb)`       | `border-base-300`     |

Always include hex fallback in `static styles`. Card surfaces: `bg-base-100 shadow-sm`.

### Text overflow protection

All user-facing text elements (titles, subtitles, descriptions) must remain visible and legible at 320px viewport width without horizontal overflow. Use Tailwind utility classes in the template for any text element that receives dynamic or prop-driven content:

```html
<span class="break-words max-w-full">${this.title}</span>
```

Reserve `static styles` for values Tailwind cannot express (`:host`, keyframes, pseudo-elements).

---

## Principles (P1–P48)

The full enumerated principles live in `references/quality/best-practices-checklist.md`. After implementing, validate against that checklist plus `references/quality/validation-rules.md` before presenting output.

---

## Common UI Patterns

- **Skeleton loader** — `aiux-skeleton h-N w-full rounded` or CSS `::before` animation (see `css-custom-properties.md`)
- **Error state** — `<div class="aiux-alert aiux-alert-error aiux-alert-soft">...</div>`
- **Empty state** — `<aiux-empty-state-content>` platform component
- **Toast** — `<div class="aiux-toast aiux-toast-top aiux-toast-center z-50"><div class="aiux-alert aiux-alert-success aiux-alert-soft">...</div></div>`
- **Loading spinner in button** — `<span class="aiux-loading aiux-loading-spinner aiux-loading-xs"></span>` inside button
- **Status badge** — `<span class="aiux-badge aiux-badge-sm aiux-badge-success aiux-badge-soft">`

---

## References

### Foundation

- [AIUXElement](references/foundation/aiux-element.md) — Base classes, lifecycle, event binding, cleanup
- [Loader & Context](references/foundation/loader-and-context.md) — `ctx` shape, `Promise.allSettled`, `aiuxFetch`, `fetchDataResource`, context API
- [Lit Patterns](references/foundation/lit-patterns.md) — `nothing`, `classMap`, events, delegation, `repeat`, `cache`
- [SSR Safety](references/foundation/ssr-safety.md) — `isServer` guards, where they are and are not needed

### App

- [Pages Cookbook](references/app/pages-cookbook.md) — Layout, list, record, nested layout, custom page templates
- [Navigation Patterns](references/app/navigation-patterns.md) — `application.js` setup, `navigate()`, L2/L3 nav, `setHeaderConfig`, `setPageActions`
- [Theme & Config](references/app/theme-and-config.md) — `theme.js`, `aiux.json`, `application.js`, `applicationLayout`
- [Backend Layer](references/app/backend-layer.md) — Deploy pipeline, build commands, common gotchas
- [Extensions](references/app/extensions.md) — Overlaying pages on a host app via `src/extensions/`, path conventions, page/loader/layout templates, nested layout precedence

### Widget

- [Component Patterns](references/widget/component-patterns.md) — Properties, lifecycle, events, i18n, templates
- [Server Scripts](references/widget/server-scripts.md) — IIFE pattern, GlideRecord, action routing, security
- [Data Fetching](references/widget/data-fetching.md) — `this.server`, loading states, record watcher, debounced search
- [Chat Integration](references/widget/chat-integration.md) — `withWidgetContext`, `setAiContext`, `client_tools`
- [Observability](references/widget/observability.md) — `getLogger`, `createLogger`, severity guide, `lazyImage`
- [Decorators](references/widget/decorators.md) — All Lit and AIUX platform decorators
- [Config Field Types](references/config-framework/config-field-types.md) — `@configProperty` decorator: semantics, base schema, localization, all field types
- [Config aiux-config-id](references/config-framework/config-id.md) — Exposing widget config in host pages via `aiux-config-id`
- [Config Groups](references/config-framework/config-groups.md) — Accordion grouping with `static configGroups`
- [Config External](references/config-framework/config-external.md) — `@externalConfig` for opening a platform table
- [Config dependsOn](references/config-framework/config-depends-on.md) — Conditional field visibility
- [Config Modes](references/config-framework/config-modes.md) — Custom config UI: `custom-url`, `inline-auto` (self-config)

### Design

- [CSS Custom Properties](references/design/css-custom-properties.md) — **Load before writing any CSS.** Color tokens, typography, motion, spacing, radius, `:host` rules, production patterns
- [DaisyUI Patterns](references/design/daisyui-patterns.md) — Component classes, `aiux-` prefix, card/badge/alert/dropdown patterns
- [Tailwind Reference](references/design/tailwind-reference.md) — Layout, spacing, typography, color utility classes

### Quality

- [Debugging Guide](references/quality/debugging-guide.md) — Expanded symptom → fix diagnostics
- [Validation Rules](references/quality/validation-rules.md) — Assertions checked after every implementation
- [Best Practices Checklist](references/quality/best-practices-checklist.md) — P1–P43 checklist
- [Audit Checklist](references/quality/audit-checklist.md) — 10-category app health audit


