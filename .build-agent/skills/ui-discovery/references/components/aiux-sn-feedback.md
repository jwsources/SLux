---
argus-naming-exceptions:
  - rule: event_name_namespaced_with_component
    identifiers:
      - feedback-clicked
      - granular-feedback-submit-clicked
---

# @servicenow/aiux-sn-feedback

## Import

```js
import '@servicenow/aiux-sn-feedback';
```


Thumbs up/down feedback widget with an optional granular feedback form (checklist, radio buttons, textarea). Built with Lit 3, fully SSR-compatible.

## Installation

```js
import '@servicenow/aiux-sn-feedback';
```

## Storybook

Feedback stories are available from the repo root:

```bash
pnpm storybook
```

The Storybook examples cover thumbs-only feedback, granular feedback, preselected states, and managed-submit error handling.

## Usage

### Minimal (thumbs only)

```html
<aiux-sn-feedback></aiux-sn-feedback>
```

### With granular feedback form

```js
import { Feedback } from '@servicenow/aiux-sn-feedback';

const positiveFeedback = {
  heading: 'What did you like?',
  items: [
    {
      type: 'checklist',
      value: [
        { id: 'accurate', label: 'Accurate information', checked: false },
        { id: 'clear', label: 'Clear and easy to understand', checked: false },
      ],
    },
    { type: 'textarea', value: '', maxlength: 300 },
  ],
};

const negativeFeedback = {
  heading: 'What went wrong?',
  items: [
    {
      type: 'radio',
      value: [
        { id: 'incomplete', label: 'Incomplete answer', checked: false },
        { id: 'inaccurate', label: 'Inaccurate information', checked: false },
      ],
    },
    { type: 'textarea', value: '', maxlength: 300 },
  ],
};
```

```html
<aiux-sn-feedback
  .positiveFeedback="${positiveFeedback}"
  .negativeFeedback="${negativeFeedback}"
  @feedback-clicked="${onThumbClick}"
  @granular-feedback-submit-clicked="${onSubmit}"
></aiux-sn-feedback>
```

### Handling the submit event

```js
function onSubmit(e) {
  const {items} = e.detail;
  // items = [{ type: 'checklist', value: [...] }, { type: 'textarea', value: '...' }]
  await fetch('/api/feedback', {method: 'POST', body: JSON.stringify(items)});
}
```

## Managed submit pattern

> **Important:** By default the popover auto-closes after submit and shows a confirmation tooltip. If your app needs to **validate, show loading states, or handle errors** before closing, use the `manage-submit` attribute instead.

When `manage-submit` is set, the component hands full control of the popover lifecycle to the parent. The popover stays open after submit, and the parent closes it (or shows an error) by updating the `error` property with a **new `timestamp`**.

### When to use `manage-submit`

- The submit handler calls an async API and you want to keep the popover open until the response arrives
- You need to display a server-side validation error inside the popover
- You want to show a loading/spinner state during submission

### Basic setup

```html
<aiux-sn-feedback
  manage-submit
  .error="${{isError: false, timestamp: Date.now()}}"
  @granular-feedback-submit-clicked="${onSubmit}"
></aiux-sn-feedback>
```

### Handling success and error

```js
async function onSubmit(e) {
  try {
    await submitToApi(e.detail.items);
    // ✓ Close the popover — set isError: false with a NEW timestamp
    feedbackEl.error = { isError: false, timestamp: Date.now() };
  } catch {
    // ✗ Show error inside the popover — set isError: true with a NEW timestamp
    feedbackEl.error = { isError: true, timestamp: Date.now() };
  }
}
```

### How it works

| `error` value                          | Effect                                             |
| -------------------------------------- | -------------------------------------------------- |
| `{ isError: false, timestamp: <new> }` | Closes the popover and resets the form             |
| `{ isError: true, timestamp: <new> }`  | Keeps the popover open and shows the error message |
| Same timestamp as before               | No change (component deduplicates by timestamp)    |

> **Tip:** Always use `Date.now()` (or an incrementing counter) for the timestamp so the component detects the change.

## Properties

### `<aiux-sn-feedback>`

| Property           | Attribute       | Type                                      | Default                             | Description                                                                    |
| ------------------ | --------------- | ----------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `loadState`        | `load-state`    | `'NONE' \| 'THUMBS_UP' \| 'THUMBS_DOWN'`  | `'NONE'`                            | Pre-selects a button on initial render                                         |
| `positiveFeedback` | —               | `GranularFeedbackDetails \| null`         | `null`                              | Config for the thumbs-up popover (heading + items)                             |
| `negativeFeedback` | —               | `GranularFeedbackDetails \| null`         | `null`                              | Config for the thumbs-down popover (heading + items)                           |
| `placement`        | `placement`     | `FeedbackPlacement`                       | `'bottom'`                          | Where the popover opens relative to the trigger button                         |
| `manageSubmit`     | `manage-submit` | `boolean`                                 | `false`                             | When `true`, the parent manages popover close after submit                     |
| `error`            | —               | `{ isError: boolean, timestamp: number }` | `{ isError: false, timestamp: -1 }` | Shows/clears an error message in the form. Use a new `timestamp` to re-trigger |

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property          | Type     | Label     | Default     | Description                                                                      |
| ----------------- | -------- | --------- | ----------- | -------------------------------------------------------------------------------- |
| `configPlacement` | `String` | Placement | `undefined` | Placement of the granular feedback popover panel relative to the trigger button. |

