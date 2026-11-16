# @servicenow/aiux-components-coe-node-map

## Import

```js
import '@servicenow/aiux-components-coe-node-map';
```


A Lit web component (extending `AIUXElement`) for visualizing graphs with nodes and edges using Cytoscape.js. Supports canvas rendering (1000+ nodes), DOM overlay nodes (rich interactive widgets), custom node renderers, popovers, keyboard accessibility, and multiple layout algorithms.

## Installation

```javascript
import '@servicenow/aiux-components-coe-node-map';
```

The custom element `<aiux-node-map>` is then available everywhere in the document.

## Quick Start

```html
<aiux-node-map
  .nodes=${[
    { id: '1', label: 'Server A', sublabel: 'Primary', icon: 'server', status: 'success' },
    { id: '2', label: 'Server B', sublabel: 'Backup', icon: 'server', status: 'warning' },
    { id: '3', label: 'Database', sublabel: 'PostgreSQL', icon: 'database', shape: 'round-rectangle' }
  ]}
  .edges=${[
    { id: 'e1', source: '1', target: '3', label: 'queries' },
    { id: 'e2', source: '2', target: '3', label: 'queries', lineStyle: 'dotted' }
  ]}
  layout="vertical"
  popover-trigger="click"
  height="85vh"
></aiux-node-map>
```

## Properties

| Property               | Attribute            | Type                                 | Default   | Description                                                 |
| ---------------------- | -------------------- | ------------------------------------ | --------- | ----------------------------------------------------------- |
| `nodes`                | —                    | `NodeData[]`                         | `[]`      | Array of nodes to display                                   |
| `edges`                | —                    | `EdgeData[]`                         | `[]`      | Array of edges connecting nodes                             |
| `layout`               | `layout`             | `LayoutType`                         | `'cose'`  | Layout algorithm                                            |
| `edgeType`             | `edge-type`          | `EdgeType \| null`                   | `null`    | Edge routing: `'straight'`, `'joints'`, `'curved'`, or auto |
| `width`                | `width`              | `string`                             | `'100%'`  | Component width (any CSS value)                             |
| `height`               | `height`             | `string`                             | `'85vh'`  | Component height (any CSS value)                            |
| `defaultIcon`          | `default-icon`       | `string`                             | `''`      | Fallback icon (name, URL, or data URI)                      |
| `popoverTrigger`       | `popover-trigger`    | `PopoverTrigger`                     | `'hover'` | Popover trigger mode: `'hover'`, `'click'`, or `'none'`     |
| `nodeTooltip`          | `node-tooltip`       | `boolean`                            | `true`    | Global toggle for node hover tooltips; auto-disabled when `popoverTrigger='hover'` |
| `renderPopoverContent` | —                    | `(node: NodeData) => TemplateResult` | —         | Custom popover renderer callback                            |
| `nodeRenderer`         | —                    | `NodeRendererContract \| null`       | `null`    | Custom canvas renderer instance                             |
| `nodeRendererTag`      | `node-renderer-tag`  | `string`                             | `''`      | Custom canvas renderer tag (auto-loads)                     |
| `asyncRenderer`        | `async-renderer`     | `boolean`                            | `false`   | Defer init until renderer is set                            |
| `nodeActionItems`      | —                    | `ContextMenuEntry[]`                 | `[]`      | Context menu actions for all nodes                          |
| `nodeComponentTag`     | `node-component-tag` | `string`                             | `''`      | DOM overlay component tag for all nodes                     |
| `nodeComponentProps`   | —                    | `Record<string, unknown>`            | `{}`      | Shared props for all overlay components                     |
| `focusElementId`       | `focus-element-id`   | `string`                             | `''`      | Smoothly pan to center on a node/edge                       |
| `canvasColor`          | `canvas-color`       | `string`                             | `''`      | Custom canvas background color (CSS)                        |
| `showEdgeArrows`       | `show-edge-arrows`   | `boolean`                            | `true`    | Global toggle for edge arrow visibility                     |
| `dotBackground`        | `dot-background`     | `boolean`                            | `false`   | Show SVG dot grid overlay on the canvas                     |
| `maxNodeScreenRatio`   | `max-node-screen-ratio` | `number`                          | `1`       | Max fraction (0–1) of container for node zoom cap           |

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

`aiux-node-map`:

