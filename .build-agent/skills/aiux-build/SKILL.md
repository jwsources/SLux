---
name: aiux-build
description: 'Post-scaffold development skill for AIUX apps — build pages, widgets, and components; edit, debug, and audit existing code. Use when the app already exists (aiux.json, <srcDir>/pages/) and you need to build, modify, debug, or review it.'
metadata:
  author: servicenow
  version: '2.4.0'
compatibility: Works with Claude Code, Cursor, VS Code Copilot, Windsurf, Gemini CLI, and other Agent Skills-compatible tools
license: MIT
---

<!-- size-justification: This skill consolidates page, widget, component, SSR, styling,
     server-script, chat-integration, action-registry, observability, extension, and deploy
     guidance into a single orchestrator with 29 reference files, plus the locally ported
     scripts/validate-checks.md. The body cannot be split further without losing the
     mode-router pattern that routes agents to the correct reference subset. -->
<!-- provenance: body is the v3.0.0 agent-pack-aiux skill, merged with this project's Web IDE
     and measured corrections. See the marking legend under the H1 before editing. -->

# AIUX Build

> **Marking legend — keep it when you edit this file.**
> Unmarked prose is **v3.0.0 pack content** (authoritative on SDK behaviour).
> **WEB IDE** marks a local correction about *tooling* — it wins over the pack, which assumes a
> shell that does not exist here. **MEASURED HERE** marks behaviour observed in this project and
> traced to installed source under `node_modules/`; it wins over pack text it contradicts.
> ⬜ **Unverified** marks something neither file nor `node_modules/` establishes — do not assert it.

