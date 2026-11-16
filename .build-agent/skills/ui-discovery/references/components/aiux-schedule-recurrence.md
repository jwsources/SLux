# @servicenow/aiux-schedule-recurrence

## Import

```js
import '@servicenow/aiux-schedule-recurrence';
```


A presentational Lit web component for creating and editing recurring event schedules in Karuna applications.

> **Important — Presentational Component Only**
>
> This component handles **UI rendering, client-side validation, and payload generation** only. It does **not** interact with any backend tables, APIs, or services.
>
> The consuming BU (Business Unit) is responsible for:
>
> - Fetching existing recurrence data from the backend and mapping it to component properties
> - Listening to the `aiux-schedule-recurrence:save` event and persisting the payload to the backend
> - Handling `aiux-schedule-recurrence:cancel` to close or navigate away
> - Any server-side validation beyond what the component provides client-side

## Installation

```bash
pnpm add @servicenow/aiux-schedule-recurrence
```

## Quick Start

### Create Mode (minimal)

```typescript
import '@servicenow/aiux-schedule-recurrence';
```

```html
<aiux-schedule-recurrence
  event-title="Team Standup"
  start-date="05-04-2026"
  selected-timezone="America/Los_Angeles"
  @aiux-schedule-recurrence:save="${handleSave}"
  @aiux-schedule-recurrence:cancel="${handleCancel}"
></aiux-schedule-recurrence>
```

### Edit Mode (pre-populated recurrence)

```html
<aiux-schedule-recurrence
  event-title="Team Standup"
  start-date="05-04-2026"
  to-date="05-04-2026"
  all-day
  selected-timezone="Asia/Kolkata"
  time-format="hh:mm a"
  first-day-of-week="0"
  repeat-type="weekly"
  repeat-count="1"
  occurrences="5"
  .daysInWeek=${[0, 3]}
  .recurrenceSkipDates=${[
    { index: 0, key: 'skip0', startDate: '13-04-2026', isValid: true }
  ]}
  .recurrenceExceptions=${[
    {
      index: 0,
      key: 'exc0',
      eventTitle: 'Special Meeting',
      startDate: '20-04-2026',
      toDate: '20-04-2026',
      allDay: false,
      fromTime: '02:00 PM',
      toTime: '03:00 PM',
      selectedTimezone: 'Asia/Kolkata',
      repeats: 'never'
    }
  ]}
  @aiux-schedule-recurrence:save=${handleSave}
  @aiux-schedule-recurrence:cancel=${handleCancel}
  @aiux-schedule-recurrence:change=${handleChange}
  @aiux-schedule-recurrence:invalid=${handleInvalid}
></aiux-schedule-recurrence>
```

> **Note:** Properties prefixed with `.` (e.g., `.daysInWeek`, `.recurrenceSkipDates`) must be set via JavaScript property binding, not as HTML attributes.

### Single-Date All-Day Mode (BU-specific)

```html
<aiux-schedule-recurrence
  event-title="Holiday"
  start-date="25-12-2026"
  all-day
  hide-end-date-on-all-day
  @aiux-schedule-recurrence:save="${handleSave}"
></aiux-schedule-recurrence>
```

> When `hide-end-date-on-all-day` is set and `all-day` is toggled on, the End Date field is hidden and `toDate` is automatically synced to `startDate`. The `toDate` field is excluded from the save payload.

### Custom Default Series End (BU-specific)

```html
<aiux-schedule-recurrence
  event-title="Store Hours"
  start-date="01-01-2026"
  default-series-end-type="on"
  default-series-end-days="365"
  @aiux-schedule-recurrence:save="${handleSave}"
></aiux-schedule-recurrence>
```

> When `default-series-end-type` is set to `'on'`, the series end will default to "On" with the date set to `startDate + defaultSeriesEndDays` (365 days = 1 year). This applies when the user changes the Repeats dropdown and also to exceptions.

### Due in Field (BU-specific)

