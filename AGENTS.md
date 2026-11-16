# AGENTS.md

Guidance for AI coding agents working in **SLux** — an AIUX **extension** application.

## Start Here

Use `AGENTS.md` as the canonical guidance file for coding agents such as Claude Code, Gemini CLI, Codex, Cascade, and other repository-aware assistants. Tool-specific files such as `CLAUDE.md` and `GEMINI.md` should point back here instead of duplicating project rules.

## Mandatory UI Edit Checklist

For any request that involves building or updating UI:

1. Invoke the `ui-discovery` skill first — before writing code or making a plan.
2. Evaluate reusable components and instance widgets together. If a candidate exists, use the best match and proceed without asking for confirmation.

Use the ServiceNow AIUX skills before changing app code:

- `ui-discovery` — see Mandatory UI Edit Checklist above
- `aiux:aiux-build` for pages, routes, layouts, widgets, server scripts, `AIUXElement` lifecycle/decorators/loaders/context patterns, and deploy pipeline work
- `horizon-design-knowledge:design-knowledge` for UI generation and design standards
- `accessibility:accessibility` for accessibility audits and fixes

The ServiceNow agent packs are declared in `package.json` dev dependencies, so they install with the project. A `postinstall` script copies the packs' skills from `node_modules/@servicenow/agent-pack-*` into `.claude/skills` automatically on every `pnpm install` — no manual step, and it works for any agent rather than relying on a Claude-specific hook. Run `pnpm agent:skills` to force a re-copy (e.g. after editing a skill, or if you installed with `--ignore-scripts`).

Keep `.claude/skills/` and the `.agents/skills` link out of `.gitignore`: some coding agents block reads of Git-ignored files, including skill references. Keep dependencies, caches, secrets, and build outputs ignored; do not enable blanket access to Git-ignored files just to read skills. Skill copies remain excluded from ESLint. Review changes after `pnpm install` or `pnpm agent:skills`, which refresh the copies and can overwrite local edits.

## Extension Model

This app **extends an existing host experience** rather than defining its own. Pages live under one of two directory conventions, rooted at `<srcDir>` — the value of `srcDir` in this app's `aiux.json` (scaffolded as `src/lux`):

```
# Convention 1 — host project id + route id (scaffolded default)
<srcDir>/extensions/<host_project_id>/<host_route_id>/pages/<route>/page.js
<srcDir>/extensions/<host_project_id>/<host_route_id>/application.js        # optional per-host lifecycle

# Convention 2 — direct host experience sys_id
<srcDir>/extensions/<experience_sys_id>/pages/<route>/page.js
<srcDir>/extensions/<experience_sys_id>/application.js                 # optional per-host lifecycle
```

- `<host_project_id>` is the host project's `projectId` from its `aiux.json` (e.g. `sn_app_aict_ui`). A host created before `aiux.json` had a `projectId` uses its scope as its project id. Look a host's project id up rather than deriving it from the scope or package name, since its form depends on how the host was created. On the instance, it's the experience's `source_aix_project.project_id`.
- `<host_route_id>` is the host experience's `url_suffix` route identifier (e.g. `aict`). It **must match the host** so these pages overlay the host's routes at `/aiux/<host_route_id>/…`.
- **The template ships this as `<srcDir>/extensions/__parentProjectId__/__parentRouteId__/`**, and `now-sdk init` prompts for the host project id and route id to fill it in. If either prompt was left blank, the placeholder survives scaffolding verbatim. Rename that directory (its `pages/` and any `application.js` move with it, since the binding is the path itself, not anything inside those files) before running `pnpm dev`, which now resolves the host from this path automatically (see Commands below) and will fail against a real instance if the placeholder is still in place.
- Convention 2 targets the host directly by its experience `sys_id`. Both conventions are discovered identically; a single project may mix them to target multiple hosts.
- The directory path — not any `aiux.json#extends` field — is what links this extension to its host. There is no `extends`/`routeMap` in `aiux.json`.
- `extension.js` is **not** read by the build. The lifecycle module is always named `application.js`.
- Contribute host chrome from `setup()` using the nav helpers from `@servicenow/aiux/aiux-components-nav`: `addNavItem`, `removeNavItem`, `setL3Nav`, `appendL3Nav`. These have no ownership tracking — they key purely on path string, so colliding with a path the host or another extension already uses silently overwrites or removes it. `addNavItem`/`removeNavItem` (and their current names, `appendL1Nav`/`prependL1Nav`/`removeL1Nav`) also accept an array to add/remove several L1 items in one call. `appendL2Nav`/`prependL2Nav`/`removeL2Nav` do the same one level down, for items nested under a specific L1's `l2Nav`.

