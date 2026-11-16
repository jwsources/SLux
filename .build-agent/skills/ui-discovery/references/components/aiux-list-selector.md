# @servicenow/aiux-components-coe-list-selector

## Import

```js
import '@servicenow/aiux-components-coe-list-selector';
```


List selector component for adding, removing, and reordering items between available and selected columns.

Supports two modes:

1. **Auto mode** - Fetches columns from ServiceNow's GraphQL API automatically
2. **Manual mode** - Supply items directly via property

Converted from the atoll-ui `sn-list-selector` component to the karuna AIUXElement pattern.

## Installation

```bash
pnpm add @servicenow/aiux-components-coe-list-selector
```

## Usage

### Auto Mode (GraphQL)

In auto mode, the component automatically fetches available columns from the ServiceNow GraphQL API based on the table name.

```html
<aiux-list-selector
  mode="auto"
  table="incident"
  available-label="Available Fields"
  selected-label="Selected Fields"
  @aiux-list-selector:selected-items-change="${(e) => console.log(e.detail.items)}"
></aiux-list-selector>
```

The component will:

- Fetch all columns for the specified table
- Show a "Loading…" placeholder while the request is in flight
- Show an error banner if the request fails (timeout, HTTP error, or invalid response)
- Support dot-walk navigation for reference fields
- Automatically fetch referenced table columns on expansion

### Manual Mode

In manual mode, you supply the available items directly via the `items` property.

```html
<aiux-list-selector
  .items=${{
    incident: {
      assigned_to: { label: 'Assigned to', reference: 'sys_user' },
      priority: { label: 'Priority', reference: null },
      state: { label: 'State', reference: null }
    },
    sys_user: {
      name: { label: 'Name', reference: null },
      email: { label: 'Email', reference: null }
    }
  }}
  items-root="incident"
  available-label="Available columns"
  selected-label="Selected columns"
></aiux-list-selector>
```

## Properties

### Auto Mode Properties

