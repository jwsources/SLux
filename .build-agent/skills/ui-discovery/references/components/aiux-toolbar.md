# @servicenow/aiux-components-coe-toolbar

## Import

```js
import '@servicenow/aiux-components-coe-toolbar';
```


Accessible, SSR-compatible toolbar component for ServiceNow AIUX. Renders ordered groups of action and toggle buttons with optional group labels, visual dividers, collapsible groups, and an overflow (···) popup for space-constrained layouts. Works in horizontal (default) and vertical orientations.

## Installation

```js
import '@servicenow/aiux-components-coe-toolbar';
```

## Usage

### Minimal

```html
<aiux-toolbar .groups="${groups}" aria-label="Record actions"></aiux-toolbar>
```

### Action items with overflow

```js
const groups = [
  {
    id: 'actions',
    items: [
      {id: 'new', icon: 'plus', tooltip: 'New record'},
      {id: 'import', icon: 'upload', tooltip: 'Import'},
      {id: 'export', icon: 'download', tooltip: 'Export'}
    ]
  },
  {
    id: 'view',
    items: [
      {id: 'filter', icon: 'filter', tooltip: 'Filter'},
      {id: 'refresh', icon: 'arrow-clockwise', tooltip: 'Refresh'}
    ]
  }
];
```

```html
<aiux-toolbar
  .groups="${groups}"
  .maxVisible="${2}"
  aria-label="List toolbar"
  @aiux-toolbar:item-clicked="${handleAction}"
></aiux-toolbar>
```

### Toggle items (stateful)

```js
function handleToggle(e) {
  const {itemId, groupId, active} = e.detail;
  // Update groups data — re-assign to trigger Lit re-render
  groups = groups.map(g =>
    g.id !== groupId
      ? g
      : {
          ...g,
          items: g.items.map(i => (i.id === itemId ? {...i, active} : i))
        }
  );
}
```

```html
<aiux-toolbar
  .groups="${groups}"
  aria-label="View mode toolbar"
  @aiux-toolbar:item-toggled="${handleToggle}"
></aiux-toolbar>
```

### Collapsible groups (Pattern 2 — Inline Expandable)

```js
const groups = [
  {
    id: 'format',
    label: 'Format',
    icon: 'text-bold',
    collapsible: true,
    defaultCollapsed: false,
    items: [
      {
        id: 'bold',
        icon: 'text-bold',
        tooltip: 'Bold',
        type: 'toggle',
        active: true
      },
      {id: 'italic', icon: 'text-italic', tooltip: 'Italic', type: 'toggle'}
    ]
  }
];
```

```html
<aiux-toolbar
  .groups="${groups}"
  aria-label="Editor toolbar"
  @aiux-toolbar:group-toggled="${handleGroupToggle}"
></aiux-toolbar>
```

### Vertical orientation (Pattern 3 — Accordion)

```html
<aiux-toolbar
  .groups="${groups}"
  orientation="vertical"
  .tooltipPlacement=${'right'}
  aria-label="Vertical toolbar"
></aiux-toolbar>
```

### Tooltip placement for edge-positioned toolbars

```html
<!-- Toolbar at the bottom edge — tooltips open upward -->
<aiux-toolbar .groups="${groups}" .tooltipPlacement=${'top'}></aiux-toolbar>

<!-- Toolbar at the right edge — tooltips open to the left -->
<aiux-toolbar
  .groups="${groups}"
  orientation="vertical"
  .tooltipPlacement=${'left'}
></aiux-toolbar>
```

## Properties

### `<aiux-toolbar>`

