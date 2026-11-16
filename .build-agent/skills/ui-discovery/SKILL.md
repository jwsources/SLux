---
name: ui-discovery
description: Discover reusable AIUX components and instance widgets before building or updating UI. Check this unified index first to avoid re-implementing existing UI.
metadata:
  author: servicenow
  version: '1.0.0'
---

# AIUX UI Discovery

> ## ⚠️ WEB IDE BOUNDARY — read before following any step below
>
> There is **no shell** in this IDE. Every `pnpm`, `node`, `npx`, `curl`, `find` and `grep` instruction in
> this file is **void**. `build` and `install` are **user actions** — never run them yourself.
> Translation table and what to ask the user for: **`AGENTS.md`** — read it first.
> Corrections for this skill are marked **WEB IDE** inline below. Where they contradict the original text,
> **the WEB IDE block wins.**

Before building or updating UI, check this index for an existing component or widget that covers the use case.

## Related Horizon Design Knowledge Skills

| Skill                | Relationship                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| accessibility        | All components in this index implement WCAG 2.2 AA — check this skill for non-obvious ARIA requirements before customizing |
| internationalization | Components that render user-visible text support `@lit/localize` — check this skill when adding locale-specific text       |

---

## How to use this skill

There are three sources of reusable UI, checked in this order: the **local workspace** (UI already authored in this project), **packaged components** (bundled with AIUX), and **instance widgets** (`sys_aix_widget` records on the ServiceNow instance, not on disk). They are independent — the same capability may exist in more than one, and a local file does not mean the packaged or instance version is absent.

0. **Check the local workspace first.** Glob the project for UI the user already authored — widgets under `widgets/*/` (each has an `index.js`, often a `server-script.js`) and page-scoped components under `pages/**/components/*.js`. Read any file whose name or purpose plausibly matches the request; reuse it directly by its existing path/import. This is offline, free, and it is the user's own code — prefer it over rebuilding. Only when nothing local fits do you move on to the packaged/instance index below. **This workspace glob is for reusing local UI only. Do NOT use workspace or `node_modules` searches to decide whether a packaged component or an instance widget exists — those resolve from `@servicenow/aiux` and the instance regardless of what is on disk.**

   **Local wins over its own deployed copy.** A widget under `widgets/<tag>/` may also appear in the instance index as a row for this project's scope — it is the same widget, deployed. The local source is what the user is editing now; the instance copy is a deployment snapshot that is equal or older. When a local widget matches an index row by tag **and** that row's scope is this project's scope, use the local source and ignore that instance row: do not rank it, and do not fetch its source. Match scope against this project's scope from `now.config.json`, allowing for the 18-character scope-prefix truncation (e.g. project scope `x_snc_toast_consumer` matches index scope `x_snc_toast_consum`). This applies **only** to the exact same scope+tag identity — a widget with the same tag in a *different* scope is a different widget and stays a candidate.

1. Read every index row and rank all plausible candidates together. Components and widgets are independent deployed entries. Do not infer a relationship from similar tag names; if both overlap, evaluate their references separately.

2. Load every reference named in the candidate's `Reference` column. If it does not fit, try the next candidate. If nothing fits, say you checked the local workspace and the unified index and found no reusable match, then continue with the original request.

