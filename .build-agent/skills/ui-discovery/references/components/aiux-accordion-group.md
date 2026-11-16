---
argus-naming-exceptions:
  - rule: package_name_aiux_sn_prefix
    identifiers:
      - '@servicenow/aiux-components-accordion'
  - rule: aiux_prefix_for_custom_elements
    identifiers:
      - aiux-accordion-group
  - rule: event_name_namespaced_with_component
    identifiers:
      - accordion-group:item-toggle
      - accordion-item-clicked
---

# @servicenow/aiux-components-accordion

## Import

```js
import '@servicenow/aiux-components-accordion';
```


Flexible accordion/collapse component with single or multiple item expansion, customizable icons, and comprehensive accessibility support. Built with Lit and styled with DaisyUI.

## Usage

```html
<!-- Basic accordion with single selection mode (default) -->
<aiux-accordion-group id="myAccordion"></aiux-accordion-group>

<script>
  const accordion = document.getElementById('myAccordion');
  accordion.items = [
    {
      title: 'How do I create an account?',
      content: 'Click the "Sign Up" button and follow the registration process.',
      open: true,
    },
    {
      title: 'I forgot my password. What should I do?',
      content: 'Click on "Forgot Password" on the login page.',
    },
    {
      title: 'How do I update my profile?',
      content: 'Go to "My Account" settings and select "Edit Profile".',
    },
  ];
</script>
```

### Lit Usage

```js
html`
  <aiux-accordion-group
    id="settings-accordion"
    .items=${this.items}
    icon="arrow"
    bordered
  ></aiux-accordion-group>
`;
```

Set a unique `id` when rendering multiple accordions so generated ARIA trigger and panel IDs remain unique.

### Multiple Selection Mode

```html
<aiux-accordion-group id="help" multiple icon="arrow" bordered></aiux-accordion-group>

<script>
  document.getElementById('help').items = [
    { title: 'Getting Started', content: 'Learn the basics...', open: true },
    { title: 'Advanced Features', content: 'Discover powerful features...', open: true },
    { title: 'Troubleshooting', content: 'Find solutions...' },
  ];
</script>
```

### Using Slots

Each accordion item supports named slots for custom HTML. The component has no default unnamed slot; project custom content through `title-{index}` and `content-{index}`.

```html
<aiux-accordion-group id="customAccordion">
  <!-- Custom title for item 0 -->
  <span slot="title-0"><strong>Custom</strong> styled title</span>

  <!-- Custom content for item 0 -->
  <div slot="content-0">
    <p>This is <strong>custom HTML content</strong>!</p>
    <button class="aiux-btn aiux-btn-sm">Action Button</button>
  </div>
</aiux-accordion-group>

<script>
  document.getElementById('customAccordion').items = [
    { title: 'Default Title', content: 'Default content', open: true },
    { title: 'Second Item', content: 'This will be replaced' },
  ];
</script>
```

## Properties

| Property       | Attribute       | Type                    | Default | Description                                                                                  |
| -------------- | --------------- | ----------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `items`        | `items`         | `AccordionItem[]`       | `[]`    | Array of accordion items. Use Lit property binding (`.items=${...}`) or JS property assignment |
| `multiple`     | `multiple`      | `boolean`               | `false` | Allow multiple items to be open simultaneously                                                |
| `icon`         | `icon`          | `'arrow' \| 'plus' \| ''` | `''`    | Icon type. Any other value renders no indicator icon                                          |
| `bordered`     | `bordered`      | `boolean`               | `false` | Add borders and distinct backgrounds to items                                                 |
| `headingLevel` | `heading-level` | `number`                | `2`     | ARIA heading level for accordion headers. Values are clamped to 1 through 6                  |

### Item Object Structure

Each item in the `items` array should have:

| Property   | Type    | Required | Description                                                      |
| ---------- | ------- | -------- | ---------------------------------------------------------------- |
| `title`    | String  | Yes      | The title/header of the accordion item                           |
| `content`  | String  | Yes      | The content shown when item is expanded                          |
| `open`     | Boolean | No       | Whether the item is initially open (default: `false`)            |
| `disabled` | Boolean | No       | Disables the header button, prevents toggling, and excludes the item from arrow/Home/End navigation (default: `false`) |

