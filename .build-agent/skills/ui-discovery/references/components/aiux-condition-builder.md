# @servicenow/aiux-components-condition-builder

## Import

```js
import '@servicenow/aiux-components-condition-builder';
```


A query builder component that lets users construct complex database queries through a graphical interface. Supports conditions with AND/OR grouping, sort by, group by, and simple filter modes.

## Installation

```bash
pnpm add @servicenow/aiux-components-condition-builder
```

## Basic Usage

```typescript
import '@servicenow/aiux-components-condition-builder';

// In your Lit template:
html`
  <aiux-condition-builder
    .tableName=${'incident'}
    .encodedQuery=${'active=true'}
    @cb-encoded-query-updated=${(e: CustomEvent) => {
      console.log('Encoded query:', e.detail.encodedQuery);
    }}
  ></aiux-condition-builder>
`;
```

## SSR Usage

Pre-fetch data on the server to avoid a client-side loading state:

```typescript
import {html} from 'lit';
import {AIUXElement} from '@servicenow/aiux-components-core';
import {fetchConditionBuilderInitialData} from '@servicenow/aiux-components-condition-builder';

class MyPage extends AIUXElement {
  static async loader(ctx) {
    const cbInitialData = await fetchConditionBuilderInitialData({
      ctx,
      encodedQuery: ctx.query.sysparm_query ?? '',
      tableName: ctx.params.table
    });
    myPageContext.set({cbInitialData});
  }

  render() {
    const {cbInitialData} = myPageContext.get() ?? {};
    return html`
      <aiux-condition-builder
        .initialData=${cbInitialData}
        .tableName=${this.table}
        @cb-encoded-query-updated=${this._handleQueryUpdated}
      ></aiux-condition-builder>
    `;
  }
}
```

## Usage inside a Modal

Embedding `aiux-condition-builder` inside `<aiux-modal>` requires three Chrome-specific workarounds (inert body, `position: fixed` containing block, top-layer ejection on DOM adoption). See [docs/usage-inside-modal.md](./docs/usage-inside-modal.md) for a full explanation and reference implementation.

## Simple Filters

Simple filter mode renders a streamlined sidebar panel with collapsible sections for conditions, sort by, and group by. Enable it by setting `filterOptions.mode` to `'simple'`.

### Basic Simple Filter

```typescript
html`
  <aiux-condition-builder
    .tableName=${'incident'}
    .encodedQuery=${this._query}
    .filterOptions=${{
      mode: 'simple',
      simpleFilter: {
        encodedQuery:
          'activeIN^priorityIN^stateIN^assigned_toIN^categoryIN^short_descriptionIN'
      }
    }}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
  ></aiux-condition-builder>
`;
```

The `simpleFilter.encodedQuery` is a template that defines which fields appear as filter sections. Each field uses an `IN` operator with no value — the condition builder renders a simple editor for each one.

### Simple Filters via aiux-list-connected

`aiux-list-connected` passes `filterOptions` directly to its internal condition builder. In simple mode, the condition builder renders as a collapsible sidebar panel:

```typescript
import '@servicenow/aiux-components-list';

html`
  <aiux-list-connected
    .table=${'incident'}
    .query=${this._query}
    .filterOptions=${{
      mode: 'simple',
      simpleFilter: {
        encodedQuery: 'activeIN^priorityIN^stateIN^assigned_toIN^categoryIN'
      }
    }}
  ></aiux-list-connected>
`;
```

### Simple Filters with Group By Presets

Pre-defined group-by options render as radio chips instead of the full dot-walk dropdown:

```typescript
html`
  <aiux-condition-builder
    .tableName=${'incident'}
    .encodedQuery=${this._query}
    .filterOptions=${{
      mode: 'simple',
      showGroupBy: true,
      showSortBy: true,
      simpleFilter: {
        _order: ['FILTER', 'SORT_BY', 'GROUP_BY'], // experimental property and may be subject to change
        groupBy: {
          presets: [
            {displayValue: 'Priority', internalValue: 'priority'},
            {displayValue: 'Category', internalValue: 'category'},
            {displayValue: 'Assigned to', internalValue: 'assigned_to'},
            {displayValue: 'Caller Email', internalValue: 'caller_id.email'}
          ],
          showNoneOption: true
        }
      }
    }}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
  ></aiux-condition-builder>
`;
```

### All filterOptions