3. **If the candidate is a widget, read its authored source before writing any code — every time.**

   **WEB IDE — the `node …/fetch-widget-source.js` command below is void.** It was a Node CLI whose only
   real work was two queries against `sys_aix_widget`; its manifest lookup, credential resolution and disk
   cache existed solely because it ran as a separate process. Here the instance is directly reachable, so:

   **a. Discovery and ranking — the `list-widgets.js` asset, run via `run_script`.** It carries the real
   discovery query, which is **not** something to improvise:

   ```
   load_skill_resource(skill_name: "ui-discovery", file_path: "scripts/list-widgets.js")
   -> optionally set FILTER_SCOPE / NAME_LIKE -> run_script
   ```

   `type=aix_widget^category!=internal^category!=system^ORDERBYname`

   **`type=aix_widget` must be a POSITIVE match.** Page and layout records live in this same table with an
   **empty** `type`, so a negative filter excludes nothing. Measured on this instance: **71 of 192 visible
   rows have an empty type** — 37% plumbing that a `type!=…` filter would hand you as candidates.
   `category`: keep `platform` + `custom`, drop `internal` (author opted out via `@discoverable(false)`, or
   omitted the decorator) and `system` (platform-created only). **Do not narrow to `platform`** — it is
   self-declared and unenforced, and in practice every discoverable widget is `custom`.

   The asset prints each candidate's `importSpecifier`, `hasServerScript`, `chat_compatible`, `roles`,
   `dependent_widget_ids`, and a **digest** (`count` + `maxUpdated`) that is the whole freshness contract:
   `count` catches adds and deletes, `maxUpdated` catches edits. Re-run later and compare.

   For a one-off lookup, `run_query table: sys_aix_widget encodedQuery: id=<tag>` is fine — but it does
   **not** apply the type/category filter, so treat its results as unranked.


   **b. Authored source — the `probe-widget-source.js` asset, run via `run_script`.** Do **not** pull
   `sourcemap` into context with `run_query`: measured on this instance, one widget's sourcemap is **302,765
   chars** against **197,215** chars of actual source inside it. The extraction must happen server-side.

   ```
   load_skill_resource(skill_name: "ui-discovery", file_path: "scripts/probe-widget-source.js")
   -> set TAG (and SCOPE if the tag is reused across scopes) -> run_script
   ```

   Leave `TAG` empty to list visible widget ids. The asset carries the mandatory controls: `isValidField`
   across all 13 fields, a bogus-field control that must read `false`, a row-count cross-check that detects a
   **discarded predicate**, the `maint`-role gap against the parent table, and a dot-walk-vs-direct-lookup
   control on the scope.

   **c. Read the column-precedence rules, or you will read the wrong thing.** Two authoring paths produce
   structurally different records:

   | Origin | `component` | `sourcemap` | Authored source lives in |
   | --- | --- | --- | --- |
   | **SDK-built** | terser-**minified** | non-empty | `sourcemap.sourcesContent[i]` where `sources[i]` is not under `node_modules` |
   | **instance-authored** | readable source | empty | `component` — it *is* the original |

   `from: 'component-minified'` means an SDK-built widget lost its `sourcesContent` upstream: you are
   reading minified code. Say so; do not present it as the author's source.

   **d. Two traps that look like features.**
   - **`script` is never empty.** The SDK writes a **stub IIFE with an empty body** into widgets that have
     no server script, so a non-zero length proves nothing — the IIFE body must be inspected (the regex
     above). Judging "has a server script" by field length is a false positive by design.
   - **The scope prefix is not derivable from the app name** — it truncates at 18 characters. Read
     `sys_scope.scope`.

   **e. Do not derive an API table from the source.** The pack removed exactly that: regex extraction
   reported unmarked helpers as public API and could not describe behaviour. Dead heuristics with known
   false positives are worse than none. Read the source and quote what it actually does.

   **Why this is non-negotiable.** A widget's API is not in the index and not in its reference. Neither
   carries its properties, events, slots or server-script contract; only its authored source does. The
   server script is the contract for `this.server.get(input)` — a guessed action (`{action: 'approve'}`
   against a script that only reads `input.limit`) round-trips successfully while doing nothing at all.
   Re-read even when you have used the widget before and its source is already in your context: a widget
   edited or redeployed since then will happily accept markup built from the old API and do nothing — no
   error, no warning, working-looking code wired to an event name that no longer exists. **Ranking on stale
   metadata is cheap to be wrong about; wiring on stale source is not.**

   **If the probe fails**, say the widget was **set aside unverified** — name it, and say you could not read
   its current properties and events, so wiring it would risk code that looks right and silently does
   nothing. That is different from "no widget matched", and the user must be able to tell which happened.

   This does not apply to components, whose reference is complete on its own.

