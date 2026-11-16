---
argus-naming-exceptions:
  - rule: package_name_aiux_sn_prefix
    identifiers:
      - '@servicenow/aiux-components-alert'
  - rule: aiux_prefix_for_custom_elements
    identifiers:
      - aiux-alert-message
  - rule: event_name_namespaced_with_component
    identifiers:
      - alert-dismiss
---

# @servicenow/aiux-components-alert

## Import

```js
import '@servicenow/aiux-components-alert';
```


A typed notification alert (info, success, warning, error, and Horizon severity variants) with an optional title, message, dismiss button, and an auto-dismiss timer that can be paused, resumed, and shows a progress bar. Built with Lit 3 and SSR-compatible.

## Usage

```html
<aiux-alert-message
  type="success"
  alert-title="Saved"
  message="Your changes have been saved."
  dismissible
></aiux-alert-message>
```

Auto-dismiss example:

```html
<aiux-alert-message
  type="info"
  alert-title="Notification"
  message="This will dismiss in 5 seconds."
  dismissible
  duration="5000"
></aiux-alert-message>
```

Slotted action example:

```html
<aiux-alert-message
  type="warning"
  alert-title="Connection issue"
  message="Some updates may not be saved."
  dismissible
>
  <button class="aiux-btn aiux-btn-sm">Retry</button>
</aiux-alert-message>
```

## Properties

| Property            | Attribute            | Type      | Default  | Description                                                                                                                                                                                                               |
| ------------------- | -------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`              | `type`               | `string`  | `'info'` | Alert type: `'info'`, `'success'`, `'warning'`, `'error'`, `'primary'`, `'accent'`, or Horizon severity types (`'critical'`, `'high'`, `'moderate'`, `'positive'`, `'low'`, `'ai'`). Unknown values fall back to `'info'` |
| `alertTitle`        | `alert-title`        | `string`  | `''`     | Optional title text displayed above the message                                                                                                                                                                           |
| `message`           | `message`            | `string`  | `''`     | Alert message text                                                                                                                                                                                                        |
| `dismissible`       | `dismissible`        | `boolean` | `false`  | Whether the alert can be manually dismissed. Also required for the auto-dismiss timer, pause/resume button, and progress bar                                                                                              |
| `icon`              | `icon`               | `string`  | `''`     | Custom icon name (overrides the default type icon)                                                                                                                                                                        |
| `duration`          | `duration`           | `number`  | `0`      | Auto-dismiss duration in milliseconds; `0` disables auto-dismiss. Only takes effect when `dismissible` is `true`                                                                                                          |
| `resetKey`          | `reset-key`          | `number`  | `0`      | Increment to restart the timer, clear pause state, and re-show if dismissed (for coalesced notifications)                                                                                                                 |
| `autofocusControls` | `autofocus-controls` | `boolean` | `true`   | Move focus to the first interactive element on render (pause button or slotted button); set to `false` for ambient alerts (toasts, sidebars)                                                                              |

## Events

All events bubble and are composed.

| Event           | Detail             | Description                                                |
| --------------- | ------------------ | ---------------------------------------------------------- |
| `alert-dismiss` | `{ type: string }` | Fired when the alert is dismissed (manually or by timeout) |

## Methods

| Method      | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `dismiss()` | Programmatically dismisses the alert and fires the `alert-dismiss` event |

## Slots

| Slot      | Description                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| (default) | Custom content rendered below the title/message (e.g. action buttons or links inside the alert) |

## CSS Parts

| Part             | Description                |
| ---------------- | -------------------------- |
| `alert`          | The alert container        |
| `content`        | The alert content area     |
| `dismiss-button` | The dismiss (close) button |

## File Structure

```
src/
├── alert-message.ts              # Component class (AIUXElement)
├── index.ts                      # Public entry point (re-exports)
├── types/
│   └── alert-message.types.ts    # TypeScript types, alert config, constants
└── stories/
    └── alert-message.stories.ts  # Storybook stories
```

## Accessibility

- **Live regions:** An `aria-live="assertive"` region announces the alert type, title, message, and available actions to screen readers on render
- **Pause/resume control:** The pause button dynamically announces `aria-label` based on state ('Pause auto-dismiss' / 'Resume auto-dismiss')
- **Progress bar:** A hidden `role="progressbar"` with `aria-valuenow` updates every second while the timer runs, for screen-reader announcements of remaining time
- **Focus management:** When `autofocusControls` is `true` (default), focus moves to the first interactive element (slotted button if present, otherwise pause or close button)
- **Icon accessibility:** Type indicator icons have `aria-hidden="true"`; button icons are also hidden from the accessibility tree

## Localization

All user-facing strings are wrapped with `msg()` and `str` from
[`@lit/localize`](https://lit.dev/docs/localization/overview/), making the
component ready for the Karuna translation pipeline:

- `'Close alert'` — dismiss button label
- `'Pause auto-dismiss'` / `'Resume auto-dismiss'` — pause button labels
- `'Auto-dismiss timer'` — progress bar label
- `'Auto-dismiss paused'` / `'Auto-dismiss resumed'` — live region announcements

## Exports

The package entry point (`index.ts`) re-exports:

```typescript
import {
  Alert,
  ALERT_CONFIG,
  DEFAULT_TYPE,
  type AlertType,
  type AlertDismissDetail,
} from '@servicenow/aiux-components-alert';
```

- **`Alert`:** The component class
- **`ALERT_CONFIG`:** Object mapping alert types to their icon names
- **`DEFAULT_TYPE`:** The default alert type (`'info'`)
- **`AlertType`:** TypeScript union of all valid alert types
- **`AlertDismissDetail`:** Shape of the `alert-dismiss` event detail

## Caveats

- **Auto-dismiss requires dismissible.** The timer only starts if both `dismissible` and `duration > 0` are set.
- **resetKey must change.** Setting `resetKey` to the same value does not trigger a reset; only a change (old value !== new value) restarts the timer.
- **Pause/resume buttons only visible when duration > 0.** If `duration` is `0` or missing, the pause/resume button is not rendered.
- **Icon directive limitation.** The icon is rendered via the `icon()` directive from `@servicenow/aiux-directive-icon`, which requires the platform sprite system at runtime. Custom icons must match icon names in the sprite.

## SSR Behavior

`render()` is deterministic — it produces the same output given the same props on server and client. No dynamic values are computed in the render path.

This follows Karuna SSR rules:

- **Rule 2** (no browser APIs in render) — no `window`, `document`, or `Date` in `render()`
- **Rule 3** (deterministic render) — no `Math.random()`, `Date.now()`, or other non-deterministic values
- **Rule 4** (pure constructor) — only default values set; timers start in `connectedCallback()`