A comprehensive example showing every available `filterOptions` property:

```typescript
html`
  <aiux-condition-builder
    .tableName=${'incident'}
    .encodedQuery=${this._query}
    .fixedEncodedQuery=${'active=true'}
    .fixedQueryMode=${'SIMPLE'}
    .filterOptions=${{
      // Render mode: 'simple' for streamlined sidebar, 'advanced' for full tabs
      mode: 'advanced',

      // Toggle visibility of Sort by and Group by tabs/sections
      showSortBy: true,
      showGroupBy: true,

      // Matching-record count below conditions (UI16 show_condition_count
      // parity). 'none' hides it (default), 'manual' shows count with a
      // refresh button, 'auto' auto-fetches on mount and as conditions
      // change (debounced).
      conditionCountMode: 'none',

      // Automatically open the filter panel on first render
      showFiltersOnLoad: false,

      // Show "Search for record" button on reference value editors
      showReferenceLookup: true,

      // Enable all opt-in features at once. Explicit per-flag values still win.
      // Enables: showUndoRedo, showSavedFilters, showRelatedListConditions,
      // showLabelsToggle, includeExcludedOperators, includeExtendedOperators,
      // useVariableRow. Does not affect flags already on by default.
      enableOptionalFeatures: false,

      // Whether the "Hide labels" toggle is visible in the toolbar
      showLabelsToggle: false,

      // Whether the saved-filters trigger is visible in the toolbar.
      // Forced off when readOnly is true.
      showSavedFilters: false,

      // Target container for popover positioning (null = default)
      popoverContainer: null,

      // When true, all controls become non-interactive while data remains visible
      readOnly: false,

      // Advanced: when true, per-field operator exclusions are respected
      // (server `excludedOperators` metadata + the contextual hierarchy rule).
      // Defaults to false to match v4 (now-predicate-builder) parity.
      includeExcludedOperators: false,

      // Advanced: when true, server-configured per-field extended operators
      // ("is changed", "is changed from", "is changed to") are appended to
      // the standard operator dropdown. Defaults to false to match v4 parity.
      includeExtendedOperators: false,

      // Per-field-type operator customizations merged into the built-in
      // defaults. Override labels/value editors, hide/add operators, reorder
      // them, or define new field types. Use `replace: true` (field-type or
      // operator level) for wholesale replacement instead of merge.
      // See CustomFieldOperatorRelationship.
      fieldOperatorRelationship: {
        string: {
          operators: [
            {internalValue: '=', displayValue: 'equals'},
            {internalValue: 'LIKE', hidden: true},
            {
              internalValue: 'MY_OP',
              displayValue: 'my custom',
              componentTag: 'my-editor'
            }
          ]
        },
        // Field-type replace: only these operators survive for `boolean`
        boolean: {
          replace: true,
          operators: [{internalValue: '=', displayValue: 'is'}]
        }
      },

      // Conditions tab's dot-walk field picker
      conditions: {
        // Only show these fields in the conditions dot-walk picker
        fieldInclusions: {
          incident: ['category', 'priority', 'state', 'assigned_to']
        },
        // Or exclude specific fields instead (use one or the other).
        // The "*" table key applies to every table.
        fieldExclusions: {
          '*': ['sys_id', 'sys_created_on']
        }
      },

      // Global group-by config — applies in both simple and advanced modes
      groupBy: {
        // Only show these fields in the group-by dot-walk picker
        fieldInclusions: {
          incident: ['category', 'priority', 'state', 'assigned_to']
        },
        // Or exclude specific fields instead (use one or the other)
        fieldExclusions: {
          incident: ['sys_id', 'sys_created_on']
        }
      },

      // Config scoped to simple filter mode only (ignored when mode is 'advanced')
      simpleFilter: {
        // Title shown at the top of the simple filter panel
        title: 'Filter incidents',

        // Template encoded query — each field becomes a filter section
        encodedQuery: 'activeIN^priorityIN^stateIN^assigned_toIN^categoryIN',

        // Order of sections in the panel
        // This is an experimental property and may be subject to change
        _order: ['FILTER', 'SORT_BY', 'GROUP_BY'],

        // Group-by overrides for simple filter mode
        groupBy: {
          // Pre-defined options rendered as radio chips
          presets: [
            {displayValue: 'Priority', internalValue: 'priority'},
            {displayValue: 'Category', internalValue: 'category'},
            {displayValue: 'Assigned to', internalValue: 'assigned_to'}
          ],
          // Show a "None" radio option to clear the GROUP BY
          showNoneOption: true
        }
      }
    }}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
  ></aiux-condition-builder>
