# SKILL-OVERRIDES.md

This file is the **overlay** for the vendor-delivered ServiceNow agent-pack skills installed under
`.build-agent/skills/`. It is loaded **by reference from `AGENTS.md`** and is read *alongside* a skill,
never instead of it.

**The rule it exists to enforce: vendor skill files are never edited. Every correction to vendor text
lives here, keyed by skill name.**

Precedence — per `AGENTS.md` § *Order of authority*: `AGENTS.md` and `TOOLNOTES.md` are **authority #1**;
nothing outranks a fact measured in this workspace. The AIUX pack skills are **authority #2**.
**This file is part of authority #1: where it contradicts a vendor skill, it WINS.** A vendor skill
sentence that this file voids is not to be acted on, however emphatic the skill is about it.

## Why this file exists

The packs are written for offline agents that have a shell. This IDE has none, so roughly a dozen
instructions per skill are void and several statements are simply wrong for this app. Those corrections
used to be hand-edited **into** the vendor files as inline "WEB IDE BOUNDARY" blocks. That made every
pack upgrade a full manual re-audit of every edited file — which is exactly what the
v2.6.0 → v3.0.0 upgrade cost: each file had to be diffed by hand, with local-only content at risk of
being silently overwritten. With the corrections out here, an upgrade is a mechanical file copy.

## Upgrade recipe

When a new `@servicenow/agent-pack-aiux` version lands in `node_modules/`:

1. **Copy vendor files ONE FILE PER `fs_copy` CALL.** Never copy a directory.
   **Measured: `fs_copy` on a directory replaces the destination subdirectory wholesale and deletes
   destination-only files — it lost 47 files earlier in this project.** Every file we added lives
   *inside* a skill directory, so one directory copy destroys them.
2. Skip the files in *Vendor files we deliberately do NOT copy* below.
3. After copying, re-read this file and confirm each correction below still applies to the new text —
   a correction the vendor has adopted can be deleted from here; a new void instruction must be added.
4. Do not move or rename anything in *Files we added that must survive a copy*:
   `load_skill_resource(skill_name, file_path)` only resolves paths **inside** a skill directory, so
   moving them breaks every call site.

### Vendor files we deliberately do NOT copy

| Vendor path | Why |
| --- | --- |
| `skills/aiux-build/scripts/validate-component.js` | Node CLI — cannot run here. Its checks are ported to `skills/aiux-build/scripts/validate-checks.md`. Keep it absent. |
| `skills/ui-discovery/scripts/sync-widgets.mjs` | Catalog-sync apparatus; void (no shell, instance is directly queryable). |
| `skills/ui-discovery/scripts/fetch-widget-source.js` | Replaced by `scripts/probe-widget-source.js` + `run_script`. |
| `skills/ui-discovery/scripts/sync-widget-catalog.js` | Part of the void catalog apparatus. |
| `skills/ui-discovery/scripts/setup-ui-discovery.mjs` | Postinstall/setup hook; void. |
| `skills/ui-discovery/scripts/generate-ui-discovery.js` | Regenerates the index between markers; void. |
| `skills/ui-discovery/scripts/lib/` | Support library for the above. |
| `skills/ui-discovery/package.json` | Scripts-package manifest for the above (the local text calls this `scripts/package.json`; upstream ships it at `skills/ui-discovery/package.json`). |
| `skills/figma-to-widget/scripts/figma-extractor.js` | Node CLI — cannot run here. What it actually does is ported to `scripts/figma-extraction.md`. Keep it absent. |
| `skills/figma-to-widget/scripts/design-translator.js` | Node CLI — ported to `scripts/design-translation.md`. Keep it absent. |
| `skills/figma-to-widget/scripts/extract-and-translate.js` | Combined Phase 1+2 CLI; void (no shell, and no way to send an `X-Figma-Token` header). |
| `skills/figma-to-widget/scripts/test-mock-pipeline.js` | Node test harness for the fixture pipeline; void. |
| `skills/figma-to-widget/scripts/validator.js` | Phase 5 Node CLI — apply the SKILL.md Phase 5 check tables by reading instead, plus the `console.log(` check they omit. |

### Files we added that must survive a copy

| Path | What it is for |
| --- | --- |
| `.build-agent/skills/aiux-build/scripts/validate-checks.md` | All 30 checks from the unrunnable `validate-component.js` (8 must-fix, 13 warnings, 9 suggestions), applied with `fs_grep` + a read. |
| `.build-agent/skills/ui-discovery/scripts/list-widgets.js` | `run_script` asset carrying the real widget discovery/ranking query + freshness digest. |
| `.build-agent/skills/ui-discovery/scripts/probe-widget-source.js` | `run_script` asset that extracts a widget's authored source server-side, with its field/row-count controls. |
| `.build-agent/skills/ui-discovery/references/**` | ~39 vendor reference files from v2.6.0 that v3.0.0 dropped (visualizations, directives, extra controllers/contexts, etc.) **plus** upstream's new ones. All of it stays — the local index table points at these paths. |
| `.build-agent/skills/figma-to-widget/scripts/figma-extraction.md` | Authored port of what `figma-extractor.js` **actually** does (real icon regex, unreachable container rules, undocumented `PACK` map / `radii` / ratio `lineHeight`), where the vendor Phase 1 prose is wrong. |
| `.build-agent/skills/figma-to-widget/scripts/design-translation.md` | Authored port of `design-translator.js`'s real maps (semantic DaisyUI colour classes, single-entry `CSS_VAR_MAP`, bare `btn`/`badge`, real `ICON_KEYWORDS` keys), where the vendor Phase 2 tables are wrong. |
| `.build-agent/skills/migrate-header-config/references/header-config-contract.md` | The header-config shape with per-field **evidence tiers**, the precedence ordering, the meaning of `null`, and the scope-creep guard. The pack has no equivalent; it outranks the vendor's inline "Header-config data shape" section. |
| `.build-agent/skills/pages-extensions-generator/**` | The entire skill — `SKILL.md` plus three `assets/` templates. The pack **dropped** this skill at v3.0.0, so it has **no upstream**: copy nothing over it, and do not delete it to "match" the pack. |

### Documented exceptions — vendor files we knowingly keep edited