### Lifecycle modules: root vs per-host

There are two places a lifecycle module can live, and they are not interchangeable:

| Module                                                                    | Binds to                                       | Needs pages? |
| ------------------------------------------------------------------------- | ------------------------------------------------ | -------------- |
| **Per-host** `<srcDir>/extensions/<host_project_id>/<host_route_id>/application.js` | Exactly that host                              | **No**       |
| **Root** `<srcDir>/application.js`                                         | The one host this app's extension pages target | **Yes**      |

- **This template scaffolds the per-host form**, at `<srcDir>/extensions/<host_project_id>/<host_route_id>/application.js`. It sits as a sibling of that host's `pages/` directory — not inside it — and is discovered, bundled, and registered on its own. `<srcDir>/extensions/<experience_sys_id>/application.js` is the convention-2 equivalent.
- To extend a **second** host, add another `application.js` under that host's directory with its own `setup()`. Each emits its own `sys_aix_widget` + `sys_aix_experience_extension` row, so hosts never share lifecycle logic.
- A **root** `application.js` (at `<srcDir>/application.js`) still works, but is the weaker option here: it is compiled only when the app has at least one page under `<srcDir>/extensions/`, and binds to a single host inferred from those pages. Prefer the per-host form. If both exist, the root module is **not** additionally registered against a host that has its own per-host module, so they never double-run.
- `.ts` is preferred over `.js` when both exist in the same directory.

### Which hooks actually run

- `setup()` — runs server-side during SSR (after the host's own `setup()`), and re-runs client-side only as a CSR fallback.
- `navigate(navCtx, ctx)` — **client-only**, on each in-app navigation, after the host's `navigate()`. An extension cannot return a redirect; only the host can.
- `teardown(ctx)` — **client-only**, after the host's `teardown()` on app exit.
- A throwing hook is caught and logged; it never breaks the host render or other extensions.
- Under `pnpm dev` the dev server renders on the main thread and does not run the isolate, so `setup()` fires **client-side only**. Verify nav contributions against a deployed instance before concluding SSR is broken.

## Do Not

- Do **not** add this app's own `<srcDir>/pages/` directory or a `landing` to `aiux.json`. Combining a project's own pages with `<srcDir>/extensions/` **pages** in one project is unsafe, not merely unsupported (STRY64103259) — the own pages get silently wired into the host's experience. If you need an app that both extends another app _and_ has its own pages, that is a **separate** app. (This hazard is specific to extension _pages_; a `<srcDir>/extensions/` tree containing only per-host lifecycle modules does not trigger it.)
- Do **not** add the host as a `package.json` dependency or import its page source. The project id/route id (or sys_id) in the file path is the entire coupling.
- Deploy **after** the host — its experience must already exist — then evict the tenant cache after every deploy; the effect is not immediate.

## Project Rules

- Components extend `AIUXElement` from `@servicenow/aiux/aiux-components-core`, never `LitElement`
- Guard browser globals with `isServer` from `lit`
- Use Tailwind + DaisyUI for styling; no `--now-*` CSS tokens
- Custom element tags are prefixed with this app's scope (kebab-cased) to avoid colliding with host or other extensions' elements
- Net-new pages the host doesn't own can be role-gated with `@roles(['admin'])`
- Prefer `pnpm build` before deploy

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm deploy
```

`pnpm dev` resolves the host declared under `<srcDir>/extensions/` automatically — the dev server itself points `aiux.json#development.host` at it and pulls the host's source into `.aiux/source-cache/` if it isn't already there, prompting once to confirm. Once set, this is a silent no-op on every later `pnpm dev`.

`pnpm dev` also checks in the background whether the host's source has changed on the instance since it was last pulled, and prints a boxed `UPDATE AVAILABLE` notice — either mid-session, the moment it finds one, or on the next `pnpm dev` if that session's already stopped by then — telling you to run `pnpm dev:refresh-extension-host` (also the command to force a re-check/re-pull on demand, with or without a notice).