`;
```

## Filter Overview

`cb-filter-overview` renders an active query as a row of dismissible pills. It pairs with `aiux-condition-builder` — both accept the same `encodedQuery` prop and emit `cb-encoded-query-updated` so a parent component can keep them in sync.

### Basic Usage

```typescript
import '@servicenow/aiux-components-condition-builder';

html`
  <cb-filter-overview
    .encodedQuery=${this._query}
    .tableName=${'incident'}
    @cb-encoded-query-updated=${(e: CustomEvent) => {
      this._query = e.detail.encodedQuery;
    }}
  ></cb-filter-overview>
`;
```

### With Fixed Conditions

Fixed conditions are locked and cannot be dismissed by the user. They appear before the normal conditions:

```typescript
html`
  <cb-filter-overview
    .encodedQuery=${this._query}
    .fixedEncodedQuery=${'active=true^priority=1'}
    .tableName=${'incident'}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
  ></cb-filter-overview>
`;
```

### Syncing with the Condition Builder

Both components use `cb-encoded-query-updated` — wire them to the same handler and they stay in sync automatically:

```typescript
html`
  <cb-filter-overview
    .encodedQuery=${this._query}
    .fixedEncodedQuery=${this._fixedQuery}
    .showMenu=${true}
    .showOpenNewWindow=${true}
    .showCopyQuery=${true}
    .showOpenEditor=${true}
    .tableName=${'incident'}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
    @cb-editor-opened=${this._handleOpenEditor}
  ></cb-filter-overview>

  <aiux-condition-builder
    .encodedQuery=${this._query}
    .fixedEncodedQuery=${this._fixedQuery}
    .tableName=${'incident'}
    @cb-encoded-query-updated=${this._handleQueryUpdated}
  ></aiux-condition-builder>
`;

// Both components fire the same event — one handler syncs both:
private _handleQueryUpdated(e: CustomEvent<CbEncodedQueryUpdatedDetail>) {
  this._query = e.detail.encodedQuery;
}
```

### Filter Overview Properties

| Property            | Attribute           | Type      | Default | Description                                                                                                                                                                                          |
| ------------------- | ------------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tableName`         | `tablename`         | `string`  | `''`    | **Required.** ServiceNow table name for the GraphQL decode call                                                                                                                                      |
| `encodedQuery`      | `encodedquery`      | `string`  | `''`    | The active (user-editable) encoded query to display as pills                                                                                                                                         |
| `fixedEncodedQuery` | `fixedencodedquery` | `string`  | `''`    | Locked conditions rendered before normal pills — cannot be dismissed by the user                                                                                                                     |
| `isSimple`          | `issimple`          | `boolean` | `false` | When `true`, pill labels use colon format ("Priority: High") instead of operator format ("Priority is High")                                                                                         |
| `readOnly`          | `readonly`          | `boolean` | `false` | When `true`, hides all dismiss controls — renders a display-only view                                                                                                                                |
| `showMenu`          | `showmenu`          | `boolean` | `false` | When `true`, each pill becomes a clickable popover trigger with a chevron-down caret (dropdown contains "Delete condition", "Delete all after"). Replaces the X dismiss button                       |
| `showOpenNewWindow` | `showopennewwindow` | `boolean` | `false` | When `true`, adds an "Open new window" item to the dropdown. Clicking it opens a new browser tab with `sysparm_query` set to the encoded query up to that pill. Only meaningful when `showMenu=true` |
| `showCopyQuery`     | `showcopyquery`     | `boolean` | `false` | When `true`, adds a "Copy entire query" item to the dropdown. Only meaningful when `showMenu=true`                                                                                                   |
| `showOpenEditor`    | `showopeneditor`    | `boolean` | `false` | When `true`, adds an "Open editor" item to the pill dropdown. Only meaningful when `showMenu=true`                                                                                                   |

### Filter Overview Events

| Event                      | Detail Type                   | Description                                                                                                                             |
| -------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `cb-encoded-query-updated` | `CbEncodedQueryUpdatedDetail` | Fired when a pill is dismissed or deleted. Same shape as the condition builder event                                                    |
| `cb-copy-query`            | `CbCopyQueryDetail`           | Fired when "Copy entire query" is clicked — detail contains `encodedQuery`, `fixedEncodedQuery`, `combinedEncodedQuery` up to that pill |
| `cb-editor-opened`         | `CbEditorOpenedDetail`        | Fired when "Open editor" is clicked. The host handles all editor behavior                                                               |

## Filter Bar

`aiux-filter-bar` renders a row of quick-filter pills from a single array. Unlike the components above it is **fully presentational**: no store, no GraphQL, no encoded query, and no ServiceNow concepts at all. A dashboard host can use it without a condition builder.

> **Not available outside this package yet.** The element is deliberately not exported, so importing the package does **not** register `<aiux-filter-bar>` — there is no supported import for it in this release. The contract is not final while `group` and `component` are still unresolved; a follow-up story publishes the element and its types together. The section below and the linked README describe the component as it will be exported.

The host owns everything that means something. The bar renders the pills, holds the transient UI state (open panel, search term, staged selection), and reports interactions through three events — it never mutates `filterControls`.

> **Full consumer documentation lives in [`src/components/filter-bar/README.md`](src/components/filter-bar/README.md)**, which ships with the package. It covers the controlled contract, all three control kinds, all three search modes, commit modes, slots, translation, accessibility and RTL, theming, how to test your host, and what is deliberately out of scope.

| | |
| --- | --- |
| Properties | `filterControls` · `disableAll` · `overflow` · `accessibleLabel` |
| Events | `aiux-filter-bar:value-change` · `aiux-filter-bar:search` · `aiux-filter-bar:remove` |
| Kinds | `select` · `multi-select` · `date` |
| Slots | `start` · `end` |

```typescript
import {msg} from '@lit/localize';
import '@servicenow/aiux-components-condition-builder';