| File | Why it stays edited |
| --- | --- |
| `.build-agent/skills/ui-discovery/SKILL.md` | Its core content is the **Unified UI Index** table, which we maintain as a **union** of upstream's v3.0.0 rows and the ~39 v2.6.0 rows upstream dropped but whose reference files we still ship. Overwriting it with the vendor copy deletes those rows and orphans `references/**`. On upgrade: **merge** new vendor rows into the local table, do not replace the file. The file itself carries a note at the top saying so. Its other local divergences are listed under *Per-skill overrides → ui-discovery*. |
| `.build-agent/skills/pages-extensions-generator/SKILL.md` | **Not a vendor file — the rule does not apply.** The pack dropped this skill at v3.0.0, so it has no upstream to diverge from; it is now an authored local skill. Listed here only so nobody looks for a pristine copy to restore it to, or treats its local-only content as drift. Edit it freely. |
| `.build-agent/skills/internationalization/SKILL.md` | 🔴 **MEASURED: its vendor `description` will not parse, so the skill silently fails to register.** The frontmatter `description` must be minimally repaired or the skill vanishes from `available_skills` and `activate_skill` fails with "Skill not found" — no error, no log line. **The body stays pristine; only the `description` is touched.** See *Frontmatter repair* below. On upgrade, copy the file then re-apply the repair and confirm the skill appears in `available_skills` on the NEXT message. |
| `.build-agent/skills/localization/SKILL.md` | 🔴 **Same measured failure, same repair, same reason.** Its vendor `description` additionally contains `Prerequisite: internationalization.` — a colon-space inside a plain scalar, which is a second independent parse hazard. Body pristine, `description` repaired. |
| *(none for `accessibility`, `figma-to-widget`, `migrate-header-config`)* | These three `SKILL.md` files are **byte-identical to `node_modules/` at v3.0.0** — copy them straight over on upgrade. Their corrections live under *Per-skill overrides* below. |

### Frontmatter repair — the one case where editing a vendor file is mandatory

🔴 **Measured in this project, Nov 2026.** The skill loader parses each `SKILL.md`'s YAML frontmatter.
**A description containing certain characters aborts that parse and the skill is dropped in total
silence** — it simply does not appear in `available_skills`, and `activate_skill` reports
"Skill not found". Nothing logs a parse error, so the symptom looks like a registry or caching bug.

**How it was isolated:** restoring the vendor `internationalization` and `localization` `SKILL.md`
files to pristine removed both skills from the registry. Editing the **`description`** field restored
each one. Two theories were tested and **disproven** on the way:

- *"The extra `compatibility:` / `license:` keys break it."* No — `accessibility`, `aiux-build` and
  `figma-to-widget` all carry both keys and load fine.
- *"A malformed quote inside `compatibility:` breaks it."* No — `internationalization` loaded with
  `compatibility:` unquoted and its description changed, and failed with `compatibility:` quoted
  correctly and its description pristine. **The discriminator is the `description` field alone.**

**The hazardous characters** are YAML indicators that are illegal or ambiguous in a *plain*
(unquoted) scalar. Both vendor descriptions contain `{technology}` — `{` opens a flow mapping — and
`localization`'s also contains `Prerequisite: internationalization.`, where `: ` is a key separator.

**The repair:** make the `description` a valid scalar while preserving its meaning — the description
is what an agent reads to decide whether to activate the skill, so do not gut it. Either quote the
whole value, or neutralise the indicator characters. **After repairing, the registry only refreshes
between messages: a skill does not reappear until the NEXT message.** Do not conclude the repair
failed in the same turn you made it.

⚠ **This is the one place "never edit a vendor file" cannot hold.** An unloadable skill is strictly
worse than a non-pristine one. Repair the frontmatter, keep the body pristine, and record it here.

## Global corrections — apply to EVERY pack skill

- **There is no shell.** Every `pnpm`, `node`, `npx`, `curl`, `find`, `grep` and `diff` instruction in
  any pack skill is void. Never claim you ran one.

  | Pack command | Here | Who runs it |
  | --- | --- | --- |
  | `pnpm run build` | the `build` tool | **user action** |
  | `pnpm run deploy` / `deploy:full` | the `install` tool (`deploy:full` = `build` then `install`) | **user action** |
  | `pnpm run dev` | *no equivalent* — see render verification below | — |
  | `pnpm install` | already done; read `node_modules/` with `fs_read_file` | — |
  | `node scripts/validate-component.js` | `scripts/validate-checks.md` + `fs_grep` + `run_diagnostics` | you |

- **`build` and `install` are USER ACTIONS.** Prepare the change, `run_diagnostics` it, report it ready,
  and ask the user to run them. Never run either yourself and never claim a change works because it
  "would build".
- **`ui_diagnostics` HANGS THE IDE on an AIUX/Lux portal route** (`/aiux/<basename>/...`) — measured,
  user-confirmed, no exception. It remains fine on ordinary platform pages. For a Lux route use the
  **`atf-cloud-runner` browser tools** (real out-of-process browser, accessibility snapshot you can
  diff), and **reload once** — the first load serves the stale SSR shell. The tell that you are looking
  at the unhydrated shell is a page title still showing the custom-element tag name.
- **Clear BOTH build outputs: `dist/` AND `dist-metadata/`.** Any pack text saying "delete `dist/`" is
  half the fix; deleting only `dist/` produces a stale install that looks like a code bug.
- **`fs_grep` / `fs_glob` / `fs_tree` silently skip `node_modules/` and dot-directories** such as
  `.build-agent/`. A zero result there is a **false zero**. Use `fs_read_file` / `fs_read_directory`.
- **The `[param]`-glob trap:** a glob containing a bracketed route directory
  (e.g. `<srcDir>/pages/case/[id]/page.js`) matches **nothing** — the brackets parse as a character
  class. Use a `*` wildcard for that segment.
- **`fs_copy` on a directory is destructive** — it replaces the destination subdirectory wholesale and
  deletes destination-only files (47 files lost earlier in this project). Always copy **one file per
  call**.

## Per-skill overrides

### aiux-build

**Void instructions**

- `references/app/backend-layer.md` **§ Build & Deploy Pipeline and § Dev Server are superseded in
  full** by the global command table above. `pnpm run build` / `deploy` / `deploy:full` / `dev` cannot
  be run; `build` and `install` are user actions. The file's **Common Gotchas** and **Role/ACL
  Contract** sections remain valid — the three-way scope alignment (`now.config.json`, `aiux.json`,
  `package.json`) is directly checkable here with `fs_read_file`.
