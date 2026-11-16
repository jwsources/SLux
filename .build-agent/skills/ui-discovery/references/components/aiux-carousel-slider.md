---
argus-naming-exceptions:
  - rule: package_name_aiux_sn_prefix
    identifiers:
      - '@servicenow/aiux-components-carousel'
  - rule: aiux_prefix_for_custom_elements
    identifiers:
      - aiux-carousel-slider
  - rule: event_name_namespaced_with_component
    identifiers:
      - carousel-content-switch
---
# @servicenow/aiux-components-carousel

## Import

```js
import '@servicenow/aiux-components-carousel';
```


Carousel slider component with autoplay, keyboard navigation, and WCAG 2.2 AA compliance.

## Installation

```bash
pnpm add @servicenow/aiux-components-carousel
```

## Usage

```html
<aiux-carousel-slider
  .items=${[
    { type: 'image', content: 'slide1.jpg', alt: 'First slide' },
    { type: 'image', content: 'slide2.jpg', alt: 'Second slide' },
  ]}
  autoplay="5000"
  show-navigation
  show-indicators
></aiux-carousel-slider>
```

## Properties

| Property         | Attribute         | Type     | Default    | Description                                                                                   |
| ---------------- | ----------------- | -------- | ---------- | --------------------------------------------------------------------------------------------- |
| `items`          | `items`           | Array    | `[]`       | Array of carousel items `{type, content, alt, width, height}`. Use Lit property binding or JS property assignment |
| `showNavigation` | `show-navigation` | Boolean  | `true`     | Show prev/next navigation buttons                                                             |
| `showIndicators` | `show-indicators` | Boolean  | `true`     | Show slide indicator dots                                                                     |
| `autoplay`       | `autoplay`        | Number   | `0`        | Auto-play interval in ms; `0` disables autoplay. Pauses on hover/focus and is disabled when reduced motion is active |
| `alignment`      | `alignment`       | String   | `'center'` | `'start'`, `'center'`, or `'end'`                                                             |
| `vertical`       | `vertical`        | Boolean  | `false`    | Vertical orientation                                                                          |
| `label`          | `label`           | String   | `''`       | Accessible label for the carousel region; defaults to "Image carousel"                        |
| `onchange`       | —                 | Function | `null`     | Legacy property-only slide change callback. Pass a function; string callbacks are not supported. Prefer `carousel-content-switch` |

Because `showNavigation` and `showIndicators` default to `true`, set them as JavaScript properties or Lit bindings when you need `false`.

## Methods

- `goToSlide(index)` — navigate to specific slide
- `next()` — next slide (wraps)
- `previous()` — previous slide (wraps)

## Events

Events bubble and cross the shadow DOM boundary.

| Event                     | Detail                     | Description                     |
| ------------------------- | -------------------------- | ------------------------------- |
| `carousel-content-switch` | `{ index, previousIndex }` | Fired when active slide changes |

## Slots

Named slots `slot="item-0"`, `slot="item-1"`, etc. provide custom HTML content per slide. A named slot replaces the fallback rendering from the corresponding `items[index].content`.

## Tag Name

The canonical custom element tag is `aiux-carousel-slider`.