const bar = document.querySelector('aiux-filter-bar');

let filterControls = [
  {
    kind: 'multi-select',
    controlId: 'priority',
    label: msg('Priority'),
    options: [
      {id: '1', label: msg('1 - Critical')},
      {id: '2', label: msg('2 - High')}
    ],
    value: []
  }
];
bar.filterControls = filterControls;

// Controlled: the bar reports, you write the value back.
bar.addEventListener('aiux-filter-bar:value-change', e => {
  const {controlId, value} = e.detail;
  filterControls = filterControls.map(c =>
    c.controlId === controlId ? {...c, value} : c
  );
  bar.filterControls = filterControls;
});
```

> **Neither the element nor the contract types are published yet** — see the note at the top of this section. `FilterControl`, `FilterBarValueChangeDetail` and friends are intentionally absent from the package's exports along with `AiuxFilterBar`, because the shape is not final while `group` and `component` are still unresolved. When it ships, a host will set `.filterControls` and read `e.detail`, neither of which needs a named import, and TypeScript will check the array structurally against the element's own property type.

## Events

| Event                      | Detail Type                   | Description                                                       |
| -------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `cb-encoded-query-updated` | `CbEncodedQueryUpdatedDetail` | Fired when the user modifies any part of the query                |
| `cb-close-simple-filter`   | —                             | Fired when the user clicks the close button in simple filter mode |

The `cb-encoded-query-updated` detail contains three encoded query strings:

| Property               | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `encodedQuery`         | Encoded query from user-editable conditions only |
| `fixedEncodedQuery`    | Encoded query from fixed (read-only) conditions  |
| `combinedEncodedQuery` | Both merged according to `fixedQueryMode`        |

## Properties

### `ConditionBuilderProps`

Lit lowercases camelCase property names when deriving the HTML attribute (e.g. `tableName` → `tablename`). Bind complex values (`filterOptions`, `initialData`) with Lit's `.property` syntax — they have no usable attribute form.

| Property            | Attribute           | Type                                  | Default    | Description                                                                                                                                                                  |
| ------------------- | ------------------- | ------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tableName`         | `tablename`         | `string`                              | `''`       | **Required.** The ServiceNow table name for field definitions                                                                                                                |
| `encodedQuery`      | `encodedquery`      | `string`                              | `''`       | The encoded query string to decode and display                                                                                                                               |
| `fixedEncodedQuery` | `fixedencodedquery` | `string`                              | `''`       | Read-only encoded query (config-level constraints)                                                                                                                           |
| `fixedQueryMode`    | `fixedquerymode`    | `'SIMPLE' \| 'DISTRIBUTED'`           | `'SIMPLE'` | How fixed conditions merge into the combined query                                                                                                                           |
| `filterOptions`     | — (property only)   | `ConditionBuilderFilterOptions`       | `{}`       | Configuration for mode, visibility, and behavior                                                                                                                             |
| `initialData`       | — (property only)   | `ConditionBuilderInitialData \| null` | `null`     | Pre-fetched SSR data — pass the opaque bag from `fetchConditionBuilderInitialData()`                                                                                         |
| `isSimple`          | `is-simple`         | `boolean`                             | `false`    | Advanced/derived. Reflects whether simple filter mode is active; derived from `filterOptions.mode`. Do not set manually — set `filterOptions.mode` instead                   |
| `useSharedStores`   | `use-shared-stores` | `boolean`                             | `false`    | Advanced. When `true`, reuse a parent condition builder's store bundle (via `cbStoreContext`) instead of creating a new one. Used internally by the simple ↔ advanced toggle |