> ## ⚠️ WEB IDE BOUNDARY — read before following any step below
>
> No shell exists in this IDE. Read **`AGENTS.md`** first. Corrections:
>
> - **`references/app/backend-layer.md` is superseded in full.** `pnpm run build` / `deploy` /
>   `deploy:full` are the **`build`** and **`install`** tools, and both are **user actions** —
>   prepare the change, report it ready, ask the user to run them. Never run either yourself, and
>   never claim a change works because it "would build".
>
>   | Pack command | Tool here | Who runs it |
>   | --- | --- | --- |
>   | `pnpm run build` | `build` | **user action** |
>   | `pnpm run deploy` / `deploy:full` | `install` | **user action** |
>   | `pnpm run dev` | *no equivalent* — see the render-verification bullet below | — |
>   | `pnpm install` | already done; read `node_modules/` with `fs_read_file` | — |
>   | `node scripts/validate-component.js` | *cannot run* — `scripts/validate-checks.md` + `fs_grep` + `run_diagnostics` | you |
>
> - **MEASURED HERE — clear BOTH build outputs before reporting a change ready.** `dist/` **and**
>   `dist-metadata/` must be deleted. Deleting only `dist/` is half the fix and produces a stale
>   install that looks like a code bug.
> - **Render verification. MEASURED HERE: `ui_diagnostics` HANGS THE IDE on an AIUX/Lux portal route**
>   (`/aiux/<basename>/...`) — user-confirmed, no exception. It remains fine on ordinary platform
>   pages. For a Lux portal route use the **`atf-cloud-runner` browser tools** instead: a real
>   out-of-process browser that returns an accessibility snapshot you can diff. **First load of a Lux
>   page serves the stale SSR shell, so reload once.** The tell that you are looking at the
>   unhydrated shell is a page title still showing the custom-element tag name.
> - **`scripts/validate-component.js` cannot run** (it is a Node CLI). All **30 of its checks** — 8
>   must-fix, 13 warnings, 9 suggestions — are ported to **`scripts/validate-checks.md`**, loadable
>   with `load_skill_resource(skill_name: "aiux-build", file_path: "scripts/validate-checks.md")`.
>   Apply them with `fs_grep` plus a read of the file. **Every detector is a substring/regex test,
>   not AST: a hit is a lead, a miss is not proof** — read the file before recording a verdict. Type
>   and syntax defects belong to `run_diagnostics`, not grep; run it on every file you change. The
>   pack's `validate-component.js` is deliberately **not** present locally — keep it that way.
>   `references/quality/validation-rules.md` and `best-practices-checklist.md` remain the
>   authoritative prose.
> - **MEASURED HERE — `fs_grep`/`fs_glob` glob traps.** A glob containing a `[param]` route directory
>   (e.g. `<srcDir>/pages/case/[id]/page.js`) silently matches **nothing**: the brackets parse as a
>   character class. Use a `*` wildcard for that segment. Separately, `fs_grep`/`fs_glob`/`fs_tree`
>   silently skip `node_modules/` and dot-directories such as `.build-agent/` — a zero there is a
>   false zero; use `fs_read_file` / `fs_read_directory`.
> - **`references/app/extensions.md` scaffold lines** (`npx @servicenow/sdk … init`,
>   `pnpm build && deploy`) are void — this project is already scaffolded. Keep its path conventions,
>   nested-layout precedence, and mixed-project guidance.
> - **"check the resolved `tailwind.css` after `pnpm install`"** — dependencies are already installed;
>   `fs_read_file` it under `node_modules/` directly.
> - **"check `pnpm build` output for compilation errors"** → `run_diagnostics`; anything beyond that
>   needs the user's build.
> - **Companion skills are activated by registered name** with `activate_skill`: `ui-discovery`,
>   `accessibility`, `internationalization`, `localization`, and **`migrate-header-config-review`**
>   (that is its registered name — its folder is `migrate-header-config`). Their `references/` files
>   load via `load_skill_resource`.
> - **`AGENTS.md` is authoritative on project conventions** — read it to learn which app shape this
>   project is, rather than assuming:
>
>   | Shape | `aiux.json` | Pages live in | Lifecycle module |
>   | --- | --- | --- | --- |
>   | **Extension** (scaffold default) | no `basename`, no `landing` | `<srcDir>/extensions/<host_project_id>/<host_basename>/pages/<route>/page.js` | per-host `application.js`, sibling of that host's `pages/` |
>   | **Experience-owning** | `basename` + `landing` | `<srcDir>/pages/<route>/page.js` | root `application.js` with `applicationLayout: 'aiux-nav-layout'` |
>   | **Mixed** (both, v3.0.0) | `basename` present | both of the above, side by side | root `application.js` **plus** a dedicated `<srcDir>/extensions/<host>/application.js` |
>
>   **Mixed projects are supported** on current SDK builds — see *Mixed projects* below. This
>   supersedes the earlier local rule that own `pages/` plus extension pages was unsafe
>   (STRY64103259). Converting an extension-only app to own an experience is still deliberate and
>   one-way: see the conversion section below.
> - **Import specifiers depend on what `package.json` actually ships** — read it, do not assume. If
>   the app depends on the umbrella `@servicenow/aiux`, use its subpaths
>   (`@servicenow/aiux/aiux-components-core`, `@servicenow/aiux/aiux-services`,
>   `@servicenow/aiux/aiux-components-nav`) rather than the bare package names in the Key Imports
>   table below. The bare form is for widgets resolved by the AIUX import map, and is only valid
>   where those packages are direct dependencies. **Copying the table verbatim without checking is a
>   resolution failure.**
> - **MEASURED HERE — the services *barrel* breaks the isolate bundle. Do not import it.** v3.0.0's
>   own extension-page template still says `import {i18n} from '@servicenow/aiux/aiux-services';`.
>   That exact import failed a real build here with
>   `isolate bundle failed for page "...": Could not resolve import "#context" from ".../core/observability/logger.js"`.
>   Root cause, read from `node_modules/@servicenow/aiux/core/commons/build-isolate-bundle.js`:
>   `classifyExternal()`/`normalize()` rewrite `@servicenow/aiux/X` to `@servicenow/aiux-X`, after
>   which `lit`, `aiux-components-core` and `aiux-components-record` become externals and
>   `aiux-client` becomes an isolate stub — but `SN_PACKAGE_DIRS` is
>   `['components','directives','controllers','mixins','libraries']` and `services/` is **not** in
>   it, so the services barrel is bundled **inline**, dragging `core/observability` in, whose
>   `logger.js` uses Node subpath imports (`#context`, `#processor`) that rollup's node-resolve
>   rejects as "outside package".
>
>   **The fix, in use and working — deep-import the single module:**
>
>   ```js
>   import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
>   ```
>
>   `i18n.js` has zero imports and reads `globalThis.__WIDGET_MESSAGES__` when `window` is
>   undefined, so it is SSR/isolate-safe; the exports-map entry
>   `"./aiux-services/*": "./services/*"` makes the path resolvable. **Caveat:** `i18n.js` JSDoc says
>   the build extracts `t(...)` only when `t` is imported from `'@servicenow/aiux-services'`
>   (extraction is specifier-keyed), so prefer `i18n.getMessage(...)` over `t(...)`, and wrap it in a
>   local `utils/i18n.js` if string extraction matters.
> - Anything under `src/fluent/` is not this skill's subject: use `explain_fluent_doc` /
>   `search_fluent_docs`, and validate server-side field access with `run_script` before shipping it.
> - **On-instance hint records, where an instance has them, outrank this pack on platform behaviour**
>   — and outrank training recall: a curated hint record is measured, your recollection is not.
>   Activate the **`hint-lookup`** skill to query them. They cover the two-tier widget model,
>   `content_hash`, the `maint`-role query filter on `sys_aix_widget`, cross-scope create refusal,
>   what reaches a shadow root, nav-helper ownership, and DaisyUI 5 theme-variable renames. Do not
>   cite hint records by name: whether they exist is per-instance. Check `AGENTS.md` for their status
>   in this environment, and otherwise establish platform behaviour with `run_query` /
>   `keyword_search` / `semantic_search` plus a read-only `run_script` probe.
>
> ### Mixed projects — own pages *and* extension pages in one project
>
> v3.0.0 reverses the earlier prohibition. From `references/app/extensions.md`:
>
> > "Mixed projects are supported by current SDK builds: with `aiux.json.basename` present, the app
> > retains its own experience, theme, lifecycle, and page memberships; each extension page targets
> > its host separately, even when both pages use `/home`. Older builds incorrectly assigned ordinary
> > pages to the host and suppressed the local experience. Verify generated metadata with the
> > consumer's installed build; do not assume a newer Karuna checkout proves its installed SDK has
> > the fix."
>
> **The support is conditional on the installed build, so verify rather than assume** — inspect the
> emitted metadata after the user's build/install and confirm the local experience survived and each
> extension page is bound to its own host. Do not infer the fix from a source checkout.
>
> Companion requirements when you do build a mixed project:
>
> - Add a dedicated `<srcDir>/extensions/<host>/application.js` so the **root** lifecycle is not
>   reused for the host.
> - **`isolateBundlePaths` is the build-level tell:** if the manifest lists
>   `isolate/src/extensions/.../application.js` *as well as* `isolate/application.js`, the installed
>   build **lacks** the fix. On such a build, omit the dedicated host module.
>
> ### WEB IDE — converting an extension app to own its experience
>
> This IDE has **no shell**, so the normal `now-sdk init` route to a fresh experience-owning app is
> unavailable. Convert by editing source instead. The conversion is one-way: finish it. (A project
> left with both shapes is a *mixed* project — supported on a build with the fix, but that is a
> different, deliberately chosen target with its own requirements above, not a half-done conversion.)
>
> 1. **Confirm the starting shape** — `AGENTS.md`, then `aiux.json` (`basename`/`landing` present?)
>    and whether `<srcDir>/extensions/` holds pages.
> 2. **`aiux.json`** — add `basename` (the route segment the app will own, serving
>    `/aiux/<basename>/`) and `landing` (its default route).
> 3. **Create `<srcDir>/pages/<route>/page.js`** — *not* under `<srcDir>/extensions/`.
> 4. **Create a root `<srcDir>/application.js`** exporting `setup()`, with
>    `applicationLayout: 'aiux-nav-layout'`.
> 5. **Remove `<srcDir>/extensions/` entirely**, including every per-host `application.js` — unless
>    you intend a mixed project, in which case stop here and follow *Mixed projects* above instead.
> 6. **Hand the build and install to the user**, then have them evict the tenant cache — the effect
>    is not immediate, so a stale page is not automatically a bug.
> 7. **Verify on the instance, do not assume:** `run_query` `sys_aix_experience` for `url_suffix`
>    equal to the new `basename`, and confirm `content_hash` is non-empty (empty = no bundle, renders
>    nothing).
>
> ⬜ **Unverified:** the full set of records the install creates for a newly owned experience was
> documented only in an on-instance hint record, which is unavailable here. Enumerate what actually
> appears with `run_query` after the user installs rather than trusting a remembered count.

