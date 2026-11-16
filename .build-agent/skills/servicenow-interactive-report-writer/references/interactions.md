# Interaction design and implementation

## 7. Interaction requirements

Dynamic means useful, working interaction—not animation or ornamental buttons.

For a substantive report, provide:
1. At least one content-exploration interaction: in-report search, meaningful filtering, sortable comparison data, or a relevant scenario control.
2. Expandable supporting evidence or methodology when supporting detail exists.
3. At least one utility interaction: print/save as PDF through the browser, clear/reset controls, or copy a section link when implemented reliably.

Default baseline for multi-section reports: search, category filtering where categories are meaningful, expand/collapse visible evidence, and print. Omit a filter if all content belongs to one category. Never invent categories or supporting detail merely to satisfy a control count.

### Interaction selection

| Reader need | Appropriate interaction | Required behavior |
|---|---|---|
| Find a relevant point | Search report text | Case-insensitive matching, result count, clear/reset, empty state |
| Focus on a real category | Select or checkbox filters | Combine predictably with search; identify the active filter |
| Inspect the basis of a finding | Native `details` and `summary` | Keyboard-operable; keep the main claim, citation, and material caveat visible |
| Compare rows | Sortable table | Correct typed sorting, stable order, visible sort direction, `aria-sort` |
| Read independent views | Tabs, only if truly needed | Proper tab keyboard behavior, state, and a print/no-JS reading path |
| Explore an explicit model | Scenario inputs | Sourced defaults, stated formula and units, bounded input, reset, labeled estimates |
| Share a point | Section permalink | Stable ID, descriptive label, graceful clipboard fallback |
| Produce a reading copy | Print button | Invokes the browser print dialog; prints the full report and evidence |

### State contract

- Search and filters affect the designated analytical items, not the report's identity, scope, main conclusion, or final attribution.
- Search and filters combine with AND logic unless the UI explicitly describes a different model.
- Explain whether sorting, filtering, or scenario inputs affect displayed results only or the underlying analysis. Never silently recalculate the main conclusion from hidden items.
- Announce result counts and empty states through a polite live region without moving keyboard focus on every keystroke.
- Provide a reset action. Reset must restore a coherent initial view.
- Never leave a navigation link pointing to content that cannot be reached because it is filtered out. Reset relevant filters before following that link, or keep section anchors outside the filtered set.
- Avoid persisting report searches, scenario inputs, or confidential content to local storage by default. Session-local state is sufficient.
- Do not use network calls for filtering, sorting, searching, printing, or expanding evidence.

### Progressive enhancement and accessibility

- Use native buttons, labels, inputs, selects, and `details` wherever possible.
- All content must exist in semantic HTML before JavaScript runs. Do not make the research depend on client-side data fetching or hydration.
- Hide JS-dependent controls until initialization succeeds; a broken script must leave a readable report rather than a fake working toolbar.
- Never use clickable `div` elements in place of buttons.
- Maintain visible focus, logical tab order, adequate target sizes, and usable mobile layouts.
- Use at least 4.5:1 contrast for normal text and 3:1 for genuinely large text; test actual rendered colors.
- Respect `prefers-reduced-motion`. Do not autoplay animation.
- Do not require hover to reveal an essential explanation or citation.
- Hidden and collapsed content must not create focus traps.
- Use one `h1`, logical heading order, semantic landmarks, and meaningful link labels.

## 10. Advanced interactions: constraints and implementation guidance

Add these only when the report's actual content warrants them. A report is not improved by having every control type.

### Sortable tables

- Use real table markup with a descriptive caption, `thead`, `tbody`, and scoped header cells.
- Place a native button inside each sortable header. Set `aria-sort="ascending"` or `"descending"` on the active `th`, and remove it from inactive headers.
- Store typed sort values separately from formatted display text. Parse percentages, currencies, dates, and missing values deliberately.
- Use `Intl.Collator` for text. Keep missing values consistently at the end. Preserve original row index as the stable tie-breaker.
- Sort data rows only, never headers or footnotes. Do not change source values or silently recalculate totals.
- Announce the sorted column and direction. Retain the source citations attached to their original rows.

### Charts and filters

- Use supplied or researched data only. Label units, periods, source, and whether the figures are actuals, estimates, or scenarios.
- Provide a readable data table or equivalent text alternative.
- Show active filters and the actual sample or data range being displayed. Empty data is an empty state, not a zero.
- Choose chart colors from the palette. On dark charts, never use Infinite Blue as a series if it disappears into the background; use a contrasting supporting series color or white instead.
- Do not rely solely on color: use direct labels, patterns, or shapes as needed.
- Tooltips must be keyboard-accessible and cannot hold the only explanation of a finding.
- Prefer inline SVG charts or native HTML/CSS only for actual data graphics, not for invented representational icons. If the host renderer cannot preserve a chart reliably, use the accessible table.

### Scenario calculators

- Use them only for an explicit model, not to make a narrative report look interactive.
- State the formula, units, assumptions, source of defaults, and what the model excludes.
- Label outputs as estimates or scenarios—not forecasts or realized benefits unless evidence supports that status.
- Validate finite numbers, ranges, empty values, and division by zero. Never show `NaN`, infinity, or a fabricated zero for unavailable data.
- Provide reset and distinguish user-entered assumptions from sourced baseline data.
- Do not persist sensitive inputs or send them to a server by default.

### Tabs

Prefer anchors and visible sections for a narrative report. If tabs are justified, implement `tablist`, `tab`, and `tabpanel` roles, matching IDs, `aria-selected`, roving `tabindex`, arrow-key navigation, and Home/End behavior. Keep all panels in the document and make them readable without JavaScript and during printing. Do not hide important contradictory evidence in a secondary tab.

### React, when explicitly appropriate

The default remains dependency-free HTML. If React is requested and the host environment already supports it:
- Use the same tokens, exact logo paths, typography, semantic structure, and footer.
- Use controlled state for filters and inputs; derive visible items without mutating the source evidence.
- Use stable keys and proper labels. Preserve keyboard focus across rerenders.
- Do not use `dangerouslySetInnerHTML` for retrieved text or source excerpts.
- Include an accessible full-content print path and reduced-motion support.
- A downloadable HTML deliverable must contain compiled, runnable assets. Do not deliver raw JSX, untranspiled imports, or a CDN-dependent React shell as a self-contained report.
- Do not assume a bundler, package manager, JSX compiler, or CSS framework is installed. If compilation is unavailable, implement the report with plain HTML and JavaScript instead.

*Made with ServiceNow EmployeeWorks*