- `scripts/validate-component.js` **cannot run** (Node CLI). All **30 of its checks** — 8 must-fix,
  13 warnings, 9 suggestions — are ported to `scripts/validate-checks.md`
  (`load_skill_resource(skill_name: "aiux-build", file_path: "scripts/validate-checks.md")`). Apply them
  with `fs_grep` plus a read of the file. **Every detector is a substring/regex test, not AST: a hit is
  a lead, a miss is not proof.** Type and syntax defects belong to `run_diagnostics`, not grep — run it
  on every file you change. `references/quality/validation-rules.md` and
  `best-practices-checklist.md` remain the authoritative prose.
- `references/app/extensions.md` **scaffold lines** (`npx @servicenow/sdk … init`, `pnpm build &&
  deploy`) are void — this project is already scaffolded. Its path conventions, nested-layout
  precedence and mixed-project guidance stay.
- "Check the resolved `tailwind.css` after `pnpm install`" → dependencies are already installed;
  `fs_read_file` it under `node_modules/` directly.
- "Check `pnpm build` output for compilation errors" → `run_diagnostics`; anything beyond that needs
  the user's build.
- `pnpm run dev` as the render-verification route → use `atf-cloud-runner`, **not** `ui_diagnostics`,
  on a Lux route (see global).
- Anything under `src/fluent/` is **not this skill's subject**: it is governed by `explain_fluent_doc` /
  `search_fluent_docs`, and server-side field access must be validated with a read-only `run_script`
  probe before shipping (a build checks syntax; it cannot see a field that does not exist). The same
  note applies to `references/app/backend-layer.md`'s Fluent SDK file map.

**Corrections**

- **Companion skills activate by *registered* name** with `activate_skill`: `ui-discovery`,
  `accessibility`, `internationalization`, `localization`, and **`migrate-header-config-review`** —
  that is its registered name; its folder is `migrate-header-config`. The pack's companion table says
  `migrate-header-config` and will not activate.
- **Add `hint-lookup` to the companion list.** On-instance hint records, where an instance has them,
  outrank this pack on platform behaviour **and outrank training recall** — a curated hint record is
  measured, your recollection is not. Activate `hint-lookup` before acting on a platform-behaviour
  assumption. Do not cite hint records by name (existence is per-instance); check `AGENTS.md` for their
  status here, otherwise establish behaviour with `run_query` / `keyword_search` / `semantic_search`
  plus a read-only `run_script` probe.
- **Import specifiers depend on what `package.json` actually ships — read it.** If the app depends on
  the umbrella `@servicenow/aiux`, use its subpaths (`@servicenow/aiux/aiux-components-core`,
  `@servicenow/aiux/aiux-services`, `@servicenow/aiux/aiux-components-nav`) rather than the bare
  package names in the skill's **Key Imports** table. The bare form is for widgets resolved by the AIUX
  import map and is valid only where those packages are direct dependencies. **Copying the table
  verbatim without checking is a resolution failure.**
- **Two rows missing from Key Imports** (verified against those packages' own `index.js` and
  `package.json`; they are **not** in `aiux-components-core`):
  - `withListContext`, `AIUXListElement`, `AIUXListProvider`, `AIUXListConnected` →
    `@servicenow/aiux-components-list` (read `node_modules/@servicenow/aiux/components/list/index.js`).
  - `withRecordContext`, `AIUXRecordElement`, `RecordContext` →
    `@servicenow/aiux-components-record` (read `node_modules/@servicenow/aiux/components/record/index.js`).
- **MEASURED: the services *barrel* breaks the isolate bundle — do not import it.** v3.0.0's own
  extension-page template still says `import {i18n} from '@servicenow/aiux/aiux-services';`. That exact
  import failed a real build here with
  `isolate bundle failed for page "...": Could not resolve import "#context" from ".../core/observability/logger.js"`.
  Root cause, read from `node_modules/@servicenow/aiux/core/commons/build-isolate-bundle.js`:
  `classifyExternal()`/`normalize()` rewrite `@servicenow/aiux/X` → `@servicenow/aiux-X`, after which
  `lit`, `aiux-components-core` and `aiux-components-record` become externals and `aiux-client` becomes
  an isolate stub — but `SN_PACKAGE_DIRS` is
  `['components','directives','controllers','mixins','libraries']` and `services/` is **not** in it, so
  the services barrel is bundled inline, dragging in `core/observability`, whose `logger.js` uses Node
  subpath imports (`#context`, `#processor`) that rollup's node-resolve rejects as "outside package".
  **Fix, in use and working:** `import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';`
  (`i18n.js` has zero imports and reads `globalThis.__WIDGET_MESSAGES__` when `window` is undefined, so
  it is SSR/isolate-safe; the exports entry `"./aiux-services/*": "./services/*"` makes it resolvable).
  **Caveat:** string extraction is specifier-keyed — the build extracts `t(...)` only when `t` is
  imported from `'@servicenow/aiux-services'` — so prefer `i18n.getMessage(...)` and wrap it in a local
  `utils/i18n.js` if extraction matters.
- **MEASURED: this project sets `srcDir: "src/lux"`.** Extension pages therefore live at
  `src/lux/extensions/<host-project-id>/<host-basename>/pages/<route>/page.js` — the verified working
  path, confirmed against `resolveSrcPath` in
  `node_modules/@servicenow/aiux/core/commons/project-config.js`. Substitute `src/lux` for `<srcDir>`
  throughout the skill.
- **Gating:** `@acl()` / `experienceAcls` is the current mechanism for new work; `@roles()` is retired
  (v3.0.0). Do not introduce it, do not recommend it in review; treat existing `@roles()` as legacy and
  read `references/app/acl.md` before changing it. (`backend-layer.md` § Role/ACL Contract omits this —
  it is stated here instead.)
- **Mixed projects (own pages + extension pages) are supported, but conditionally on the installed
  build** — verify, do not assume. Inspect the emitted metadata after the user's build/install and
  confirm the local experience survived and each extension page is bound to its own host. The
  build-level tell: if the manifest's `isolateBundlePaths` lists
  `isolate/src/extensions/.../application.js` **as well as** `isolate/application.js`, the installed
  build **lacks** the fix — on such a build omit the dedicated host `application.js`. This supersedes
  the earlier local rule that own `pages/` plus extension pages was unsafe (STRY64103259).