```html
<aiux-schedule-recurrence
  event-title="Task Schedule"
  start-date="01-01-2026"
  show-due-in-field
  due-in-max-days="90"
  due-in-default-value="10"
  @aiux-schedule-recurrence:save="${handleSave}"
></aiux-schedule-recurrence>
```

> The "Due in" field is a BU-specific dropdown that allows users to specify a number of days. It is hidden by default and can be enabled via `show-due-in-field`. The dropdown values range from 0 to `due-in-max-days` (default 90), and the default selected value is `due-in-default-value` (default 10).

## Features

- **Event Configuration** — Title, start/end dates, from/to times, timezone selection
- **All-Day Events** — Toggle that hides time pickers
- **Recurrence Patterns**:
  - Never (one-time event)
  - Daily (every N days)
  - Weekly (every N weeks, specific days of the week)
  - Monthly (by date number or by day-of-week pattern)
  - Yearly (by date number or by day-of-week pattern)
- **Series End Options** — Never, on a specific date, or after N occurrences
- **Skip Dates** — Exclude specific dates from the recurrence
- **Exceptions** — Define alternate recurrence rules for specific occurrences
- **Live Summary** — Auto-generated human-readable description of the recurrence pattern
- **Client-Side Validation** — Required fields, date/time range checks, real-time error display
- **External Validation Messages** — Display server-side errors/warnings via `.validationMessages`
- **Internationalization** — All UI strings are localized via `@lit/localize`

## Properties

### Event Fields

| Property           | Attribute           | Type      | Default              | Description                                                                      |
| ------------------ | ------------------- | --------- | -------------------- | -------------------------------------------------------------------------------- |
| `eventTitle`       | `event-title`       | `string`  | `''`                 | Title of the event                                                               |
| `startDate`        | `start-date`        | `string`  | `''`                 | Start date (format matches `dateFormat`)                                         |
| `toDate`           | `to-date`           | `string`  | `''`                 | End date (format matches `dateFormat`)                                           |
| `allDay`           | `all-day`           | `boolean` | `false`              | Whether this is an all-day event (hides time pickers)                            |
| `fromTime`         | `from-time`         | `string`  | `''`                 | Start time (format matches `timeFormat`)                                         |
| `toTime`           | `to-time`           | `string`  | `''`                 | End time (format matches `timeFormat`)                                           |
| `selectedTimezone` | `selected-timezone` | `string`  | `''` (browser local) | IANA timezone identifier. Defaults to the browser's local timezone when omitted. |

### Recurrence Configuration

| Property      | Attribute      | Type                    | Default     | Description                                                                                           |
| ------------- | -------------- | ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `repeatType`  | `repeat-type`  | `RepeatType`            | `'never'`   | Recurrence frequency: `'never'`, `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`                       |
| `repeatCount` | `repeat-count` | `number \| undefined`   | `undefined` | Repeat interval (e.g., every 2 weeks). Maps to the `every` field in detail objects                    |
| `occurrences` | `occurrences`  | `number \| undefined`   | `undefined` | Number of occurrences for series end type `'after'`                                                   |
| `daysInWeek`  | — (JS only)    | `number[] \| undefined` | `undefined` | Days selected for weekly recurrence (`0`=Sun, `1`=Mon, ... `6`=Sat)                                   |
| `repeatUntil` | `repeat-until` | `string`                | `''`        | Series end date (format matches `dateFormat`) for series end type `'on'`                              |
| `monthType`   | `month-type`   | `string`                | `''`        | Monthly pattern: `'date'` (by date number) or `'day'` (by day-of-week)                                |
| `yearType`    | `year-type`    | `string`                | `''`        | Yearly pattern: `'date'` (by date number) or `'day'` (by day-of-week)                                 |
| `weekIndex`   | `week-index`   | `string`                | `''`        | Week position for monthly/yearly day patterns: `'first'`, `'second'`, `'third'`, `'fourth'`, `'last'` |
| `dayOfWeek`   | `day-of-week`  | `number \| undefined`   | `undefined` | Day of week for monthly/yearly day patterns (`0`=Sun ... `6`=Sat)                                     |

