# PLATFORM-NOTES.md

Reference detail for agents **[AGENTS.md](AGENTS.md) is the always-read file and
holds the rules**; this one is lookup-only, loaded on the triggers in AGENTS.md's final table.

Nothing instance-specific belongs in `.build-agent/skills/` — the skills must stay portable, so every
measured fact about *this* instance and *this* IDE lives here or in AGENTS.md.

---

## Command → tool

The AIUX packs were written for offline agents with a shell. There is none here.

| Pack instruction | Web IDE equivalent |
| --- | --- |
| `pnpm build` / `now-sdk build` | the **`build`** tool — **SDK ACTION** |
| `pnpm deploy` / `now-sdk install` | the **`install`** tool — **SDK ACTION**, requires dist and dist-metadata to be delete first |
| `pnpm dev` (dev server, hot reload) | **no equivalent.** After the install: `ui_diagnostics` (headless render + console + network + DOM) |
| `pnpm lint` / `eslint-plugin-aiux-*` | no execution. Regex-detectable rules → `fs_grep`; type/syntax → `run_diagnostics`. The plugins *are* installed, so the user's own `pnpm lint` does enforce them |
| `node scripts/validate-component.js` | do the assertions inline; `aiux-build` → `scripts/validate-checks.md` carries all 30 ported checks |
| `node scripts/sync-widgets.mjs` (+ `--check`) | **concept deleted.** `run_query` on `sys_aix_widget`, live |
| `node scripts/fetch-widget-source.js --key <scope>.<tag>` | `run_query` + the `run_script` extraction probe in `ui-discovery/SKILL.md` step 3 |
| `find <dir> -name "<glob>"` | `fs_glob` |
| `grep -rn "<pattern>" <dir>` | `fs_grep` (`-n`, regex alternation, `glob` filter) |
| `mkdir -p <dir>` | nothing — `fs_write_file` creates parents |
| `cp <template> <target>` | `fs_read_file`, substitute placeholders, `fs_write_file` |
| `curl` / `FIGMA_ACCESS_TOKEN=… node …` | see `figma-to-widget/SKILL.md`; `web_fetch` sends no auth header |
| "read `tailwind.css` after `pnpm install`" | already installed — `fs_read_file` it under `node_modules/` |
| `now-sdk auth`, `.env`, `GLIDE_ORIGIN`, `AUTH_TOKEN`, `X_USER_TOKEN` | irrelevant — every instance tool here is already authenticated |

## Instance tools the packs do not know exist

The packs' entire widget-sync architecture exists because an offline agent cannot query the instance.

| Tool | Use for |
| --- | --- |
| `run_query` | any table by encoded query — `sys_aix_widget`, `sys_aix_experience`, `sys_dictionary`, `sys_choice` |
| `run_script` | read-only server-side probes (writes revert via `rollback_script`). **Mandatory before shipping any server script** |
| `keyword_search` / `semantic_search` | metadata by keyword / by concept when you don't know the table |
| `inspect_component_dom` | the **real rendered DOM** of a web component (`sys_ux_lib_asset`) — roles, slots, accessible names |
| `css_variable_explorer` | `--now-*` token values, light **and** dark, plus fallbacks |
| `explain_fluent_doc` / `search_fluent_docs` | Fluent SDK truth for anything under `src/fluent/` |
| `atf-cloud-runner__browser_*` | drive a real browser — how the `db_image` URL forms below were settled |

⚠ **`sys_aix_widget` is silently role-filtered.** A `before query` business rule appends
`category!=internal^ORcategoryISEMPTY` for callers without `maint` — no error, no log line. Measured: 192
rows against 562 on the parent `sys_ux_widget`. A widget can exist and be invisible, and any ratio from
that table has a role-dependent denominator. "No widget matched" may mean "none I am allowed to see".

## Genuinely unavailable — ask the user

| Need | Why blocked | Ask for |
| --- | --- | --- |
| authenticated Figma REST | `web_fetch` cannot send `X-Figma-Token` | the node JSON pasted in, or a Figma MCP server once MCP works |
| screen-reader verification | no NVDA/JAWS/VoiceOver | "verify with a screen reader" + exactly what to listen for |
| 320px reflow | `ui_diagnostics` takes no viewport width | "check at 320px"; meanwhile review CSS against the `accessibility` skill's reflow guidance |
| hot-reload iteration | no dev server | nothing — batch changes so one install validates several |
| `git` history | no git access | ask the user to read it out |

---

## Measured platform facts

Each was established by measurement in this workspace, cost real time to find, and fails **silently**.
These are the candidate hint records to author when `x_snc_hints_knowle_hint` is reachable again.

