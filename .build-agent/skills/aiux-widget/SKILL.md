---
name: aiux-widget
description: Use when creating, editing or cloning an AIUX widget — a sys_aix_widget record holding a Lit web component that extends AIUXWidgetElement, used in AI portals, the Employee Hub and Otto conversation cards. Triggers on "aix widget", "aiux widget", "AI portal widget", "AIUXWidgetElement", "sys_aix_widget", "widget for the agent to show", or adding a custom UI component to an AI portal. Also use when a widget lists in the Widget Builder but never renders, when a widget column holds the text Symbol(CallExpressionShape), or when a widget save aborts for no obvious reason.
---

# aiux-widget

Creating a `sys_aix_widget` record from Fluent. There is no typed Fluent API for
this table — use the generic `Record()` from `@servicenow/sdk/core`.

**Authority:** the hint record `aiux-widget-development-guide` owns this table. If
a hint lookup is available, read it. This skill is the portable subset plus the
traps that produce a clean build and a broken widget.

## When to use

- Creating, editing or cloning a `sys_aix_widget` record
- Adding a custom UI component to an AI portal or Employee Hub
- Building a widget for an Otto conversation card, or wiring one into an AI agent
  tool → `references/agent-tool-widget.md`
- Diagnosing a widget that lists in the Builder and never renders
- Diagnosing a column that holds the literal text `Symbol(CallExpressionShape)`
- Diagnosing a widget save that aborts with no clear reason

Not this skill: theming and dark mode inside the shadow root; Otto panel hosting
and the Builder REST surface; SDK AIUX page projects. Those are separate records.

## Instructions

### Five failure modes that build clean and break the widget

Everything else in this skill is recoverable by reading the record back. These are
the ones that report success and leave you with nothing.

1. 🛑 **Every `data` value must be a plain literal.** The build does not evaluate
   expressions — it stringifies the AST node. A function call, a `.join()`, a `+`
   concatenation or a variable holding a computed value installs the literal text
   `Symbol(CallExpressionShape)` into the column. Clean build, clean
   `run_diagnostics`, no warning. Write `component` as **one double-quoted string
   literal with `\n` escapes**; backticks and `${` need no escaping inside one.

2. 🛑 **The Fluent install path bypasses the `Compile Widget` business rule**, which
   normally derives `component_compile_metadata` and `input_schema`. Author both by
   hand. A widget with empty `component_compile_metadata` lists in the Builder and
   never registers. Hand-authoring is the vendor-shipped pattern, not a workaround.

3. 🛑 **`importBoundaries` is `[first import start, last import semicolon]`, and
   `start` is NOT always 0** — a leading comment pushes it down. **Verify by
   substring, never by counting alone:** `component.substring(start, end)` must
   begin `import`, end `;`, and no `import` may appear after `end`.

4. 🛑 **A `static properties` key named `data` or `server` aborts the save.** So
   does an `id` that is not kebab-case with at least one hyphen.

5. 🛑 **`best_for` is mandatory by Data Policy**, though not in the dictionary.
   Omit it and the insert fails with *"Data Policy Exception: The following fields
   are mandatory: Best for"*.

### Workflow

1. Define the kebab-case `id` (at least one hyphen, starts `[a-z]`, no uppercase)
   and the JS class name.
2. Write the Lit component. Extend `AIUXWidgetElement` from
   `@servicenow/aiux-components-core`. Every user-facing string through
   `i18n.getMessage` with a **plain literal** — an interpolated template literal is
   never extracted and ships untranslated. Give every CSS custom property a literal
   fallback.
3. Write the server script if needed: an IIFE over `(data, options, input)` that
   **populates `data.*` and never returns**. Default to `GlideRecordSecure`.
4. Author `input_schema` in the **JSON-Schema shape** (`type: object`, `properties`,
   top-level `required`), as a string literal. The flat shape is legacy and the next
   compile overwrites it.
5. Author `component_compile_metadata`: `imports`, `elementClassName` (the **first**
   class declared), `importBoundaries`. Add `hasServerScript` only when `true` — it
   is optional, and an empty IIFE counts as no server script.
6. Write the `Record()` with `table: 'sys_aix_widget'`, in `src/fluent/widgets/`,
   in the app's scope. Every `data` value a literal. Full field list and a complete
   worked example: `references/field-reference.md`, `references/worked-example.md`.
7. `run_diagnostics`, then build and install. ⚠ Diagnostics validates almost
   nothing here — `data` accepts unknown column names silently and `table` is not
   type-checked. A clean run means the file parses.
8. **Read the record back.** Confirm `component_compile_metadata` is non-empty, no
   column contains `Symbol(`, and the `importBoundaries` substring check holds. A
   clean build proves nothing.

### Verification script

```javascript
var g = new GlideRecord('sys_aix_widget');
if (!g.get('id', '<widget-id>')) { gs.info('NOT FOUND'); }
else {
    var comp = g.getValue('component') || '';
    var ccm = g.getValue('component_compile_metadata') || '';
    gs.info('ccm empty        = ' + (ccm === ''));          // must be false
    gs.info('Symbol( present  = ' + (comp.indexOf('Symbol(') > -1)); // must be false
    var m = ccm.match(/"importBoundaries":\[(\d+),(\d+)\]/);
    if (m) {
        var s = parseInt(m[1], 10), e = parseInt(m[2], 10);
        var slice = comp.substring(s, e);
        gs.info('starts import    = ' + (slice.indexOf('import') === 0));
        gs.info('ends semicolon   = ' + (slice.charAt(slice.length - 1) === ';'));
        gs.info('no import after  = ' + (comp.substring(e).indexOf('import') === -1));
    }
}
```

## Next Steps

- Preview the widget. **Do not make a Builder save a prerequisite** — the Builder's
  package-manager worker fails on paths including its own untouched default
  template, and preview survives when save does not.
- A Builder or Table API save changes `component`, so it **recompiles** — the
  cheapest way to populate the compiler-output fields after a bypassed install.
- To show the widget in an Otto conversation: `references/agent-tool-widget.md`.
- Theming inside the shadow root, Otto panel hosting, SDK AIUX page projects: read
  the hint records `aiux-widget-theming-darkmode`, `aiux-widget-otto-panel`,
  `aiux-sdk-development-guide`.