| Property             | Attribute              | Type                 | Default              | Description                                                                                                                                                                                                       |
| -------------------- | ---------------------- | -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`               | `mode`                 | `'manual' \| 'auto'` | `'manual'`           | Data population mode. `'manual'` uses `items` directly. `'auto'` fetches columns from GraphQL and requires `table`.                                                                                                |
| `table`              | `table`                | `string`             | `''`                 | ServiceNow table name (e.g. `'incident'`) used when `mode="auto"`.                                                                                                                                              |
| `tableName`          | `table-name`           | `string`             | `''`                 | Alias for `table` for `sn-list-selector` compatibility.                                                                                                                                                          |
| `graphqlEndpoint`    | `graphql-endpoint`     | `string`             | `'/api/now/graphql'` | GraphQL endpoint URL for auto-mode fetches.                                                                                                                                                                       |
| `allowDotWalking`    | `allow-dot-walking`    | `boolean`            | `true`               | When `false`, hides expand chevrons in connected mode — users can only select top-level fields. No effect in manual mode (controlled by `items`).                                                                 |
| `showExtendedFields` | `show-extended-fields` | `boolean`            | `false`              | When `true`, fetches inherited fields from parent tables in addition to direct fields. Mirrors `glide.ui.list.allow_extended_fields`. Changing at runtime clears the column cache and re-fetches. Auto mode only. |
| `includeSysId`       | `include-sys-id`       | `boolean`            | `false`              | When `true`, the `sys_id` field appears in the available items list and can be selected. When `false` (default), `sys_id` is hidden. Changing at runtime clears the column cache and re-fetches. Auto mode only.  |

### Manual Mode Properties

| Property               | Attribute                 | Type       | Default | Description                                                                                                                                                                                                                |
| ---------------------- | ------------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                | property only             | `ItemsMap` | `{}`    | Available items keyed by category. Each item maps to `{ label, reference, additionalData?, subLabel? }`. Use Lit property binding or JS property assignment.                                                               |
| `itemsRoot`            | `items-root`              | `string`   | `''`    | Root category key to start navigation from. Defaults to the first key in `items`.                                                                                                                                          |
| `showSelectedItemPath` | `show-selected-item-path` | `boolean`  | `false` | When `true` (manual mode only), clicking a selected item navigates the available panel to that item's location in the category hierarchy. Requires the full item path to be pre-loaded in `items`. No effect in auto mode. |

### Common Properties

| Property             | Attribute              | Type                                    | Default     | Description                                                                                                                                                                                                                                         |
| -------------------- | ---------------------- | --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedItems`      | property only          | `SelectedPathSegment[][]`               | `[]`        | Pre-selected items in path format. Each entry is an array of `{ id, label, locked? }` path segments. Use Lit property binding or JS property assignment.                                                                                            |
| `unselectableItems`  | property only          | `UnselectableItems`                     | `{}`        | Items that cannot be selected or deselected, keyed by category name. Each value is an array of item IDs within that category that are rendered as disabled checkboxes and blocked from selection. Use Lit property binding or JS property assignment. |
| `availableLabel`     | `available-label`      | `string`                                | `''`        | Label for the available items column. When empty (default), renders a localized `"Available columns"` via `@lit/localize`. Consumer-provided values take precedence.                                                                                |
| `selectedLabel`      | `selected-label`       | `string`                                | `''`        | Label for the selected items column. When empty (default), renders a localized `"Selected columns"` via `@lit/localize`. Consumer-provided values take precedence.                                                                                  |
| `showCount`          | `show-count`           | `boolean`                               | `true`      | Show item counts next to column headings.                                                                                                                                                                                                           |
| `disableReorder`     | `disable-reorder`      | `boolean`                               | `false`     | Disable drag-and-drop and keyboard reordering of selected items.                                                                                                                                                                                    |
| `search`             | `search`               | `'initial' \| 'contains'`               | `'initial'` | Search filter mode: `'initial'` filters by label prefix; `'contains'` matches anywhere in the label.                                                                                                                                                |
| `headersLevel`       | `headers-level`        | `number`                                | `6`         | Heading element level for section titles (1–6).                                                                                                                                                                                                     |
| `viewType`           | `view-type`            | `'compact' \| 'twoPanels' \| 'dotWalk'` | `'dotWalk'` | Layout structure for the component. A ResizeObserver may override this at runtime based on the host width: below 480 px → 'compact', 480–659 px (and not dotWalk) → 'twoPanels', otherwise → the requested viewType.                                |
| `hideResetWarning`   | `hide-reset-warning`   | `boolean`                               | `false`     | When `true`, suppresses the dismissible warning banner that appears when `table` (auto mode) or `itemsRoot` (manual mode) changes at runtime while items are selected. Selections are always cleared on data change; only the banner is suppressed. |
| `showVariables`      | `show-variables`       | `boolean`                               | `false`     | When `true`, appends an "Other" section at the bottom of the available panel containing catalog item variables fetched via GraphQL. Variable rows are non-selectable — they open a right panel listing the variable's fields. Auto mode only.       |
| `showHiddenControls` | `show-hidden-controls` | `boolean`                               | `false`     | When `true`, controls that are hidden by default (e.g. the ⓘ info icon for `additionalData`) are always visible instead of appearing only on hover/focus. Useful for keyboard-first or accessibility-first workflows.                               |

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property                     | Type      | Label                    | Default     | Description                                                                                          |
| ----------------------------- | --------- | ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| `configAvailableLabel`        | `String`  | Available Label          | `undefined` | Overrides `availableLabel`: heading text for the available items column                               |
| `configSelectedLabel`         | `String`  | Selected Label           | `undefined` | Overrides `selectedLabel`: heading text for the selected items column                                 |
| `configShowCount`             | `Boolean` | Show Count               | `undefined` | Overrides `showCount`: shows item counts in the panel headings                                        |
| `configDisableReorder`        | `Boolean` | Disable Reorder          | `undefined` | Overrides `disableReorder`: disables drag-and-drop reordering of selected items                       |
| `configHeadersLevel`          | `Number`  | Headers Level            | `undefined` | Overrides `headersLevel`: heading level (1-6) for the panel section titles                            |
| `configViewType`              | `String`  | View Type                | `undefined` | Overrides `viewType`: `'dotWalk'`, `'twoPanels'`, or `'compact'`; may still be overridden at narrow widths |
| `configHideResetWarning`      | `Boolean` | Hide Reset Warning       | `undefined` | Overrides `hideResetWarning`: suppresses the data-changed warning banner                               |
| `configShowSelectedItemPath`  | `Boolean` | Show Selected Item Path  | `undefined` | Overrides `showSelectedItemPath`: clicking a selected item navigates the available panel to it (manual mode only) |