| Property                   | Type      | Label                  | Default     | Description                                                                                         |
| --------------------------- | --------- | ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `configLayout`              | `String`  | Layout                 | `undefined` | Layout algorithm used to position nodes and edges.                                                  |
| `configWidth`               | `String`  | Width                  | `undefined` | Width of the component (default: 100%).                                                             |
| `configHeight`              | `String`  | Height                 | `undefined` | Height of the component (default: '85vh').                                                          |
| `configDefaultIcon`         | `String`  | Default Icon           | `undefined` | Default icon to use for nodes without a specified icon.                                             |
| `configPopoverTrigger`      | `String`  | Popover Trigger        | `undefined` | Controls how the node popover is triggered.                                                         |
| `configEdgeType`            | `String`  | Edge Type              | `undefined` | Edge routing type controlling how edges are drawn between nodes.                                    |
| `configCanvasColor`         | `String`  | Canvas Color           | `undefined` | Custom canvas background color (CSS color string); theme default used when empty.                   |
| `configShowEdgeArrows`      | `Boolean` | Show edge arrows       | `undefined` | Global toggle for edge arrow visibility                                                             |
| `configDotBackground`       | `Boolean` | Dot background         | `undefined` | Show a dot grid pattern on the canvas background                                                    |
| `configMaxNodeScreenRatio`  | `Number`  | Max Node Screen Ratio  | `undefined` | Maximum fraction (0-1) of the container's smaller dimension a node may occupy after fit-to-screen. |
| `configNodeTooltip`         | `Boolean` | Node Tooltip           | `undefined` | Allows a page admin to enable or disable node hover tooltips per-widget instance via the Config Editor, without a code change. Overrides `nodeTooltip`. |

`aiux-node-map-minimap`:

| Property                 | Type      | Label              | Default     | Description                                                                  |
| ------------------------ | --------- | ------------------ | ----------- | ---------------------------------------------------------------------------- |
| `configShowSizeDropdown` | `Boolean` | Show size dropdown | `undefined` | Whether to show the minimap container-size dropdown (Large / Medium / Small) |
| `configShowZoomDropdown` | `Boolean` | Show zoom dropdown | `undefined` | Whether to show the minimap zoom-level dropdown (25% - 150%)                 |

## Node Data Structure

```typescript
interface NodeData {
  id: string;
  label?: string;
  sublabel?: string;
  icon?: string; // Built-in name ('database', 'cloud', …), URL, or data URI
  shape?: NodeShape; // 'ellipse' | 'round-rectangle' (default)
  status?: NodeStatus; // 'info' | 'success' | 'warning' | 'error' — drives accent color
  color?: string; // Custom CSS accent color; overrides status
  selectedColor?: string; // Border color when selected; overrides default primary
  labelBg?: string; // Label pill background color
  labelColor?: string; // Label pill text color
  hoverBg?: string; // Node background color on hover
  indicators?: NodeIndicator[]; // Up to 2 badge indicators (canvas renderer only)
  actionItems?: ContextMenuEntry[]; // Per-node context menu items; overrides global nodeActionItems
  rendererTag?: string; // Per-node canvas renderer tag; overrides global node-renderer-tagHEAD
  tooltip?: string; // Custom tooltip text on hover; falls back to label when omitted; set to '' to suppress
  groupCount?: number; // Group count badge (for aiux-node-map-node-stack)
  groupCount?: number; // Group count badge (for aiux-node-map-node-stack)
  nodeWidth?: number; // Custom model-space width
  nodeHeight?: number; // Custom model-space height
  component?: string; // Custom element tag — triggers DOM overlay
  componentProps?: Record<string, unknown>;
  componentSize?: { width: number; height: number }; // Default: 200×60
  componentStyle?: Record<string, string>;
  [key: string]: unknown;
}
```

### Node Design

- **Shape**: Round-rectangle (default) or ellipse, with a thin border (color from `--color-neutral`)
- **Icon**: Centered, scaled to 50% of the node size. 867+ built-in icons available
- **Label**: Displayed below the shape in a medium-weight font
- **Selected**: Border color changes to `--color-primary`

All colors are theme-aware via DaisyUI CSS custom properties.

## Edge Data Structure

```typescript
interface EdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  status?: EdgeStatus; // Semantic state — drives line color
  lineStyle?: EdgeLineStyle; // 'solid' (default) | 'dotted'
  selectedColor?: string; // Line color when selected
  hoverColor?: string; // Line color on parent node hover
  iconIndicator?: EdgeStatus; // Status icon badge at edge midpoint
  thickness?: EdgeThickness; // Line thickness scale (default: 1)
  opacity?: number; // Line opacity 0–1 (default: 1)
  showArrow?: boolean; // Per-edge arrow visibility; overrides showEdgeArrows
  [key: string]: unknown;
}
```

## Supported Layouts

| Layout       | Description                        | Best For                |
| ------------ | ---------------------------------- | ----------------------- |
| `cose`       | Force-directed layout (default)    | General purpose graphs  |
| `vertical`   | Hierarchical top-to-bottom (dagre) | Trees, DAGs, org charts |
| `horizontal` | Hierarchical left-to-right (dagre) | Pipelines, workflows    |

