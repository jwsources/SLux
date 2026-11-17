# Component catalog

Each is a standalone UI Builder / Now Experience component with typed properties. Components never query data themselves; they receive props from bindings (see `DATA_CONTRACT.md`). Tone values: `info | warning | critical | success | neutral`.

## Shell components
### PageHeader
Breadcrumb, title, status chips, primary actions.
`{ breadcrumb: [{label, href}], title: string, chips: [{label, tone}], subtitle?: string, actions: [{label, kind: "primary"|"secondary"}] }`
CS0001623: chips Open, Unassigned (warning), Reportable event (critical); account text Riverside General Hospital; actions Actions, Create, Assign to me (primary).

### ViewSwitch
Pill segmented control. `{ views: [{id, label, available}], active: string }`. Intelligent view `available` follows the richness gate.

## Intelligent view
### OttoBrief (span 12)
`{ summary: string, alerts: [{tone, text, refs: string[]}], stats: [{label, value, caption?, mono?}] }`. Four stat tiles max. CS0001623: devices in scope 14, remote eligible 11, dispatch required 3, target firmware 4.2.1; critical alert for MDR/FDA reportability under REG0001002.

### RootCauseCard (span 7)
From-to transition plus facts. Reusable for any "A becomes B" finding.
`{ title?: string, from: {label, value, tone}, to: {label, value, tone}, description: string, facts: [{label, value, mono?}] }`
CS0001623: 3.8.0 (critical) to 4.2.1 (success); defect reference FW-2024-0847; trigger device VitalWatch Monitor - Medical ICU 01.

### PartyCard (span 5)
`{ person: {name, title}, facts: [{label, value, emptyTone?}] }`. An empty value renders a chip with the `emptyTone` and the text "Not set". CS0001623: Rebecca Torres, Clinical Engineering Director; account; assignment group Alectri Clinical Engineering; assigned to empty.

### RecordChain (span 5)
Vertical relationship chain, the current record highlighted.
`{ nodes: [{role: "parent"|"self"|"related", label, number, table, state?, href}] }`. CS0001623: CS0001624 (parent), CS0001623 (self), WO0010020 (Draft), CHG0030002, REG0001002 (Draft).

### SplitProgress (span 7)
Segmented bar with legend. `{ segments: [{label, value, tone}], caption?: string }`. Includes an accessible text alternative. CS0001623: remote 11, dispatch 3. Usually composes a TaskTable below it.

### TaskTable
`{ columns: [{key, label, align?, link?}], rows: object[] }`. CS0001623 columns: Site, Task (link), State, Devices. **State is the real task state field**; the tasks are not dispatched and the table must say whatever the record says.

### NarrativeSteps (span 12)
Numbered tiles. `{ steps: [{text, refs?: string[]}] }`.

### OttoDock
Findings with sources, suggested actions, ask input.
`{ findings: [{id, title, detail, sources: string[], target: componentId, severity}], suggestions: [{id, label, action, params}], placeholder: string }`.
Rules: a finding without a source or a target is dropped. A suggestion always opens a confirm step.

### FactList (fallback)
Generic label-value card for fields no specialist covers. `{ title, facts: [{label, value, mono?}] }`.

## Details view
### RecordFields
`{ sections: [{title, fields: [{label, value, type, mono?, href?, emptyTone?}]}] }`. Built from the table's form layout. Generic. Single column of sections, two or more columns of fields as width allows, a hairline between sections, no nested cards.

## Activity view
### StoryStrip
Otto milestones. `{ stages: [{stage, title, detail, tone, noteId, sources[]}] }`. Each item links to its source note. CS0001623: linked as child of CS0001624; cause firmware 3.8.0 defect; scope 14 devices across 3 accounts; plan 11 remote and 3 dispatch with WO0010020 and CHG0030002; regulatory reportable with REG0001002.

### ActivityComposer
`{ modes: [{id: "work_note"|"customer_comment", label, internalOnly}], mentions: true, recordLinks: true }`. Shows "Only internal users can see work notes" for the work note mode.

### ActivityStream
`{ groups: [{label, entries: (NoteCard|SystemGroup)[]}], filter: "key"|"all"|"customer", hasMore: boolean }`. Sticky day headers, latest first. Default filter Key notes.

### NoteCard
`{ id, author: {name, initials}, type: "work_note"|"customer_comment", topics: string[], time, title, summary, structured?: [{label, value, mono?}], refs: string[], hasFullBody: boolean }`. Structured notes (for example a remediation plan with total devices, remote eligible, dispatch required, target firmware) render as label-value rows; links to CHG, WO and site tasks render as mono links. "Show full note" reveals the original body.

### SystemGroup
`{ count, timeRange, summary, items: [] }`. Consecutive system-authored entries collapse into one row; "Expand updates" lists them.

### ActivityFilters
`{ search: string, types: [{id, label, checked}], topics: [{id, label, checked}], mentions: string[] }`. Facets are computed from loaded entries. Filters combine and update the stream in place.