## Events

Events bubble and cross the shadow DOM boundary.

| Event                                      | Detail type                 | Description                                                                                               |
| ------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `aiux-list-selector:selected-items-change` | `SelectedItemsChangeDetail` | Fired whenever the full set of selected items changes.                                                    |
| `aiux-list-selector:item-selected`         | `ItemSelectedDetail`        | Fired when a single item is selected or deselected.                                                       |
| `aiux-list-selector:item-expand-requested` | `ItemExpandRequestedDetail` | Fired when a reference field is expanded. In manual mode, populate `items[item.reference]`.               |
| `aiux-list-selector:scrolled-to-bottom`    | `ScrolledToBottomDetail`    | Fired when a panel is scrolled within 100 px of its bottom (once per scroll; resets when scrolling back). |
| `aiux-list-selector:search-term-set`       | `SearchTermSetDetail`       | Fired on every search input change. Component filters locally; consumer may also do server-side search.   |

### Event Detail Types

```typescript
// SelectedItemsChangeDetail — wrapped in {items: ...} for Seismic parity
interface SelectedItemsChangeDetail {
  items: Array<Array<{id: string; label: string}>>;
}

interface ItemSelectedDetail {
  item: Array<{id: string; label: string}>;
  selected: boolean; // true = added, false = removed
}

interface ItemExpandRequestedDetail {
  category: string; // table the item lives in, e.g. 'incident'
  itemId: string; // field ID being expanded, e.g. 'assigned_to'
  item: ListSelectorItem; // full item object; item.reference is the target table
  path: string[]; // full path of item IDs from root to the expanded item
}

interface ScrolledToBottomDetail {
  category: string; // table/panel that was scrolled, e.g. 'sys_user'
}

interface SearchTermSetDetail {
  value: string; // current search text
  category: string; // left panel category
  openedCategory: string | null; // right panel category (dotWalk only), or null
}
```

## Features

- Two-column layout: available items (left) and selected items (right)
- Dot-walk navigation with breadcrumbs for hierarchical item categories
- Search/filter within available items (`'initial'` or `'contains'` mode)
- Drag-and-drop reordering of selected items
- Keyboard reordering via **Alt+Arrow Up / Alt+Arrow Down**
- Locked items support (locked items cannot be removed or reordered)
- Highlight animation on newly selected items
- Loading placeholder while auto-mode fetches are in progress
- Error banner if the GraphQL fetch fails (timeout after 10 s, HTTP error, or invalid response)
- Screen reader announcements via `aria-live` region when items are added, removed, or reordered
- **RTL (Right-to-Left) support** — Automatically detects `dir="rtl"` on `document` or `document.documentElement` and mirrors chevron directions, reverses breadcrumb separators and tooltip label order for Arabic, Hebrew, and other RTL languages

## RTL (Right-to-Left) Language Support

The component automatically detects RTL mode from the document's `dir` attribute and adapts the UI:

- **Chevron directions**: All chevrons (→) are mirrored to point left (←) in RTL mode
  - Available panel expand buttons
  - Breadcrumb separators
  - Selected item path separators (when displaying dot-walk paths like "Company > Contact")