- **DEBUG-table rows the pack lacks:**
  - Widget silently renders `null` → context mixin used on a page with no
    `<aiux-list-provider>`/`<aiux-record-provider>`; drop the mixin or add the provider.
  - `isolate bundle failed … Could not resolve import "#context"` → services-barrel import; deep-import
    `…/aiux-services/src/i18n.js`.
  - Change appears not to apply after install → stale build output; delete **both** `dist/` and
    `dist-metadata/`, then have the user rebuild + reinstall.
  - Lux page shows the tag name as its title → unhydrated SSR shell; reload once, verify with
    `atf-cloud-runner`, not `ui_diagnostics`.
  - Own pages assigned to a host experience → mixed-project support missing in the installed build;
    check `isolateBundlePaths`.

**Authored procedure — converting an extension app to own its experience** (one-way; the pack has no
equivalent because its route is `now-sdk init`, which needs a shell):

1. Confirm the starting shape — `AGENTS.md`, then `aiux.json` (`basename`/`landing` present?) and
   whether `<srcDir>/extensions/` holds pages.
2. `aiux.json` — add `basename` (the route segment the app will own, serving `/aiux/<basename>/`) and
   `landing` (its default route).
3. Create `<srcDir>/pages/<route>/page.js` — *not* under `<srcDir>/extensions/`.
4. Create a root `<srcDir>/application.js` exporting `setup()`, with
   `applicationLayout: 'aiux-nav-layout'`.
5. Remove `<srcDir>/extensions/` entirely, including every per-host `application.js` — unless a *mixed*
   project is the deliberate target, in which case stop and follow the mixed-project requirements
   instead. A project left with both shapes is a mixed project, not a half-done conversion.
6. Hand build and install to the user, then have them evict the tenant cache — the effect is not
   immediate, so a stale page is not automatically a bug.
7. **Verify on the instance, do not assume:** `run_query` `sys_aix_experience` for `url_suffix` equal to
   the new `basename`, and confirm `content_hash` is non-empty (empty = no bundle, renders nothing).

⬜ **Unverified:** the full set of records the install creates for a newly owned experience was
documented only in an on-instance hint record, unavailable here. Enumerate what actually appears with
`run_query` after the user installs rather than trusting a remembered count.

**Marking convention** (previously a legend inside the vendor file): unmarked pack prose is
authoritative on SDK behaviour; **WEB IDE** marks a tooling correction, which wins over pack text that
assumes a shell; **MEASURED HERE** marks behaviour observed in this project and traced to installed
source under `node_modules/`, which wins over pack text it contradicts; ⬜ **Unverified** marks something
neither the files nor `node_modules/` establishes — do not assert it. Those markings now live **in this
file**, not in the vendor skill.

**Our added files**

- `scripts/validate-checks.md` — the 30 ported `validate-component.js` checks (8 must-fix, 13 warnings,
  9 suggestions), applied with `fs_grep` + a read; a miss is not proof. Load with `load_skill_resource`.

### ui-discovery

> **This skill's `SKILL.md` is a documented exception: it is deliberately kept edited.** See
> *Documented exceptions* above. Do not restore it from `node_modules/`. What follows records why it
> diverges, so a future agent neither "fixes" it nor loses the reasoning.

**Void instructions**

- Every `pnpm`, `node`, `npx`, `curl`, `find` and `grep` instruction in the vendor file is void; `build`
  and `install` are user actions. Where the vendor text and these corrections conflict, **these win**.
- **There is no widget catalog, and none is needed.** The whole sync-and-snapshot apparatus existed only
  because an offline agent could not query the instance. Void — do not attempt, do not mention to the
  user, do not ask permission for: `node …/sync-widgets.mjs`, its `--check` freshness mode, the
  `index current` / `index outdated` / `index freshness-unknown` vocabulary, the scripted permission
  request, the scripted failure speech, the "after a sync this file is out of date" caveat, the empty
  `<!-- WIDGET_INDEX_START/END -->` table, and the `<!-- WIDGET_PROVENANCE_START/END -->` "Widget index
  not synced" block. v3.0.0 **still ships all of it** — `scripts/sync-widgets.mjs`,
  `fetch-widget-source.js`, `sync-widget-catalog.js`, `setup-ui-discovery.mjs`,
  `generate-ui-discovery.js`, `scripts/lib/`, a scripts `package.json` — and hardcodes
  `.claude/skills/ui-discovery/scripts/` paths that do not exist here. None of it is installed into this
  skill and none of it must be reinstated.
  **Instead: query the instance at the moment you need it** — no snapshot, therefore no staleness
  problem.
- `node .claude/skills/ui-discovery/scripts/fetch-widget-source.js --key <scope>.<tag>` (vendor step 3)
  is void. Its only real work was two queries against `sys_aix_widget`; the manifest lookup, credential
  resolution and disk cache existed solely because it ran out of process. Replacements, both run via
  `run_script` after `load_skill_resource`:
  - **Discovery/ranking** — `scripts/list-widgets.js`. Carries the real query
    `type=aix_widget^category!=internal^category!=system^ORDERBYname`, prints each candidate's
    `importSpecifier`, `hasServerScript`, `chat_compatible`, `roles`, `dependent_widget_ids`, and a
    **digest** (`count` + `maxUpdated`) that is the whole freshness contract (`count` catches adds and
    deletes, `maxUpdated` catches edits).
  - **Authored source** — `scripts/probe-widget-source.js`. Carries the mandatory controls:
    `isValidField` across all 13 fields, a bogus-field control that must read `false`, a row-count
    cross-check that detects a discarded predicate, the `maint`-role gap against the parent table, and a
    dot-walk-vs-direct-lookup control on the scope.
- `ui_diagnostics` as the render check (vendor step 5) is void on `/aiux/<basename>/...` — it hangs the
  IDE. Use `atf-cloud-runner` and reload once (see global).

**Corrections**

- **`@servicenow/karuna` → `@servicenow/aiux`.** v3.0.0 still names the old package in **two** places —
  vendor step 0 ("those resolve from `@servicenow/karuna` and the instance") and vendor step 5
  ("components are bundled with `@servicenow/karuna`"). The local file says `@servicenow/aiux` in both.
- **A reference's `## Import` line may need translating.** Imports here resolve through the umbrella
  package: `@servicenow/aiux/<subpath>` (e.g. `@servicenow/aiux/aiux-components-record`), **not** the
  bare `@servicenow/aiux-components-record` the reference docs show. Verified against the `exports` map
  in `node_modules/@servicenow/aiux/package.json`. When you translate an import line, **say so** — do
  not silently emit something that contradicts the reference the user can also read.