### DaisyUI is prefixed, and the safelist is the floor

`tailwind.css` configures `@plugin "daisyui" { prefix: 'aiux-' }`, so **unprefixed DaisyUI component
classes do not exist** — `card`, `card-body`, `badge badge-success`, `progress progress-error` emit
nothing. An unsafelisted class is tree-shaken with no error: the element renders unstyled, which reads as
a layout bug rather than a missing class.

Measured gaps in `@source inline()` at v2.6.0 — all absent, all needed for ordinary UI work:

| Absent | Use instead |
| --- | --- |
| `w-20` / `w-24` / `w-32` (the `{w,h}-*` scale stops at **16**) | fractional `w-1/2`, `w-2/3`, `w-1/3`, `w-full` |
| `gap-x-*` / `gap-y-*` | plain `gap-*` |
| `shadow-*`, `-translate-y-*`, `motion-reduce:*` | author in the component's `static styles` |
| arbitrary `transition-[…]`, `duration-[var(--duration-sm)]` | `static styles` with `var(--duration-sm, 200ms)` fallbacks and a `prefers-reduced-motion` media query |

Verified present and safe to use: `aiux-card{,-border,-body,-title,-actions}`,
`aiux-badge{,-sm,-soft,-success,-warning,-error,-neutral}`, `aiux-skeleton{,-text,-card,-title,-item}`,
`aiux-btn*`, `aiux-alert*`, `aiux-loading*`, `aiux-progress*`, `grid-cols-*`, `gap-*`, `p-*`, `h-*` (≤16),
`w-full`, fractional widths, `flex`, `items-*`, `justify-*`, `shrink-0`, `text-{xs..3xl}`,
`text-text-tertiary`, `text-success`, `text-error`, `sr-only`.

Verify at `node_modules/@servicenow/aiux/components/core/src/styles/tailwind.css` with **`fs_read_file`**,
since grep cannot reach `node_modules`. ⚠ That file's `@source` globs (`../../../../applications/**`,
`components/**`, `examples/**`) resolve **inside the metapackage**, not into this app's `src/`, so do not
assume app-source scanning emits a utility. Treat the safelist as the floor.

### A backtick in a comment inside a css template terminates the literal

In `static styles = css` … a comment containing backticks ends the tagged template and produces a cascade
of unrelated TypeScript syntax errors far from the real line. Never put backticks in comments inside `css`
or `html` templates.

### The browser tools are Playwright, and three test conventions invert

`atf-cloud-runner__browser_*` **is** Playwright — each call reports the code it ran
(`await page.goto(…)`, `await page.getByRole(…).click()`). So assertions are executable here, but
there is **no runner**: no `test/` directory, no `*.test.js`, and no `test` script in
`package.json`. Any pack or agent instruction written for `vitest` or a Playwright spec file is
void on the harness while live on the driver.

Three conventions from widget-test guidance invert as a result:

| Written for a spec runner | Here |
| --- | --- |
| "NO `page.goto()` — the widget is auto-mounted" | `browser_navigate` is **required**; nothing auto-mounts |
| "NO IMPORTS — use the `describe` / `it` globals" | moot, nothing supplies them |
| `page.$('my-widget .skeleton-card')` | **unavailable** — no `browser_evaluate`, no CSS-selector query |

⚠ **`data-testid` is unreachable.** Assertions read the **accessibility snapshot** — roles,
accessible names, text. A `data-testid` never appears there, so a test hook authored as one
cannot be asserted on. Name things for the a11y tree instead: that is a stricter contract and it
doubles as the accessibility check.

⚠ **A dead session is not a dead tool.** `Failed to proxy to BOS` and `Session not found` both
mean the session expired — a fresh `browser_navigate` mints a new one. Four retries were spent
on this before a different URL proved the runner was fine. A session also dies after
`browser_close`.

⚠ **`sys_attachment.do` serves `text/html` to a fetch but kills a navigation.** `ui_diagnostics`
renders it (the document's own `<title>` becomes the page title, which is the proof it parsed as
HTML); `browser_navigate` to the same URL fails every time while other URLs on the host work in
the same session. Most likely `Content-Disposition` — a fetch ignores it, a top-level navigation
has nothing to render. **Inferred, not measured**: the header was never read.

ATF is the harness that persists (`atf-run-test`, and `atf-triage` is a real `agent` delegation
target). Browser driving verifies once inside a session; an ATF test is repeatable without an
agent present.

### db_image is served by name, not by record sys_id

Measured in a real browser against this instance:

| URL form | Result |
| --- | --- |
| `/<name>` (e.g. `/hm_storefront.jpg`) | ✅ renders. No scope prefix for a global-scope row |
| `/<db_image sys_id>.iix` | ❌ `ERR_HTTP_RESPONSE_CODE_FAILURE` |
| `/<value of the row's `image` field>.iix` | ✅ renders — `.iix` resolves the **blob** sys_id, not the record sys_id |

Prefer the name. Read `width`/`height` off the row and pass both to `lazyImage` so there is no layout
shift.

### sys_aix_experience field names, and the extend preconditions

The display field is **`title`**, not `name` — `nameISNOTEMPTY` is rejected outright. Before writing
extension pages, confirm on the host row: `url_suffix` matches the directory, `extendable = 1`, and
`content_hash` is **non-empty** (empty = no bundle, renders nothing).

### Percentage points are not percent

A rate metric that moves is measured in **percentage points**: a conversion rate of 24.6% moving by 2.1 is
−2.1 **pts**, not −2.1%. Rendering "%" there asserts a ~9% relative move — a different and wrong claim.
Count metrics (items per receipt) do move in percent. Enforced in
`src/extensions/sn_ex_emp_hub_na/employeeslate/lib/kpi-data.js`.

---

## Extension model

This app **extends an existing host experience** rather than defining its own. Two directory conventions:

```
# Convention 1 — host scope + route id (scaffolded default)
src/extensions/<host_scope>/<host_route_id>/pages/<route>/page.js
src/extensions/<host_scope>/<host_route_id>/application.js        # optional per-host lifecycle

# Convention 2 — direct host experience sys_id
src/extensions/<experience_sys_id>/pages/<route>/page.js
src/extensions/<experience_sys_id>/application.js                 # optional per-host lifecycle
```

This app uses convention 1: `src/extensions/<host_scope>/<host_route_id>/`.

- `<host_route_id>` is the host experience's `url_suffix` (e.g. `employeeslate`). It **must match the
  host** so pages overlay the host's routes at `/aiux/<host_route_id>/…`.