- **Tooltip label order**: Selected item tooltips reverse label order and use `<` separator instead of `>`
  - LTR: `"Company > Contact"`
  - RTL: `"Contact < Company"`

**Enabling RTL mode:**

```html
<!-- Option 1: Set dir="rtl" on document -->
<html dir="rtl">
  <body>
    <aiux-list-selector ...></aiux-list-selector>
  </body>
</html>

<!-- Option 2: Set dir="rtl" on any parent element -->
<div dir="rtl">
  <aiux-list-selector ...></aiux-list-selector>
</div>
```

The component detects RTL automatically during `firstUpdated()` by checking the computed CSS `direction` property, which inherits from parent elements. No additional configuration required.

**Note**: Detection happens in `firstUpdated()` (not `connectedCallback()`) to ensure the element is fully attached to its parent DOM tree and inherited `dir` attributes are properly resolved.

## Shift-Click Multi-Select

The component supports selecting a range of items using Shift+Click, matching desktop application behavior.

### How to Use

1. **Click** any checkbox to select/deselect an item (this becomes the "anchor")
2. **Hold Shift** and **hover** over another item to see a preview of the range
3. **Click** while holding Shift to select/deselect all items in the range

### Behavior

- **Visual Preview**: Items in the range are highlighted with a light blue background while hovering with Shift held
- **Range Direction**: Works in both directions (anchor can be above or below the target)
- **Search Filtering**: Only visible (filtered) items are included in the range
- **Locked Items**: Automatically excluded from the range selection
- **Unselectable Items**: Automatically excluded from the range selection
- **Select vs Deselect**: If the anchor item was checked, the range will select all items. If unchecked, the range will deselect all items.

### Example

```javascript
// Listen for selection changes
listSelector.addEventListener('aiux-list-selector:selected-items-change', e => {
  console.log('Selected items:', e.detail.items);
});
```

**Keyboard Interaction:**

- `Shift` key press/release activates/deactivates range selection mode
- Mouse hover updates the preview while Shift is held
- Click with Shift held commits the range selection

## Selected Bucket Multi-Select

The selected bucket supports multi-select for bulk removal operations, allowing users to quickly remove multiple items at once.

### How to Use

1. **Click** any item in the selected bucket to select it (not the remove button or drag handle)
2. **Click again** to deselect the item
3. **Shift+Click** on another item to select a range between the last selected item and the clicked item
4. Press **Delete** or **Backspace** to remove all selected items
5. Click the **remove button (×)** on any selected item to remove all selected items

### Behavior

- **Visual Feedback**: Selected items are highlighted with a background color and outline
- **Range Selection**: Shift+click selects all items between the last selected item and the clicked item
- **Locked Items**: Cannot be selected or removed
- **Keyboard Shortcuts**: Delete or Backspace removes all selected items
- **Bulk Remove**: Clicking the remove button on any selected item removes all selected items
- **Clear Selection**: Selection is automatically cleared after deletion or removal
- **Drag-and-Drop**: Drag-and-drop reordering still works on non-selected items

### Example

```javascript
// All bulk removal operations fire the standard events
listSelector.addEventListener('aiux-list-selector:selected-items-change', e => {
  console.log('Items removed:', e.detail.items);
});

listSelector.addEventListener('aiux-list-selector:item-selected', e => {
  console.log('Item removed:', e.detail.item, 'selected:', e.detail.selected);
});
```

**Keyboard Interaction:**

- Click item containers to select/deselect (avoid clicking remove button or drag handle)
- Shift+Click for range selection
- Delete or Backspace removes all selected items
- Selection is cleared after delete/remove operations

**Notes:**

- This feature is separate from the Available Bucket Shift-Click Multi-Select
- When `showSelectedItemPath` is enabled, item clicks navigate the available panel instead of selecting items (multi-select is disabled in this mode)
- Locked items are never included in the selection and cannot be removed

## Drag Handle Tooltips

Drag handles in the selected bucket display helpful tooltips to guide users on how to reorder items.

### Behavior

