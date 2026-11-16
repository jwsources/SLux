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

> ## ℹ️ APPLICABILITY — check the project shape first
>
> This skill covers the **extension** shape: pages under `src/extensions/` that overlay a host
> application. An AIUX project is either that or **experience-owning** (`aiux.json` carries `basename` +
> `landing`, pages in `pages/<route>/page.js`, root `application.js`) — **never both**, because own pages
> plus extension pages in one project is unsafe, not merely unsupported (STRY64103259): the own pages get
> silently wired into a host's experience.
>
> **Read `AGENTS.md` to determine which shape this project is before using this skill.** If it owns its own
> experience, stop and use `aiux-build` with `pages/<route>/page.js` instead; `aiux-build`'s boundary block
> also carries the one-way procedure for converting an extension app into an experience-owning one.
>
> ## ⚠️ WEB IDE BOUNDARY — read before following any step below
>
> No shell exists in this IDE. Read **`AGENTS.md`** first.
>
> - **`mkdir -p` is unnecessary** — `fs_write_file` creates parent directories.
> - **`cp assets/<template>.js <target>`** → `fs_read_file` the template, **substitute its placeholders**,
>   then `fs_write_file` the target. Never write it unsubstituted.
> - **Placeholders like `__parentScopeName__` / `__parentRouteId__` are unresolved `now-sdk init` template
>   tokens, not build-time variables.** Nothing substitutes them: neither `aiux.json` nor `now.config.json`
>   carries a host field, and the build emits them verbatim into record keys. Resolve them by querying
>   `sys_aix_experience` for the host's scope and `url_suffix`, then **rename the directories**.
> - **Confirm the host exists before writing anything:** `run_query` on `sys_aix_experience` for the
>   `url_suffix` (Convention 1's route id) or the `sys_id` (Convention 2). The directory path **is** the
>   entire coupling, so a typo produces a page that silently belongs to nothing. A host whose
>   `content_hash` is empty has no bundle and renders nothing — do not extend it.
> - **Then `run_diagnostics`, and stop.** `build` and `install` are **user actions**. Deploy must follow the
>   host, and the tenant cache must be evicted after every deploy — the effect is not immediate, so a stale
>   page is not automatically a bug.
> - **The four `docs/**` pointers are dead** — vendor monorepo paths, not shipped in this package. Each is
>   **resolved to a shipped or authored equivalent** in the Full Documentation table below; use that table
>   rather than hunting for the original paths.
> - **`AGENTS.md` is authoritative on project conventions.** `extension.js` is **not** read by the build
>   (the lifecycle module is always `application.js`), and nav helpers key on the **path string only** with
>   no ownership tracking — colliding with a path the host or another extension uses silently overwrites
>   it. A file nothing imports **is not built**.

Extend an existing AIUX application with overlay pages using nested layouts (STRY64337616 — Lorenzo Mendes), without modifying host application code. To scaffold a standalone application page under `applications/*/pages/` instead, use the **aiux-build** skill.

## Quick Start

### Extension Pages (Convention 1: scope + basename)

Target path — `fs_write_file` creates the directories, so there is no `mkdir` step:

```
src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js
```

Instantiate the template rather than copying it: `fs_read_file`
`assets/application-page-template.js`, substitute its placeholders, `fs_write_file` to the target above.

A freshly scaffolded project may contain the tree
`src/extensions/__parentScopeName__/__parentRouteId__/` with those two placeholders unreplaced — resolve
them to the real host scope and route id and rename the directories.

**Key:** Extension pages use `page.js` (not `index.js`). Route derived from directory path.

## Path Conventions

### Extension Pages: Two Formats

**Convention 1** (scope + basename — familiar):

```
src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js
src/extensions/sn_app_aict_ui/aict/pages/home/page.js
```

**Convention 2** (direct sys_id — explicit):

```
src/extensions/<experience-sys_id>/pages/<route>/page.js
src/extensions/2f86ed94fdab96a806bbbb5b8573c5d5/pages/home/page.js
```

Both formats are discovered identically. A single project can target multiple hosts by mixing conventions.

## Full Documentation

The four `docs/**` paths this section originally listed are vendor monorepo paths and are **not shipped**.
Resolved to what actually exists here:

| Original dead path | Use instead |
| --- | --- |
| `docs/arch-pages.md` — page architecture, routing, SSR | `aiux-build` → `references/app/pages-cookbook.md`, `references/foundation/ssr-safety.md`, and the File-Based Routing section of `references/app/navigation-patterns.md` |
| `docs/arch-header-config.md` — toolbar, L3 tabs, metadata | `migrate-header-config-review` → `references/header-config-contract.md` (authored, per-field evidence tiers), plus the `setHeaderConfig` section of `aiux-build` → `references/app/navigation-patterns.md` |
| `docs/adr/application-extensions.md` — design rationale | `aiux-build` → `references/app/extensions.md`, and the Extension Model section of `AGENTS.md` |
| `docs/onboarding/.../08-extensibility/` — developer guide | this skill plus `aiux-build` → `references/app/extensions.md` |

All of the above load with `load_skill_resource(skill_name: "<skill>", file_path: "<path>")`.

## Templates

Use the templates in `assets/`:

- **application-page-template.js** — Page component with loader
- **loader-template.js** — Data fetching module
- **layout-override-template.js** — Custom layout for extensions

Replace placeholders and implement your logic.

## Key Concepts

- **Pages = Lit web components** extending `AIUXElement`
- **Loaders = SSR data fetching** via `static async loader(ctx)`
- **Layouts = nested inheritance** with per-level most-specific-wins precedence
- **Extensions = overlay pages** on host applications without modifying host code

## Related Horizon Design Knowledge Skills

| Skill                | Relationship                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accessibility        | Required: extension pages render real UI (HTML structure, CSS, interactive elements) and must comply with WCAG 2.2 AA — ARIA labeling, keyboard navigation, and SSR-safe focus management |
| internationalization | Required: all user-visible strings in page/loader templates must use `i18n.getMessage()` — never hardcoded English                                                                        |

## When to Use This Skill

- Building extension pages in `src/extensions/`
- Implementing page loaders for SSR
- Setting up custom layouts for extensions
- When user mentions "create extension page", "add extension page", "extend page", "extension page layout"
- Not for standalone application pages in `applications/*/pages/` — use the **aiux-build** skill for that