| Property           | Attribute           | Type                                               | Default        | Description                                                              |
| ------------------ | ------------------- | -------------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `groups`           | property only       | `ToolbarGroup[]`                                   | `[]`           | Ordered groups of toolbar items. Use Lit property binding or JS property assignment |
| `orientation`      | `orientation`       | `'horizontal' \| 'vertical'`                       | `'horizontal'` | Layout direction; also controls Arrow key axis for keyboard navigation   |
| `size`             | `size`              | `'sm' \| 'md' \| 'lg'`                             | `'md'`         | Scales all buttons and icons uniformly                                   |
| `ariaLabel`        | `aria-label`        | `string`                                           | `''`           | Accessible label for the `role="toolbar"` region. Empty value falls back to localized `"Toolbar"` |
| `maxVisible`       | `maxvisible`        | `number`                                           | `0`            | Maximum groups shown inline; `0` = show all. Extras move to the overflow menu |
| `tooltipPlacement` | `tooltipplacement`  | `'auto' \| 'top' \| 'bottom' \| 'left' \| 'right'` | `'auto'`       | Direction tooltips open toward. `auto` picks orientation-aware defaults  |

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property                  | Type     | Label              | Default     | Description                                       |
| ------------------------- | -------- | ------------------ | ----------- | -------------------------------------------------- |
| `configSize`              | `String` | Size                | `undefined` | Button / icon size token: sm \| md \| lg.           |
| `configMaxVisible`        | `Number` | Max Visible         | `undefined` | Max groups shown inline; 0 = show all.              |
| `configTooltipPlacement`  | `String` | Tooltip Placement   | `undefined` | Controls which side item tooltips open toward.      |

## Events

Events bubble and cross the shadow DOM boundary.

### `aiux-toolbar:item-clicked`

Fired when an `action`-type item is clicked.

```ts
detail: {
  itemId: string; // id of the clicked item
  groupId: string; // id of the parent group
  item: ToolbarItem; // full item object
}
```

### `aiux-toolbar:item-toggled`

Fired when a `toggle`-type item is clicked.

**This event carries a required contract.** `aiux-toolbar` is a controlled component — it holds no internal `active` state. The `active` value in `detail` is the _desired_ new state computed by the component; the caller must write it back into the `groups` data to make it permanent. If you do not update `item.active` and re-assign `groups`, the button will visually revert to its previous state on the next render and `aria-pressed` will be incorrect.

Contrast with `aiux-toolbar:item-clicked`, which is fire-and-forget — no data update required.

```ts
detail: {
  itemId: string; // id of the toggled item
  groupId: string; // id of the parent group
  item: ToolbarItem; // full item object at the moment of the click
  active: boolean; // new active state AFTER toggle — must be written back into groups data
}
```

### `aiux-toolbar:group-toggled`

Fired when a collapsible group trigger is clicked.

```ts
detail: {
  groupId: string; // id of the toggled group
  collapsed: boolean; // new collapsed state AFTER toggle (true = now collapsed)
  group: ToolbarGroup; // full group object at the moment of the toggle
}
```

## Data types

```ts
interface ToolbarGroup {
  id: string;
  items: ToolbarItem[];
  label?: string; // micro-label above the group; trigger text when collapsible
  collapsible?: boolean; // enables inline expand/collapse trigger button
  defaultCollapsed?: boolean; // initial SSR-rendered collapsed state
  icon?: string; // aiux-icon name for the collapsible trigger
}

interface ToolbarItem {
  id: string;
  type?: 'action' | 'toggle' | 'separator'; // default: 'action'
  icon?: string; // aiux-icon name
  label?: string; // visible text label; renders alongside icon when both present
  tooltip?: string; // DaisyUI data-tip text; falls back to label then ariaLabel
  disabled?: boolean; // renders with reduced opacity and native disabled attribute
  active?: boolean; // pressed state for toggle items
  ariaLabel?: string; // explicit accessible label override
  data?: Record<string, unknown>; // pass-through metadata returned in event detail
}
```

## File structure

```
toolbar/
├── index.js                          # Package entry point
├── package.json
├── src/
│   ├── index.ts                      # Public exports
│   ├── toolbar.ts                    # <aiux-toolbar> — single registered element
│   ├── toolbar.stories.ts            # Storybook stories
│   ├── controllers/
│   │   └── toolbar-controller.ts     # Group visibility, overflow, collapsed state, event emission
│   ├── styles/
│   │   └── toolbar.styles.ts         # Component styles (collapse animation, :host display)
│   └── types/
│       └── toolbar.types.ts          # All TypeScript interfaces and type aliases
├── test/
│   ├── toolbar.test.js               # SSR rendering tests (75+ cases)
│   └── toolbar-controller.test.js    # Controller unit tests
└── vN/
    └── index.js                      # Build output (generated, do not edit)
```

