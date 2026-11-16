## 13. Validation before delivery

Validate using the capabilities actually available. If no browser or execution environment is available, perform static inspection and clearly distinguish that from runtime testing. Never claim a check was performed when it was not.

⚠ **THE TEMPLATE'S OWN INTERACTIONS WERE NEVER BROWSER-TESTED.** `references/package-validation.md`
records what packaging did: structure parsed, IDs and anchors checked, attribution verified, the Python
validator compiled against a fixture. It also records what packaging never did — browser execution,
JavaScript runtime tests, screen-reader tests, visual rendering, external font fetches, end-to-end print.
So a report built from the template **inherits no runtime confidence from it**. Every interaction box
below must be ticked by exercising that report, or left unticked.

⚠ **"No browser available" is a property of the host, not of this skill — check before assuming it.** On a ServiceNow instance the obstacle is usually that the report file has no URL, which is fixable: `references/servicenow-preview.md` attaches it to a record so a page-diagnostics tool can open it. That proves the document renders and is console-clean. It does **not** prove the controls work, so the interaction checks below stay unticked until something has actually operated them.

### Evidence and writing

- [ ] The opening answers the user's actual question.
- [ ] Scope, dates, units, and comparison periods are clear and consistent.
- [ ] Research-dependent claims have real, applicable citations at the point of use.
- [ ] Material limitations, source conflicts, and evidence gaps remain visible.
- [ ] Facts, inference, scenarios, and recommendations are not conflated.
- [ ] No invented scores, sources, metrics, examples, or completion claims.
- [ ] Voice is clear, people-focused, and direct without hype.

### Brand and layout

- [ ] Exact logo paths are preserved and clear space is adequate.
- [ ] ServiceNow Sans font declarations and Arial fallback are present.
- [ ] Infinite Blue is primary and Wasabi Green is restrained.
- [ ] All actual light and dark text-background pairs follow the rules.
- [ ] No gray fine print, green body copy, or green-on-white labels.
- [ ] Consistent containers, narrative measure, spacing, corners, and borders.
- [ ] Mobile layout works around 375px wide without page-level overflow.
- [ ] Tables are readable or independently scrollable.

### Interactions

- [ ] Every visible control has working behavior; no decorative controls.
- [ ] Search: case differences, whitespace, multiple terms, evidence-only matches, clearing, and no results.
- [ ] Filters: each option, combinations with search, empty state, and reset.
- [ ] Evidence: individual and bulk toggling, filtered items, and meaningful button labels.
- [ ] Navigation: targets remain reachable after filtering.
- [ ] Optional sorting: text, numbers, dates, ties, missing data, and announced direction.
- [ ] Optional scenarios: range limits, invalid input, reset, and clearly labeled estimates.
- [ ] Keyboard-only use: logical order, focus visibility, native activation, no trap.
- [ ] No-JS mode: full report readable; no nonfunctional toolbar displayed.
- [ ] Print: all findings and evidence included; controls and empty-state message omitted; user state restored after print or cancellation.
- [ ] No console errors or unintended network requests when runtime testing is available.

### Delivery

- [ ] No instructional scaffold text, unresolved placeholders, fake links, or sample data remains.
- [ ] The requested file was successfully created.
- [ ] The final attribution is the last visible content.
- [ ] Material font, offline, export, or execution limitations are disclosed briefly.
- [ ] The actual returned file reference is used; no fabricated download URL.

*Made with ServiceNow EmployeeWorks*