4. **Check the candidate against the request before writing code.** Reading a reference tells you what the candidate *has*; it does not tell you what the request needs and the candidate lacks. List both: which parts of the user's request this component or widget satisfies, and which it does not. Base that on its source, not on its name or description — a widget that only dispatches `thing:approve` does not perform the approval, and a server script that never reads an input key silently ignores it.

   If anything is missing, **say so and stop for a decision**. Do not quietly ship the covered part as finished, and do not invent the missing behavior — you cannot edit a packaged component or a deployed widget, and routing around it (writing the missing logic into the page) changes who owns that logic, may duplicate what the owner ships next, and may bypass constraints the original enforces. Offer the real options: accept the partial capability, implement the rest in the page deliberately, choose a different candidate, build custom, or ask the owner to extend it. The failure this prevents is not an unfinished job — it is a partial result presented as a complete one.

5. **Add the import from the selected reference — every time, for both components and widgets.** The element does not render without it: an unimported custom element is silently inert (no error, no warning, just an empty tag), which is easy to mistake for "should just work" when a widget "resolves from the instance." That phrase describes where the imported *code* comes from, not whether an import statement is needed — it is, for both kinds of candidate. Do not add a package dependency: components are bundled with `@servicenow/aiux`, and a widget's import resolves from the instance at request time rather than from `node_modules`, but the `import` line itself is still required in the page/component that uses the element.

   **If a widget's custom element does not appear to render, the fix is almost always this missing import — check for it before considering anything else.** Never respond to a missing-import symptom by copying the widget's source into the local project (e.g. a new `widgets/<tag>/` directory): that turns a shared, instance-resolved widget into an untracked fork that immediately starts drifting from the original, which is the exact duplication this skill exists to prevent.

   **Controllers, directives, and contexts are cataloged the same way.** Before writing a new `ReactiveController` (`addController`), a new Lit `directive()`, or a new `createContext()`, check the `Kind` column for `controller` / `directive` / `context` rows first — these are versioned npm packages, not instance state, so treat them like component rows: read the reference, use the `## Import` line verbatim (a named import, e.g. `import {FocusTrapController} from '...'`, not the side-effect import used for components), and don't re-implement functionality one of these already covers.

6. Mention what you selected and why. Do not stop for confirmation on the selection itself — only on a capability gap found in step 4.

## Widget catalog status — WEB IDE: there is no catalog, and none is needed

**The entire sync-and-snapshot apparatus this section used to describe is deleted.** It existed only
because an offline agent could not query the instance: a script pulled a `widgets.json` manifest into an
agent cache, regenerated this file between markers, and a postinstall hook restored it. Every part of that
is void here.

**Void — do not attempt, do not mention to the user, do not ask permission for:**
`node …/sync-widgets.mjs`, its `--check` freshness mode, the `index current` / `index outdated` /
`index freshness-unknown` vocabulary, the scripted permission request, the scripted failure speech, the
"after a sync this file is out of date" caveat, and the empty `<!-- WIDGET_INDEX_START/END -->` table below.

**Instead: query the instance at the moment you need it.** There is no snapshot, therefore no staleness
problem. See step 3 above for the `run_query` / `run_script` recipes.

⚠ **Your `sys_aix_widget` results are silently role-filtered.** A `before query` business rule appends
`category!=internal^ORcategoryISEMPTY` for every caller without the **`maint`** role — no error, no log
line. Page widgets are commonly `category=internal`, so **"no widget matched" may mean "no widget I am
allowed to see matched"**, and you must say which. Measured: 192 rows on `sys_aix_widget` against 562 on the
parent `sys_ux_widget` for the same class — cross-check a suspicious total that way.

---

## Unified UI Index

**Read every row before concluding no match exists. Do not skim.** `platform` is a tie-breaker over `custom`, not a reason to reject a widget.

| Capability | Kind | Scope | Category | Description | Best for | Reference |
| ---------- | ---- | ----- | -------- | ----------- | -------- | --------- |

