---
name: pages-extensions-generator
description: Creates AIUX extension pages that overlay a host application using Karuna's nested layouts framework (STRY64337616). Use when building extension pages in src/extensions/ — for standalone application pages in applications/*/pages/, use aiux-build instead.
metadata:
  author: servicenow
  version: '1.0.0'
  relatedStory: STRY64337616
compatibility: Works with Claude Code, Cursor, VS Code Copilot, Windsurf
license: MIT
---

# Creating AIUX Extension Pages

> ## 📍 RETARGETED — this skill is now a thin local supplement
>
> **This skill was DROPPED from the agent pack at v3.0.0.** Its capability was absorbed into
> **`aiux-build` → `references/app/extensions.md`**, which is already updated locally to the v3.0.0
> version and is **substantially better than what this skill used to restate**: it adds view pages
> (`list/<view>/`, `record/<view>/`), the duplicate-root collision guard, Convention 3 (the `glide`
> alias), the project-id lookup, and the `isolateBundlePaths` trap analysis.
>
> **So: `aiux-build` → `references/app/extensions.md` is the authority** for path conventions,
> templates, layout precedence and the key-differences table. Load it with
> `load_skill_resource(skill_name: "aiux-build", file_path: "references/app/extensions.md")` and
> follow it. This file now carries **only** what nothing upstream covers: placeholder resolution, the
> dead-path table, the `assets/` templates, the host-existence precondition, this app's measured
> extension path, and the measured services-barrel build trap.
>
> **Convention on this page:** statements marked **[local — measured]** were verified in this project
> and outrank the pack. Statements marked **[local — environment]** exist because this IDE has no
> shell. Everything else is a pointer into the pack.

> ## ℹ️ APPLICABILITY — check the project shape first
>
> This skill covers the **extension** shape: pages under `<srcDir>/extensions/` that overlay a host
> application. An AIUX project is either that or **experience-owning** (`aiux.json` carries `basename` +
> `landing`, pages in `pages/<route>/page.js`, root `application.js`). Mixed projects are supported by
> current SDK builds — see *Scaffolding Options* and *Preserve the host shell in a mixed project* in
> `references/app/extensions.md`, which supersedes the older blanket "never both" claim (STRY64103259)
> that this file used to make.
>
> **Read `AGENTS.md` to determine which shape this project is before using this skill.** If it owns its
> own experience and you only want a normal page, use `aiux-build` with `pages/<route>/page.js`.
>
> ## ⚠️ WEB IDE BOUNDARY — read before following any step below
>
> No shell exists in this IDE. Read **`AGENTS.md`** first.
>
> - **[local — environment] `mkdir -p` is unnecessary** — `fs_write_file` creates parent directories.
> - **[local — environment] `cp assets/<template>.js <target>`** → `fs_read_file` the template,
>   **substitute its placeholders**, then `fs_write_file` the target. Never write it unsubstituted.
> - **[local — environment] Then `run_diagnostics`, and stop.** `build` and `install` are **user
>   actions**. Deploy must follow the host, and the tenant cache must be evicted after every deploy —
>   the effect is not immediate, so a stale page is not automatically a bug.
> - **[local — environment] `AGENTS.md` is authoritative on project conventions.** `extension.js` is
>   **not** read by the build (the lifecycle module is always `application.js`), and nav helpers key on
>   the **path string only** with no ownership tracking — colliding with a path the host or another
>   extension uses silently overwrites it. A file nothing imports **is not built**.

## 1. Confirm the host exists — before writing anything

