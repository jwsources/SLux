# @servicenow/aiux-360-degree-visualization

## Import

```js
import '@servicenow/aiux-360-degree-visualization';
```


Purely presentational radial relationship graph. Renders a central entity node surrounded by N configurable sectors, each containing pill-shaped node cards with carousel navigation.

The component is stateless: it does not fetch data or manage selection internally. All interactions are emitted as custom events.

## Usage

```html
<aiux-360-degree-visualization
  .entity=${{title: 'Server-01', overline: 'SRV001'}}
  .relations=${[
    {name: 'Runs', nodes: [{id: '1', label: 'App A', count: 3}]},
    {name: 'Managed by', nodes: [{id: '2', label: 'Team Alpha', count: 5}]},
  ]}
  .selectedNodeId=${'1'}
  .size=${1000}
  @aiux-360-degree-visualization:node-click=${(e) => console.log(e.detail)}
></aiux-360-degree-visualization>
```

## Sizing

By default the component is responsive: it fills its container width up to a 800px cap and the SVG scales to match, keeping a square aspect ratio. Two ways to make it larger:

- Set the `size` property to an explicit pixel width. This lifts the 800px cap and renders at exactly that width, e.g. `.size=${1000}`.
- Or style the host element with CSS: `aiux-360-degree-visualization { max-width: 1200px; }`.

Note that the wheel itself occupies roughly the inner half of the graphic; the surrounding space is reserved for the pill "spokes" that radiate outward from each sector.

## Properties

| Property         | Attribute          | Type             | Default                      | Description                                                    |
| ---------------- | ------------------ | ---------------- | ---------------------------- | -------------------------------------------------------------- |
| `entity`         | -                  | `EntityInfo`     | `{title: ''}`               | Central entity displayed at the hub                            |
| `relations`      | -                  | `Relation[]`     | `[]`                         | Array of relation sectors. Sector count equals array length.   |
| `selectedNodeId` | `selected-node-id` | `string \| null` | `null`                       | Currently selected node ID                                     |
| `size`           | `size`             | `number`         | responsive (capped at 800px) | When omitted, the component fills its container up to 800px. When set, the cap is lifted and the component renders at exactly this width (e.g. `1400`). |

### EntityInfo

| Field               | Type      | Required | Description                                                                 |
| ------------------- | --------- | -------- | --------------------------------------------------------------------------- |
| `title`             | `string`  | yes      | Primary heading of the entity. Always shown.                                |
| `overline?`         | `string`  | no       | Small text displayed above the title (e.g. a record number or category). Hidden when absent. |
| `subtitle?`         | `string`  | no       | Secondary text displayed below the title. Hidden when absent.               |
| `caption?`          | `string`  | no       | Smallest detail line at the bottom of the center circle. Hidden when absent. |
| `enableNavigation?` | `boolean` | no       | When `true`, the entity title renders as a clickable link that fires `center-node-click`. |
| `meta?`             | `Record<string, unknown>` | no | Opaque metadata bag. Passed through verbatim in the `center-node-click` event detail. |

### Relation

| Field    | Type             | Description                                            |
| -------- | ---------------- | ------------------------------------------------------ |
| `name`   | `string`         | Human-readable relation name                           |
| `nodes`  | `RelationNode[]` | Nodes belonging to this relation                       |
| `color?` | `string`         | Optional fill color for the sector wedge (hex string)  |

### RelationNode

| Field    | Type     | Description                                                     |
| -------- | -------- | --------------------------------------------------------------- |
| `id`     | `string` | Unique identifier                                               |
| `label`  | `string` | Display label (e.g. "Open issues")                              |
| `count?` | `number` | Numeric count shown in the badge. Hidden when absent; `0` is valid. |
| `meta?`  | `Record<string, unknown>` | Opaque metadata bag. Passed through verbatim in event details. |

## Events

| Event                                                    | Detail                   | Description                              |
| -------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `aiux-360-degree-visualization:node-click`            | `NodeClickDetail`        | A node pill was clicked                  |
| `aiux-360-degree-visualization:view-all`              | `ViewAllDetail`          | "View all" activated for a sector        |
| `aiux-360-degree-visualization:selection-change`      | `SelectionChangeDetail`  | Node selection toggled                   |
| `aiux-360-degree-visualization:carousel-navigate`     | `CarouselNavigateDetail` | Carousel page changed                    |
| `aiux-360-degree-visualization:center-node-click`     | `CenterNodeClickDetail`  | Center entity name clicked (only when `entity.enableNavigation` is `true`) |

All events set `bubbles: true` and `composed: true`, so they cross shadow DOM boundaries.

### Event Detail Types

**NodeClickDetail:** `{ node: RelationNode, sectorIndex: number }`

**ViewAllDetail:** `{ relation: Relation, sectorIndex: number }`

**SelectionChangeDetail:** `{ selectedNodeId: string | null, previousNodeId: string | null }`

**CarouselNavigateDetail:** `{ sectorIndex: number, direction: 'next' | 'prev', page: number }`

**CenterNodeClickDetail:** `{ entity: EntityInfo }`

## Accessibility

- Full keyboard navigation: arrow buttons and node pills are focusable with Enter/Space activation
- Visible keyboard focus indicators on every interactive element, including the navigable center-node link (WCAG 2.4.7)
- ARIA labels on all interactive elements (pills, navigation arrows, "View all" links)
- Carousel arrows and "View all" controls are labelled per sector (e.g. "Next page, Used by", "View all Used by (2)") so repeated controls are distinguishable (WCAG 2.4.6 / 2.4.4)
- `role="group"` on the SVG root with a descriptive `aria-label`, keeping the interactive descendants reachable in the accessibility tree
- `aria-pressed` on node pills to indicate selection state
- `aria-live="polite"` region announces carousel page changes to screen readers
- Long text in the sector relation names, node pill labels, and the center entity node is truncated with an ellipsis so it stays inside its bounds; the full text is exposed on hover via a native SVG `<title>` and remains in each element's `aria-label` for screen readers. Node pill width is capped so a long label cannot distort the wheel

## RTL Support

The component automatically detects right-to-left layout from the inherited CSS
`direction` property (typically set via `dir="rtl"` on a parent element or the
document). When RTL is active:

- Sectors are mirrored counter-clockwise (the first sector appears to the left
  of 12 o'clock instead of the right)
- Pill badge/label order is reversed (label first, count badge second)
- Carousel navigation arrows swap positions and chevron direction
- SVG text in sector labels receives `direction="rtl"` for proper bidi
  glyph shaping; center-node text uses `text-anchor="middle"` which is
  direction-neutral

No property is required to enable RTL; detection is automatic via
`getComputedStyle(this).direction`.

## Dependencies

| Package | Type | Version |
|---|---|---|
| `lit` | peer | `^3.0.0` |
| `@lit/localize` | peer | `^0.12.2` |
| `@servicenow/aiux-components-core` | peer | `^4.26.1` |

## Installation

```
pnpm add @servicenow/aiux-360-degree-visualization
```

## Development

```
pnpm install
pnpm test
pnpm lint
```