### Format & Locale

| Property             | Attribute           | Type                                                           | Default             | Description                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------- | -------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dateFormat`         | `date-format`       | `'dd-MM-yyyy' \| 'yyyy-MM-dd' \| 'MM/dd/yyyy' \| 'dd/MM/yyyy'` | `'dd-MM-yyyy'`      | Date format used for display and parsing. Only these four values are supported; any other value logs a console warning and falls back to `'dd-MM-yyyy'`. Note that `MM/dd/yyyy` (US) and `dd/MM/yyyy` (EU/India/AU/UK) look visually identical for dates where day and month are both ≤ 12, so pick one per deployment and stick with it. |
| `timeFormat`         | `time-format`       | `'hh:mm a' \| 'HH:mm'`                                         | `'hh:mm a'`         | Time format used for display and parsing. Only these two values are supported (`'hh:mm a'` for 12-hour, `'HH:mm'` for 24-hour); any other value logs a console warning and falls back to `'hh:mm a'`.                                                                                                                                     |
| `firstDayOfWeek`     | `first-day-of-week` | `number`                                                       | `1`                 | First day of the week (`0`=Sunday, `1`=Monday)                                                                                                                                                                                                                                                                                            |
| `availableTimezones` | — (JS only)         | `TimezoneOption[]`                                             | `DEFAULT_TIMEZONES` | Timezone options for the dropdown (26 built-in timezones)                                                                                                                                                                                                                                                                                 |

### Advanced Settings

| Property                 | Attribute                  | Type                         | Default                    | Description                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------- | ---------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recurrenceSkipDates`    | — (JS only)                | `SkipDate[]`                 | `[]`                       | Pre-populated skip dates. Each `startDate` must match the configured `dateFormat`; mismatched strings fail validation and disable Save until the user re-picks the date.                                                                                    |
| `recurrenceExceptions`   | — (JS only)                | `RecurrenceException[]`      | `[]`                       | Pre-populated exception rules. Each `startDate` / `toDate` must match the configured `dateFormat`. Each exception's `selectedTimezone` is overwritten with the parent event's `selectedTimezone` on load; exceptions do not have their own timezone picker. |
| `seriesEndFields`        | — (JS only)                | `SeriesEndType[]`            | `['never', 'on', 'after']` | Which series end options to show                                                                                                                                                                                                                            |
| `disableSkipDate`        | `disable-skip-date`        | `boolean`                    | `false`                    | Hide the skip dates section entirely                                                                                                                                                                                                                        |
| `expandAdvancedSettings` | `expand-advanced-settings` | `boolean`                    | `false`                    | Open the advanced settings accordion by default                                                                                                                                                                                                             |
| `hideEndDateOnAllDay`    | `hide-end-date-on-all-day` | `boolean`                    | `false`                    | When `true` and `allDay` is enabled, hides the End Date field and excludes `toDate` from the payload                                                                                                                                                        |
| `defaultSeriesEndType`   | `default-series-end-type`  | `'never' \| 'on' \| 'after'` | `'never'`                  | Default series end type when repeat type changes                                                                                                                                                                                                            |
| `defaultSeriesEndDays`   | `default-series-end-days`  | `number`                     | `180`                      | Number of days to add to start date for 'on' type series end                                                                                                                                                                                                |
| `showDueInField`         | `show-due-in-field`        | `boolean`                    | `false`                    | Show the "Due in" dropdown field (BU-specific)                                                                                                                                                                                                              |
| `dueInMaxDays`           | `due-in-max-days`          | `number`                     | `90`                       | Maximum value in the "Due in" dropdown (0 to this value)                                                                                                                                                                                                    |
| `dueInDefaultValue`      | `due-in-default-value`     | `number`                     | `10`                       | Default selected value in the "Due in" dropdown                                                                                                                                                                                                             |
| `dueIn`                  | `due-in`                   | `number \| undefined`        | `undefined`                | Current "Due in" value (input/output)                                                                                                                                                                                                                       |
| `validationMessages`     | — (JS only)                | `ValidationMessage[]`        | `[]`                       | External validation messages (e.g., server-side errors) displayed as alerts                                                                                                                                                                                 |