## Behavior notes

- Initial open state is read from each item's `open` value. In single-selection mode (`multiple=false`), ensure at most one item has `open: true` in the initial `items` array if only one panel should start open.
- Single-selection mode is enforced when the user toggles an item: opening one item closes the others.

## Events

### `accordion-group:item-toggle`

Fired when an accordion item is opened or closed. The event bubbles and crosses the shadow DOM boundary.

**Event Detail:**

```typescript
interface AccordionGroupItemToggleDetail {
  index: number; // The index of the item that changed
  title: string; // The title of the item
  open: boolean; // Whether the item is now open or closed
}
```

**Example:**

```javascript
accordion.addEventListener('accordion-group:item-toggle', (e) => {
  console.log(`Item "${e.detail.title}" is now ${e.detail.open ? 'open' : 'closed'}`);
});
```

### `accordion-item-clicked` (deprecated)

Fired when an accordion item is clicked. This event is provided for backward compatibility with AP4 and dispatches the same detail as `accordion-group:item-toggle`. New consumers should use `accordion-group:item-toggle` instead.

**Event Detail:**

```typescript
interface AccordionItemClickedDetail {
  index: number; // The index of the item that was clicked
  title: string; // The title of the item
  open: boolean; // Whether the item is now open or closed
}
```

**Example:**

```javascript
// Legacy AP4 pattern - prefer accordion-group:item-toggle for new code
accordion.addEventListener('accordion-item-clicked', (e) => {
  console.log(`Item ${e.detail.index} clicked`);
});
```

## File Structure

```
src/
├── accordion-group.ts                # Component class (AIUXElement)
├── index.ts                           # Public entry point (re-exports)
├── types/
│   └── accordion-group.types.ts       # TypeScript types and interfaces
└── stories/
    └── accordion-group.stories.ts     # Storybook stories
```

## Accessibility

The component implements the [ARIA Accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) (WCAG 2.2 Level A/AA).

### ARIA attributes

- Each header is wrapped in `<div role="heading" aria-level>` with a configurable level (default 2) via the `heading-level` attribute
- Each trigger button carries:
  - `aria-expanded="true|false"` to reflect the open/collapsed state
  - `aria-controls` to reference the associated panel ID
- Each panel carries:
  - `role="region"` to expose it as a landmark region
  - `aria-labelledby` to reference the trigger ID
  - `inert` attribute when collapsed to remove it from the accessibility tree

### Keyboard interaction

| Key           | Behavior                                                       |
| ------------- | -------------------------------------------------------------- |
| Tab           | Move focus to the next focusable element                       |
| Shift+Tab     | Move focus to the previous focusable element                   |
| Enter / Space | Toggle the focused header (native button)                      |
| Arrow Down    | Move focus to the next non-disabled header (wraps to first)    |
| Arrow Up      | Move focus to the previous non-disabled header (wraps to last) |
| Home          | Move focus to the first non-disabled header                    |
| End           | Move focus to the last non-disabled header                     |

Disabled items are excluded from arrow/Home/End navigation.

### Focus ring

A visible focus ring appears on the collapse container during keyboard navigation only (via `:has(.accordion-header-btn:focus-visible)`). Mouse clicks do not trigger the ring.

### Reduced motion

Collapse expand/collapse transitions are suppressed when the user's reduced-motion preference is enabled (WCAG 2.3.3).

## Exports

- `AccordionGroup` — The component class
- `AccordionItem` — Type definition for accordion items
- `AccordionGroupItemToggleDetail` — Type definition for the item-toggle event detail

## Installation

This package is published to the internal ServiceNow Nexus registry.

```bash
pnpm add @servicenow/aiux-components-accordion
```

## Browser Support

Works in all modern browsers that support:

- Web Components (Custom Elements)
- ES6 JavaScript
- CSS Grid and Flexbox
