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

`run_diagnostics` and `ui_diagnostics` are validation, not change — no approval needed. `ui_diagnostics`
needs an install first.

## There is no terminal

Every `pnpm` script in `package.json` is how this app builds *outside* this IDE. In here:

| Script | Here |
| --- | --- |
| `pnpm build` | the **`build`** tool — SDK ACTION |
| `pnpm deploy` | the **`install`** tool — SDK ACTION. Deploy **after** the host, then evict the tenant cache |
| `pnpm lint` | no execution. Regex-detectable rules → `fs_grep`; type/syntax → `run_diagnostics` |
| `pnpm dev` | no equivalent. No dev server, no hot reload. After install → `ui_diagnostics` |

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

1. **This file, then TOOLNOTES.md** — this repo, this IDE, this instance. Nothing outranks a fact
   measured here.
2. **The AIUX skills.** This is an AIUX project, so they own the framework: `ui-discovery` first for
   any UI, then `aiux-build`, `accessibility`, `components`, `patterns`, `motion` and the rest.
   Strong on Lit, components, tokens and ARIA — and they know nothing about this instance.
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
  nothing, and an unsafelisted utility is tree-shaken silently. See PLATFORM-NOTES.md before writing CSS.
- Custom element tags carry the app's scope, kebab-cased (`x-snc-[SCOPE]]-…`)
- Net-new pages the host doesn't own can be role-gated with `@roles(['admin'])`

## Do not

- **Do not add an app's own `pages/` directory or a `landing` to `aiux.json`.** Own pages plus
  `src/extensions/` pages in one project is unsafe, not merely unsupported (STRY64103259) — the own pages
  get silently wired into the host's experience. An app that both extends another app *and* has its own
  pages must be a **separate** app. (Specific to extension *pages*; a `src/extensions/` tree holding only
  per-host lifecycle modules does not trigger it.)
- **Do not add the host as a `package.json` dependency** or import its page source. The scope/route-id in
  the directory path is the entire coupling.

## Before building or updating UI

1. Invoke the **`ui-discovery`** skill first — before writing code or making a plan.
2. Evaluate reusable components and instance widgets together. If a candidate exists, use the best match
   and proceed without asking for confirmation.

`.build-agent/skills/` holds **17 skill folders, committed and hand-edited** — version-controlled
content, not generated. Twelve are edited copies of the ServiceNow agent packs; the other five
(`hint-lookup`, `aiux-instance-ops`, `aiux-agents`, `servicenow-interactive-report-writer`,
`aiux-tailwind-vision-spec`) are authored here. There is no `postinstall` hook, no `.claude/skills`, no
`.agents/skills` symlink and no `pnpm agent:skills`. Do not try to regenerate them.

Two more skills — `atf-run-test` and `update-system-property` — are provided by the environment and are
**not** on disk. TOOLNOTES.md → Skill inventory lists all of them, plus the two loader rules that make a
skill silently invisible.

---

## Read TOOLNOTES.md when

| Trigger | Section |
| --- | --- |
| A skill tells you to run any shell command | Command → tool |
| You need instance data, or a widget/experience lookup | Instance tools · `sys_aix_widget` role filter |
| Writing or debugging CSS, Tailwind or DaisyUI classes | Measured facts → DaisyUI safelist |
| Writing a `css` or `html` tagged template | Measured facts → backtick trap |
| Referencing an image | Measured facts → `db_image` URLs |
| Touching `src/extensions/` structure or `application.js` | Extension model · hooks |
| Something is blocked and you may need to ask the user | Genuinely unavailable |
| A skill cites a path that does not exist | Dead links in the pack |
| The pack version may have moved | Drift detection |
| Choosing a skill | Skill inventory |
