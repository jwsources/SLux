# Spec

## 1. Principles
- **Otto first.** The Intelligent view opens with what Otto discovered (brief, findings, suggestions), not a field form.
- **Framework is generic, components are data-specific.** Shell, grid, slots, tokens and Otto dock never know about cases. Components get typed props through bindings.
- **Configuration over code.** A record type's layout is a JSON config. Adding a table means adding a config, not a page.
- **Every Otto finding points at evidence.** A finding names its sources and the component that shows it. Clicking it scrolls to and highlights that component.
- **Not a standard record view.** No stacked form sections, no related-list tabs as the main body.

## 2. Page framework
Slots, top to bottom, inside an app rail (72 px) and a content area:

| Slot | Holds | Rule |
|---|---|---|
| `header` | One PageHeader | Always first, always present |
| `viewSwitch` | Intelligent view / Details / Activity / Related lists | Intelligent view only for rich records (section 4) |
| `grid` | Ordered components, each with a column span 1 to 12 | 12 columns, gap 18, auto-flow |
| `dock` | One OttoDock | Right column 300 to 380 px; wraps below the grid on narrow widths |

The header and view switch are identical across views. Only the body changes.

## 3. Views
| View | What it is |
|---|---|
| **Intelligent view** | The cockpit. Spans the case and everything linked to it that needs attention or is in process: related records, remediation, tasks, regulatory status, Otto findings. Default when available. |
| **Details** | The case record itself. `RecordFields` lists every field of the table's form layout as label and value, grouped by form section. Generic, no config needed. |
| **Activity** | The journal, made scannable (section 5). |
| **Related lists** | Standard related lists, with counts on the switch. Not redesigned here. |

## 4. Richness gate
Offer the Intelligent view only when both are true: a layout config matches the record's table and condition, and the Otto payload returns a brief plus at least one finding. Otherwise hide that option and open Details by default. Never render an empty Intelligent view. While Otto loads, show Details with a skeleton on the Intelligent option, and enable it when the payload lands without moving the user off their current view.

## 5. Activity view
Activity is separate so Details stays clean. Components: `StoryStrip` (Otto milestones with jump links to source notes), `ActivityComposer` (work note or customer comment, internal-only hint, @ mentions, # record links), `ActivityStream` (grouped by day, sticky day headers, latest first, default filter Key notes), `NoteCard` (author, type and topic chips, time, one-line title, two-line summary, Show full note; structured notes render as label-value rows), `SystemGroup` (consecutive system updates collapse into one row with a count), `ActivityFilters` (search, type, topic, Mentions record).
- Otto's titles, summaries, topics and key-note flags are enrichments. The full original note is always one click away and is never replaced.
- Without an Otto payload: no StoryStrip, no key-notes filter, notes show a truncated body.
- The Intelligent view may show a short Latest activity teaser linking here; it never embeds the stream.

## 6. Behaviour
- **Loading:** header renders at once from the record. Components show skeletons at final height. Otto sections fill as the payload arrives; record sections never wait for Otto.
- **Empty and missing:** an empty field shows a warning chip with its meaning (for example "Not set"). A component with no data is hidden, not shown empty. No Otto payload: hide OttoBrief and the OttoDock findings, keep a plain ask input.
- **Finding click:** scroll the target component into view, give it a 2 px focus ring for 1.5 s, move keyboard focus to its heading.
- **Breakpoints:** above 1100 px, grid and dock side by side. Below, the dock moves under the grid. Below 720 px every component spans 12, stat tiles stay 2 columns, tables scroll inside their card, NarrativeSteps becomes 1 column.
- **Links:** any record number opens that record in a workspace tab. Record numbers use the mono face.
- **Suggestions** from Otto run through existing platform actions or flows and always ask for confirmation. Nothing is written silently.
- **Accessibility:** each card is a section labelled by its heading. Touch targets 44 px minimum. The progress bar has a text alternative. Chips carry text, never color alone. Text contrast 4.5:1.