## Date Formats

The `dateFormat` property accepts one of four values. Every date the component reads (`startDate`, `toDate`, `repeatUntil`, plus the `startDate` / `toDate` inside each `recurrenceSkipDates` and `recurrenceExceptions` entry) and every date the component writes (save payload, recurrence summary) is in this format.

| `dateFormat` | Example for 15 April 2026 | Typical region                                                  |
| ------------ | ------------------------- | --------------------------------------------------------------- |
| `dd-MM-yyyy` | `15-04-2026`              | Default; common across the Karuna platform                      |
| `yyyy-MM-dd` | `2026-04-15`              | ISO 8601, backend-friendly                                      |
| `MM/dd/yyyy` | `04/15/2026`              | United States                                                   |
| `dd/MM/yyyy` | `15/04/2026`              | Most of the rest of the world (EU, India, Australia, UK, LATAM) |

**Setting a non-default format:**

```html
<aiux-schedule-recurrence
  date-format="MM/dd/yyyy"
  start-date="04/15/2026"
  to-date="04/15/2026"
  .recurrenceSkipDates=${[
    { index: 0, key: 'skip0', startDate: '05/04/2026', isValid: true }
  ]}
></aiux-schedule-recurrence>
```

**Validation behavior**

- The field-level error `"The date must match format: dd-MM-yyyy, yyyy-MM-dd, MM/dd/yyyy, dd/MM/yyyy"` fires when a date string fails to parse against the **currently configured** format. Even though the message lists all four formats, the form only accepts the one configured via `dateFormat`.
- Save is disabled until every required date parses cleanly.

**Unsupported values**

If a `dateFormat` outside the four supported values is passed (via attribute binding, plain-JS, or `as any` casts that bypass the TS type), the component logs a `console.warn` and falls back to `dd-MM-yyyy` so the form remains usable. TypeScript consumers using JS property binding will see a compile-time error first.

**Caveat: visual ambiguity between US and EU slash formats**

`MM/dd/yyyy` and `dd/MM/yyyy` look identical for any date where both day and month are ≤ 12 (e.g. `04/05/2026` is April 5 in one and 4 May in the other: same characters, different date). The format string is the only disambiguator. Pick one per deployment, and never switch a deployed consumer without re-keying its stored dates.

## Events

All events bubble and are composed.

### `aiux-schedule-recurrence:save`

Fired when the Save button is clicked. **Only fires if the form is valid.**

```typescript
element.addEventListener('aiux-schedule-recurrence:save', (e: CustomEvent) => {
  const { eventRecurrence } = e.detail;
  // eventRecurrence contains: { event, skipDates, exceptions }
  // Send to your backend API
});
```

**Payload shape** (`e.detail`):

