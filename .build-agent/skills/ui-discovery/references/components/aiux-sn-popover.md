# @servicenow/aiux-sn-popover

## Import

```js
import '@servicenow/aiux-sn-popover';
```


`<aiux-sn-popover>` is a floating panel anchored to a trigger element. It supports auto-flip placement, four keyboard interaction modes, focus trapping, sizing constraints, and full ARIA customisation — a feature-complete equivalent of `now-popover`.

---

## Installation

Import the component once in your application entry point:

```js
import '@servicenow/aiux-sn-popover';
```

The custom element `<aiux-sn-popover>` is then available everywhere in the document.

---

## Quick start

```html
<aiux-sn-popover placement="bottom" heading="Filter options">
  <button slot="trigger">Open filters</button>
  <div slot="content">
    <label><input type="checkbox" /> Show archived items</label>
    <label><input type="checkbox" /> Show draft items</label>
  </div>
</aiux-sn-popover>
```

Click the trigger to open the panel. Press **Escape** or click outside to close.

---

## Slots

| Slot      | Description                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------- |
| `trigger` | Toggles the popover. Stays in the shadow DOM for accurate position measurement. Typically a `<button>`. |
| `content` | Content rendered inside the panel. Physically hoisted into a portal on open and returned on close.      |

---

## Properties