- Both conventions are discovered identically; one project may mix them to target multiple hosts.
- **The directory path is the entire link to the host.** There is no `extends`/`routeMap` in `aiux.json`.
- `extension.js` is **not** read by the build. The lifecycle module is always `application.js`.
- `.ts` wins over `.js` when both exist in a directory.
- Contribute host chrome from `setup()` with the nav helpers from `@servicenow/aiux/aiux-components-nav`:
  `addNavItem`, `removeNavItem`, `setL3Nav`, `appendL3Nav` (current names `appendL1Nav`/`prependL1Nav`/
  `removeL1Nav`, plus the `L2` equivalents for items under a specific L1's `l2Nav`; all accept an array).
  ⚠ **No ownership tracking** — they key purely on path string, so colliding with a path the host or
  another extension already uses silently overwrites or removes it.

### Lifecycle modules: root vs per-host

| Module | Binds to | Needs pages? |
| --- | --- | --- |
| **Per-host** `src/extensions/<host_scope>/<host_route_id>/application.js` | exactly that host | **No** |
| **Root** `application.js` | the one host this app's extension pages target | **Yes** |

- **This template scaffolds the per-host form**, a *sibling* of that host's `pages/` directory, not inside
  it — discovered, bundled and registered on its own.
- To extend a **second** host, add another `application.js` under that host's directory with its own
  `setup()`. Each emits its own `sys_aix_widget` + `sys_aix_experience_extension` row, so hosts never
  share lifecycle logic.
- A **root** `application.js` still works but is weaker: compiled only when at least one page exists under
  `src/extensions/`, and bound to a single host inferred from those pages. If both exist, the root module
  is **not** additionally registered against a host that has its own per-host module — they never
  double-run.

### Which hooks actually run

- `setup()` — server-side during SSR (after the host's own `setup()`), re-running client-side only as a
  CSR fallback.
- `navigate(navCtx, ctx)` — **client-only**, on each in-app navigation, after the host's `navigate()`. An
  extension cannot return a redirect; only the host can.
- `teardown(ctx)` — **client-only**, after the host's `teardown()` on app exit.
- A throwing hook is caught and logged; it never breaks the host render or other extensions.
- Under a dev server `setup()` fires **client-side only**, because that renders on the main thread without
  the isolate. **There is no dev server here**, so this applies only outside this IDE — never conclude SSR
  is broken from it. Verify nav contributions against a deployed instance.

---

## Skill inventory

⚠ **A skill that fails to load is indistinguishable from one that does not exist.** Two measured
loader rules:

- **The entry file must be `SKILL.md`, uppercase.** `aiux-tailwind-vision-spec` sat on disk with
  valid frontmatter and never appeared in `<available_skills>` because its file was `skill.md`.
  No error, no warning — the folder is skipped. Renaming it fixed it, and the list rebuilt on the
  next message.
- **The registered name comes from the frontmatter `name:`, not the folder.**
  `migrate-header-config/` registers as `migrate-header-config-review`, so a folder name that
  differs from the skill name is normal and not a symptom.

Boundary-reviewed, from `@servicenow/agent-pack-aiux` v2.6.0:

| Skill (registered name) | Folder | Use for |
| --- | --- | --- |
| `ui-discovery` | `ui-discovery` | **always first for UI** — reusable components and instance widgets |
| `aiux-build` | `aiux-build` | pages, routes, layouts, widgets, server scripts, `AIUXElement` lifecycle/decorators/loaders/context. Also carries the one-way extension → experience-owning conversion |
| `accessibility` | `accessibility` | accessibility audits and fixes |
| `figma-to-widget` | `figma-to-widget` | a Figma URL → widget |
| `pages-extensions-generator` | `pages-extensions-generator` | extension pages under `src/extensions/` that overlay a host |
| `migrate-header-config-review` | `migrate-header-config` | legacy `headerConfig.js` → app-owned `header-config.js`. **Registered name ≠ folder name.** Its `references/header-config-contract.md` is authored here, not shipped by the pack |
| `internationalization` | `internationalization` | global-readiness review without translating |
| `localization` | `localization` | locale adaptation, RTL, translation catalogs |

From `@servicenow/agent-pack-horizon-design-knowledge`. **No boundary blocks** — they were audited and
contain no shell or offline instructions, so none was needed; AGENTS.md covers them because it loads
unprompted:

| Skill | Use for |
| --- | --- |
| `components` | DaisyUI primitive selection and generation |
| `compositions` | multi-region assemblies — forms, dialogs, data tables, notifications |
| `motion` | CSS transitions/animations, duration and easing tokens, `motion-reduce` |
| `patterns` | cross-cutting patterns — status colour, truncation, loading/empty/error states |

Authored in this repo, not shipped by any pack — so no boundary review applies and there is no upstream
to drift from:

| Skill | Use for |
| --- | --- |
| `hint-lookup` | the curated hint library — see the section below for the REST access path |
| `aiux-instance-ops` | investigating or verifying instance state, and the confirm-then-read-back rule before any write |
| `aiux-agents` | briefing a sub-agent before an `agent` delegation — the three real targets, and the rules a sub-agent does **not** inherit |
| `aiux-tailwind-vision-spec` | deterministic visual-element → AIUX class and token mapping, from `tailwind.css` |
| `servicenow-interactive-report-writer` | evidence-led interactive HTML reports, with a bundled template and validator |

Provided by the environment, **not** on disk under `.build-agent/skills/`: `atf-run-test` (run, debug or
triage an ATF test) and `update-system-property` (change an existing `sys_properties` value).

---

## Dead links in the packs

The packs were authored inside the vendor's monorepo. These paths are **not shipped** and are dead in any
environment:

- `docs/**` in `migrate-header-config` and `pages-extensions-generator` — **both resolved**: the
  header-config contract is authored at `migrate-header-config/references/header-config-contract.md`, and
  `pages-extensions-generator`'s Full Documentation section maps all four original paths to shipped or
  authored equivalents.
- `.argus/rules/**` and `tools/eslint-plugin-aiux-*` (in `accessibility`)
- `examples/admin-configuration/**` (in `aiux-build`)
- `i18n-litjs.md` / `i18n-intljs.md` / `l10n-litjs.md` / `l10n-intljs.md` (in `internationalization` /
  `localization`)
- `scripts/test-no-figma.js` (in `figma-to-widget`)
- the per-component repo links in `ui-discovery/references/components/*.md`

Also measured dead. ⚠ These contain `.claude/`, which is a path inside the **vendor's** monorepo and has
nothing to do with the removed `.claude/skills` pipeline:

- `karuna/components/list/.claude/rules/list-styling-standards.md` — cited **11×** in
  `compositions/references/data-table-spec.md` as the "canonical token rules". Use the `components` /
  `patterns` skills and `css_variable_explorer` instead.
- `.claude/rules/architecture.md` and `docs/**` in
  `ui-discovery/references/components/aiux-visual-board.md`.

## Hint records — available, over REST

On-instance hint records carry **generic** knowledge: facts missing from or disproven by the public
documentation, measured silent-failure modes, and practical guidance — including a hint on how to use
the ServiceNow product documentation. They sit at **level 3** in AGENTS.md's order of authority,
alongside the Fluent docs: below this file and below the AIUX skills, above training recall.

⚠ **A hint is a measurement with a date.** Platform behaviour moves between ServiceNow releases, so
where a hint contradicts something measured in this workspace, **the local measurement wins** and the
hint is the thing to correct. Two further constraints, both measured here:

- **The table is not on this instance.** `new GlideRecord('x_snc_hints_knowle_hint').isValid()` returns
  **false** on hmewfront. The library lives on **crmai**, so the skill's LOCAL path does not apply here —
  only its REMOTE path.
- **The MCP tools are absent** (`find_hint`, `hint_retrieval`, `hint_triage`). MCP is not involved; the
  REST endpoints are the transport and they work.

Access is already provisioned on this instance — do not re-create it:

| Record | Value |
| --- | --- |
| `sys_alias` **Hints API crmai** | `3f5409e50f581bd4d940b8d530d1b2f5` — this is the only id a client needs |
| `basic_auth_credentials` **Hints API - crmai** | `235409e50f581bd4d940b8d530d1b25e`, user `hints_api` |
| `http_connection` | points at `https://crmai.service-now.com`, base path `/api/x_snc_hints_knowle/hints` |

```js
// Resolve the credential the platform's way. NEVER read the password field —
// it returns a fixed ten-asterisk MASK, and sending that yields a 401 that is
// indistinguishable from a wrong password.
var info = new sn_cc.ConnectionInfoProvider().getConnectionInfo(ALIAS_SYS_ID);
var user = info.getCredentialAttribute('user_name');   // NOT 'username' — that returns null
var pass = info.getCredentialAttribute('password');
```

⚠ **`getConnectionAttribute('connection_url')` returns EMPTY.** Read `connection_url` off the
`http_connection` row whose `connection_alias` matches and which is `active`.
⚠ **`getConnectionInfo` returns null when no ACTIVE `sys_connection` points at the alias** — an alias
alone is not enough.
⚠ **401 PRECEDES ROUTING** on these endpoints: every wrong URL also reads 401, so a wrong path is
indistinguishable from a wrong credential until something returns 200. Get a 200 on any operation
before touching the path. A **200 with `count: 0`** on a query that should match means the caller lacks
`x_snc_hints_knowle.hint_reader` — not that the library is empty.
⚠ Judge relevance by the **spread** of `similarity`, never an absolute value: on-topic sits only
~0.05–0.08 above an off-topic control. One row clearly ahead is a match; a flat spread means the query
was too vague.

Records that cover ground these notes also touch — the hint is authoritative where they disagree:

| Hint record | Covered |
| --- | --- |
| `aiux-framework-architecture` | Two-tier widget model, `content_hash`, the `maint`-role query filter on `sys_aix_widget`, cross-scope create refusal, "a file nothing imports is not built" |
| `aiux-widget-theming-darkmode` | What reaches a shadow root; the themed-vs-static trap (static colour pinned to light mode in dark) |
| `aiux-nav-helper-api` | What `navLayoutContext` owns versus the nav helpers; path-string keying with no ownership tracking |
| `aiux-lookalike-daisyui-lit` | DaisyUI 5 renamed every theme variable |
| `aiux-extension-vs-experience-app` | The two app shapes, the conversion between them, and the record chain install creates — **the only source for that record chain**, still ⬜ in `aiux-build` |
| `sn-validate-scripts-on-instance` | A filter on a non-existent field is discarded and returns every row — the origin of the control-must-fire rule |

They now sit at position 0 in AGENTS.md's order of authority. **Re-measure rather than trusting the
summaries above** — each row names the ground a record covers, not its current contents.

## Drift detection

The skills in `.build-agent/skills/` are **edited copies** of `@servicenow/agent-pack-aiux` **v2.6.0**;
the pristine originals in `node_modules/` are the diff baseline. All `@servicenow/*` deps are pinned to
`"latest"`, so a reinstall performed outside this IDE can change the packs — check
`node_modules/@servicenow/agent-pack-aiux/package.json`. **Re-copying a pack over `.build-agent/skills/`
overwrites every boundary block**; that loss is visible and cheap to redo, not silent, but it is a full
re-audit.

For a whole-tree text sweep of `.build-agent/` (which grep cannot traverse): `fs_copy` it to a non-hidden
path, grep the copy, `fs_delete` it, and confirm the file count returns to its pre-copy value. Do **not**
rename `.build-agent` — that path is the skill load path, so dropping the dot de-registers all 12 skills,
and the registry only refreshes between messages, so the breakage surfaces a message later.
