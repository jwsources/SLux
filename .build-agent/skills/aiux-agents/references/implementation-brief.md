# Brief — implementation (`build_agent_core#sub_implementation`)

Writes files: builds a page, widget or component, or fixes a defect.

⚠️ **`aiux-build` is the authority, not this file.** This brief supplies only
what `aiux-build` cannot: the environment, the load order, and the handoff
contract. Everything about *how* to build a page, widget or component lives in
that skill and its references. Do not restate it here — a second copy competes
with the original.

---

## Assemble the payload

1. The **environment preamble** from `SKILL.md` §2, verbatim.
2. The context list from `SKILL.md` §3 — paths, sys_ids, verified contracts,
   what is already ruled out.
3. The brief below.
4. The task, with its definition of done.

```
YOU ARE IMPLEMENTING. Follow the aiux-build skill as the authority.

FIRST, IN THIS ORDER, NO EXCEPTIONS:
  1. Read AGENTS.md. It outranks every skill on anything about this repo.
  2. activate_skill aiux-build — classify the task with its Mode Router
     (BUILD / EDIT / DEBUG / ANALYZE) and load only that mode's references.
  3. activate_skill ui-discovery — BEFORE drafting a plan or writing any UI.
     It is a mandatory gate, not advice.

REUSE BEFORE YOU BUILD. ui-discovery ranks local workspace UI first, then
packaged components, then instance widgets. CHECK THE LOCAL WORKSPACE PROPERLY
— a component that already exists in this app and does the job is always the
right answer, and missing one has cost this project a duplicate implementation
more than once. If a candidate covers part of the task, say which part it does
NOT cover and stop for a decision rather than shipping the covered half.

THEN, AFTER THE CODE IS WRITTEN:
  4. activate_skill accessibility — every component and page, unconditionally.
     Not only the ones that look interactive.
  5. activate_skill internationalization — every user-visible string, date,
     number and currency.

VERIFY, DO NOT ASSUME:
  - run_diagnostics on every file you touched. It proves the code PARSES, and
    nothing about behaviour.
  - build and install ARE available to you, behind the user's approval. Ask for
    them when the work is ready.
  - Once installed, verify on the RENDERED page — ui_diagnostics for a headless
    render plus console and DOM, or the atf-cloud-runner browser tools to drive
    it and read the accessibility snapshot. On a refactor that should change
    nothing, any snapshot difference is a regression.
  - Name whatever you could not confirm, and why.

BEFORE REPORTING READY — the handoff checklist. The rules behind these are in
the preamble; what matters here is that all four happen at the handoff, not
whenever:
  - Backtick gate on every touched file with a css/html/svg template. On a file
    that is mostly CSS the line-marker pattern is BLIND — census every backtick
    instead and account for each one by position.
  - Reference integrity both ways for every symbol, import, class and data-*
    attribute added or removed.
  - Delete BOTH dist and dist-metadata.
  - State what is VERIFIED and what is UNVERIFIED, with evidence.

YOU CANNOT ASK A QUESTION. You return exactly once and the parent reads it, so
there is no mid-task clarification available to you. When you hit one of these,
STOP THE WORK AND MAKE THE BLOCKER YOUR RETURN VALUE — name the options you can
see and what each costs, and do not pick one:
  - A runtime contract cannot be read from source.
  - A reused component covers only part of the task. Say which part it does not
    cover.
  - The task needs a decision about scope, data, or user-visible wording.
  - The same category of bug appears twice after a fix. That is structural:
    read the related files and return a refactor proposal instead of a third
    patch.

RETURN THE WORK YOU COMPLETED ALONGSIDE THE BLOCKER. A partial task with a named
blocker and a clean stopping point is useful; an abandoned one is not. Say
exactly what is in the tree and what is not.
```

---

## Return format

```markdown
## What changed
{outcomes, not a diff — the parent can see the diff}

## Reused vs written
| Thing | Source | Why |
|---|---|---|
| ... | reused `components/foo.js` | already does X |
| ... | written new | nothing in ui-discovery covered Y |

## Verified
{what, and by what evidence — diagnostics, a quoted source line, a control}

## Unverified
{what could not be confirmed, and why — always includes anything needing a render}

## Handoff
{what the user should look at after build + install, and what correct looks like}
```

---

## Project-specific constraints a sub-agent will not guess

- **This is an extension app.** Pages live at
  `src/extensions/<host_scope>/<host_route_id>/pages/<route>/page.js`. The
  directory path — not any `aiux.json#extends` field — is what binds it to the
  host. Never add own `pages/` at the project root: own pages plus extension
  pages in one project is unsafe, not merely unsupported.
- **Routes are flat.** The route comes from one directory name, so hierarchy
  lives in the route registry (`lib/v4-nav.js`), not in nested folders.
- **Imports resolve through the umbrella package.** Use
  `@servicenow/aiux/aiux-components-core`, not the bare
  `@servicenow/aiux-components-core` the skill tables show. Check how a sibling
  file imports before trusting any README.
- **Extend `AIUXElement` or `AIUXWidgetElement`**, never plain `LitElement`.
- **Tailwind utilities are safelisted.** An unsafelisted utility is tree-shaken
  in silence — the width/height scale stops at 16, and `gap-x`, `gap-y` and
  `shadow-*` are absent. Hand-written CSS in `static styles` needs no safelist
  and cannot be tree-shaken.
- **A page cannot style another component's shadow root,** and a shell cannot
  style slotted content. Content rendered by host chrome must carry its own
  styles, which means its own custom element.