| Property              | Attribute                | Type                                         | Default    | Description                                                                                                                                                                                                          |
| --------------------- | ------------------------ | -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opened`              | `opened`                 | `boolean`                                    | `false`    | Whether the panel is visible. Reflects as an attribute.                                                                                                                                                              |
| `placement`           | `placement`              | `Placement` (see below)                      | `'bottom'` | Preferred placement for the panel. Supports 12 values: 4 sides × 3 alignments (start / center / end), plus physical left/right/top/bottom aliases. When `flip` is enabled (the default), flips automatically when viewport space is tight. RTL-aware: `start` and `end` swap in RTL. |
| `heading`             | `heading`                | `string`                                     | `''`       | Optional header text. When non-empty, renders a title row with the text and a labelled close button. The panel is auto-labelled via `aria-labelledby`.                                                               |
| `closeOnEscape`       | `close-on-escape`        | `boolean`                                    | `true`     | Close when Escape is pressed. To disable, use a **property binding** — see [Boolean prop gotcha](#boolean-prop-gotcha).                                                                                              |
| `closeOnOutsideClick` | `close-on-outside-click` | `boolean`                                    | `true`     | Close when a `mousedown` occurs outside the host element and panel.                                                                                                                                                  |
| `offset`              | `offset`                 | `number`                                     | `8`        | Gap in pixels between the trigger edge and the near edge of the panel.                                                                                                                                               |
| `interactionType`     | `interaction-type`       | `'dialog' \| 'none' \| 'listbox' \| 'combo'` | `'dialog'` | Focus management and Tab-key dismiss behaviour. See [Interaction types](#interaction-types).                                                                                                                         |
| `focusPanel`          | `focus-panel`            | `boolean`                                    | `false`    | Move focus to the panel container on open. Useful when `interactionType` is not `'dialog'` so screen readers still enter the panel.                                                                                  |
| `bare`                | `bare`                   | `boolean`                                    | `false`    | Remove border, shadow, background, and content padding from the panel container. Use when slotted content provides its own visual container.                                                                         |
| `noPadding`           | `no-padding`             | `boolean`                                    | `false`    | Remove the default content padding while keeping border, shadow, and background. Use for edge-to-edge content (e.g. menus, list selectors).                                                                          |
| `flip`                | `flip`                   | `boolean`                                    | `true`     | Automatically flip the panel to the opposite side when viewport space is tight. Set to `false` to pin the panel to the requested `placement` side.                                                                   |
| `arrow`               | `arrow`                  | `boolean`                                    | `false`    | Render a caret on the panel edge facing the trigger. Updates direction automatically when the panel flips. No effect when `bare` is `true`.                                                                          |
| `disableScroll`       | `disable-scroll`         | `boolean`                                    | `false`    | Disable scrolling inside the content area (`overflow: hidden`).                                                                                                                                                      |
| `constrain`           | —                        | `Constrain \| null`                          | `null`     | Sizing constraints for the panel. **Property binding only.** See [Constrain](#constrain).                                                                                                                            |
| `configAria`          | —                        | `ConfigAria`                                 | `{}`       | ARIA attribute overrides for the panel container. **Property binding only.** See [ARIA customisation](#aria-customisation).                                                                                          |
| `positionTarget`      | —                        | `HTMLElement \| null`                        | `null`     | Alternative element used as the position anchor instead of the trigger slot. **Property binding only.**                                                                                                              |
| `container`           | —                        | `HTMLElement \| null`                        | `null`     | DOM node the panel portal is appended to. Defaults to `document.body`. **Property binding only.**                                                                                                                    |

### Placement values

12 placements: 4 sides × 3 cross-axis alignments. Each alignment can be requested as a
**logical** (`start` / `end`) or **physical** (`left` / `right` / `top` / `bottom`) value.

| Side     | Logical start  | Physical alias | Center (default) | Physical alias | Logical end  |
| -------- | -------------- | -------------- | ----------------- | -------------- | ------------ |
| `bottom` | `bottom-start` | `bottom-right` | `bottom`          | `bottom-left`  | `bottom-end` |
| `top`    | `top-start`    | `top-right`    | `top`             | `top-left`     | `top-end`    |
| `left`   | `left-start`   | `left-top`     | `left`            | `left-bottom`  | `left-end`   |
| `right`  | `right-start`  | `right-top`    | `right`           | `right-bottom` | `right-end`  |

- **`start`** aligns the panel's leading edge to the trigger's leading edge (left in LTR).
- **`end`** aligns the panel's trailing edge to the trigger's trailing edge (right in LTR).
- **RTL-aware:** the logical `start`/`end` forms swap automatically when `document.documentElement.dir === 'rtl'`, so the panel keeps the same reading-order relationship to the trigger. The physical aliases (`left`, `right`, `top`, `bottom`) describe a literal visual position and are **not** affected by writing direction — `bottom-right` always opens to the right, even in RTL. Prefer the logical forms unless a literal physical position is genuinely required regardless of locale.
- **Flip:** when `flip` is enabled (the default), the panel flips to the opposite side when viewport space is tight, preserving the alignment (e.g. `bottom-end` → `top-end`). Set `flip="false"` (or `.flip=${false}`) to disable this behaviour and always use the requested side.

---

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property              | Type      | Label          | Default     | Description                                                                                          |
| --------------------- | --------- | -------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `configPlacement`     | `String`  | Placement      | `undefined` | Overrides `placement`: where the panel appears relative to the trigger.                              |
| `configHeading`       | `String`  | Heading        | `undefined` | Overrides `heading`: optional title shown in the panel header alongside a close button.              |
| `configOffset`        | `Number`  | Offset         | `undefined` | Overrides `offset`: space (in px) between the trigger and the panel edge.                            |
| `configBare`          | `Boolean` | Bare           | `undefined` | Overrides `bare`: renders the panel without border, shadow, or background styles.                    |
| `configNoPadding`     | `Boolean` | No Padding     | `undefined` | Overrides `noPadding`: removes default content padding while keeping border, shadow, and background. |
| `configDisableScroll` | `Boolean` | Disable Scroll | `undefined` | Overrides `disableScroll`: the panel content area does not scroll.                                   |
| `configArrow`         | `Boolean` | Arrow          | `undefined` | Overrides `arrow`: shows a small arrow on the panel edge pointing toward the trigger.                |

---

## Events

| Event                           | Detail                                                                                                    | Cancelable | Description                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiux-sn-popover:open-request`  | —                                                                                                         | Yes        | Fired before the panel opens. Call `preventDefault()` to control the `opened` property externally (controlled mode).                                |
| `aiux-sn-popover:close-request` | `{ actionSource: CloseActionSource }`                                                                     | Yes        | Fired before the panel closes. Call `preventDefault()` to control the `opened` property externally (controlled mode).                               |
| `aiux-sn-popover:opened`        | `{ placement: string }`                                                                                   | No         | Fired after the panel is positioned and visible. `placement` reflects the resolved side, which may differ from the requested value after auto-flip. |
| `aiux-sn-popover:closed`        | `{ actionSource: 'outside-click' \| 'trigger-click' \| 'escape-press' \| 'close-button' \| 'tab-press' }` | No         | Fired after the panel is removed. `actionSource` identifies what triggered the close gesture.                                                       |

All events bubble and are composed.

```js
el.addEventListener('aiux-sn-popover:opened', (e) => {
  console.log('opened on side:', e.detail.placement);
});

el.addEventListener('aiux-sn-popover:closed', (e) => {
  console.log('closed by:', e.detail.actionSource);
  // 'outside-click' | 'trigger-click' | 'escape-press' | 'close-button' | 'tab-press'
});
```

### Controlled mode