- **`type=aix_widget` must be a POSITIVE match.** Page and layout records live in the same table with an
  **empty** `type`, so a negative filter excludes nothing. Measured: **71 of 192 visible rows have an
  empty type** — 37% plumbing that a `type!=…` filter would hand you as candidates. On `category`: keep
  `platform` + `custom`, drop `internal` (author opted out via `@discoverable(false)`, or omitted the
  decorator) and `system` (platform-created). **Do not narrow to `platform`** — it is self-declared and
  unenforced, and in practice every discoverable widget is `custom`.
- **Never pull `sourcemap` into context with `run_query`** — measured, one widget's sourcemap is
  **302,765 chars** against **197,215 chars** of actual source inside it. Extraction must happen
  server-side (hence `probe-widget-source.js`).
- **Column precedence by authoring path**, or you read the wrong field:

  | Origin | `component` | `sourcemap` | Authored source lives in |
  | --- | --- | --- | --- |
  | **SDK-built** | terser-**minified** | non-empty | `sourcemap.sourcesContent[i]` where `sources[i]` is not under `node_modules` |
  | **instance-authored** | readable source | empty | `component` — it *is* the original |

  `from: 'component-minified'` means an SDK-built widget lost its `sourcesContent` upstream: you are
  reading minified code. Say so; do not present it as the author's source.
- **`script` is never empty.** The SDK writes a **stub IIFE with an empty body** into widgets that have
  no server script, so field length proves nothing — the IIFE body must be inspected. Judging "has a
  server script" by length is a false positive by design.
- **The scope prefix is not derivable from the app name — it truncates at 18 characters.** Read
  `sys_scope.scope`. (Also applies to the local-wins matching rule below, e.g. project scope
  `x_snc_toast_consumer` matches index scope `x_snc_toast_consum`.)
- **Do not derive an API table from the source.** The pack removed exactly that: regex extraction
  reported unmarked helpers as public API and could not describe behaviour. Dead heuristics with known
  false positives are worse than none — read the source and quote what it actually does.
- **Local wins over its own deployed copy.** When a local widget under `widgets/<tag>/` matches an index
  row by tag **and** that row's scope is this project's scope (allowing the 18-char truncation), use the
  local source and ignore that instance row — do not rank it, do not fetch its source. Same tag in a
  *different* scope is a different widget and stays a candidate.
- ⚠ **`sys_aix_widget` results are silently role-filtered.** A `before query` business rule appends
  `category!=internal^ORcategoryISEMPTY` for every caller without the **`maint`** role — no error, no log
  line. Page widgets are commonly `category=internal`, so **"no widget matched" may mean "no widget I am
  allowed to see matched"**, and you must say which. Measured: **192 rows on `sys_aix_widget` against
  562 on the parent `sys_ux_widget`** for the same class — cross-check a suspicious total that way.
- **Probe failure is not "no match".** If the probe fails, say the widget was **set aside unverified** —
  name it, and say you could not read its current properties and events, so wiring it would risk code
  that looks right and silently does nothing. The user must be able to tell which happened.
- **The index table is a UNION.** The local table keeps the ~39 v2.6.0 rows v3.0.0 dropped (the
  `aiux-visualizations-*` family, `aiux-document-viewer`, `aiux-playbook`, `aiux-visual-board`,
  `aiux-stepper`, `aiux-timeline`, `page-alert-host`, `sn-aiux-chat-wrapper`, the extra
  controllers `FocusController` / `TooltipController` / `RovingTabIndexController` /
  `AriaLiveController`, the directives `spreadProps` / `timeAgo` / `liveRegion` / `provideOrigin` /
  `tooltip` / `lazyImage` / `lottieAnimation`, and the contexts `widgetRenderingContext` /
  `mobileAppBridgeContext`) **plus** upstream's v3.0.0 rows, because we still ship their reference files
  under `references/`. On upgrade, merge — never replace.
- **Renamed in v3.0.0 — search the new name** (local-only alias line; seven capabilities were renamed,
  not removed): `aiux-components-calendar` → `aiux-calendar-component`, `aiux-components-loader` →
  `aiux-loader`, `aiux-components-tabs` → `aiux-tab-group`, `aiux-components-toast` →
  `aiux-toast-notification`, `aiux-components-time-selector` → `aiux-time-selector`,
  `aiux-components-empty-state-content` → `aiux-empty-state-content`, `aiux-resizable-panes` →
  `aiux-resizable-pane-group`. If another skill or an older page cites an old name, it means the new row.

**Our added files**

- `scripts/list-widgets.js` — the discovery/ranking `run_script` asset (query + freshness digest);
  set `FILTER_SCOPE` / `NAME_LIKE` as needed.
- `scripts/probe-widget-source.js` — the server-side source-extraction `run_script` asset; set `TAG`
  (and `SCOPE` when a tag is reused across scopes), leave `TAG` empty to list visible widget ids.
- `references/**` — the union's reference files, including every v2.6.0 ref v3.0.0 dropped. The index
  table's `Reference` column resolves into here.

### accessibility

**Void instructions**

- **Nothing in this skill is a command — it is portable in full.** The vendor text is also **unchanged
  between v2.6.0 and v3.0.0**, so expect the corrections below to survive the next upgrade too.
- `.argus/rules/shared/daisyui.md` and `tools/eslint-plugin-aiux-style/` / `tools/eslint-plugin-aiux-a11y/`
  are **vendor monorepo paths, NOT shipped in this package. Ignore them.** They are cited **twice** — the
  *Reference Files* list and the *Before Starting Any Work* table — and are **still dead at v3.0.0**, so
  this correction is permanent. The per-component APG pattern for each DaisyUI component is in
  `references/aria-apg-patterns/` instead. **The a11y ESLint plugins *are* installed as devDependencies**,
  so the user's own lint does enforce those rules — say that, rather than implying you ran it.
- `build` / `install` are user actions (global).

**Corrections**

- **Verification evidence, strongest first:** `ui_diagnostics` after the user installs proves roles,
  accessible names, landmarks and `aria-*` wiring from the **rendered** DOM — but it **hangs on an
  AIUX/Lux route** (see global); use `atf-cloud-runner` there. `inspect_component_dom` gives a web
  component's real rendered tag and role before you assert anything about it; never infer that from
  authoring source.