- **Hover**: Tooltip appears after 300ms delay when hovering over a drag handle
- **Focus**: Tooltip appears immediately when drag handle receives keyboard focus
- **Content**: "Drag to reorder, or press Alt+Arrow keys"

### Accessibility

- Tooltips are automatically connected to drag handles via `aria-describedby`
- Keyboard users see the same tooltip content when focusing the drag handle
- Screen readers announce the tooltip text when the drag handle is focused

### Example

```javascript
// No configuration needed - tooltips are automatically enabled
// when disableReorder is false
const listSelector = document.querySelector('aiux-list-selector');
```

**Note**: Tooltips are disabled when `disableReorder` is true

## Auto-Scroll to Newly Selected Items

When items are added to the selected bucket, the component automatically scrolls to show the newly added items, ensuring users can always see what they just added.

### Behavior

- **Trigger**: Fires when `_newlySelectedItemIds` changes (items are added via the available bucket)
- **Target**: Scrolls to the first newly added item
- **Animation**: Uses `behavior: 'smooth'` for smooth scrolling
- **Positioning**: Uses `block: 'nearest'` to avoid unnecessary scrolling if the item is already visible
- **SSR-Safe**: Guarded with `isServer` check and uses `requestAnimationFrame` to ensure DOM is ready

### When Auto-Scroll Triggers

Auto-scroll **only triggers** when:

- Items are added via the available bucket (checkbox selection)
- `_newlySelectedItemIds` is populated with new item IDs

Auto-scroll **does not trigger** when:

- Items are removed from the selected bucket
- Items are reordered via drag-and-drop
- Items are programmatically set via the `selectedItems` property
- The component is being hydrated during SSR

### Example

```javascript
// No configuration needed - auto-scroll is always enabled
const listSelector = document.querySelector('aiux-list-selector');

// When user selects items from the available bucket,
// the selected bucket auto-scrolls to show them
listSelector.addEventListener('aiux-list-selector:selected-items-change', e => {
  console.log('Items changed:', e.detail.items);
  // Auto-scroll happens automatically after this event
});
```

### Technical Details

The auto-scroll implementation uses:

- `scrollIntoView()` with `behavior: 'smooth'` and `block: 'nearest'`
- `requestAnimationFrame()` to ensure DOM is fully rendered before scrolling
- `data-item-id` attribute to locate the newly added item element

**Note**: The `block: 'nearest'` option prevents scrolling if the item is already within the visible viewport, providing a smooth user experience without unnecessary movement.

## Keyboard Navigation

The component provides comprehensive keyboard navigation support in the available bucket for power users and accessibility.

### Keyboard Shortcuts

| Shortcut                  | Context                                        | Action                                                                                                                                      |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ctrl+A** (Cmd+A on Mac) | Available bucket (left or right panel focused) | Select all visible, unselected items in the focused panel. Does not deselect. Respects search filter, locked items, and unselectable items. |
| **Arrow Right →**         | Expand button focused in left panel            | Move focus from the expand button to the first checkbox in the right panel                                                                  |
| **Arrow Left ←**          | Right panel focused                            | Move focus from the right panel back to the expand button of the opened item in the left panel                                              |
| **Enter**                 | Checkbox focused                               | Toggle the focused checkbox (select/deselect the item)                                                                                      |
| **Alt+Arrow Up ↑**        | Selected item focused                          | Move the selected item up in the list (reorder)                                                                                             |
| **Alt+Arrow Down ↓**      | Selected item focused                          | Move the selected item down in the list (reorder)                                                                                           |

### Select All (Ctrl+A / Cmd+A)

The **Select All** feature allows users to quickly select all visible, unselected items in the focused panel (left or right).

**Behavior:**

- Determines which panel has keyboard focus (left or right)
- Selects all unselected items in that panel only
- **Does NOT deselect** - only adds new selections (matches Seismic behavior)
- Respects search filtering (only selects filtered results)
- Automatically skips locked items
- Automatically skips unselectable items (defined via `unselectableItems` property)
- Automatically skips already-selected items
- Works on Mac (Cmd+A) and Windows/Linux (Ctrl+A)

