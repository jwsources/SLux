# @servicenow/aiux-sn-honeycomb

## Import

```js
import '@servicenow/aiux-sn-honeycomb';
```


Honeycomb tilemap visualization component. Renders a Highcharts tilemap with hexagon-shaped tiles, supporting custom color classes, tooltips, data labels, and optional color-based grouping.

## Storybook

Honeycomb stories are available from the repo root:

```bash
pnpm storybook
```

The Storybook examples cover the default tilemap, simple and empty data, grouped colors, custom colors, size variants, background cells, data labels, subtitles, and named slots.

## Usage

```html
<aiux-sn-honeycomb
  .points="${myPoints}"
  .honeycombConfig="${{ title: 'My Honeycomb' }}"
></aiux-sn-honeycomb>
```

## Properties

- `points` - Array of honeycomb tile data points (default: `[]`). Each point requires:
  - `hc-a2` - Two-letter abbreviation shown on the tile
  - `name` - Full name of the tile
  - `region` - Optional region string (reserved for future grouping logic)
  - `x` - Column position in the honeycomb grid
  - `y` - Row position in the honeycomb grid
  - `value` - Numeric value used for color classification
- `honeycombConfig` - Optional configuration object for chart appearance and behavior

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property         | Type      | Label       | Default     | Description                                                                                |
| ---------------- | --------- | ----------- | ----------- | -------------------------------------------------------------------------------------------- |
| `configGroupBy`     | `String`  | Group By     | `undefined` | Overrides `groupBy`: controls how tiles are spatially arranged, `"category"` or `"value"` |
| `configUsePopover`  | `Boolean` | Use Popover  | `undefined` | Overrides `usePopover`: replaces the default Highcharts tooltip with an aiux-sn-popover on tile hover |

## Slots

The component provides four named slots for positioning content at the corners of the visualization:

- `top-start` - Positioned at the top-left corner (absolute positioning with `top: 0.5rem; left: 0.5rem`)
- `top-end` - Positioned at the top-right corner (absolute positioning with `top: 0.5rem; right: 0.5rem`)
- `bottom-start` - Positioned at the bottom-left corner (absolute positioning with `bottom: 0.5rem; left: 0.5rem`)
- `bottom-end` - Positioned at the bottom-right corner (absolute positioning with `bottom: 0.5rem; right: 0.5rem`)

These slots are useful for overlaying legends, labels, controls, or other UI elements on top of the honeycomb chart.

### Example

```html
<aiux-sn-honeycomb .points="${myPoints}">
  <div slot="top-start" class="card">
    <h3>Legend</h3>
    <!-- Legend content -->
  </div>
  <div slot="bottom-end" class="badge">Last updated: 2024-03-19</div>
</aiux-sn-honeycomb>
```

## HoneycombConfig

- `title` - Chart title
- `subtitle` - Chart subtitle
- `colorClasses` - Array of color axis data classes for value-to-color mapping. Each entry has:
  - `from` - Lower bound of the range (inclusive)
  - `to` - Upper bound of the range (exclusive)
  - `color` - CSS color for this range
  - `name` - Optional legend label for this range
- `tooltipFormat` - Highcharts-format string for tooltip `pointFormat`
- `groupByColor` - When `true`, rearranges tile coordinates so hexagons sharing the same color class are placed together in compact clusters
- `plotOptions` - Highcharts `plotOptions` configuration for customizing series behavior (data labels, formatting, etc.)

## Events

This component does not dispatch any custom events.

## Features

- Highcharts-powered tilemap with honeycomb (hexagon) tile shape
- Zod runtime validation for `points` and `honeycombConfig`
- Custom color class ranges with legend
- Optional data labels on tiles
- Configurable tooltips
- Color-based grouping mode
- Responsive sizing via container dimensions

## Performance Considerations

### Background Grid Limitations

When `showBackground: true` is enabled in `honeycombConfig`, the component generates a rectangular grid of empty hexagons covering the data's bounding box plus padding. **This grid size grows quadratically** with the spatial spread of your data:

```
Grid cells = (xRange + 2×padding) × (yRange + 2×padding)
```

**Example:** Data spanning `x: [0, 50]` and `y: [0, 50]` generates `52 × 52 = 2,704` background hexagons.

**Safety limit:** The component enforces a maximum of **2,500 background cells**. If your data exceeds this threshold:

- The background grid is automatically disabled
- A console warning is logged with the actual grid size and data range
- The visualization still renders normally with data hexagons only

**Recommendations:**

- For large spatial spreads, consider disabling `showBackground` or using `groupByColor: true` to compact the layout
- Monitor console warnings during development to catch unexpected data ranges
- Test with production-scale data to validate performance

## Dependencies

- `highcharts` ^12.5.0
- `zod` ^4.0.15
- `lit` ^3.0.0 (peer)
- `@servicenow/aiux-components-core` ^4.10.1 (peer)