## Events

All events bubble and are composed.

### `feedback-clicked`

Fired when a thumb button is clicked (selected or deselected).

```ts
detail: {
  button: 'THUMBS_UP' | 'THUMBS_DOWN';
  isSelected: boolean;
}
```

### `granular-feedback-submit-clicked`

Fired when the user submits the granular feedback form.

```ts
detail: {
  items: Array<{
    type: 'checklist' | 'radio' | 'textarea';
    value: ProcessedListItem[] | string;
  }>;
}
```

## Data types

```ts
interface GranularFeedbackDetails {
  heading: string;
  items: RawFeedbackItem[];
}

type RawFeedbackItem =
  | { type: 'checklist'; value: { id: string; label: string; checked?: boolean }[] }
  | { type: 'radio'; value: { id: string; label: string; checked?: boolean }[] }
  | { type: 'textarea'; value?: string; maxlength?: number };
```

## File structure

The package publishes TypeScript source only; there is no build step in this repo.

```
feedback/
├── package.json
└── src/
    ├── index.ts                          # Public exports (package entry point)
    ├── feedback.ts                       # <aiux-sn-feedback> — single registered element
    ├── renders/
    │   ├── feedback-button.render.ts     # Render helper for thumb buttons
    │   ├── feedback-popover.render.ts    # Render helper for popover panel
    │   └── feedback-form.render.ts       # Render helper for form (checklist/radio/textarea)
    ├── constants/
    │   └── feedback-constants.ts         # Labels, enums, event names
    ├── controllers/
    │   ├── FeedbackStateController.ts    # Button state, popover open/close
    │   ├── FeedbackFormController.ts     # Checklist/radio/textarea mutations
    │   └── FeedbackTooltipController.ts  # Confirmation tooltip timer
    ├── styles/
    │   └── feedback.styles.ts            # All component styles (single shadow DOM)
    ├── types/
    │   └── feedback.types.ts             # All TypeScript interfaces
    └── utils/
        └── feedback-helpers.ts           # Data normalization helpers
```

## Exports

```js
import { Feedback } from '@servicenow/aiux-sn-feedback';
```

## Architecture

`<aiux-sn-feedback>` is the **single registered custom element**. All visual sub-sections (button, popover, form) are implemented as **render helper functions** in separate files under `renders/`. This follows the Karuna naming convention (Rule 8) — only the top-level component has a `@customElement` tag; children use render functions.

Business logic lives in three Lit `ReactiveController` classes:

| Controller                  | Responsibility                                                       |
| --------------------------- | -------------------------------------------------------------------- |
| `FeedbackStateController`   | Which button is selected, whether popover is open, processed items   |
| `FeedbackFormController`    | Checklist / radio / textarea item mutations and submit payload build |
| `FeedbackTooltipController` | Confirmation tooltip show/hide with auto-dismiss timer               |

Render helpers are pure functions — they take data and callbacks, return `TemplateResult`. All state mutations happen in controllers, which call `host.requestUpdate()` to trigger re-renders.

## Accessibility

| Feature              | Implementation                                                                         |
| -------------------- | -------------------------------------------------------------------------------------- |
| Thumb buttons        | `aria-label`, `aria-pressed`, `title`                                                  |
| SVG icons            | `aria-hidden="true"` on all decorative SVGs                                            |
| Popover dialog       | `role="dialog"`, `aria-modal`, heading via `aiux-sn-popover` — focus trap included     |
| Escape key           | Handled by `aiux-sn-popover`; closes panel and returns focus to trigger button         |
| Focus management     | `focus-panel` attribute on `aiux-sn-popover` moves focus in on open; restored on close |
| Checklist group      | `role="group"` with `aria-label`                                                       |
| Radio group          | `role="radiogroup"` with `aria-label`                                                  |
| Form inputs          | `<label for>` on all checkboxes and radio buttons                                      |
| Textarea             | `aria-label` matching placeholder text, `aria-describedby` linked to character counter |
| Character counter    | `aria-live="polite"`, linked via `id` to textarea's `aria-describedby`                 |
| Error message        | `role="alert"` for immediate screen reader announcement                                |
| Confirmation tooltip | `role="tooltip"`, `aria-live="polite"`                                                 |
| Feedback container   | `role="group"`, `aria-label="Feedback"`                                                |
| Focus indicators     | `focus-visible` outlines on all interactive elements                                   |

## Styling

All colors use DaisyUI semantic tokens (`bg-base-100`, `border-base-300`, `text-text-primary`, etc.) which automatically switch for light/dark theme via the DaisyUI theme system.

The popover panel (arrow, shadow, sizing) is rendered and styled by `aiux-sn-popover`. The only custom CSS in `feedback.styles.ts` is `:host { display: block }` and the `.sr-only` helper for the screen-reader live region.

## SSR compatibility

This component is compatible with `@lit-labs/ssr`.

| Constraint                           | How it is handled                                              |
| ------------------------------------ | -------------------------------------------------------------- |
| No browser globals in `render()`     | `render()` uses only Lit templates and controller state        |
| No `window` / `setTimeout` on server | All timer calls are guarded with `if (!isServer)` from `'lit'` |
| No DOM access outside event handlers | DOM queries only run in `updated()` / event handlers           |
| All properties have safe defaults    | Every `@property` has an explicit default value                |