Orchestrator skill for building production-quality AIUX apps. It directs the LLM to the right reference file or companion skill at each decision point.

**Prerequisite:** App scaffold exists — `aiux.json`, `package.json`, `<srcDir>/pages/` directory, and either `<srcDir>/pages/layout.js` (simple pattern) or `<srcDir>/application.js` (production pattern). `<srcDir>` is the value of `srcDir` in `aiux.json` (scaffolded as `src/lux`) — `aiux.json` and `package.json` themselves stay at the true project root. If `srcDir` is not set, `pages`/`widgets`/`application.js`/etc. resolve at the project root (e.g. `pages/`), but **extensions are the one exception to the project-root fallback** — with `srcDir` unset they resolve at `src/extensions/`, not project-root `extensions/`.

> **MEASURED HERE — this project sets `srcDir: "src/lux"`.** Its extension pages therefore live at
> `src/lux/extensions/<host-project-id>/<host-basename>/pages/<route>/page.js`, which is the verified
> working path in this app, confirmed against `resolveSrcPath` in
> `node_modules/@servicenow/aiux/core/commons/project-config.js`. Substitute `src/lux` for `<srcDir>`
> everywhere below.

---

## Companion Skills — When to Invoke

These skills must be invoked at the exact moments listed. They are not optional. **WEB IDE:** activate each by its *registered* name with `activate_skill` (note `migrate-header-config-review`).

