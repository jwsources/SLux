---
argus-naming-exceptions:
  - rule: package_name_aiux_sn_prefix
    identifiers:
      - '@servicenow/aiux-components-dialog'
  - rule: aiux_prefix_for_custom_elements
    identifiers:
      - aiux-dialog
  - rule: event_name_namespaced_with_component
    identifiers:
      - aiux-dialog-open
      - aiux-dialog-close
      - aix-dialog-close
      - aiux-dialog-close-request
---
# @servicenow/aiux-components-dialog

## Import

```js
import '@servicenow/aiux-components-dialog';
```


Modal and modeless dialog component for the Karuna AIUX platform.

## Installation

```bash
pnpm add @servicenow/aiux-components-dialog
```

## Usage

```javascript
import '@servicenow/aiux-components-dialog';
```

```js
html`
  <aiux-dialog
    ?open=${this.showDialog}
    @aiux-dialog-close=${() => {
      this.showDialog = false;
    }}
  >
    <div slot="header">Dialog Title</div>
    <p>Dialog content goes here</p>
    <div slot="footer">
      <button
        class="aiux-btn aiux-btn-primary"
        @click=${() => {
          this.showDialog = false;
        }}
      >
        OK
      </button>
    </div>
  </aiux-dialog>
`;
```

## Properties

| Property               | Type      | Default | Attribute                 | Description                                                        |
| ---------------------- | --------- | ------- | ------------------------- | ------------------------------------------------------------------ |
| `open`                 | `Boolean` | `false` | `open`                    | Whether the dialog is visible                                      |
| `showCloseButton`      | `Boolean` | `true`  | `show-close-button`       | Show the close (x) button                                          |
| `closeOnEscape`        | `Boolean` | `true`  | `close-on-escape`         | Close on Escape key                                                |
| `closeOnBackdropClick` | `Boolean` | `true`  | `close-on-backdrop-click` | Close when clicking the backdrop                                   |
| `preventScroll`        | `Boolean` | `true`  | `prevent-scroll`          | Prevent body scroll while open (auto-disabled for modeless)        |
| `resizable`            | `Boolean` | `false` | `resizable`               | Allow drag-to-resize                                               |
| `isModal`              | `Boolean` | `true`  | `is-modal`                | Modal (backdrop + focus trap) vs modeless (draggable, no backdrop) |
| `size`                 | `String`  | `'md'`  | `size`                    | Preset width: `sm`, `md`, `lg`, `xl`, `fullscreen`                 |
| `customSize`           | `Object`  | `null`  | `custom-size`             | Exact dimensions: `{ width, height }` (any CSS value)              |
| `hidePadding`          | `Boolean` | `false` | `hide-padding`            | Remove padding from header, body, and footer                       |
| `dialogLabel`          | `String`  | `''`    | `dialog-label`            | Accessible name (aria-label) when no header slot is provided       |

For Boolean properties that default to `true`, such as `showCloseButton`, `closeOnEscape`, `closeOnBackdropClick`, `preventScroll`, and `isModal`, set `false` with JavaScript property assignment or Lit property binding.

`hidePadding` only removes the dialog's own header/body/footer padding. It does not adjust the layout of slotted content — `::slotted()` cannot reach past direct slot children, so if your slotted content also needs padding or layout adjustments to look right with `hide-padding`, style that content yourself (either in the light DOM or by injecting a `<style>` into your own component's shadow root).

## Slots

| Slot      | Description                    |
| --------- | ------------------------------ |
| (default) | Dialog body content            |
| `header`  | Dialog header / title content  |
| `footer`  | Dialog footer / action buttons |

## Events

Events bubble and cross the shadow DOM boundary.

| Event                       | Cancelable | Description                                                                    |
| --------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `aiux-dialog-open`          | No         | Fired when the dialog opens                                                    |
| `aiux-dialog-close`         | No         | Fired when the dialog closes                                                   |
| `aix-dialog-close`          | No         | Legacy alias also fired when the dialog closes                                 |
| `aiux-dialog-close-request` | Yes        | Fired when close is requested; call `preventDefault()` to keep the dialog open |

```javascript
dialog.addEventListener('aiux-dialog-close-request', e => {
  if (hasUnsavedChanges) {
    e.preventDefault(); // keep dialog open
  }
});
```

## Controlled vs Uncontrolled

The dialog supports both usage patterns:

**Uncontrolled (default):** The dialog manages its own `open` state. When the user clicks the backdrop, presses Escape, or clicks the close button, the dialog sets `open = false` internally after dispatching a cancelable `aiux-dialog-close-request` event.

```js
html`<aiux-dialog ?open=${this.show}>
  <p>Closes itself unless you preventDefault</p>
</aiux-dialog>`;
```

**Controlled:** Prevent the default close behavior and manage `open` from the parent. This is useful when you need confirmation before closing (e.g. unsaved changes).

```js
html`<aiux-dialog
  ?open=${this.show}
  @aiux-dialog-close-request=${e => {
    e.preventDefault();
    if (this._canClose()) this.show = false;
  }}
>
  <p>Parent decides when to close</p>
</aiux-dialog>`;
```

## Modeless (Draggable) Dialog

Set `is-modal` to `false` for a draggable, non-blocking dialog without a backdrop. The header acts as the drag handle.

```html
<aiux-dialog ?open="${this.show}" .isModal="${false}" size="md">
  <div slot="header">Draggable Panel</div>
  <p>Background remains interactive</p>
</aiux-dialog>
```

## Custom Size

```html
<aiux-dialog
  ?open=${this.show}
  .customSize=${{ width: '800px', height: '600px' }}
>
  <div slot="header">Custom Sized</div>
  <p>Overrides the size attribute</p>
</aiux-dialog>
```

## Accessibility

- `role="dialog"` with `aria-modal` on the dialog container
- `aria-labelledby` linked to the header slot; `aria-label` fallback via `dialogLabel`
- Focus trap cycles Tab/Shift+Tab within the dialog (modal mode), traversing nested shadow DOMs
- Focus moves into the dialog on open and restores to the trigger on close
- Popover API integration for top-layer promotion

## Reduced Motion

The `@reducedMotionAware` decorator respects `prefers-reduced-motion`. Scale+fade enter/exit animations are replaced with a simple fade when reduced motion is active.

## Dialog Stacking

Multiple open dialogs are managed by a shared stack. Only the topmost modal dialog is visible; each dialog receives an incremented z-index. Closing the top dialog reveals the one below.

## Tag Name

The canonical custom element tag is `aiux-dialog`.

## Dependencies

- `@servicenow/aiux-components-core` (workspace)
- `@servicenow/aiux-controller-focus` (workspace) — powers the dialog's Tab/Shift+Tab focus trap and previous-focus restore
- `@servicenow/aiux-directive-icon` (workspace)
- `lit` (peer)
- `@lit/localize` (peer)