Additional Cytoscape layouts (`grid`, `circle`, `concentric`, `breadthfirst`) are available but not optimized.

## Edge Routing

Controlled by `edge-type` attribute. When `null` (default), auto-selects: **vertical/horizontal** → `joints`, **cose and others** → `straight`.

| Type       | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `straight` | Direct straight lines                                          |
| `joints`   | Orthogonal (right-angle) routing, direction follows the layout |
| `curved`   | Bezier curves with fan-out for edges sharing the same source   |

## Events

| Event                             | Detail                                                      | Description                         |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| `aiux-node-map:node-click`        | `{ node: NodeData }`                                        | User clicks a node                  |
| `aiux-node-map:edge-click`        | `{ edge: EdgeData }`                                        | User clicks an edge                 |
| `aiux-node-map:node-action`       | `{ node: NodeData, actionId: string, actionLabel: string }` | Click inside a renderer action zone |
| `aiux-node-map:node-mouseover`    | `{ node: NodeData }`                                        | Mouse enters a node                 |
| `aiux-node-map:node-mouseout`     | —                                                           | Mouse leaves a node                 |
| `aiux-node-map:node-focused`      | `{ node: NodeData }`                                        | Node gains hover or keyboard focus  |
| `aiux-node-map:node-unfocused`    | `{ node: NodeData }`                                        | Node loses hover or keyboard focus  |
| `aiux-node-map:canvas-tap`        | —                                                           | User clicks the canvas background   |
| `aiux-node-map:zoom-change`       | `{ zoom: number, baselineZoom: number }`                    | Zoom level changes                  |
| `aiux-node-map:selection-changed` | `{ nodes: string[], edges: string[] }`                      | Selection state changes             |
| `aiux-node-map:context-action`    | `{ item: ContextMenuItem, elementId, elementType }`         | Context menu item clicked           |

## Methods

| Method             | Description                                    |
| ------------------ | ---------------------------------------------- |
| `fit()`            | Fit the graph viewport to contain all elements |
| `center()`         | Center the graph without changing zoom         |
| `resetZoom()`      | Reset zoom to default level and center         |
| `zoomIn()`         | Smoothly zoom in by one step (×1.2)            |
| `zoomOut()`        | Smoothly zoom out by one step (÷1.2)           |
| `clearSelection()` | Clear all selections, fires selection-changed  |

## Extensions

Built-in add-ons provided by the package. Each returns a Lit `TemplateResult` for placement in any slot.

```typescript
import { extensions } from '@servicenow/aiux-components-coe-node-map';

html`
  <aiux-node-map .nodes=${nodes} .edges=${edges}>
    <div slot="top-end">${extensions.toolbar()}</div>
    <div slot="bottom-end">${extensions.minimap()}</div>
  </aiux-node-map>
`;
```

| Extension              | Element                      | Description                                                     |
| ---------------------- | ---------------------------- | --------------------------------------------------------------- |
| `extensions.minimap()` | `<aiux-node-map-minimap>`    | Bird's-eye dot overview with draggable viewport                  |
| `extensions.toolbar()` | `<aiux-node-map-toolbar>`    | Compact vertical toolbar (zoom in/out, fit)                      |
| `extensions.search()`  | `<aiux-node-map-search>`     | Search input with auto-suggest; highlights matching nodes/edges  |

## Slots

| Slot Name       | Position      |
| --------------- | ------------- |
| `top-start`     | Top-left      |
| `top-center`    | Top-center    |
| `top-end`       | Top-right     |
| `bottom-start`  | Bottom-left   |
| `bottom-center` | Bottom-center |
| `bottom-end`    | Bottom-right  |

## Exports

```typescript
import '@servicenow/aiux-components-coe-node-map';
import type {
  NodeData,
  EdgeData,
  GraphData,
  LayoutType,
  NodeShape,
  NodeStatus,
  NodeIndicator,
  EdgeLineStyle,
  EdgeType,
  PopoverTrigger,
  PopoverContentRenderer,
  SelectionChangedDetail,
  NodeRendererContract,
  NodeRenderResult,
  NodeRenderContext,
  NodeAction,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuEntry,
  ContextActionDetail,
} from '@servicenow/aiux-components-coe-node-map';

// Utilities
import {
  iconUri,
  iconUriFromSvg,
  resolveIconValue,
  AVAILABLE_ICONS,
  resolveComponentUrl,
  ensureComponentLoaded,
  prewarmIcons,
  collectIconNames,
  clearIconCache,
  isIconName,
  AiuxNodeMapNode,
  NodeMapMinimap,
  NodeMapToolbar,
  extensions,
} from '@servicenow/aiux-components-coe-node-map';
import type {
  ExtensionConnectDetail,
  MinimapOptions,
  SearchOptions,
  NodeMapExtensions,
} from '@servicenow/aiux-components-coe-node-map';
```