- **Screen-reader announcement and 320px reflow cannot be checked here — ask the user**, naming exactly
  what to listen for or look at.
- **Never report an audit as passed on static evidence alone.** The *Testing Checklist* reads as if you
  can tick every box yourself; you cannot tick the screen-reader or visual ones. State which checks were
  automated, which were static (a grep or a read), and which are still open with the user.

**Our added files**

- **None.** Everything under `references/**` here is **vendor-shipped** — `reflow-guide.md`,
  `accessible-dnd.md`, `canvas-interfaces.md`, `forced-colors-reference.md`, `form-validation.md` and
  `aria-apg-patterns/` — verified file-for-file against the pack. It must still survive an upgrade, so
  copy it **one file per call**; never a directory copy.

### figma-to-widget

**Void instructions**

- Vendor text is **unchanged at v3.0.0**. **Every `node scripts/…` and `curl` invocation is void**, along
  with the `FIGMA_ACCESS_TOKEN` environment prerequisite — there is no environment to set it in. None of
  the pack's Node scripts are installed here (see *Vendor files we deliberately do NOT copy*).
- **`scripts/test-no-figma.js` is STILL DEAD at v3.0.0** — the package ships only
  `design-translator.js`, `extract-and-translate.js`, `figma-extractor.js`, `test-mock-pipeline.js`,
  `validator.js` and `fixtures/`. So the whole **"No-Figma path"** section and its
  `node scripts/test-no-figma.js` command reference a file the package does not contain: the instruction
  is broken even for an agent that *has* a shell.
- **Phase 1 acquisition — three paths. Choose one and say which before starting:**

  | Path | Status |
  | --- | --- |
  | **The user pastes the node JSON** | ✅ **works today.** The shape is exactly `scripts/fixtures/task-card.json` — read that fixture first so you can ask for precisely the right export |
  | **Figma MCP server** configured in this IDE | ⬜ MCP *is* supported here but **unconfigured and never exercised**. If a Figma MCP tool appears in your tool list, use it — then record what actually worked |
  | `web_fetch` against the Figma REST API | ✗ **ruled out** — it cannot send an `X-Figma-Token` header, and a token must never be placed in a URL |

**Corrections**

- 🛑 **Phases 1 and 2 prose are both unreliable — load our two ports instead** (next section). Verified by
  reading `figma-extractor.js` and `design-translator.js` in full against the SKILL.md text.
- **Phase 2 is wrong in a way that ships a bug.** The prose publishes **raw palette classes**
  (`bg-white`, `bg-gray-100`, `bg-red-50`, `text-gray-600`) where the implementation emits **DaisyUI
  semantic classes**: `BG_COLOR_MAP` really is `'#ffffff': 'bg-base-100'`, `'#f3f4f6': 'bg-base-300'`,
  `'#fef2f2': 'bg-error/10'`, and `TEXT_COLOR_MAP` really is `'#6b7280': 'text-base-content/60'`.
  **Palette classes DO NOT THEME — a widget built from the prose tables is pinned to light mode.** Also:
  `CSS_VAR_MAP` has exactly **one** entry (`#1f2937`), not the three the fallback prose implies;
  `DAISY_PATTERNS` returns bare `'btn'`/`'badge'`, not `aiux-btn`/`aiux-badge`; `ICON_KEYWORDS` keys are
  `link`/`avatar`/`alert`, not `aiux-link`/`aiux-avatar`/`aiux-alert`.
- **Phase 1 is wrong about icon detection:** `figma-extractor.js` applies
  `/^(icons?|glyph|sn-ai[ux]x?-icon)/` to `name.split('/')[0]`, so **the pack's own example
  `aiux-icon/chevron` FAILS**. Containers also never reach the trigger/field/picker rules, so an
  auto-layout `btn` frame is never a `trigger`.
- **Phase 5 prose is sound and in two places *stricter* than `validator.js`** (`@ExplicitSysId` as a
  must-exist error; `aiux-loading` instead of a bare `/loading/`) — follow the prose. **The one check it
  omits: `console.log(` as an info-level anti-pattern — apply it anyway.** Score is
  `100 − errors×15 − warnings×5 − info×1`; report it **with itemised findings** and combine with
  `run_diagnostics`. Every check is a regex, so a hit is a lead and a miss is not proof.
- `scripts/fixtures/task-card-widget.js` is the gold-standard output — read it to see what "done" looks
  like.
- **Hand off:** `ui-discovery` first (something may already do this), `aiux-build` for the component and
  server-script contract, `accessibility` before calling it done — a pixel-faithful widget with no roles
  or accessible names is not finished.

**Our added files**

- `scripts/figma-extraction.md` — authored port of what `figma-extractor.js` **actually** does where the
  Phase 1 prose is wrong: the real icon regex, the unreachable container rules, the missing
  `COMPONENT_SET`/`GROUP` container types, and the undocumented `PACK` alignment map, `^ic[-_]` icon
  prefix, plural `radii` field and **ratio-valued** `lineHeight`.
- `scripts/design-translation.md` — authored port of `design-translator.js`'s real maps (the semantic
  `BG_COLOR_MAP`/`TEXT_COLOR_MAP` above, the single-entry `CSS_VAR_MAP`, bare `DAISY_PATTERNS` names, the
  real `ICON_KEYWORDS` keys) plus opacity snapping, border mapping and text transform/decoration, which
  the prose omits entirely.
- Both load with `load_skill_resource(skill_name: "figma-to-widget", file_path: "scripts/<name>.md")` and
  **outrank the SKILL.md Phase 1 / Phase 2 tables.**

### internationalization

**Void instructions**

- The skill contains no commands and is portable in full — but **translation/string extraction is a USER
  ACTION**, performed by the user's `now-sdk` build. There is no terminal here: name the step and hand it
  over; never invent an extraction command or claim you ran one. *(An older local note named
  `pnpm localize:extract` — wrong, and not this pack's command; the real family is `now-sdk run dev …`,
  see `localization`.)*

**Corrections**