```typescript
{
  eventRecurrence: {
    event: {
      eventOrRuleName: string;    // maps from eventTitle
      startDate: string;
      toDate?: string;            // included only when allDay=true (excluded when hide-end-date-on-all-day is also true)
      fromTime?: string;          // included only when allDay=false
      toTime?: string;            // included only when allDay=false
      repeats: RepeatType;
      selectedTimezone: string;
      allDay: boolean;
      // Only the ACTIVE detail object is included (based on repeats value):
      dayDetails?: { every: number; seriesEndDetails: { type, date?, occurence? } };
      weekDetails?: { every: number; daysInWeek: number[]; seriesEndDetails: {...} };
      monthDetails?: { every: number; onDetails: { type, dateNumber?, day?, weekType? }; seriesEndDetails: {...} };
      yearDetails?: { every: number; onDetails: {...}; seriesEndDetails: {...} };
    };
    skipDates: Array<{
      startDate: string;
      toDate: string;              // same as startDate
      index: number;
      eventOrRuleName: string;     // auto-generated "Skip Date 0", "Skip Date 1", etc.
      repeats: 'never';
      allDay: true;
      key: string;
    }>;
    exceptions: Array<{
      eventOrRuleName: string;
      startDate: string;
      toDate?: string;             // included only when allDay=true (excluded when hide-end-date-on-all-day is also true)
      fromTime?: string;           // included only when allDay=false
      toTime?: string;             // included only when allDay=false
      repeats: RepeatType;
      selectedTimezone: string;    // always the parent event's timezone; any value passed via `.recurrenceExceptions[].selectedTimezone` is overwritten on load
      allDay: boolean;
      index: number;
      key: string;
      // Active detail object included (same as event)
    }>;
    summary: string;               // human-readable description of the recurrence pattern (e.g. "Every day, starting 15-04-2026")
  }
}
```

> **Payload Field Rules:**
>
> - When `allDay=true`: `toDate` is included, `fromTime`/`toTime` are excluded
> - When `allDay=false`: `fromTime`/`toTime` are included, `toDate` is excluded
> - When `hide-end-date-on-all-day=true` and `allDay=true`: `toDate` is also excluded

### `aiux-schedule-recurrence:cancel`

Fired when the Cancel button is clicked. No payload.

```typescript
element.addEventListener('aiux-schedule-recurrence:cancel', () => {
  // Close the dialog or navigate away
});
```

### `aiux-schedule-recurrence:change`

Fired when any field value changes.

```typescript
element.addEventListener('aiux-schedule-recurrence:change', (e: CustomEvent) => {
  const { field, value, event } = e.detail;
  // field: the property path that changed (e.g., 'eventTitle', 'repeats', 'skipDates')
  // value: the new value
  // event: full RecurrenceEvent snapshot
});
```

### `aiux-schedule-recurrence:invalid`

Fired when the form validity state changes (valid to invalid or vice versa).

```typescript
element.addEventListener('aiux-schedule-recurrence:invalid', (e: CustomEvent) => {
  const { isValid, errors } = e.detail;
  // isValid: boolean
  // errors: ValidationError[] — array of { field: string, message: string }
});
```

## Slots

### `footer-start`

A named slot for injecting custom content on the left side of the action buttons footer. Useful for adding navigation buttons like "Previous" or "Back".

```html
<aiux-schedule-recurrence
  event-title="Store Hours"
  @aiux-schedule-recurrence:save="${handleSave}"
>
  <button slot="footer-start" class="aiux-btn aiux-btn-ghost" @click="${goToPreviousStep}">
    ← Previous
  </button>
</aiux-schedule-recurrence>
```

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ [slot:footer-start]          [Cancel]  [Save]       │
└─────────────────────────────────────────────────────┘
```

> Events from slotted content bubble up automatically — no special handling required.

---

## Integration Guide

### Creating a New Recurrence

1. Render the component with desired defaults (or no attributes for a blank form)
2. Listen for `aiux-schedule-recurrence:save`
3. Extract `e.detail.eventRecurrence` and persist to your backend

```typescript
handleSave(e: CustomEvent) {
  const payload = e.detail.eventRecurrence;
  // POST payload to your backend API
  await myApi.createRecurrence(payload);
}
```

### Editing an Existing Recurrence

1. Fetch the recurrence data from your backend
2. Map backend field names to component properties
3. Pass complex data (skip dates, exceptions, days-in-week) via JS property binding
4. On save, update the backend record with the new payload

```typescript
// Map backend data to component properties
const recurrence = await myApi.getRecurrence(id);