**Example:**

```javascript
// Listen for selection changes after Ctrl+A
listSelector.addEventListener('aiux-list-selector:selected-items-change', e => {
  console.log('All visible items selected:', e.detail.items);
});

// Pressing Ctrl+A multiple times won't deselect - it only selects new items
```

### Cross-Panel Navigation (Arrow Left/Right)

When navigating hierarchical data in dot-walk mode, you can use **Arrow keys** to move focus between the left and right panels without using the mouse.

**Behavior:**

- **Arrow Right (→)**: When focused on an expand button (chevron), moves focus to the first checkbox in the right panel
- **Arrow Left (←)**: When focused anywhere in the right panel, moves focus back to the expand button of the currently opened item in the left panel
- Only works when a right panel is open (dot-walk mode)
- Provides seamless keyboard-only navigation through hierarchical data

**Example Workflow:**

1. Tab to an item with a reference field (shows expand button with chevron)
2. Press **Enter** to expand and show the right panel
3. Press **Arrow Right →** to move focus to the first item in the right panel
4. Use **Tab** to navigate between items in the right panel
5. Press **Arrow Left ←** to return focus to the expand button
6. Continue navigating with **Tab** or **Arrow keys**

### Enter Key Checkbox Toggle

When a checkbox in the available bucket receives keyboard focus, you can press **Enter** to toggle its checked state.

**Behavior:**

- Works with any checkbox in the available bucket (left or right panel)
- Selects the item if unchecked
- Deselects the item if checked
- Respects locked and unselectable item rules
- Provides the same result as clicking the checkbox with a mouse

**Accessibility Benefits:**

- Allows keyboard-only users to select items without needing Space bar
- Consistent with standard web form behavior where Enter activates focused elements
- Screen readers announce the checkbox state change

### Example

```html
<aiux-list-selector
  table="incident"
  .selectedItems="${[]}"
></aiux-list-selector>

<script>
  const listSelector = document.querySelector('aiux-list-selector');

  // All keyboard shortcuts work automatically without configuration

  listSelector.addEventListener(
    'aiux-list-selector:selected-items-change',
    e => {
      console.log('Selection changed via keyboard:', e.detail.items);
    }
  );
</script>
```

**Notes:**

- All keyboard shortcuts work automatically without additional configuration
- Keyboard navigation respects all existing constraints (locked items, unselectable items, search filtering)
- Ctrl+A selects all unselected items in whichever panel has focus (left or right) - it does NOT toggle/deselect
- Cross-panel arrow navigation only works in dot-walk mode when a right panel is open
- Arrow Right works when focus is on an expand button or info icon in the left panel

## Internationalization (i18n)

All user-facing strings in the component are wrapped with `msg()` and `str` from `@lit/localize`, enabling automatic translation when a locale is applied via `applyLocale()` from `@servicenow/aiux-locales`.

### What is localized

- Column headers (`"Available columns"`, `"Selected columns"`) — used as render-time defaults when `availableLabel` / `selectedLabel` are empty
- Search placeholders and aria-labels (`"Search"`, `"Search available items"`, `"Search variables"`)
- Empty state messages (`"No fields to select from"`, `"No matching items"`, `"No fields selected yet"`, `"Select fields to add here"`)
- Loading and error messages (`"Loading…"`, `"Error loading data: ..."`, reset warning text)
- Breadcrumb and panel labels (`"Breadcrumb"`, `"Left panel"`, `"Right panel"`, `"Close panels"`)
- Button text (`"Dismiss"`, `"Reload data"`)
- Accessibility labels (`"Open item: ..."`, `"Navigate to ..."`, `"Remove ... from the selected column"`, etc.)

### Consumer label overrides

When a consumer provides `availableLabel` or `selectedLabel`, the consumer-provided value is used as-is (not localized). This is intentional — the consumer owns the string and is responsible for its translation. The `msg()` default only applies when the property is empty.

