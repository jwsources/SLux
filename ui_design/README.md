# Record Intelligence View: build package

For the coding agent. Build a generic record page framework for ServiceNow (Next Experience / UI Builder) with a rich "Intelligent view" driven by Otto, plus Details, Activity and Related lists views. CS0001623 (a Customer Service case) is the first configuration, not a special case.

## Read in this order

1. `SPEC.md` - what to build: views, framework, behaviour.
2. `COMPONENTS.md` - every component, its props and its CS0001623 binding.
3. `DATA_CONTRACT.md` - layout config schema, Otto payload schema, data resources.
4. `tokens.json` - design tokens (colors, tones, type, radii, spacing).
5. `samples/config.cs0001623.json` and `samples/otto-payload.cs0001623.json` - concrete examples.
6. 'design/*' - Visual targets
7. `ACCEPTANCE.md` - definition of done.

## Visual reference

The design canvas has four boards: Intelligent view, Details, Activity, and the spec board. Visual target: see design/*.

## Ground rules

- **Generic framework, specific components.** No component, and no part of the shell, may contain a table name, field name or record number. Those live only in config and data.
- **Real data is the truth.** Otto payload and record data are the source. Never hard-code values from the design. Work order and task states render the actual state field (for example WO0010020 is Draft; its dispatch tasks are not dispatched).
- **Placeholders in the design are bindings.** Anything in square brackets on the boards ([Author], [time], [DAY], [n]) is real journal data to be bound.
- **Intelligent view is a cockpit.** It spans the case and everything linked to it that needs attention or is in process. Details is only the case record itself.
- **Assumption.** Implemented as a UI Builder page variant on Next Experience. If your target differs, keep the contracts and swap the component shells.

## Build order

1. Tokens and the shell: header, view switch, 12-column grid, dock, breakpoints.
2. Details view (`RecordFields`): generic, needs no config.
3. Config table and loader (resolve by table and condition).
4. Components: FactList, PageHeader, RecordChain, PartyCard, SplitProgress, TaskTable, RootCauseCard, NarrativeSteps, OttoBrief, OttoDock.
5. Data resources for `record.*`, then the Otto payload adapter.
6. Richness gate for the Intelligent view.
7. Activity view: ActivityComposer, ActivityStream, NoteCard, SystemGroup, ActivityFilters, StoryStrip.
8. CS0001623 config, then a second table with a different config to prove the framework is generic.

## Open points to confirm with the owner

- Exact table names and the condition that selects the rich layout for device-safety cases.
- Where Otto's payload comes from (agent output stored on the record, or an on-demand call) and its latency budget.
- Journal fields for work notes and customer comments, and how structured notes (such as a remediation plan) are stored.
