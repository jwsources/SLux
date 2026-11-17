# AGENTS.md

Canonical guidance for AI coding agents in an AIUX application

This is the only agent file in this repo; the agent that runs here is the ServiceNow **Build Agent**.
`README.md` is for humans.

---

## Non-negotiables

1. **Build and install are ONE unit, and they are the user's to run.**
   Prepare the change, `run_diagnostics`, delete dist and dist-metadata, then STOP and report it ready.
   Do **not** call `build` — a build without the install that follows it is wasted, and a build left
   behind an install is the stale-`dist` bug. Call either only when the user explicitly asks.
   Never claim a change works because it "would build".
2. **Never invent a shell step.** There is **no terminal** in this IDE — not for the agent, not for the
   user. If the only documented route is a command, say the route is unavailable and name the tool instead.
3. **A tool's success message is not evidence.** Read the returned diff after every write. Back any claim
   about instance state with the query behind it **plus a control that must fire** — a filter on a field
   that does not exist is silently *discarded* and returns every row.
4. **A STALE SSR RENDER LOOKS EXACTLY LIKE A CODE BUG.** Twice now, source verified correct at every
   layer while the page disagreed. Both times the server-rendered output was from older component code
   than the client bundle.
   - **Tell:** the page title stays the element name (`x-snc-…-page`), so `updated()` never ran; and the
     SSR markup contains structure deleted installs ago while carrying CURRENT data.
   - **Symptom that looks like a render bug:** slotted content reported as *hidden*. A `<div slot="x">`
     whose matching `<slot name="x">` is absent from the server-rendered shadow root is NOT rendered.
     So a page can supply hero content the stale shell has nowhere to put.
   - 🔑 **THE REMEDY IS TO RELOAD ONCE.** The first load after an install serves the stale SSR shadow
     root; the second is hydrated. This has cost four rounds of false "regression" reports. ALWAYS
     navigate twice, or check the title first, before judging any page.
   - `?uxpcb=1` does not help — that is browser-side, and the staleness is in the SSR output.
   - Only escalate to a tenant-cache eviction if the title is STILL the element name after a reload.

5. **NEVER call `ui_diagnostics` on an AIUX/Lux portal route.** It **HANGS THIS IDE** on any
   `/aiux/<basename>/…` path — user-confirmed, no exception, no retry. It remains fine on ordinary
   platform pages (`/nav_to.do`, `/list/<table>`, a UI Page).
   - **For a Lux portal, verify with the `atf-cloud-runner` browser tools instead.** They drive a real
     browser out of process and return an accessibility snapshot you can diff — which is also the only
     way to satisfy non-negotiable #4's reload-twice rule on these routes.
   - This is the one place the AIUX skills' advice ("after install → `ui_diagnostics`") is actively
     dangerous rather than merely void.

`run_diagnostics` is validation, not change — no approval needed. `ui_diagnostics` is also validation and
needs an install first, **but see #5 before pointing it at anything under `/aiux/`.**

## There is no terminal

Every `pnpm` script in `package.json` is how this app builds *outside* this IDE. In here:

| Script | Here |
| --- | --- |
| `pnpm build` | the **`build`** tool — SDK ACTION |
| `pnpm deploy` | the **`install`** tool — SDK ACTION. Deploy **after** the host, then evict the tenant cache |
| `pnpm lint` | no execution. Regex-detectable rules → `fs_grep`; type/syntax → `run_diagnostics` |
| `pnpm dev` | no equivalent. No dev server, no hot reload. After install → `ui_diagnostics` on a platform page, or the **`atf-cloud-runner` browser tools** for anything under `/aiux/` (see non-negotiable #5) |

The AIUX skills were written for offline agents **with** a shell. Every `pnpm`, `node`, `npx`, `curl`,
`find` and `grep` instruction in them is void — the full translation table is in TOOLNOTES.md.

## Searching: zeros are void by default


- ⚠ **A ZERO ON A SUBSTRING IS USUALLY CASE, NOT ANCHORING.** `href\(` returned zero while
  `detailHref(` sat in the file — because `detailHref` has a capital H, so `href(` is genuinely
  absent. I first blamed mixing a `^`-anchored branch with unanchored ones in one alternation;
  that was wrong. Alternation works. Check camelCase boundaries before theorising, and prefer
  `-i` or the fuller identifier.
- ⚠ **NEVER `run_query` `sys_ux_lib_asset` without a highly specific `name`.** It returns the `content`
  field, which holds whole minified bundles — one broad query returned 2.2 MB (100k chars after
  truncation) of unrelated library source. `inspect_component_dom` is the safe wrapper, but it only
  indexes `category=source_map`. Verified absent there: `sn-aiux-chat-wrapper` under the names
  `chat-wrapper`, `aiex`, `aiel` (control `nameISNOTEMPTY` fired, so those zeros are real).
- `fs_grep`: target one file via `glob`, never `path`. **Any zero is void** until a control pattern known
  to exist fires under identical params, differing only in the pattern. Still void → `fs_read_file`.
- ⚠ **`fs_grep`, `fs_glob` and `fs_tree` skip `node_modules` and dot-directories**, and `local_search`
  returns nothing at all in this build. Every grep of `node_modules/` or `.build-agent/` is a **false
  zero**. `fs_read_file` and `fs_read_directory` are not affected — use those.

## Order of authority

1. **This file, then SKILL-OVERRIDES.md, then TOOLNOTES.md** — this repo, this IDE, this instance.
   Nothing outranks a fact measured here. **SKILL-OVERRIDES.md is the correction layer over the vendor
   skills**: read it whenever you activate a pack skill, and where it contradicts that skill's text, the
   overlay wins.
2. **The AIUX skills.** This is an AIUX project, so they own the framework: `ui-discovery` first for
   any UI, then `aiux-build`, `accessibility`, `components`, `patterns`, `motion` and the rest.
   Strong on Lit, components, tokens and ARIA — and they know nothing about this instance.
   ⚠ **Their files are now PRISTINE vendor content.** They were written for offline agents with a shell,
   so they contain instructions that are void or wrong here. Those corrections are NOT in the skill files
   any more — they are in SKILL-OVERRIDES.md. A pack skill read on its own is incomplete by design.
3. **Equal footing, both general guidance:**
   - `explain_fluent_doc` / `search_fluent_docs` — anything under `src/fluent/`.
   - the **`hint-lookup`** skill — the curated hint library: facts missing from or disproven by the
     public documentation, measured silent-failure modes, and practical guidance. It also carries a
     hint on how to use the ServiceNow product documentation.

   Activate `hint-lookup` before building anything that touches platform configuration, architecture
   or SDK behaviour, and whenever capturing or correcting generic knowledge.

   ⚠ **A hint is a measurement with a date.** Platform behaviour moves between ServiceNow releases,
   so a hint can be stale. Where one contradicts something measured here, **the local measurement
   wins** — and the hint is then the thing to correct. Never expect project specifics in a hint.

   ⚠ The `find_hint` / `hint_retrieval` / `hint_triage` **MCP tools are absent** in this build; the
   skill reaches the library over REST instead, so hints ARE available. Access path in TOOLNOTES.md.
4. **Training-data recall** — last, and only when nothing above covers the question.

## Project rules

- Components extend `AIUXElement` from `@servicenow/aiux/aiux-components-core`, never `LitElement`
- Guard browser globals with `isServer` from `lit`
- Tailwind + DaisyUI for styling; **no `--now-*` CSS tokens**
- **DaisyUI classes are `aiux-` prefixed.** Unprefixed component classes (`card`, `badge-success`) emit
  nothing, and an unsafelisted utility is tree-shaken silently. See TOOLNOTES.md → DaisyUI safelist
  before writing CSS.
- Custom element tags carry the app's scope, kebab-cased (`x-snc-[SCOPE]-…`)
- **Gate net-new pages with `@acl()` on the page class, or `experienceAcls` in `aiux.json`.** Pack
  v3.0.0 retires `@roles()`: "Never `@roles()` for new gating". Existing `@roles()` usage still works —
  do not churn it — but write new gating the new way. See `aiux-build/references/app/acl.md`.
- **Never import the `@servicenow/aiux/aiux-services` barrel in a page, widget or component.** It is
  bundled INLINE by the isolate builder (`services/` is not in its `SN_PACKAGE_DIRS`), drags in
  `core/observability`, and fails the page's isolate bundle with
  `Could not resolve import "#context"`. Measured — it broke a real build here. Deep-import instead:
  `import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js'`. That module has zero imports and is
  SSR-isolate-safe. Pack v3.0.0's own extension page template still gets this wrong.

## Do not

- **Mixed projects (own `pages/` + extension pages) — REVISED at pack v3.0.0, conditional on your build.**
  The old rule here was "unsafe, not merely unsupported (STRY64103259)". v3.0.0 states the opposite:
  "Mixed projects are supported by current SDK builds: with `aiux.json.basename` present, the app retains
  its own experience, theme, lifecycle, and page memberships… Older builds incorrectly assigned ordinary
  pages to the host and suppressed the local experience." It then hedges, and the hedge is the operative
  part: **"Verify generated metadata with the consumer's installed build."**
  - So this is permitted now, but it is **not** a free action. Add a dedicated
    `<srcDir>/extensions/<host>/application.js` so the root lifecycle is not reused for the host, and
    check the emitted manifest: if `isolateBundlePaths` lists both `isolate/application.js` **and**
    `isolate/src/extensions/…/application.js`, the installed build LACKS the fix — on such a build omit
    the dedicated module. Details in `aiux-build/references/app/extensions.md`.
  - ⬜ **Unverified on this instance.** Nobody has yet read back emitted metadata here to confirm which
    behaviour this installed SDK has. Until someone does, treat a mixed project as a deliberate,
    verified-after-install choice rather than a default.
- **Do not add the host as a `package.json` dependency** or import its page source. The project-id/route-id
  in the directory path is the entire coupling.

## Before building or updating UI

1. Invoke the **`ui-discovery`** skill first — before writing code or making a plan.
2. Evaluate reusable components and instance widgets together. If a candidate exists, use the best match
   and proceed without asking for confirmation.

`.build-agent/skills/` holds **19 skill folders**. Twelve derive from the ServiceNow agent packs; the
other seven (`hint-lookup`, `aiux-instance-ops`, `aiux-agents`, `aiux-widget`, `diag-playbook`,
`servicenow-interactive-report-writer`, `aiux-tailwind-vision-spec`) are authored here. There is no
`postinstall` hook, no `.claude/skills`, no `.agents/skills` symlink and no `pnpm agent:skills`. Do not
try to regenerate them.

### 🔑 Never edit a vendor skill file

The pack-derived skills are **byte-identical to `node_modules/@servicenow/agent-pack-*`** and must stay
that way. Editing them is what turned the v2.6.0 → v3.0.0 pack bump into a full manual re-audit.

- **Corrections go in `SKILL-OVERRIDES.md`**, keyed by skill name — never inline in the skill.
- **Adding our own files alongside vendor content is fine** and survives an upgrade, because a
  file-by-file vendor copy never touches them. They must stay inside the skill folder:
  `load_skill_resource(skill_name, file_path)` only resolves paths within a skill directory, so moving
  `validate-checks.md` or `header-config-contract.md` out would break every call site.
- **Upgrading a pack** = copy the vendor files over, **one file per `fs_copy` call**. A directory copy is
  destructive: it deletes destination-only files. The recipe and the don't-copy / must-survive /
  exceptions lists are in `SKILL-OVERRIDES.md` → Upgrade recipe.
- **Two deliberate exceptions**, both recorded in the overlay: `ui-discovery/SKILL.md` keeps a hand-
  maintained union component index, and `pages-extensions-generator` has no upstream at all — the pack
  dropped it at v3.0.0, so it is now an authored local skill.

⚠ **`pages-extensions-generator`'s capability now lives upstream** in
`aiux-build/references/app/extensions.md`, which is the authority for path conventions, templates and
layout precedence. The local folder is retained only for its `__parentScopeName__` / `__parentRouteId__`
resolution and its three `assets/` templates, which the pack does not ship.

Two more skills — `atf-run-test` and `update-system-property` — are provided by the environment and are
**not** on disk. TOOLNOTES.md → Skill inventory lists all of them, plus the two loader rules that make a
skill silently invisible.

---

## Extension paths resolve through `srcDir`

`aiux.json` here sets **`"srcDir": "src/lux"`**, so this app's extension pages live at:

```
src/lux/extensions/<host-project-id>/<host-basename>/pages/<route>/page.js
```

- **Extensions are the one exception to the project-root fallback.** With `srcDir` UNSET they resolve at
  `src/extensions/`, never project-root `extensions/`. With `srcDir` set they resolve at
  `<srcDir>/extensions/`. Verified against
  `node_modules/@servicenow/aiux/core/commons/project-config.js` → `resolveSrcPath`.
- Convention 1 is **host project id + host basename**, not scope + route id. They coincide for a host
  created before `aiux.json` carried a `projectId`, because such a host uses its scope as its project id —
  which is why `sn_ex_emp_hub_mw/salesportal` works for the Sales Portal.
- `aiux.json`'s own `projectId` must be a **non-empty** string. An empty `""` does NOT fall back to the
  scope: the validator does `aiuxJson.projectId ?? scope`, and `??` only triggers on null/undefined, so
  `""` reaches the non-empty check and **fails the build**. Measured here.

## Read SKILL-OVERRIDES.md when

**You activate any pack skill** — `ui-discovery`, `aiux-build`, `accessibility`, `figma-to-widget`,
`internationalization`, `localization`, `migrate-header-config-review`, `pages-extensions-generator`,
`components`, `compositions`, `motion`, `patterns`. The skill files are pristine vendor content and
carry shell commands and claims that are void or wrong here; the overlay is where those are corrected.
Read its global section plus the section for the skill you activated.

## Read TOOLNOTES.md when

| Trigger | Section |
| --- | --- |
| A skill tells you to run any shell command | Command → tool |
| You need instance data, or a widget/experience lookup | Instance tools · `sys_aix_widget` role filter |
| Writing or debugging CSS, Tailwind or DaisyUI classes | Measured facts → DaisyUI safelist |
| Writing a `css` or `html` tagged template | Measured facts → backtick trap |
| Referencing an image | Measured facts → `db_image` URLs |
| Touching `<srcDir>/extensions/` structure or `application.js` | Extension model · hooks |
| Copying or merging skill files, or taking a new pack version | Measured facts → `fs_copy` is destructive · Drift detection |
| Something is blocked and you may need to ask the user | Genuinely unavailable |
| A skill cites a path that does not exist | Dead links in the pack |
| Choosing a skill | Skill inventory |