> `vN/index.js` is generated by `node build.js` in `karuna/components/`. Do not edit it directly.

## Exports

```js
import {Toolbar} from '@servicenow/aiux-components-coe-toolbar';
```

## Architecture

`<aiux-toolbar>` is the **single registered custom element**. All rendering logic is contained in private render helpers within the class (`_renderGroup`, `_renderItem`, `_renderCollapsibleTrigger`, `_renderOverflowMenu`).

Business logic lives in `ToolbarController`:

| Responsibility        | Detail                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Group visibility      | `getVisibleGroups` / `getOverflowGroups` slice `groups` by `maxVisible`                                                      |
| Overflow menu         | `overflowOpen` state, `toggleOverflow`, `closeOverflow`                                                                      |
| Collapsed group state | `Map<groupId, boolean>` seeded from `defaultCollapsed` on `connectedCallback`                                                |
| Event emission        | All `aiux-toolbar:item-clicked`, `aiux-toolbar:item-toggled`, `aiux-toolbar:group-toggled` events dispatched from controller |

Roving tabindex keyboard navigation (ARIA toolbar pattern) is implemented in `_handleKeydown` on the host element — Arrow keys move focus within the toolbar, Home/End jump to extremes, Tab exits entirely.

## Accessibility

| Feature                  | Implementation                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| Toolbar region           | `role="toolbar"`, `aria-orientation`, `aria-label`                            |
| Roving tabindex          | One `tabindex="0"` at a time; Arrow keys update focus and tabindex            |
| Action buttons           | `aria-label` from `tooltip` → `label` → `ariaLabel` fallback chain            |
| Toggle buttons           | `aria-pressed="true"/"false"` (absent on non-toggle items via `ifDefined`)    |
| Disabled items           | `aria-disabled="true"`, `opacity-40`, remain in tab order for discoverability |
| Separator items          | `role="separator"`, `aria-orientation` matching toolbar axis                  |
| Collapsible trigger      | `aria-expanded`, `aria-controls` pointing to item container                   |
| Collapsed item container | `aria-hidden="true"` when collapsed                                           |
| Overflow button          | `aria-haspopup="true"`, `aria-expanded="true"/"false"`                        |
| Overflow menu            | `role="menu"`, `aria-label="More actions"`                                    |
| Overflow item groups     | `role="group"`                                                                |
| Decorative dividers      | `aria-hidden="true"`                                                          |
| Keyboard: Arrow keys     | Move focus within toolbar (horizontal: Left/Right; vertical: Up/Down)         |
| Keyboard: Home / End     | Jump to first / last button                                                   |
| Keyboard: Escape         | Closes overflow menu when open                                                |

## Styling

All colors use DaisyUI semantic tokens (`bg-base-100`, `border-base-content/20`, `text-text-tertiary`, etc.) which automatically adapt to light/dark themes. The collapse animation for collapsible group items uses custom CSS (`toolbar-group-items` with `grid-template-rows` transition) since Tailwind has no animate-collapse utility.

## SSR compatibility

This component is compatible with `@lit-labs/ssr`.

| Constraint                           | How it is handled                                                     |
| ------------------------------------ | --------------------------------------------------------------------- |
| No browser globals in `render()`     | `render()` uses only Lit templates and controller state               |
| No `window` / `document` on server   | All browser API calls guarded with `if (!isServer)` from `'lit'`      |
| No DOM access outside event handlers | `querySelectorAll` only in `_handleKeydown` (browser event handler)   |
| `render()` is pure                   | First focusable ID computed as a local variable; no instance mutation |
| All properties have safe defaults    | Every `@property` has an explicit non-null default value              |