- 🔴 **ICU-PLURAL OVERRIDE — the single most important entry here.** §2 and the *Output Checklist* tell
  you to "Use the message API's **plural** and **gender/select** support (ICU MessageFormat style)". **The
  AIUX message API has no such support.** Its own companion `i18n-litjs.md` states: "`i18n.getMessage`
  does plain placeholder substitution — it has **no** ICU plural/gender selection. `'{0} items'` renders
  '1 items' at count 1." **An agent following the parent SKILL.md alone SHIPS BROKEN PLURALS. The
  companion wins:** write a structurally complete phrasing per case as **separate literal messages** and
  select among them with **`Intl.PluralRules`** (`localization/l10n-intljs.md` §1). Never fake it with
  `if`/concatenation in the component; raise genuine ICU plural needs with the platform i18n owners.
- **The argument must be a literal.** From `i18n-litjs.md`: the AST extractor only writes string /
  `{code, message, comment}` literals to `sys_ui_message`; **a variable argument is never extracted and
  falls back to the source string in every locale.** So `i18n.getMessage(someVariable)` is silently
  untranslatable everywhere.
- **`src/client/` is React with its own conventions** — do not assume the AIUX `i18n` service exists
  there.
- **Confirm the import specifier against existing pages** before introducing a second mechanism. The
  companions write `@servicenow/aiux-services`; the working import in this app is
  `@servicenow/aiux/aiux-services/src/i18n.js`, and the barrel is a **measured build trap** (see
  *aiux-build* above).
- **Verify the platform's non-standard locale codes against the instance** (`run_query` on `sys_choice`
  or the language tables) rather than trusting a remembered list — then map to BCP 47 at every external
  boundary, or the lookup silently falls back to a default instead of erroring.
- 📌 **Retired claim — do not re-add it.** Through v2.6.0 the local file asserted that the `i18n-*.md`
  companions "do not ship" and told you to supply the APIs from memory. **That claim is FALSE as of
  v3.0.0:** `i18n-litjs.md` and `i18n-intljs.md` are **vendor-shipped and present**. Read them; don't
  improvise.

**Our added files**

- **None.** `i18n-litjs.md` and `i18n-intljs.md` legitimately ship at v3.0.0 and are correctly in place —
  they are **vendor** files, not ours. Keep them, copy them on upgrade, and do not treat them as local
  additions.

### localization

**Void instructions**

- No commands in the skill text, but two steps are **USER ACTIONS**, because there is no terminal here:
  - **Pseudolocalization.** The correct command is **`now-sdk run dev --pseudo`** (v3.0.0,
    `l10n-litjs.md` §1). Name it and hand it to the user. *(An older local note said
    `pnpm localize:extract` — that was wrong: it is neither this pack's command nor a pseudolocalization
    command.)*
  - **Translation delivery**, which lands in the **instance**, not this repo — see the contract below.

**Corrections**

- **Verification limits.** Text-expansion fitting, tofu / font coverage and RTL mirroring are *partly*
  visible in the `ui_diagnostics` DOM after the user installs, but that is **partial evidence only: THE
  VISUAL JUDGEMENT IS THE USER'S.** Ask them, naming the locale **and** the screen to look at. (On a Lux
  route use `atf-cloud-runner` instead — see global.)
- **Translation-delivery contract** (from `l10n-litjs.md` §1 — the parent skill has this nowhere):
  Lit/AIUX widget strings are *not* shipped as per-widget catalog files. **The build-time extractor
  writes each `i18n.getMessage()` literal to `sys_ui_message`**; the server fetches a page's translations
  via **`fetchWidgetTranslationsForPage`**, injects them as **`window.__WIDGET_MESSAGES__`**, and
  **`i18n.loadMessages()`** loads them client-side. So the per-language `sys_ui_message` rows are a
  **platform/instance** task, inspectable with `run_query` — not a file you edit in this repo. Verify
  untranslated keys fall back to the **source string**, never to a blank or a raw key.
- **Direction comes from the LOCALE, not a maintained allowlist** (from `l10n-intljs.md` §3 — this
  supersedes keeping a list of RTL languages). Drive RTL mirroring and date UIs from the locale. These
  are **methods** on `Intl.Locale`; the older `textInfo` / `weekInfo` accessor **properties** are
  deprecated and support varies, so feature-detect:

  ```js
  const dir = (loc.getTextInfo?.() ?? loc.textInfo)?.direction ?? 'ltr';
  ```

  Same shape for `getWeekInfo?.() ?? weekInfo` (first day / weekend) and `getCalendars?.()`.
- **Dead pointer — do not chase it.** Both litjs companions close by pointing at `accessibility` and
  `responsive-design` as separate Horizon Design skills. **`accessibility` IS installed here** and is a
  live pointer. **`responsive-design` ships in NEITHER pack available in this project**, so that pointer
  is dead — apply this skill's own expansion/fitting guidance and
  `accessibility/references/reflow-guide.md` instead.
- 📌 **Retired claim — do not re-add it.** The old local assertion that the `l10n-*.md` companions "do
  not ship" is **FALSE at v3.0.0**: `l10n-litjs.md` and `l10n-intljs.md` are vendor-shipped and present.
- The prerequisite stands: apply `internationalization` first — and read its **ICU-plural override**
  before touching plurals, because the CLDR plural categories this skill asks for cannot come from the
  message API.

**Our added files**

- **None.** `l10n-litjs.md` and `l10n-intljs.md` legitimately ship at v3.0.0 and are correctly in place —
  **vendor** files, not ours.

### migrate-header-config-review

> Folder: `.build-agent/skills/migrate-header-config/`. **Registered name:
> `migrate-header-config-review`** — see *Corrections*.

**Void instructions**

- **Shell → tools.** Step 1 and Category 5 use `jq`, `find` and `grep -rn`, all void here:

  | Vendor command | Here |
  | --- | --- |
  | `SRC=$(jq -r '.srcDir // "."' aiux.json)` | **there is no `jq`** — `fs_read_file` `aiux.json` and read `srcDir` |
  | `find "$SRC/pages" -name "headerConfig.js" -o -name "headerConfig.ts"` | `fs_glob` with `**/headerConfig.{js,ts}`, scoped to the resolved `srcDir` **and** the project root — plus `src/extensions/**` when the project extends a host |
  | `grep -rn "computeCurrentHeaderConfig" …` and `grep -rn "ctx.headerConfig\|__LAYOUT_DATA__['header-config']\|__runHeaderConfig" …` | `fs_grep` with `-n`; the same regex alternation works. `grep -v node_modules` needs no analogue — scope the glob |

  v3.0.0 is authoritative on *where*: `application.js` and `pages/` live under the configured `srcDir`
  (scaffolded as `src/lux`), but **"most existing apps predate `srcDir` and keep it unset"**, in which
  case it resolves to the project root. **Glob both shapes rather than assuming one.**