### `ConditionBuilderFilterOptions`

| Property                              | Type                              | Default                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enableOptionalFeatures`              | `boolean`                         | `false`                             | When true, all opt-in feature flags default to their enabled state without having to set each individually. Explicit per-flag values always win — e.g., `enableOptionalFeatures: true, showUndoRedo: false` enables everything except undo/redo. Flags affected (all default to false individually): `includeExcludedOperators`, `includeExtendedOperators`, `showLabelsToggle`, `showRelatedListConditions`, `showSavedFilters`, `showUndoRedo`, `useVariableRow`. Flags already on by default (`showAddConditionSet`, `showGroupBy`, `showReferenceLookup`, `showSortBy`, `showTagLookup`) and non-boolean flags are unaffected.                                                                            |
| `mode`                                | `'simple' \| 'advanced'`          | `'advanced'`                        | Render mode — simple shows a streamlined sidebar, advanced shows full tabs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `showSortBy`                          | `boolean`                         | `true`                              | Whether to show the Sort by tab/section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `showGroupBy`                         | `boolean`                         | `true`                              | Whether to show the Group by tab/section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `conditionCountMode`                  | `'none' \| 'manual' \| 'auto'`    | `'none'`                            | Controls the matching-record count display below conditions (UI16 `show_condition_count` parity). `'none'` hides it, `'manual'` shows count with a refresh button, `'auto'` auto-fetches on mount and as conditions change (debounced). The count links to `/{table}_list.do?sysparm_query=…` (new tab); a host may intercept the cancelable `cb-record-count:view-results` event to navigate differently. Auto mode is expensive — use manual unless you need live counts.                                                                                                                                                                                                                                   |
| `showFiltersOnLoad`                   | `boolean`                         | `false`                             | Automatically open the filter panel on first render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `showReferenceLookup`                 | `boolean`                         | `true`                              | Show a "Search for record" button on reference value editors that opens a full list picker modal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `showTagLookup`                       | `boolean`                         | `true`                              | Show the tag lookup value editor for tag fields. Set to false to disable tag lookups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `showLabelsToggle`                    | `boolean`                         | `false`                             | Whether the "Hide labels" toggle is visible in the toolbar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `showSavedFilters`                    | `boolean`                         | `false`                             | Whether the saved-filters trigger is visible in the toolbar. Forced off when `readOnly` is `true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `popoverContainer`                    | `HTMLElement \| null`             | `null`                              | Target container for popover positioning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `readOnly`                            | `boolean`                         | `false`                             | When true, all controls become non-interactive while data remains visible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `includeExcludedOperators`            | `boolean`                         | `false`                             | Advanced. When true, per-field operator exclusions are respected — both server-configured `excludedOperators` (from `sys_dictionary`) and the contextual rule that hides hierarchy operators on reference fields with no record hierarchy. A saved query whose operator is now excluded still loads correctly; once the user switches away, that operator drops from the dropdown. Defaults to off, matching v4 (now-predicate-builder) parity.                                                                                                                                                                                                                                                               |
| `includeExtendedOperators`            | `boolean`                         | `false`                             | Advanced. When true, server-configured per-field extended operators are appended to the standard operator dropdown: `is changed` (VALCHANGES, no value editor), `is changed from` (CHANGESFROM), `is changed to` (CHANGESTO). CHANGESFROM/CHANGESTO inherit the value editor of the field type's `=` operator and are excluded automatically when the field type lacks equality. Source data: set `extended_operators=VALCHANGES;CHANGESFROM;CHANGESTO` on the field's `sys_dictionary.attributes`. Defaults to off, matching v4 (now-predicate-builder) parity.                                                                                                                                              |
| `fieldOperatorRelationship`           | `CustomFieldOperatorRelationship` | `{}`                                | Per-field-type operator customizations merged into the built-in defaults — override display labels, assign value-editor component tags, hide operators, add new operators, reorder them, or define entirely new field types. Consumer overrides win; unspecified field types and operators keep their defaults. Opt into wholesale replacement with `replace: true` at the field-type level (discard all built-in operators for that type) or the operator level (swap one matched operator wholesale). Applied to the field-operator-relationship store, so all condition rows, operator dropdowns, and value editors respect it. See [`CustomFieldOperatorRelationship`](#customfieldoperatorrelationship). |
| `conditions`                           | `object`                          | —                                   | Config for the Conditions tab's dot-walk field picker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `conditions.fieldExclusions`          | `FieldFilterMap`                  | —                                   | Per-table field exclusion lists for the dot-walk picker. The `"*"` table key applies to every table, unioned with that table's own entry when both are present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `conditions.fieldInclusions`          | `FieldFilterMap`                  | —                                   | Per-table field inclusion lists — only these fields are shown. Same `"*"` wildcard-table behavior as `fieldExclusions`; independent of it — see the precedence note below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `groupBy`                             | `object`                          | —                                   | Global group-by config (applies in both simple and advanced modes)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `groupBy.fieldExclusions`             | `FieldFilterMap`                  | —                                   | Per-table field exclusion lists for the dot-walk picker. The `"*"` table key applies to every table, unioned with that table's own entry when both are present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `groupBy.fieldInclusions`             | `FieldFilterMap`                  | —                                   | Per-table field inclusion lists — only these fields are shown. Same `"*"` wildcard-table behavior as `fieldExclusions`; independent of it — see the precedence note below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `simpleFilter`                        | `object`                          | —                                   | Config scoped to simple filter mode only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `simpleFilter.encodedQuery`           | `string`                          | —                                   | Template encoded query defining which fields appear as simple filter sections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `simpleFilter.title`                  | `string`                          | —                                   | Title shown at the top of the simple filter panel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `simpleFilter._order`                 | `SimpleFilterSectionValue[]`      | `['FILTER', 'SORT_BY', 'GROUP_BY']` | Order of sections in the simple filter panel (this is an experimental property and may be subject to change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `simpleFilter.groupBy`                | `object`                          | —                                   | Group-by config specific to simple filter mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `simpleFilter.groupBy.presets`        | `GroupByPresetOption[]`           | —                                   | Pre-defined options rendered as radio chips instead of dot-walk dropdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `simpleFilter.groupBy.showNoneOption` | `boolean`                         | `true`                              | Whether to show a "None" radio option that clears the GROUP BY                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

#### `fieldExclusions`/`fieldInclusions` notes

- **v4 (now-predicate-builder) parity**: v4's `fieldExclusionList` is a flat array with no separate inclusion concept and no per-table keying — it filters server-side, at fetch time. `$fieldInclusionList`/`$fieldExclusionList` GraphQL variables exist in `panel-definitions.query.ts` for an unrelated earlier story, but `fetchStandardPanelDefinitions()` never populates them — this feature filters client-side, after the fetch, and per-table, with the `"*"` table key as the flat-array equivalent: `fieldExclusionList: ['active']` maps to `fieldExclusions: {'*': ['active']}`.
- **Precedence**: `fieldInclusions` and `fieldExclusions` are independent checks — a field must pass both to be shown. A field present in both lists for the same table is therefore **excluded**, matching Seismic/v4's actual server-side behavior (`DotwalkDataService.getFieldFilter()` in `dev/glide` chains an inclusion check and an exclusion check with `Predicate.and()`).
- **Keywords and Variables are exempt** (Conditions tab only): the keywords pseudo-field (full-text search) and, when `useVariableRow` is on, the Variables item are never filtered by `fieldExclusions`/`fieldInclusions` — they have their own dedicated visibility rules (single-use/NQ mutual exclusion for keywords; the variable-row transform for Variables) with no equivalent in a consumer's table-column list.
- **Interaction with pagination**: filtering happens after the panel-definitions fetch, while pagination (100-row pages, `hasMore`) is computed server-side on the *unfiltered* result. A restrictive `fieldInclusions` list can leave a picker showing very few (or zero) matches per page even though "Load more" is still available.

### `GroupByPresetOption`

| Property        | Type     | Description                                                     |
| --------------- | -------- | --------------------------------------------------------------- |
| `displayValue`  | `string` | Label shown to the user in the picker UI                        |
| `internalValue` | `string` | Dot-walk field path (e.g., `'priority'` or `'caller_id.email'`) |

### `CustomFieldOperatorRelationship`

A map of field **type** → operator customizations, supplied via
`filterOptions.fieldOperatorRelationship`. It is merged with the built-in
field-operator defaults — consumer entries win, everything else is untouched.

```typescript
type CustomFieldOperatorRelationship = Record<string, CustomFieldTypeConfig>;
```

Merge rules per field type:

1. Operators marked `hidden: true` are removed from the dropdown (still recognized for saved queries).
2. Operators matching a built-in `internalValue` override its `displayValue` / `componentTag` (or, with `replace: true`, replace that operator wholesale).
3. Operators with a new `internalValue` are appended.
4. Consumer-mentioned operators are reordered to the front in declaration order; remaining built-ins follow.

**Replace (opt-in; merge is the default):**

- `CustomFieldTypeConfig.replace: true` — discard **all** built-in operators for that field type and use only the listed operators, in order.
- `CustomFieldOperator.replace: true` — swap a matched built-in operator wholesale for exactly the fields provided (any built-in field not restated is dropped), instead of shallow-merging onto it.

#### `CustomFieldTypeConfig`

| Property    | Type                    | Default | Description                                                                              |
| ----------- | ----------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `operators` | `CustomFieldOperator[]` | —       | Operator customizations for this field type                                              |
| `replace`   | `boolean`               | `false` | When `true`, discard the built-in operators for this field type and use only `operators` |

#### `CustomFieldOperator`

| Property        | Type      | Default | Description                                                                                                                                             |
| --------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internalValue` | `string`  | —       | **Required.** The internal operator value (e.g., `'='`, `'ISEMPTY'`, `'MY_CUSTOM_OP'`)                                                                  |
| `displayValue`  | `string`  | —       | Override the label shown in the operator dropdown                                                                                                       |
| `componentTag`  | `string`  | —       | Override or assign the value-editor custom-element tag for this operator                                                                                |
| `hidden`        | `boolean` | `false` | When `true`, removes the operator from the dropdown but keeps it recognized for backward compatibility                                                  |
| `replace`       | `boolean` | `false` | When `true` and this matches a built-in operator by `internalValue`, replace it wholesale (drop un-restated built-in fields) instead of shallow-merging |

### `FieldFilterMap`

```typescript
type FieldFilterMap = Record<string, string[]>;
// Keys are table names, values are arrays of field names
// Example: { incident: ['category', 'priority'], task: ['state'] }
```

### `ConditionBuilderInitialData`

Opaque data bag returned by `fetchConditionBuilderInitialData()`. Pass it directly to the `initialData` property — never inspect or construct it manually.

## Exports

```typescript
// Registers aiux-condition-builder, cb-filter-overview and aiux-filter-bar
import '@servicenow/aiux-components-condition-builder';

// SSR loader
import {fetchConditionBuilderInitialData} from '@servicenow/aiux-components-condition-builder';

// Shared aggregate row-count fetch (reusable by hosts rendering their own
// matching-record count UI around the condition builder)
import {
  fetchRowCount,
  ROW_COUNT_QUERY
} from '@servicenow/aiux-components-condition-builder';

// Types
import type {
  ConditionBuilderFilterOptions,
  ConditionBuilderInitialData,
  ConditionBuilderProps,
  CustomFieldOperator,
  CustomFieldOperatorRelationship,
  CustomFieldTypeConfig,
  FieldFilterMap,
  GroupByPresetOption
} from '@servicenow/aiux-components-condition-builder';

import type {CbEncodedQueryUpdatedDetail} from '@servicenow/aiux-components-condition-builder';
```

`aiux-filter-bar` contributes the element registration only. Its contract types
(`FilterControl`, `FilterOption`, the three event details, `filterByLabel`) are
deliberately unpublished while the shape is being finalized — see the note in
the Filter Bar section above.