**[local — environment]** `run_query` on **`sys_aix_experience`** for the host's `url_suffix`
(Convention 1's route id) or its `sys_id` (Convention 2). **The directory path _is_ the entire
coupling, so a typo produces a page that silently belongs to nothing** — no build error, no runtime
error, just a page attached to no experience.

Record two things from that row:

- its **`url_suffix`**, and
- its **project id**, read from `source_aix_project.project_id` — the Convention 1 directory name.
  (See *Path Conventions* in `references/app/extensions.md`: a host created before `aiux.json` had a
  `projectId` uses its scope as its project id, so look it up rather than deriving it.)

> ### 🔴 [local — measured] Empty `content_hash` / `extendable` is NOT a blocker
>
> **This file previously said a host whose `content_hash` is empty "has no bundle and renders nothing
> — do not extend it." That is FALSE, and it was disproved here by measurement.** The Sales Portal
> host experience — `sys_aix_experience` `sys_id` **`29aa0e97fb97fe5089ecfee34eefdc09`**, `url_suffix`
> **`salesportal`**, scope **`sn_ex_emp_hub_mw`** — has **both `content_hash` and `extendable`
> empty**, and it **renders perfectly in a real browser**: nav, widgets and the user session are all
> present, and an extension page overlaid onto it works.
>
> **The correct precondition is only: the host experience EXISTS.** Note its `url_suffix` and project
> id and proceed. Do not read `content_hash` or `extendable` as gates, and do not refuse to extend a
> host because they are empty. *(Kept as a local override so the next merge does not reintroduce the
> false gate.)*

## 2. Resolve the `now-sdk init` placeholders — then rename the directories

**[local]** A freshly scaffolded project may contain the tree
`<srcDir>/extensions/__parentScopeName__/__parentRouteId__/`.

> **Placeholders like `__parentScopeName__` / `__parentRouteId__` are unresolved `now-sdk init`
> template tokens, not build-time variables.** Nothing substitutes them: neither `aiux.json` nor
> `now.config.json` carries a host field, and the build emits them verbatim into record keys.

Resolve them by querying `sys_aix_experience` for the host's scope and `url_suffix` (step 1), then
**rename the directories** to the real host project id / basename. Leaving them in place produces
record keys containing the literal token text.

## 3. Write the page — path conventions and templates

Path conventions (all three, including the `glide` alias and the duplicate-root collision guard),
the page/loader/layout templates, layout precedence, view pages and the key-differences table are
in **`references/app/extensions.md`**. Do not restate them from this file or from memory.

### [local — measured] The real extension path for THIS app

`aiux.json` here sets **`srcDir: "src/lux"`**, so extension pages live at:

```
src/lux/extensions/<host-project-id>/<host-basename>/pages/<route>/page.js
```

**Extensions are the one exception to the project-root fallback:** with `srcDir` **unset** they are at
**`src/extensions/`**, never project-root `extensions/`. Verified against
`node_modules/@servicenow/aiux/core/commons/project-config.js` → `resolveSrcPath`.

**Key:** extension pages use `page.js` (not `index.js`). The route is derived from the directory path.

### Templates — `assets/` (local-only; the pack ships no asset files)

**[local]** v3.0.0 inlines template *code* into `references/app/extensions.md` prose but ships **no
asset files**. These three remain on disk here and are still the instantiable templates:

- **`assets/application-page-template.js`** — page component with loader
- **`assets/loader-template.js`** — data-fetching module
- **`assets/layout-override-template.js`** — custom layout for extensions

Instantiate, never copy: `fs_read_file` the template, substitute its placeholders
(`{{TAG_NAME}}`, `{{PAGE_TITLE}}`, `{{PAGE_PATH}}`, `{{CLASS_NAME}}`, `{{NAV_LEVEL}}`, the
`x-scope-…` tag and the class name), then `fs_write_file` to the target path. Apply the import fix in
§4 while substituting.

## 4. 🔴 [local — measured] The services-barrel import trap

**Upstream's extension page template still gets this wrong.** v3.0.0's own template in
`references/app/extensions.md` writes a **barrel** import (and
`assets/application-page-template.js` here writes the same barrel under its other specifier form,
`@servicenow/aiux-services` — substitute it too):

```js
import {i18n} from '@servicenow/aiux/aiux-services'; // ❌ fails the build here
```

That exact import **failed a real build in this project** with:

```
Could not resolve import "#context"   (from core/observability/logger.js)
```

**Cause:** the services barrel is bundled **inline** by the isolate builder (`services/` is not in
`SN_PACKAGE_DIRS`), so it drags `core/observability` — and that module's `#context` subpath import —
into the isolate bundle, where it cannot resolve.

**The working fix, in use in this app — import the module directly:**

```js
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js'; // ✅
```

That module has **zero imports** and reads `globalThis.__WIDGET_MESSAGES__` when `window` is
undefined, which makes it SSR-isolate-safe. Apply it to every extension page, loader and layout you
instantiate, including when copying code out of `references/app/extensions.md`.

## 5. Dead-path resolution table

**[local]** The four `docs/**` pointers this skill originally carried are vendor monorepo paths and
are **not shipped in any pack available here**. Resolved to what actually exists:

| Original dead path | Use instead |
| --- | --- |
| `docs/arch-pages.md` — page architecture, routing, SSR | `aiux-build` → `references/app/pages-cookbook.md`, `references/foundation/ssr-safety.md`, and the File-Based Routing section of `references/app/navigation-patterns.md` |
| `docs/arch-header-config.md` — toolbar, L3 tabs, metadata | `migrate-header-config-review` → `references/header-config-contract.md` (authored, per-field evidence tiers, merged with pack v3.0.0's field list), plus the `setHeaderConfig` section of `aiux-build` → `references/app/navigation-patterns.md` |
| `docs/adr/application-extensions.md` — design rationale | `aiux-build` → `references/app/extensions.md`, and the Extension Model section of `AGENTS.md` |
| `docs/onboarding/.../08-extensibility/` — developer guide | `aiux-build` → `references/app/extensions.md` (now the authority), plus this file |

All of the above load with `load_skill_resource(skill_name: "<skill>", file_path: "<path>")`.

## Key Concepts

- **Pages = Lit web components** extending `AIUXElement`
- **Loaders = SSR data fetching** via `static async loader(ctx)`
- **Layouts = nested inheritance** with per-level most-specific-wins precedence
- **Extensions = overlay pages** on host applications without modifying host code
- **Host-level chrome** (nav items, etc.) comes from `application.js` exporting `setup(ctx)` —
  `extension.js` is not read by the build

Details for every one of these: `aiux-build` → `references/app/extensions.md`.

## Related Skills

| Skill                | Relationship                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aiux-build           | **Authority** for extension path conventions, templates, layout precedence, view pages (`references/app/extensions.md`)                                                                   |
| accessibility        | Required: extension pages render real UI (HTML structure, CSS, interactive elements) and must comply with WCAG 2.2 AA — ARIA labeling, keyboard navigation, and SSR-safe focus management |
| internationalization | Required: all user-visible strings in page/loader templates must use `i18n.getMessage()` — never hardcoded English. Read its boundary block: the AIUX message API has **no ICU plural/gender support**, and the argument must be a literal |
| aiux-instance-ops    | The `run_query` / confirm-then-read-back discipline behind step 1                                                                                                                          |

## When to Use This Skill

- Building extension pages under `<srcDir>/extensions/` (`src/lux/extensions/` in this app)
- Resolving `__parentScopeName__` / `__parentRouteId__` placeholders in a freshly scaffolded tree
- Confirming a host experience exists before coupling a page to it
- Instantiating the `assets/` page / loader / layout templates
- Hitting `Could not resolve import "#context"` on an extension page build (§4)
- Not for standalone application pages — use **aiux-build** for those
