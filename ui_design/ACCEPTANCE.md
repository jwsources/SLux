# Acceptance

## Framework
- [ ] No component or shell code contains a table name, field name or record number.
- [ ] A second record type renders using only a new config and, at most, new data resources.
- [ ] Header and view switch are identical across all views.
- [ ] Richness gate: with no config or no Otto payload, the Intelligent option is hidden and Details is the default; an empty Intelligent view never renders.

## CS0001623 Intelligent view
- [ ] Layout matches the board: brief (12), cause (7) with party (5), chain (5) with remediation (7), situation (12), Otto dock on the right.
- [ ] Stats show 14, 11, 3 and 4.2.1 from real data; the reportability alert links REG0001002.
- [ ] Assigned to shows a "Not set" warning chip.
- [ ] RecordChain shows CS0001624, the current case, WO0010020, CHG0030002, REG0001002 with real states (WO0010020 Draft, REG0001002 Draft).
- [ ] The dispatch task table shows each task's real state; none is hard-coded.
- [ ] Clicking an Otto finding scrolls to and highlights its target component and moves focus to its heading.
- [ ] Suggestions always open a confirm step.

## Details
- [ ] Lists the form layout fields grouped by section, with no Otto components and no nested cards.

## Activity
- [ ] Story strip items jump to their source notes.
- [ ] Stream is grouped by day with sticky headers, latest first, default filter Key notes.
- [ ] Structured notes render as label-value rows; Show full note reveals the original body.
- [ ] Consecutive system updates collapse into one expandable row.
- [ ] Filters (search, type, topic, mentions) combine and update in place.
- [ ] Without an Otto payload the stream still works with truncated bodies.

## Quality
- [ ] Responsive at the breakpoints in SPEC.md; tables scroll inside their cards.
- [ ] Keyboard operable; 44 px touch targets; chips never rely on color alone; 4.5:1 text contrast.
- [ ] Loading shows skeletons at final height; record sections never wait for Otto.