<!-- COMPONENT_INDEX_START -->
| `aiux-announcement-banner` | component | — | — | A container that fetches, groups, and renders a set of active announcement banners, applying client-side dismissal state from localStorage and live updates over the AMB realtime channel. | — | `references/components/aiux-announcement-banner.md` |
| `aiux-code-editor` | component | — | — | A Monaco-based source code editor for the AIUX platform with syntax highlighting, an optional toolbar, fullscreen mode, and optional linting and autocomplete. | — | `references/components/aiux-code-editor.md` |
| `aiux-condition-builder` | component | — | — | A query builder component that lets users construct complex database queries through a graphical interface. | — | `references/components/aiux-condition-builder.md` |
| `aiux-date-range-picker` | component | — | — | Date range picker for selecting start and end dates from quick presets or a calendar popup. | — | `references/components/aiux-date-range-picker.md` |
| `aiux-document-viewer` | component | — | — | Document viewer component for rendering ServiceNow attachments including PDFs, images, text, JSON, and Office documents converted server-side. | — | `references/components/aiux-document-viewer.md` |
| `aiux-gallery-list` | component | — | — | List package that provides `<aiux-list-connected>` for ServiceNow-backed table, gallery, and kanban views plus `<aiux-gallery-list>` for presentational card-grid rendering with pagination, filtering, sorting, and condition-builder integration. | — | `references/components/aiux-gallery-list.md` |
| `aiux-help-assistant` | component | — | — | Dynamic Guidance assistant that runs a live, voice-driven Now Assist help session with screen sharing. | — | `references/components/aiux-help-assistant.md` |
| `aiux-help-panel` | component | — | — | A floating help panel for ServiceNow pages showing contextual documents, guided tours, and a What's New tab. | — | `references/components/aiux-help-panel.md` |
| `aiux-list-connected` | component | — | — | List package that provides `<aiux-list-connected>` for ServiceNow-backed table, gallery, and kanban views plus `<aiux-gallery-list>` for presentational card-grid rendering with pagination, filtering, sorting, and condition-builder integration. | — | `references/components/aiux-list-connected.md` |
| `aiux-nacm` | component | — | — | Now Assist Content Management (NACM) components for AI-powered skill invocation, response rendering, record-watcher updates, and user interaction in the Now Assist experience. | — | `references/components/aiux-nacm.md` |
| `aiux-pagination-nav` | component | — | — | Accessible pagination navigation with page buttons, ellipsis truncation, optional prev/next and first/last controls, arrow-key navigation, and a dots display mode. | — | `references/components/aiux-pagination-nav.md` |
| `aiux-playbook` | component | — | — | A self-contained web component for rendering ServiceNow Playbooks. | — | `references/components/aiux-playbook.md` |
| `aiux-record-activity-layout` | component | — | — | Record package that provides data fetching, provider, APIs, and components for ServiceNow records. | — | `references/components/aiux-record-activity-layout.md` |
| `aiux-record-activity-stream` | component | — | — | Record package that provides data fetching, provider, APIs, and components for ServiceNow records. | — | `references/components/aiux-record-activity-stream.md` |
| `aiux-record-core-attachment` | component | — | — | Attachment management panel that lists, uploads, previews, and edits file attachments on a ServiceNow record, with a full and compact display mode. | — | `references/components/aiux-record-core-attachment.md` |
| `aiux-record-form` | component | — | — | Record package that provides data fetching, provider, APIs, and components for ServiceNow records. | — | `references/components/aiux-record-form.md` |
| `aiux-score` | component | — | — | A score card that displays a single metric with an optional change indicator and target. | — | `references/components/aiux-score.md` |
| `aiux-stepper` | component | — | — | Vertical stepper that shows AI agent workflow progress for a conversation by reading `sys_cs_message` records and subscribing to a live record watcher. | — | `references/components/aiux-stepper.md` |
| `aiux-visualizations-arc` | component | — | — | Arc visualization component for single-value gauge and dial charts with min/max ranges, optional rule-based zone coloring, gradient arcs, animated rendering, and configurable center content. | — | `references/components/aiux-visualizations-arc.md` |
| `aiux-visualizations-axis` | component | — | — | Cartesian chart visualization for line, spline, column, bar, area, areaspline, and scatter charts using DataResponse input with configurable axes, legend, tooltip, interactions, and annotations. | — | `references/components/aiux-visualizations-axis.md` |
| `aiux-visualizations-bullet` | component | — | — | Bullet chart visualization for comparing a metric against a target or range, with min/max bounds, rule-based coloring, optional animation, and DataResponse-driven labels and values. | — | `references/components/aiux-visualizations-bullet.md` |
| `aiux-visualizations-composition` | component | — | — | Composition visualization for pie, donut, and semi-donut charts that render proportional segments from a DataResponse with one dimension for slice labels and one metric for slice values. | — | `references/components/aiux-visualizations-composition.md` |
| `aiux-visualizations-matrix` | component | — | — | Matrix heatmap visualization for comparing values across two categorical dimensions, with automatic or explicit axis/value mapping, gradient or categorical legends, optional zero-filled missing cells, and configurable tooltips. | — | `references/components/aiux-visualizations-matrix.md` |
| `aiux-visualizations-score` | component | — | — | Score visualization for displaying a single metric as a formatted score card with optional target comparison, change indicator, conditional coloring, click events, and responsive sizing via `<aiux-score>`. | — | `references/components/aiux-visualizations-score.md` |
| `aiux-visualizations-spider` | component | — | — | Spider/radar visualization for comparing one or more numerical series across categorical axes, with configurable legend, tooltip, labels, marker display, polygon styling, and gradient series colors. | — | `references/components/aiux-visualizations-spider.md` |
| `aiux-visual-board` | component | — | — | AIUX Visual Board (Kanban) component — a standalone, reusable board rendering engine for 1D and 2D kanban layouts with drag-and-drop support. | — | `references/components/aiux-visual-board.md` |
| `page-alert-host` | component | — | — | Page-level alert system with a single host element that renders and orchestrates a stack of dismissible alerts. | — | `references/components/page-alert-host.md` |
| `sn-aiux-chat-wrapper` | component | — | — | Chat components for AIUX applications that wrap `sn-engagement-experience` to provide AI chat functionality with event-based session handling. | — | `references/components/sn-aiux-chat-wrapper.md` |
| `ChatController` | controller | — | — | `ChatController` composes the chat experience for `NavLayout` — managing chat mode (OMNI, default, and AIEX-hidden), lazy-loading the AIEX library, session lifecycle, event handling, navigation override, and LBF prop configuration. | — | `references/controllers/ChatController.md` |
| `FocusTrapController` | controller | — | — | A standalone, Lit-compatible controller package for focus behaviour in elements with shadow roots, providing `FocusController` for auto-focus delegation and a lightweight trap toggle, and `FocusTrapController` for overlay-oriented focus trapping with container scoping, custom focus order, and an explicit activate/deactivate lifecycle. | — | `references/controllers/FocusTrapController.md` |
| `FocusController` | controller | — | — | A standalone, Lit-compatible controller package for focus behaviour in elements with shadow roots, providing `FocusController` for auto-focus delegation and a lightweight trap toggle, and `FocusTrapController` for overlay-oriented focus trapping with container scoping, custom focus order, and an explicit activate/deactivate lifecycle. | — | `references/controllers/FocusController.md` |
| `TooltipController` | controller | — | — | A standalone, Lit-compatible tooltip controller. | — | `references/controllers/TooltipController.md` |
| `RovingTabIndexController` | controller | — | — | A standalone, Lit-compatible controller that implements the roving tabindex pattern for a group of peer items inside a host element. | — | `references/controllers/RovingTabIndexController.md` |
| `AriaLiveController` | controller | — | — | A standalone, Lit-compatible controller that announces messages to screen readers via partitioned `aria-live` region pairs on `document.body`. | — | `references/controllers/AriaLiveController.md` |
| `spreadProps` | directive | — | — | Lit directive for spreading properties onto elements. | — | `references/directives/spreadProps.md` |
| `timeAgo` | directive | — | — | Lit directive for auto-updating relative time display. | — | `references/directives/timeAgo.md` |
| `liveRegion` | directive | — | — | Lit directive for applying aria-live attributes to elements for screen reader announcements. | — | `references/directives/liveRegion.md` |
| `provideOrigin` | directive | — | — | Lit directive for providing widget origin context to descendant elements without adding a wrapper element. | — | `references/directives/provideOrigin.md` |
| `icon` | directive | — | — | A child-position Lit directive that renders an inline SVG `<use>` icon referencing the platform sprite sheet. | — | `references/directives/icon.md` |
| `tooltip` | directive | — | — | A Lit element directive that attaches tooltip show/hide behaviour directly to a trigger element. | — | `references/directives/tooltip.md` |
| `lazyImage` | directive | — | — | Lit directive for rendering images with performance best practices: native lazy loading, async decoding, and required dimensions to prevent Cumulative Layout Shift (CLS). | — | `references/directives/lazyImage.md` |
| `lottieAnimation` | directive | — | — | Lit element-position directive for rendering Lottie animations with slug-based asset resolution, lazy `lottie-web` loading, and imperative playback control. | — | `references/directives/lottieAnimation.md` |
| `widgetRenderingContext` | context | — | — | Lit context for tracking where a widget is rendered ('page' or 'chat'). | — | `references/contexts/widgetRenderingContext.md` |
| `mobileAppBridgeContext` | context | — | — | Re-export of the mobile app bridge context from `@servicenow/mobile-app-bridge-lit` for consistent context management across the application. | — | `references/contexts/mobileAppBridgeContext.md` |
| `routeContext` | context | — | — | Logical barrel exports for AIUX Lit contexts, including `routeContext` for the current navigation state, `experienceContext`/`experienceContextManager` for app/experience metadata, and `userPreferencesContext` for pre-fetched user preferences. | — | `references/contexts/routeContext.md` |
| `experienceContext` | context | — | — | Logical barrel exports for AIUX Lit contexts, including `routeContext` for the current navigation state, `experienceContext`/`experienceContextManager` for app/experience metadata, and `userPreferencesContext` for pre-fetched user preferences. | — | `references/contexts/experienceContext.md` |
| `userPreferencesContext` | context | — | — | Logical barrel exports for AIUX Lit contexts, including `routeContext` for the current navigation state, `experienceContext`/`experienceContextManager` for app/experience metadata, and `userPreferencesContext` for pre-fetched user preferences. | — | `references/contexts/userPreferencesContext.md` |
| `aiux-sn-feedback` | component | — | — | Thumbs up/down feedback widget with an optional granular feedback form (checklist, radio buttons, textarea). | — | `references/components/aiux-sn-feedback.md` |
| `aiux-sn-honeycomb` | component | — | — | Honeycomb tilemap visualization component. | — | `references/components/aiux-sn-honeycomb.md` |
| `aiux-sn-popover` | component | — | — | `<aiux-sn-popover>` is a floating panel anchored to a trigger element. | — | `references/components/aiux-sn-popover.md` |
| `aiux-accordion-group` | component | — | — | Flexible accordion/collapse component with single or multiple item expansion, customizable icons, and comprehensive accessibility support. | — | `references/components/aiux-accordion-group.md` |
| `aiux-alert-message` | component | — | — | A typed notification alert (info, success, warning, error, and Horizon severity variants) with an optional title, message, dismiss button, and an auto-dismiss timer that can be paused, resumed, and shows a progress bar. | — | `references/components/aiux-alert-message.md` |
| `aiux-carousel-slider` | component | — | — | Carousel slider component with autoplay, keyboard navigation, and WCAG 2.2 AA compliance. | — | `references/components/aiux-carousel-slider.md` |
| `aiux-dialog` | component | — | — | Modal and modeless dialog component for the Karuna AIUX platform. | — | `references/components/aiux-dialog.md` |
| `aiux-node-map` | component | — | — | A Lit web component (extending `AIUXElement`) for visualizing graphs with nodes and edges using Cytoscape.js. | — | `references/components/aiux-node-map.md` |
| `aiux-toolbar` | component | — | — | Accessible, SSR-compatible toolbar component for ServiceNow AIUX. | — | `references/components/aiux-toolbar.md` |
| `aiux-appointment-calendar` | component | — | — | An appointment calendar component for scheduling, rescheduling, and proposing appointment slots. | — | `references/components/aiux-appointment-calendar.md` |
| `aiux-audio-player` | component | — | — | Audio player component with playback controls (play/pause, rewind, fast-forward, scrubber, volume, and playback rate). | — | `references/components/aiux-audio-player.md` |
| `aiux-checklist` | component | — | — | A Lit web component providing a sorted, checkable item list with optional editing, prefixes, links, loading state, and empty state. | — | `references/components/aiux-checklist.md` |
| `aiux-checklist-item` | component | — | — | A Lit web component providing a sorted, checkable item list with optional editing, prefixes, links, loading state, and empty state. | — | `references/components/aiux-checklist-item.md` |
| `aiux-contact-card` | component | — | — | Contact card component that displays a user's avatar, name, titles, badges, and contact fields. | — | `references/components/aiux-contact-card.md` |
| `aiux-list-selector` | component | — | — | List selector component for adding, removing, and reordering items between available and selected columns. | — | `references/components/aiux-list-selector.md` |
| `aiux-sla` | component | — | — | Migrated from `crm-aiux-sla` (`app-crm-ainpx-agent/widgets/crm-aiux-sla`). | — | `references/components/aiux-sla.md` |
| `aiux-schedule-recurrence` | component | — | — | A presentational Lit web component for creating and editing recurring event schedules in Karuna applications. | — | `references/components/aiux-schedule-recurrence.md` |
| `aiux-timer` | component | — | — | Live timer web component — Karuna (Lit SSR) port of the Seismic `sn-timer`. | — | `references/components/aiux-timer.md` |
| `aiux-360-degree-visualization` | component | — | — | Purely presentational radial relationship graph. | — | `references/components/aiux-360-degree-visualization.md` |
| `aiux-resizable-panes` | component | — | — | Two adjacent content regions with a draggable, keyboard-operable separator between them, for dense workspaces: list + form, detail + activity stream, side-by-side comparisons. | — | `references/components/aiux-resizable-panes.md` |
| `aiux-color-swatch` | component | — | — | An editable color swatch component that displays a color preview and opens a popover color picker for selection. | — | `references/components/aiux-color-swatch.md` |
| `aiux-timeline` | component | — | — | Horizontal timeline Lit web component for the ServiceNow AIUX platform. | — | `references/components/aiux-timeline.md` |
| `aiux-components-calendar` | component | — | — | Calendar date picker component for the Karuna AIUX platform. | — | `references/components/aiux-components-calendar.md` |
| `aiux-components-empty-state-content` | component | — | — | A centered empty-state message for when content is unavailable, with a heading, optional body text, an action slot, and a choice of an icon or a slotted illustration as its asset. | — | `references/components/aiux-components-empty-state-content.md` |
| `aiux-components-loader` | component | — | — | SSR-safe loading indicator for AIUX applications with a CSS radial-dot animation by default, optional Lottie animation, size variants, label text, and a ServiceNow footer option. | — | `references/components/aiux-components-loader.md` |
| `aiux-components-tabs` | component | — | — | A flexible tab navigation component using button elements for WCAG-compliant tab navigation, with icon support, animated panel transitions, and DaisyUI styling. | — | `references/components/aiux-components-tabs.md` |
| `aiux-components-time-selector` | component | — | — | Editable time input with a dropdown picker for the Karuna AIUX platform. | — | `references/components/aiux-components-time-selector.md` |
| `aiux-components-toast` | component | — | — | A flexible toast notification component for displaying temporary messages, with multiple types, 9 positions, auto-dismiss, and smooth position-aware animations. | — | `references/components/aiux-components-toast.md` |
| `aiux-list-nav-menu` | component | — | — | List Navigation Menu Component for Karuna | — | `references/components/aiux-list-nav-menu.md` |
| `aiux-create-list-dialog` | component | — | — | List Navigation Menu Component for Karuna | — | `references/components/aiux-create-list-dialog.md` |
<!-- COMPONENT_INDEX_END -->
<!-- WIDGET_INDEX_START -->
<!-- WIDGET_INDEX_TABLE -->
<!-- WIDGET_INDEX_END -->