html`
  <aiux-schedule-recurrence
    event-title=${recurrence.eventOrRuleName}
    start-date=${recurrence.startDate}
    to-date=${recurrence.toDate}
    repeat-type=${recurrence.repeats}
    repeat-count=${recurrence.weekDetails?.every}
    ?all-day=${recurrence.allDay}
    selected-timezone=${recurrence.selectedTimezone}
    .daysInWeek=${recurrence.weekDetails?.daysInWeek}
    .recurrenceSkipDates=${mapSkipDates(recurrence.skipDates)}
    .recurrenceExceptions=${mapExceptions(recurrence.exceptions)}
    @aiux-schedule-recurrence:save=${(e) => myApi.updateRecurrence(id, e.detail.eventRecurrence)}
  ></aiux-schedule-recurrence>
`;
```

### Validation Flow

- The component performs **client-side validation** automatically (required fields, date ranges, time ranges, occurrence counts)
- The **Save button is disabled** when the form is invalid
- Listen to `aiux-schedule-recurrence:invalid` for real-time validity state updates
- For **server-side validation errors**, pass them via the `.validationMessages` property:

```typescript
// Display server-side errors as alerts above the action buttons
element.validationMessages = [
  {
    type: 'error',
    message: 'This time slot conflicts with an existing schedule.',
  },
  { type: 'warning', header: 'Note', message: 'Holiday schedule may apply.' },
];
```

## Public Exports

The package entry point exports the component class only:

```typescript
import { ScheduleRecurrence } from '@servicenow/aiux-schedule-recurrence';
```

Internal types, render functions, controllers, utilities, and constants are not exported from the package entry point. Consumers should use the `<aiux-schedule-recurrence>` component API, properties, and custom events documented above.

## Styling & Theming

The component uses **Tailwind CSS** utility classes and **DaisyUI** semantic tokens. It inherits theming from the Karuna design system via `AIUXElement`.

DaisyUI theme variables respected:

- `--color-base-100`, `--color-base-200`, `--color-base-300` — Background surfaces
- `--color-base-content` — Text color
- `--color-primary`, `--color-primary-content` — Primary actions and calendar accents
- `--color-error` — Validation errors

Dark mode is supported out of the box through DaisyUI theme switching.

## Accessibility

- **WCAG 2.1 Level A and AA** verified -- automated axe-core scans run across all repeat modes and UI states as part of the functional test suite
- Form labels are programmatically associated with inputs via `for`/`id`, `aria-label`, and `aria-labelledby`
- Required fields are marked with visual asterisks
- Error states are communicated visually and programmatically (`role="alert"` on external validation messages; inline `.text-error` spans for field-level errors)
- Calendar navigation buttons have descriptive `aria-label` attributes
- Advanced settings accordion toggle carries an `aria-label` via the DaisyUI collapse pattern
- All interactive elements (inputs, selects, buttons, day-of-week toggles) are keyboard accessible and focusable
- Save and Cancel buttons respond to keyboard activation (Enter/Space) via native browser button behaviour

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

```bash
# Run unit tests (Node, fast)
cd packages/schedule-recurrence && pnpm test

# Run unit tests with coverage
cd packages/schedule-recurrence && pnpm test:coverage

# Run functional tests (Vitest browser mode, Chromium)
# Requires one-time: npx playwright install chromium
cd packages/schedule-recurrence && pnpm test:functional

# Storybook
cd components && pnpm storybook
```

## Dependencies

**Runtime:**

- `@lit/localize` — Internationalization
- `@servicenow/aiux-components-core` — Base element class
- `@servicenow/aiux-sn-popover` — Calendar popovers
- `@servicenow/aiux-components-icon` — Icons
- `cally` — Calendar date picker

**Peer:** `lit ^3.0.0`

**Dev:** `@vitest/browser-playwright`, `playwright`, `vitest` — drive the
functional test suite in Chromium. `axe-core` — WCAG 2.1 A/AA automated
accessibility audits within the functional suite.

## License

ISC