Use the cancelable `open-request` and `close-request` events to control the `opened` property externally. This is useful when you need to validate or prevent open/close actions:

```js
const popover = document.querySelector('aiux-sn-popover');

// Prevent opening unless a condition is met
popover.addEventListener('aiux-sn-popover:open-request', (e) => {
  if (!userIsAuthenticated()) {
    e.preventDefault(); // Block the open
    showLoginDialog();
  }
});

// Prevent closing for certain action sources
popover.addEventListener('aiux-sn-popover:close-request', (e) => {
  if (e.detail.actionSource === 'outside-click' && formHasUnsavedChanges()) {
    e.preventDefault(); // Block the close
    confirmDiscard().then((confirmed) => {
      if (confirmed) popover.opened = false; // Manually close
    });
  }
});
```

When you call `preventDefault()` on either request event, the component will **not** update its `opened` property. You must manage the `opened` state yourself by setting `popover.opened = true` or `popover.opened = false` when appropriate.

> **Note:** Calling `preventDefault()` on these events will also block the `show()` and `hide()` methods, since they dispatch the same cancelable events. See [Methods](#methods) for details on how to force state changes when needed.

---

## Methods

| Method   | Description                        |
| -------- | ---------------------------------- |
| `show()` | Opens the panel programmatically.  |
| `hide()` | Closes the panel programmatically. |

```js
const popover = document.querySelector('aiux-sn-popover');

// Open from code — trigger click is not needed
popover.show();

// Close from code — fires 'aiux-sn-popover:closed' with actionSource: undefined
popover.hide();
```

> **⚠️ Important:** `show()` and `hide()` dispatch **cancelable** events (`aiux-sn-popover:open-request` and `aiux-sn-popover:close-request`). If any ancestor listener calls `preventDefault()` on these events, the methods will have **no effect** — the panel will not open or close.
>
> **To guarantee state changes** (bypassing the cancelable open/close-request events), set the `opened` property directly:
>
> ```js
> // Force open — always works, bypasses cancelable request events
> popover.opened = true;
>
> // Force close — always works, bypasses cancelable request events
> popover.opened = false;
> ```
>
> Use `show()`/`hide()` when you want to respect controlled mode and allow parent components to intercept the request. Use direct property assignment when you need guaranteed state changes regardless of listeners.

---

## Interaction types

`interactionType` controls focus management and keyboard dismiss behaviour inside the panel.

| Value                  | Focus trap | Tab behaviour                                                                                          | Recommended for                                          |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `'dialog'` _(default)_ | Yes        | Cycles within the panel; cannot leave                                                                  | Forms, rich dialogs, any modal content                   |
| `'none'`               | No         | Immediately closes the panel                                                                           | Tooltip-style panels with little or no focusable content |
| `'listbox'`            | No         | Tab **or** Shift+Tab closes the panel. Arrow keys (Up/Down/Home/End) navigate between focusable items. | Option lists, menus, listboxes                           |
| `'combo'`              | No         | Closes only when focus is currently inside the panel                                                   | Comboboxes, autocompletes                                |

Escape always closes (unless `closeOnEscape` is disabled).

```html
<!-- Combobox pattern — Tab exits only when typing inside the input -->
<aiux-sn-popover interaction-type="combo" focus-panel>
  <input slot="trigger" type="text" placeholder="Search…" />
  <ul slot="content" role="listbox">
    …
  </ul>
</aiux-sn-popover>
```

---

## Constrain

Limit the panel's dimensions via the `constrain` property. The special value `'target'` resolves to the trigger element's corresponding dimension, measured at open time. If the trigger resizes while the panel is open, call `hide()` then `show()` to recalculate.

```js
// Panel is at least as wide as the trigger, capped at 400 px wide, scrolls after 300 px tall
popover.constrain = { minWidth: 'target', maxWidth: 400, maxHeight: 300 };
```

In a Lit template:

```html
<aiux-sn-popover .constrain=${{ minWidth: 'target', maxHeight: 300 }}>
  …
</aiux-sn-popover>
```

```ts
interface Constrain {
  width?: number | 'target';
  minWidth?: number | 'target';
  maxWidth?: number | 'target';
  height?: number | 'target';
  minHeight?: number | 'target';
  maxHeight?: number | 'target';
}
```

When a height constraint is applied the content area scrolls automatically (`overflow: auto`). Combine with `disable-scroll` to clip instead of scroll.

---

## ARIA customisation

Override the panel container's role and ARIA attributes via `configAria`:

```js
popover.configAria = {
  panel: {
    role: 'listbox',
    'aria-label': 'Color options',
  },
};

// Localise the close button label (i18n)
popover.configAria = {
  closeButton: { 'aria-label': 'Fermer' },
};
```

```ts
interface ConfigAria {
  panel?: {
    role?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
  };
  closeButton?: {
    /** Accessible label for the × close button in the panel header. Defaults to 'Close'. */
    'aria-label'?: string;
  };
}
```

**Defaults when `configAria` is not set:**

- `role="dialog"` with `aria-modal="true"`
- When `heading` is set: labelled via `aria-labelledby` pointing to the heading element
- When no heading: `aria-label="Popover"`

**`configAria.panel.role` also updates `aria-haspopup`:** When you override the panel role, the trigger's `aria-haspopup` attribute is automatically updated to match, keeping the ARIA tree consistent:

```js
// Trigger will announce: "button, has popup listbox"
popover.configAria = { panel: { role: 'listbox', 'aria-label': 'Select country' } };
// → trigger gets aria-haspopup="listbox"
// → panel gets role="listbox"
```

---

## Boolean prop gotcha

HTML attribute presence is truthy **regardless of the value string**. To set a boolean property to `false`, always use a **property binding**, not an attribute:

```html
<!-- Correct — property binding evaluates to the boolean false -->
<aiux-sn-popover .closeOnEscape="${false}"></aiux-sn-popover>

<!-- Wrong — the string "false" is still truthy (attribute is present) -->
<aiux-sn-popover close-on-escape="false"></aiux-sn-popover>
```

This applies to `closeOnEscape`, `closeOnOutsideClick`, and any boolean property you need to set to `false`.

---

## Accessibility

- The panel has `role="dialog"` and `aria-modal="true"` by default (overridable via `configAria`).
- The trigger element receives `aria-expanded`, `aria-haspopup` (dynamically set to match the panel's actual rendered role), and `aria-controls` pointing to the panel when open.
- When `heading` is set the panel is labelled via `aria-labelledby`; otherwise `aria-label="Popover"` is used as a generic fallback.
- `interactionType="dialog"` activates a focus trap so keyboard-only users cannot leave the panel accidentally.
- `interactionType="listbox"` moves focus into the panel on open and enables arrow key navigation (ArrowUp, ArrowDown, Home, End) between focusable items (`[role="option"]`, `[role="menuitem"]`, `button`, `a[href]`, `[tabindex]`).
- **Focus restore on close:** When the panel is closed via Escape, Tab, Shift+Tab, or the close button, focus is returned to the trigger element. Focus is _not_ returned for outside-click (user intentionally clicked elsewhere) or trigger-click (focus is already on the trigger).
- The arrow caret carries `aria-hidden="true"` and is invisible to assistive technology.

> **Warning — WCAG 2.1 SC 4.1.2 (Name, Role, Value):** The fallback `aria-label="Popover"` is a generic label that describes the widget type, not its purpose. Screen readers will announce _"Popover dialog"_ with no context about what the panel contains. Always provide a meaningful accessible name by setting either:
>
> - `heading="…"` — renders a visible title and auto-labels the panel via `aria-labelledby`, or
> - `.configAria=${{ panel: { 'aria-label': '…' } }}` — sets a descriptive `aria-label` directly on the panel container.
>
> The generic fallback exists only to prevent a nameless dialog (which would be a harder WCAG violation). It should never appear in production without a contextual replacement.

---

## Known limitations

### Outside-click detection does not support closed shadow roots

Outside-click detection uses `composedPath()`, which correctly pierces all **open** shadow DOM boundaries regardless of nesting depth. The one unsupported case is when `<aiux-sn-popover>` is embedded inside a **closed** shadow root (`attachShadow({mode: 'closed'})`): the browser retargets the event path at that boundary, causing `path.includes(host)` to return `false` for clicks on the trigger — which incorrectly fires an outside-click close. Closed shadow DOM is strongly discouraged in the web components ecosystem and is incompatible with Lit; this is not a realistic concern in practice.

### Flip logic uses a heuristic threshold, not actual panel dimensions

The placement flip algorithm uses a `FLIP_THRESHOLD` (200 px) heuristic to decide when to flip to the opposite side. It compares available space on both sides and flips when the preferred side has less than 200 px _and_ the opposite side has more room. This works well for most panel sizes but may not be optimal for very small or very large panels. Set `flip` to `false` to disable auto-flip entirely and lock the panel to the requested side.

Viewport overflow is prevented by CSS `max-width` and `max-height` guards that clamp the panel to the available space on all four edges, ensuring the panel never extends beyond the viewport boundary.