### Extraction

Running `pnpm localize:extract` from the karuna root picks up all `msg()` calls and updates the XLIFF files in `xliff/`. The `lit-localize.json` glob `components/!(aiux)/src/**/*.ts` covers this component automatically.

## Migration from Seismic `sn-list-selector`

### Breaking Changes

This component maintains feature parity with Seismic's `sn-list-selector`, with the following breaking changes to event payloads:

#### 1. `aiux-list-selector:selected-items-change` event detail shape

**Seismic format:**

```javascript
event.detail; // Array<Array<{id, label}>>
```

**AIUX format (current):**

```javascript
event.detail.items; // Array<Array<{id, label}>>
```

**Migration:**

```diff
- const selectedItems = event.detail;
+ const selectedItems = event.detail.items;
```

#### 2. `aiux-list-selector:item-expand-requested` event detail — added `path` field

**Seismic format:**

```javascript
{
  category: string,
  itemId: string,
  item: ListSelectorItem
}
```

**AIUX format (current):**

```javascript
{
  category: string,
  itemId: string,
  item: ListSelectorItem,
  path: string[]  // ← NEW: full path from root to expanded item
}
```

**Migration:**
The `path` field provides the full item path from root to the expanded item, useful for breadcrumb reconstruction or navigation state tracking. Existing code that only uses `category`, `itemId`, or `item` will continue to work without changes.

### Property Mapping

| Seismic Property       | AIUX Property             | Notes                                                                         |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `mode`                 | `mode`                    | Same values: `'manual'` or `'auto'` (was `'tableDescription'` in old Seismic) |
| `tableName`            | `table` or `table-name`   | Both attributes accepted; both map to the same internal property              |
| `allowDotWalking`      | `allow-dot-walking`       | **Default differs**: Seismic defaults to `false`, AIUX defaults to `true`     |
| `items`                | `items`                   | Same structure                                                                |
| `itemsRoot`            | `items-root`              | Same                                                                          |
| `selectedItems`        | `selected-items`          | Same structure: `Array<Array<{id, label, locked?}>>`                          |
| `unselectableItems`    | `unselectable-items`      | Same structure                                                                |
| `showExtendedFields`   | `show-extended-fields`    | Same                                                                          |
| `includeSysId`         | `include-sys-id`          | Same                                                                          |
| `showVariables`        | `show-variables`          | Same                                                                          |
| `showHiddenControls`   | `show-hidden-controls`    | Same                                                                          |
| `hideResetWarning`     | `hide-reset-warning`      | Same                                                                          |
| `showSelectedItemPath` | `show-selected-item-path` | Same (manual mode only)                                                       |
| `availableLabel`       | `available-label`         | Same                                                                          |
| `selectedLabel`        | `selected-label`          | Same                                                                          |
| `showCount`            | `show-count`              | Same                                                                          |
| `headersLevel`         | `headers-level`           | Same                                                                          |
| `disableReorder`       | `disable-reorder`         | Same                                                                          |
| `search`               | `search`                  | Same values: `'initial'` or `'contains'`                                      |
| `viewType`             | `view-type`               | Same values: `'compact'`, `'twoPanels'`, `'dotWalk'`                          |

## CSS Custom Properties

The component respects the following DaisyUI/theme CSS variables:

| Property                 | Default | Description                                          |
| ------------------------ | ------- | ---------------------------------------------------- |
| `--color-base-100`       | white   | Background of the available and selected containers. |
| `--color-base-300`       | —       | Border color for containers, rows, and dividers.     |
| `--color-text-secondary` | —       | Section heading text color.                          |
| `--color-text-tertiary`  | —       | Loading placeholder text color.                      |
| `--color-primary`        | —       | Drop-target indicator and primary accent.            |
| `--color-error`          | —       | Remove button hover color.                           |
| `--color-success`        | —       | New-item highlight animation color.                  |

## Development

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint

# Format
pnpm format:write
```

## License

ISC