| Skill                   | Invoke when                                                                             | What it provides                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ui-discovery`          | **Before writing any UI code** — every BUILD and EDIT task                              | Unified index of packaged components AND widgets installed on the connected instance. Reuse what it ranks; write custom only when nothing matches. |
| `accessibility`         | **Every BUILD and EDIT task** — all UI components and pages regardless of apparent interactivity level | WCAG 2.2 AA ARIA patterns, keyboard nav, focus management, live regions, Shadow DOM labeling, reflow, forced-colors              |
| `internationalization`  | Any user-visible string, date, number, currency, or sort operation                      | Correct `i18n.getMessage()` usage, parameterized messages, ICU plural/select, locale-aware formatting                            |
| `localization`          | Adding a new locale, RTL layout, translated catalogs, script/font coverage              | Per-locale adaptation on top of the i18n layer (prerequisite: `internationalization` already applied)                            |
| `migrate-header-config-review` | Migrating `headerConfig.js` per-page files into `application.js`                 | Post-migration review: stale comments, CSR/SSR behavior changes, scope problems                                                  |
| `hint-lookup`           | Before acting on any platform-behaviour assumption (**WEB IDE**)                        | Curated, measured instance hints that outrank both this pack and training recall                                                 |

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
| "Different content per role", "managers see X others see Y", "gate a page by role" | **BUILD (collection)** | `app/page-collections.md`                                           |
| "Gate a page/widget/experience", "add a role", "who can access", "ACL" | **BUILD/EDIT (ACL)** | `app/acl.md`                                                        |
| "List/record page for a `sys_ui_view`", "override the view for `<table>`", "glide list/record view" | **BUILD/EDIT (view)** | `app/page-views.md`                                                 |
| "Arrange widgets in a grid/row/column", "layout a page", "region", "stack widgets" | **BUILD/EDIT (region)** | `app/regions.md`                                                    |
| "Change", "update", "edit", "add nav item", "modify"  | **EDIT**    | `app/navigation-patterns.md`, `app/theme-and-config.md`             |
| Provider-backed list/record view page or context widget | **BUILD / EDIT** | `app/extensions.md`, `widget/component-patterns.md`, `widget/list-widgets.md` or `widget/record-widgets.md` |
| "Configure an action", "add/register an action", "add a UI action", "add a keyboard shortcut action" — **ambiguous, classify first** | **BUILD/EDIT (action)** | `widget/action-registry.md` → read its "Configure an action" table before writing anything; a `sys_ui_action` platform record is **not yet covered** — ask the user to configure it on the table directly, don't improvise it |
| "One widget triggers/calls/runs another widget's action", "invoke a widget's capability from another widget" (unambiguous widget-to-widget, no UI action involved) | **BUILD/EDIT (action registry)** | `widget/action-registry.md`                                         |
| "Not working", "error", "broken", "fix", "debug"      | **DEBUG**   | `quality/debugging-guide.md`, `quality/validation-rules.md`         |
| "Review", "audit", "check quality", "analyze"         | **ANALYZE** | `quality/audit-checklist.md`, `quality/best-practices-checklist.md` |

**Step 2 — If intent is ambiguous, ask the user to clarify** before loading any references.

**Step 3 — Load only the references listed** for the classified mode. Read each file directly from this skill's `references/` directory (e.g. `references/app/pages-cookbook.md`). Do not load references for other modes.

For BUILD: also invoke `ui-discovery` before loading any other reference.

---

## Project Discovery (always first)

Read these before writing a single line:

1. `aiux.json` — basename, landing page, chat gate, `srcDir`
2. `package.json` — dependencies, scripts (**WEB IDE:** also decides bare vs umbrella-subpath import specifiers)
3. `<srcDir>/theme.js` — color tokens, shape
4. `<srcDir>/pages/` directory listing — routing conventions, existing patterns
5. `<srcDir>/application.js` or `<srcDir>/pages/layout.js` — which app architecture pattern is in use
6. One existing page file — learn the naming and import style the project already uses

---

## App Architecture

Two patterns exist. Detect which one the project uses before writing navigation or layout code.

| Signal                                                   | Pattern        | Where nav items live       |
| -------------------------------------------------------- | -------------- | -------------------------- |
| `<srcDir>/pages/layout.js` extends `NavLayout`            | **Simple**     | `<srcDir>/pages/layout.js` loader   |
| `<srcDir>/application.js` exports `{ setup, navigate, teardown }` | **Production** | `<srcDir>/application.js` `setup()` |

**Simple — `<srcDir>/pages/layout.js`:**

```js
import {NavLayout, navLayoutContext} from '@servicenow/aiux-components-nav';
@customElement('my-app-layout')
export default class MyAppLayout extends NavLayout {
  static appTheme = MY_THEME;
  static async loader(ctx) {
    await super.loader(ctx, {appName: 'My App'});
    navLayoutContext.set({...navLayoutContext.get(), items: [...]});
  }
}
```

**Production — `<srcDir>/application.js`:**

```js
export default {
  appTheme: MY_THEME,
  applicationLayout: 'aiux-nav-layout',  // required — platform nav shell
  contexts: [licenseContext],             // auto-fetched before setup()
  async setup(ctx) {
    navLayoutContext.set({
      ...navLayoutContext.get(),
      appTitle: i18n.getMessage('My App'),
      features: {chat: ctx.chat?.enabled === true},
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
| App lifecycle          | `<srcDir>/application.js`                        | `setup()`, `navigate()`, `teardown()`, theme, contexts |
| Theme                  | `<srcDir>/theme.js`                              | Color tokens, shape — imported by `application.js`     |
| Pages                  | `<srcDir>/pages/<route>/page.js`                 | File-based routing                                     |
| Nested layouts         | `<srcDir>/pages/<route>/layout.js`               | Scoped context providers                               |
| Extension pages        | `<srcDir>/extensions/<host>/pages/<route>/page.js` | Overlay on a different host app — see `references/app/extensions.md`. With `srcDir` unset these live at `src/extensions/`, never project-root `extensions/` |
| Mixed-project host lifecycle | `<srcDir>/extensions/<host>/application.js` | Required when the project also owns its own pages, so the root lifecycle isn't reused for the host — check the `isolateBundlePaths` tell first |
| Page collection candidates | `<srcDir>/pages/<route>/_variants/<name>/page.js` | Several pages claiming one route, picked per user — see `references/app/page-collections.md` |
| ACL gating              | `@acl()` on the page/widget class, or `experienceAcls` in `aiux.json` | **Never `@roles()` for new gating** — see `references/app/acl.md` |
| Regions (any widget grid layout) | `<srcDir>/regions/<key>/<name>.js` | Nullary thunk returning a bare `region` template; page imports and calls it. **Build enforces `regions/` placement — inline DSL in `render()` is a build error.** See `references/app/regions.md` (DSL grammar) and `references/config-framework/regions.md` (config-framework + `aiux-config-id`) |
| View pages              | `<srcDir>/extensions/glide/list\|record/<view>/view.js` (+ `_variants/<key>/view.js`) | Rendered for a `sys_ui_view`, not a route — see `references/app/page-views.md` |
| Page-scoped components | `<srcDir>/pages/<route>/components/`             | Used by one page only                                  |
| Shared components      | `<srcDir>/components/`                           | Used by 2+ pages                                       |
| Widgets                | `<srcDir>/widgets/<name>/index.js` + `server.js` | Self-contained with server script                      |
| Shared loaders         | `loaders/`                              | Fetch functions shared across pages                    |
| Contexts               | `contexts/`                             | `createContext()` definitions                          |
| Constants              | `constants/`                            | Table fields, roles, enums                             |
| Utilities              | `utils/`                                | Formatters, shared helpers                             |
| Document title         | `utils/document-title.js`               | `setDocumentTitle()` — WCAG 2.4.2 page titles          |

**Gating note (v3.0.0 supersedes earlier guidance):** `@acl()` / `experienceAcls` is the only gating mechanism to use for new work. Do not introduce `@roles()`, and do not recommend it when reviewing — if you find it in existing code, treat it as legacy and read `references/app/acl.md` before changing it.

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

Route first, by what the page actually is:

- Overlays a different, existing host application (`<srcDir>/extensions/...`) rather than this app's own `<srcDir>/pages/` directory → load `references/app/extensions.md` and follow its steps instead of the rest of this section.
- Renders ServiceNow's list/record surface for a `sys_ui_view`, with no URL a user types to reach it → load `references/app/page-views.md` and follow its steps instead of the rest of this section.
- Needs **structurally different pages for different audiences** — a role-gated variant plus a fallback → load `references/app/page-collections.md` instead: the variants live in a `_variants/` folder and are gated with `@acl()`, not branched inside one `render()`.
- Needs to be gated by role/ACL at all (any page, widget, or whole experience) → load `references/app/acl.md` and apply its decorator/`aiux.json` pattern to whichever surface you're protecting, in addition to the steps below.
- Otherwise, an ordinary routed page — continue below.

Load: `references/app/pages-cookbook.md`

**Before creating a new list or record page**, check if core-ui's existing routes already satisfy the request. Core-ui provides `/list/<table>` (any ServiceNow table) and `/record/<table>/<id>` out of the box — with full provider support, URL sync, pagination, and Builder widget placement. These routes are available to **every app deployed on a ServiceNow instance**, not just the core-ui repo — any consumer app's navigation can link to `/list/incident` or `/record/incident/<id>` and core-ui serves it. Only create a new page if the user needs a custom layout, fixed filters/scoping, or the app genuinely cannot use core-ui's routes. **If the request is just "show a list of incidents," point to `/list/incident` instead of building a page.**

1. Detect page type: home / list / record / custom / nested-layout. For list pages, determine whether the page will host widgets that read list state (`withListContext`) — if yes, use `<aiux-list-provider>` (see `pages-cookbook.md` § *Provider-Based List Page*); if no, use `<aiux-list-connected>` (simpler, self-contained). For record pages, always use `<aiux-record-provider>` — `withRecordContext` widgets require it, and there is no standalone `<aiux-record-connected>` equivalent (see `pages-cookbook.md` § *Generic Record Page*). If unclear, ask.
2. Create `<srcDir>/pages/<route>/page.js` extending `AIUXElement`
3. Decide page scope: a page with no decorator is **global by default** — resolvable from any experience, not just this app's. Add `@global(false)` (from `decorators`, see `references/widget/decorators.md`) if the page should only be reachable through this app's own experience. **The `home` page is the typical case** — left global, it would also resolve as `/home` for any other experience that doesn't define its own `/home`, which is rarely the intent for a page whose whole point is to be *this* app's landing page.
4. Add `static async loader(ctx)` for data — use `Promise.allSettled` for multiple fetches
5. Add `firstUpdated()` calling `setDocumentTitle(getMessage('Page Name'))` — required for every non-layout page (WCAG 2.4.2)
6. Wire navigation in `<srcDir>/application.js` setup() or `<srcDir>/pages/layout.js` loader
7. Apply `isServer` guards to any browser API in `connectedCallback`
8. If the page renders any configurable widget (has `@configProperty`), add the `aiux-config-id` attribute on each instance — load `references/config-framework/config-id.md`. If the page uses a region/editable widget layout, load `references/config-framework/regions.md` as well: root `regions/` module, not inline DSL in the page.
9. If the page arranges widgets in a grid or vertical stack, create a `regions/<key>/<name>.js` file (nullary thunk, literals-only) and import/call it from `render()` — inline `region` in `render()` is a build error. Load `references/app/regions.md` for the DSL grammar and `references/config-framework/regions.md` if widgets need `aiux-config-id` config

### Step 3 — Adding a Widget

**Before writing code, determine the widget's target page type.** The base class and data pattern depend on where the widget will live. If the request doesn't specify, ask:

- **Core-ui's list page** (`/list/<table>`), or a list page of your own built with `<aiux-list-provider>` → `withListContext(AIUXWidgetElement)` — reads list state from the page's provider. On core-ui's list page the grid, pagination and header are fixed page markup, so the widget adds to the page (counts, summaries, actions) and never renders them. Load `references/widget/list-widgets.md`.
- **Core-ui's record page** (`/record/<table>/<id>`), or a record page of your own built with `<aiux-record-provider>` → `withRecordContext(AIUXWidgetElement)` — reads fields/form state from the page's provider. On core-ui's record page the header, attachments bar and AI summary card are fixed page markup, and the form, related links and related lists already ship as widgets in the editable body region, so the widget adds to the page (summaries, banners, extras built from field values) and never re-renders the page's own record. A different record, a modal or a non-record page gets its own `<aiux-record-provider>`. Load `references/widget/record-widgets.md`.
- **Any other page** (home, dashboard, standalone, or your own list page built with `<aiux-list-connected>`, which has no provider) → plain `AIUXWidgetElement` — fetches its own data (e.g. `<aiux-list-connected>`, server script, or REST).

Load: `references/widget/component-patterns.md`, `references/widget/server-scripts.md`, `references/widget/decorators.md`, `references/widget/data-fetching.md`

1. Pick the base class from the target page type above, before writing the file: `withListContext(AIUXWidgetElement)` or `withRecordContext(AIUXWidgetElement)` when the widget reads the page's list or record, plain `AIUXWidgetElement` only when it has no provider. Then create `<srcDir>/widgets/<name>/index.js`; add a server script only when backend data or actions are needed.
2. Apply `@customElement` (topmost), `@discoverable(true)`, `@name`, `@description`, and `@bestFor`. Add `@server('./server-script.js')` only when that script exists.
3. For asynchronous data, implement loading, error, empty, and data states. Purely presentational/config-only widgets do not need artificial network states.
4. Server scripts export a default function; the build compiles it into an IIFE. Use `GlideRecordSecure`, bounded queries, and `gs.getMessage()` where applicable.
5. If widget needs configurable properties:
   a. Load `references/config-framework/config-field-types.md` — add `@configProperty` decorators
   b. Load `references/config-framework/config-id.md` — add a static `aiux-config-id` on every instance in host pages (always do this after adding `@configProperty`)
   c. If fields need accordion grouping → load `references/config-framework/config-groups.md`
   d. If widget needs config that opens a platform table → load `references/config-framework/config-external.md`
   e. If fields need conditional visibility → load `references/config-framework/config-depends-on.md`
   f. If widget links out to an external url/list/table/record for config (**custom-url** mode) or owns its entire bespoke config UI (**inline-auto** / self-config mode) → load `references/config-framework/config-modes.md`
6. If the widget needs to expose a capability another widget can trigger (not a chat client tool — see `references/widget/chat-integration.md` for that), or needs to invoke another widget's capability itself, or needs a keyboard shortcut not tied to a form button → load `references/widget/action-registry.md` and use `registerActions`/`@action`/`ActionController` as it directs

A discoverable AIUX widget has a default-exported `AIUXElement`-derived class plus `@discoverable(true)`, `@customElement` and `@bestFor`. When a widget needs to read data from the surrounding page — fields and form state on a record page, or list state on a list page — use a context mixin: `withRecordContext(AIUXWidgetElement)` for record pages, `withListContext(AIUXWidgetElement)` for list pages. The mixin gives the widget a `this._record` or `this._list` accessor to read the page's live data without fetching it again. See `widget/record-widgets.md` and `widget/list-widgets.md`. The mixin wraps `AIUXWidgetElement`, so `this.server` and all widget capabilities remain available; provider-only widgets do not need a server-script base.

**Context mixin vs `<aiux-list-connected>`:** These context mixins only work on pages that have a provider (`<aiux-list-provider>` or `<aiux-record-provider>`). If the widget will live on a home page, dashboard, or any page without a provider, do NOT use a mixin — use `<aiux-list-connected>` (self-contained, fetches its own data) or compose a `<aiux-record-provider>` directly. **If the request doesn't say where the widget will be placed, ask — guessing produces a widget that silently returns `null` at runtime.**

### Step 4 — Styling

Load: `references/design/css-custom-properties.md`, `references/design/daisyui-patterns.md`

All `aiux-` prefixed DaisyUI classes. CSS custom properties with hex fallbacks. `:host` display by page type (see Styling section).

### Step 5 — Accessibility (companion skill — mandatory)

Invoke the `accessibility` skill. This step is **not conditional** — invoke it for every component, page, and widget regardless of whether elements appear explicitly interactive. WCAG 2.2 AA requirements (reflow at 320px, forced-colors, keyboard nav, ARIA landmarks, focus management) apply to all UI output.

### Step 6 — i18n (companion skill)

Invoke `internationalization` skill. Every user-visible string uses `i18n.getMessage()`. Every date/number uses locale-aware formatting. **MEASURED HERE:** import `i18n` by deep path (`@servicenow/aiux/aiux-services/src/i18n.js`), never from the services barrel — see the WEB IDE BOUNDARY block.

### Step 7 — Validate

Run through `references/quality/validation-rules.md` and `references/quality/best-practices-checklist.md`. Fix all violations before presenting output. **WEB IDE:** also apply `scripts/validate-checks.md` with `fs_grep` + a read, and `run_diagnostics` on every changed file; a grep miss is not proof.

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
| Add nav item        | `<srcDir>/application.js` or `<srcDir>/pages/layout.js`   | `items[]` array                      | Active state, route path          |
| Change theme        | `<srcDir>/theme.js`                              | Token values                         | `appTheme` reference              |
| Add page route      | `<srcDir>/pages/` directory                      | New page file + nav                  | No route conflicts                |
| Modify widget data  | `<srcDir>/widgets/<name>/index.js` + `server.js` | Both files                           | Action name match, response shape |
| Add context sharing | Layout + consumer page                  | Context definition + provide/consume | `willUpdate` re-provision         |
| Add/edit `@configProperty` | `config-framework/config-field-types.md` | `@configProperty` decorators on component | `aiux-config-id` on all host instances (`config-id.md`) |
| Add gating          | `app/acl.md`                            | `@acl()` or `experienceAcls`          | Never `@roles()`; re-check after install |

---

## DEBUG Mode

Load: `references/quality/debugging-guide.md`

| Symptom                            | Check                           | Fix                                                                      |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| Blank page                         | Console errors, loader return   | Missing `isServer` guard; loader crash                                   |
| Widget shows no data               | Server script                   | Must be `(function(data, options, input) { ... })(data, options, input)` |
| Widget not rendering               | `@customElement` + export       | Missing decorator or wrong base class                                    |
| Widget silently renders `null`     | Context mixin without provider  | Page has no `<aiux-list-provider>`/`<aiux-record-provider>` — drop the mixin or add the provider |
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
| `isolate bundle failed … Could not resolve import "#context"` | Services-barrel import (**MEASURED HERE**) | Deep-import `@servicenow/aiux/aiux-services/src/i18n.js` — see the WEB IDE BOUNDARY block |
| Change appears not to apply after install | Stale build output (**MEASURED HERE**) | Delete **both** `dist/` and `dist-metadata/`, then have the user rebuild + reinstall |
| Lux page shows the tag name as its title | Unhydrated SSR shell (**MEASURED HERE**) | Reload once; verify with `atf-cloud-runner`, not `ui_diagnostics` |
| Own pages assigned to a host experience | Mixed-project support in the installed build | Check `isolateBundlePaths` for a second `isolate/src/extensions/.../application.js` — see *Mixed projects* |

---

## ANALYZE Mode

Load: `references/quality/audit-checklist.md`, `references/quality/best-practices-checklist.md`

10-category audit: Structure → Base classes → SSR safety → Styling → i18n → Accessibility → Performance → Security → Observability → Chat integration.

---

## Key Imports

**WEB IDE — read `package.json` first.** If the app depends on the umbrella `@servicenow/aiux`, translate every `From` value below to its subpath (`@servicenow/aiux/aiux-components-core`, etc.). Copying this table verbatim without checking is a resolution failure.

| Import                                                              | From                                    | Purpose                      |
| ------------------------------------------------------------------- | --------------------------------------- | ---------------------------- |
| `html`, `css`, `nothing`, `isServer`                                | `lit`                                   | Templates, styles, SSR guard |
| `customElement`, `property`, `state`, `query`                       | `lit/decorators.js`                     | Lit decorators               |
| `classMap`                                                          | `lit/directives/class-map.js`           | Conditional CSS classes      |
| `repeat`                                                            | `lit/directives/repeat.js`              | Keyed list rendering         |
| `cache`                                                             | `lit/directives/cache.js`               | State-switching templates    |
| `AIUXElement`, `AIUXWidgetElement`, `WithData`, `withWidgetContext` | `@servicenow/aiux-components-core`      | Base classes                 |
| `withListContext`, `AIUXListElement`, `AIUXListProvider`, `AIUXListConnected` | `@servicenow/aiux-components-list` | List provider/context base class + mixin. **MEASURED HERE:** these are **not** in `aiux-components-core` — read from `node_modules/@servicenow/aiux/components/list/index.js` |
| `withRecordContext`, `AIUXRecordElement`, `RecordContext` | `@servicenow/aiux-components-record` | Record provider/context base class + mixin. **MEASURED HERE:** likewise not in `aiux-components-core` — read from `node_modules/@servicenow/aiux/components/record/index.js` |
| `decorators`, `createContext`, `getHeaders`                         | `@servicenow/aiux-components-core`      | Platform APIs                |
| `configProperty`, `externalConfig`                                  | `@servicenow/aiux-components-core`      | Config decorators (widget)   |
| `elementId`                                                         | `@servicenow/aiux-components-core`      | Config binding — auto-imported by the `aiux-config-id` desugar; import by hand only inside `layout` templates |
| `aiuxFetch`, `fetchDataResource`                                    | `@servicenow/aiux-components-core`      | Client fetch + data broker   |
| `registerActions`, `unregisterActions`, `executeAction`, `broadcastAction`, `listActions`, `action`, `ActionController` | `@servicenow/aiux-components-core` | Widget-to-widget action registry (see `references/widget/action-registry.md`) |
| `isPluginActive`, `getSystemProperty`, `getLogger`                  | `@servicenow/aiux-components-core`      | Plugin checks, logging       |
| `userContext`, `getAMBService`                                      | `@servicenow/aiux-components-core`      | User context, real-time      |
| `i18n`, `locationService`, `recordWatcherService`                   | `@servicenow/aiux-services`             | Platform services. **MEASURED HERE:** never import the barrel in page/widget code — deep-import the module (`@servicenow/aiux/aiux-services/src/i18n.js`) or the isolate bundle fails |
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
| `AIUXWidgetElement`              | `AIUXElement`       | Widgets with `this.server` and no provider (home, dashboard, standalone) |
| `withListContext(AIUXWidgetElement)` / `withRecordContext(AIUXWidgetElement)` | `AIUXWidgetElement` | Widgets on a list or record page that read its provider; `_list` / `_record` |
| `WithData(AIUXWidgetElement)`    | `AIUXWidgetElement` | Widgets that auto-bind `this.data` from server |
| `withWidgetContext(AIUXElement)` | `AIUXElement`       | Chat-integrated widgets                        |
| `AIUXRecordElement`              | `AIUXElement`       | Record-provider pages and widgets; `_record`    |
| `AIUXListElement`                | `AIUXElement`       | List-provider pages and widgets; `_list`       |

For a host-backed record or list view page, prefer the exported context base class above and compose provider-bound leaves. Do not fetch the host's rows/record again. Mixins are for a different base or intentionally optional provider placement, not the default recipe. Read `references/app/extensions.md` for view-page layout and SDK compatibility checks. For a general-purpose record/list widget authored in Builder (not bound to a host view page), see `references/widget/record-widgets.md` or `references/widget/list-widgets.md` for base-class choice, the paired `@discoverable(true, {requiresPageType: [...]})` declaration, and what's safe to change when editing one later.

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
- [Backend Layer](references/app/backend-layer.md) — Deploy pipeline, build commands, common gotchas. **WEB IDE: superseded in full by the boundary block above**, except its own WEB IDE BOUNDARY note, which is current
- [Extensions](references/app/extensions.md) — Overlaying pages on a host app via `<srcDir>/extensions/`, path conventions, page/loader/layout templates, nested layout precedence, mixed-project support, and **view pages**: why they have no loader, and how a `list/<view>/` or `record/<view>/` page consumes the host's provider instead of fetching
- [ACLs](references/app/acl.md) — `@acl()` on pages/widgets, `experienceAcls` in `aiux.json`, rule shape, build-time checks, decision caching
- [Page Collections](references/app/page-collections.md) — Several pages on one route resolved per user: `_variants/`, `@acl()`/`@order()`, declaring the role, the ungated-fallback ordering trap, verification
- [Page Views](references/app/page-views.md) — `glide/list|record/<view>/view.js`, `@table()` overrides, how it differs from page collections
- [Regions](references/app/regions.md) — `regions/` file convention (build-enforced), `row`/`column`/`raw` primitives, attribute grammar, common parse errors

### Widget

- [Component Patterns](references/widget/component-patterns.md) — Properties, lifecycle, events, i18n, templates
- [Server Scripts](references/widget/server-scripts.md) — IIFE pattern, GlideRecord, action routing, security
- [Data Fetching](references/widget/data-fetching.md) — `this.server`, loading states, record watcher, debounced search
- [Chat Integration](references/widget/chat-integration.md) — `withWidgetContext`, `setAiContext`, `client_tools`
- [Action Registry](references/widget/action-registry.md) — Start here on any "configure/add an action" request: disambiguates a native ServiceNow UI Action (`sys_ui_action`, platform config, no widget code) from a custom registry entry (`registerActions`/`@action`/`ActionController`). Also covers `executeAction`/`broadcastAction`, `listActions`, widget-to-widget invocation (distinct from client tools), and keyboard shortcuts
- [Observability](references/widget/observability.md) — `getLogger`, `createLogger`, severity guide, `lazyImage`
- [Record Widgets](references/widget/record-widgets.md) — General-purpose record-context widgets: mixin base class, reading `this._record`, which record page components already exist (never rendered from a widget)
- [List Widgets](references/widget/list-widgets.md) — General-purpose list-context widgets: mixin base class, reading `this._list.state`, which list page components are fixed
- [Decorators](references/widget/decorators.md) — All Lit and AIUX platform decorators
- [Config Field Types](references/config-framework/config-field-types.md) — `@configProperty` decorator: semantics, base schema, localization, all field types
- [Config aiux-config-id](references/config-framework/config-id.md) — Exposing widget config in host pages via `aiux-config-id`
- [Config Groups](references/config-framework/config-groups.md) — Accordion grouping with `static configGroups`
- [Config External](references/config-framework/config-external.md) — `@externalConfig` for opening a platform table
- [Config dependsOn](references/config-framework/config-depends-on.md) — Conditional field visibility
- [Config Modes](references/config-framework/config-modes.md) — Custom config UI: `custom-url`, `inline-auto` (self-config)
- [Regions](references/config-framework/regions.md) — Editable region layouts: root `regions/` module, relative import depth, DSL grammar, verification

### Design

- [CSS Custom Properties](references/design/css-custom-properties.md) — **Load before writing any CSS.** Color tokens, typography, motion, spacing, radius, `:host` rules, production patterns
- [DaisyUI Patterns](references/design/daisyui-patterns.md) — Component classes, `aiux-` prefix, card/badge/alert/dropdown patterns
- [Tailwind Reference](references/design/tailwind-reference.md) — Layout, spacing, typography, color utility classes

### Quality

- [Debugging Guide](references/quality/debugging-guide.md) — Expanded symptom → fix diagnostics
- [Validation Rules](references/quality/validation-rules.md) — Assertions checked after every implementation
- [Best Practices Checklist](references/quality/best-practices-checklist.md) — P1–P43 checklist
- [Audit Checklist](references/quality/audit-checklist.md) — 10-category app health audit

### Local resources (not in the pack)

- [Validate Checks](scripts/validate-checks.md) — **WEB IDE:** all 30 checks from the unrunnable `scripts/validate-component.js` (8 must-fix, 13 warnings, 9 suggestions), applied with `fs_grep` + a read. Load with `load_skill_resource`