## File Structure

```
src/
  components/
    aiux-node-map.ts              # Main component
    aiux-node-map.styles.ts       # Shadow DOM styles
    aiux-node-map.graph-styles.ts # Cytoscape stylesheet builder
    aiux-node-map.layout-config.ts# Layout algorithm configs
    aiux-node-map.keyboard-handlers.ts
    aiux-node-map.context-menu.ts # Context menu render helpers & keyboard handlers
  controllers/
    graph-controller.ts           # Cytoscape lifecycle, diff, events
    dom-overlay-controller.ts     # DOM overlay positioning & sync
    minimap-controller.ts         # Minimap canvas rendering & viewport drag
    context-menu-controller.ts    # Context menu: chevron, menu state, action dispatch
    popover-controller.ts         # Node popover: open/close, positioning, hover debounce
    indicator-manager.ts          # Indicator/sublabel positioning & reveal
    graph-animations.ts           # First-load animation presets
    graph-animations.raf.ts       # RAF-based burst animation
    graph-animations-shared.ts    # BFS-depth + center/hide setup shared by both presets
    hover-glow.ts                 # DOM-based glow effect for node hover state
  extensions/
    extensions.ts                 # Public extensions object (factory functions)
    node-map-minimap.ts           # <aiux-node-map-minimap> self-wiring element
    node-map-toolbar.ts           # <aiux-node-map-toolbar> self-wiring element
    node-map-search.ts            # <aiux-node-map-search> self-wiring element
  renderers/
    node-renderer.types.ts        # NodeRendererContract, NodeAction
    node-map-node.ts              # Built-in AiuxNodeMapNode element
    default-render-node.ts        # Pure render function
  types/
    node-map.types.ts             # NodeData, EdgeData, LayoutType, etc.
    graph-controller.types.ts     # GraphController options and internal types
    extension.types.ts            # ExtensionConnectDetail interface
    context-menu.types.ts         # ContextMenuItem, ContextMenuDivider, ContextActionDetail
  controllers/
    search-index.ts               # In-memory search index for nodes/edges
  utils/
    icon-uri.ts                   # Icon resolution & data URI generation
    icon-cache.ts                 # Runtime sprite fetch & cache (prewarmIcons)
    dynamic-loader.ts             # Component manifest loader
  stories/                        # Storybook stories
  index.ts                        # Public exports
```

## Accessibility

- **`role="application"`** on the graph container with a summary label (node/edge count, zoom level)
- **Tab / Shift+Tab** cycles through nodes → edges → toolbar
- **Enter / Space** on a focused node opens the popover (hover and click modes)
- **Arrow keys** pan the viewport; **Ctrl+Shift+arrows** zoom in/out
- **Context menu keyboard**: Tab to chevron → Enter/Space opens menu → Arrow Up/Down navigates items → Escape closes
- **`aria-live="polite"`** region announces focused node, loading state, and errors
- **Screen-reader-only** summary of the graph is always present

## SSR Compatibility

The component guards against server-side rendering with `typeof globalThis.window !== 'undefined'` checks. `render()` returns only static HTML/slots — no browser APIs are called during rendering. Safe for use with `@lit-labs/ssr`.

## Dependencies

| Package                                   | Purpose                       |
| ----------------------------------------- | ----------------------------- |
| `cytoscape` (3.33.1)                      | Graph rendering engine        |
| `cytoscape-dagre` (2.5.0)                 | Hierarchical layout algorithm |
| `@servicenow/aiux-components-core`        | AIUXElement base class        |
| `@servicenow/aiux-directive-icon`         | Icon rendering (chevron, context menu action icons, minimap toggle) |
| `@servicenow/aiux-directive-tooltip`      | Tooltip directive (node hover tooltips, minimap toggle)             |
| `@servicenow/aiux-sn-popover`             | Node popover                  |
| `lit` (peer, ^3.0.0)                      | Web component framework       |

## Known Limitations

- **Indicators** only work with the default canvas renderer — ignored for DOM overlays and custom renderers
- **DOM overlay scale** — recommended max ~50–100 nodes; use canvas renderer for larger graphs
- **Canvas rendering** — custom renderers must be synchronous (SVG-only, no HTML)

## Documentation

- [**Architecture**](./docs/architecture.md) — Component structure, rendering modes, and internal design
- [**API Reference**](./docs/api-reference.md) — Complete property, event, and method documentation
- [**User Guide**](./docs/user-guide.md) — Installation, usage examples, and configuration

## Development

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## License

ISC