- **The build hard-fails on both legacy patterns, but `build` is a USER ACTION.** Never run a build to
  discover whether a pattern is present — use the globs. Never claim the migration succeeded because a
  build "would now pass": hand the build to the user and report their result.
- **Dead links:** `docs/arch-header-config.md` and `../../../docs/arch-header-config.md` are vendor
  monorepo paths, **not shipped in this package** (still true at v3.0.0, which replaced them with an
  inline `### Header-config data shape` section). Do not hunt for them.
- **Authored epistemic rule — the Category 5 "must be empty" re-check: an empty result is not proof.**
  Broaden the pattern once (drop the extension, widen the directory) **and then open the surviving
  files** — a grep can miss in a file that really does contain the string. Applies to every "must be
  empty" check in the skill.

**Corrections**

- **This skill REGISTERS as `migrate-header-config-review`** (its frontmatter `name`) while its folder is
  `migrate-header-config`. **That is vendor-shipped, not a local edit** — stated here only so nobody
  treats the mismatch as a symptom or "fixes" the frontmatter. Activate it by the registered name.
- **`references/header-config-contract.md` OUTRANKS the vendor's inline "Header-config data shape"
  section** (see *Our added files*). Category 4's key list is a **comparison checklist, not a shape
  definition**.
- **Era / STRY attribution — v3.0.0 REMOVED this, so the overlay is its only home:**
  - Pattern **A** (per-page `pages/<route>/headerConfig.js` run via `__runHeaderConfig`) is
    **pre-STRY64088112**.
  - Pattern **B** (`computeCurrentHeaderConfig` named export → `ctx.headerConfig` →
    `__LAYOUT_DATA__['header-config']`) is **pre-STRY64218924**.
  - The app-owned model you migrate **to** is **STRY64218924**.
- **`AGENTS.md` is authoritative on the project's shape, and the shape decides where to search:** an
  experience-owning app keeps pages in `pages/<route>/page.js` with a root `application.js`; an extension
  app keeps them under `src/extensions/<host-project-id>/<host-basename>/pages/`. Header contributions go
  through `navLayoutContext` in `setup()` — establish what that owns versus the nav helpers from the
  instance, not from memory.

**Our added files**

- `references/header-config-contract.md` — **the pack has no equivalent.** It is the authority for the
  header-config shape and **outranks** the vendor's thinner inline section, whose field list (including
  `metadata`, `icon` and the `l3` entry `id`) is merged into it. It adds what the pack section lacks:
  per-field **EVIDENCE TIERS** (shipped / named / unverified), the **PRECEDENCE ordering** (loader data
  outranks `navLayoutContext.headerConfig`, which outranks the nav item), the explanation that **`null` is meaningful** (it tells
  nav-layout "use the nav item" and clears the previous route's config), and the scope-creep guard: **"Do
  not add a field to a migrated resolver that the legacy branch did not set."** Load with
  `load_skill_resource(skill_name: "migrate-header-config-review", file_path: "references/header-config-contract.md")`.

### pages-extensions-generator

> **NOT a vendor skill — the pack DROPPED it at v3.0.0, so it has NO UPSTREAM.** It is now effectively an
> **authored local skill**: the never-edit-a-vendor-file rule does not apply to it, there is nothing to
> restore it to, and it must not be deleted to "match" the pack. Its capability was absorbed into
> `aiux-build` → `references/app/extensions.md`. This section records why the folder is retained and what
> only it knows; the skill file itself carries the detail.

**Void instructions**

- Same global shell boundary: `mkdir -p` is unnecessary (`fs_write_file` creates parent directories);
  `cp assets/<template>.js <target>` → `fs_read_file` the template, **substitute its placeholders**, then
  `fs_write_file` the target — never write it unsubstituted. Then `run_diagnostics` and stop: `build` and
  `install` are **user actions**, deploy must follow the host, and the tenant cache must be evicted
  afterwards (the effect is not immediate, so a stale page is not automatically a bug).

**Corrections**

- **The authority moved upstream.** `aiux-build` → `references/app/extensions.md` is now **the authority**
  for path conventions, page/loader/layout templates, layout precedence, view pages, the duplicate-root
  collision guard and the `isolateBundlePaths` trap. Load it and follow it; do not restate it from this
  skill or from memory.
- **Why the local folder is retained** — two things nothing upstream covers:
  1. **`__parentScopeName__` / `__parentRouteId__` resolution.** These are **unresolved `now-sdk init`
     template tokens, not build-time variables** — nothing substitutes them (neither `aiux.json` nor
     `now.config.json` carries a host field) and **the build emits them verbatim into record keys**.
     Resolve by querying `sys_aix_experience` for the host's project id
     (`source_aix_project.project_id`) and `url_suffix`, then **RENAME the directories**.
  2. **Three `assets/` template files the pack does not ship at all** —
     `assets/application-page-template.js`, `assets/loader-template.js`,
     `assets/layout-override-template.js`.
- 🔴 **MEASURED: a host with an EMPTY `content_hash` / `extendable` is NOT un-extendable.** The file
  previously claimed such a host "has no bundle and renders nothing — do not extend it"; that is false.
  Measured on the **Sales Portal** host — `sys_aix_experience`
  **`29aa0e97fb97fe5089ecfee34eefdc09`**, `url_suffix` **`salesportal`**, scope **`sn_ex_emp_hub_mw`** —
  **both fields empty, the portal renders fully, and an extension page overlaid on it works.** **The real
  precondition is only that the host row EXISTS.** Do not read `content_hash` or `extendable` as gates.
- It also carries the measured **services-barrel import trap** (`Could not resolve import "#context"` →
  deep-import `@servicenow/aiux/aiux-services/src/i18n.js`) and this app's measured extension path
  `src/lux/extensions/<host-project-id>/<host-basename>/pages/<route>/page.js`. Both are stated
  canonically under *aiux-build* above; the copies here are deliberate duplication, not drift.

**Our added files**

- **The whole skill folder** — `SKILL.md` plus `assets/application-page-template.js`,
  `assets/loader-template.js`, `assets/layout-override-template.js`. All local, no upstream: copy nothing
  over it on upgrade.
