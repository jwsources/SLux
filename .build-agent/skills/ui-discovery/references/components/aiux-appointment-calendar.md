# @servicenow/aiux-appointment-calendar

## Import

```js
import '@servicenow/aiux-appointment-calendar';
```


An appointment calendar component for scheduling, rescheduling, and proposing appointment slots. Supports week and day views, multi-slot selection, event categorisation, and timezone-aware rendering. Built with Lit 3, fully SSR-compatible.

## Installation

```bash
pnpm add @servicenow/aiux-appointment-calendar
```

```js
import '@servicenow/aiux-appointment-calendar';
```

### Peer dependencies

Consumers must provide:

| Package                                | Version    |
| -------------------------------------- | ---------- |
| `lit`                                  | `^3.0.0`   |
| `@lit/localize`                        | `^0.12.2`  |
| `@servicenow/aiux-components-core`     | `^4.10.1`  |
| `@servicenow/aiux-directive-icon`      | `^1.1.1`   |

## Usage

### Minimal

```html
<aiux-appointment-calendar></aiux-appointment-calendar>
```

### With events and timezone

```js
const events = [
  {start: '2024-06-10 09:00:00', end: '2024-06-10 09:30:00', type: 'available'},
  {start: '2024-06-10 10:00:00', end: '2024-06-10 10:30:00', type: 'available'},
  {
    start: '2024-06-10 11:00:00',
    end: '2024-06-10 11:30:00',
    type: 'unavailable'
  }
];
```

```html
<aiux-appointment-calendar
  app-title="Book an Appointment"
  context-date="2024-06-10 00:00:00"
  timezone="America/New_York"
  .events="${events}"
  @aiux-appointment-calendar:schedule-appointment="${onSchedule}"
  @aiux-appointment-calendar:range-updated="${onRangeUpdated}"
></aiux-appointment-calendar>
```

### Localized weekday/month names

```html
<aiux-appointment-calendar
  .contextDate="${new Date()}"
  locale="fr"
></aiux-appointment-calendar>
```

Binding `locale` to `session.user.language` keeps weekday names, month names, and AM/PM in sync with the instance's active language.

Non-`en` locale data is loaded lazily via `import('moment/locale/<code>.js')` from a static, fully-enumerated map in `locale-loaders.ts` (required so bundlers can statically discover each locale file; a single runtime-templated dynamic import cannot be resolved by Vite's dev server). An esbuild plugin in `.storybook/main.js` rewrites each locale file's `require('../moment')` to `require('moment-timezone')` during Vite's pre-bundling, ensuring all locale data registers on the same moment instance — so locale changes are reflected correctly in Storybook as well.

### Day view with multi-slot selection

```html
<aiux-appointment-calendar
  view="DAY"
  enable-multi-select-slot
  show-view-selector
  timezone="UTC"
  .events="${events}"
  @aiux-appointment-calendar:propose-appointment="${onPropose}"
></aiux-appointment-calendar>
```

### With categories

```js
const categories = [
  {id: 'morning', label: 'Morning', icon: 'sun', order: 0},
  {id: 'afternoon', label: 'Afternoon', icon: 'partly-cloudy', order: 1}
];

const events = [
  {
    start: '2024-06-10 09:00:00',
    end: '2024-06-10 09:30:00',
    type: 'available',
    category: 'morning'
  },
  {
    start: '2024-06-10 14:00:00',
    end: '2024-06-10 14:30:00',
    type: 'available',
    category: 'afternoon'
  }
];
```

```html
<aiux-appointment-calendar
  enable-categories
  .categories="${categories}"
  .events="${events}"
></aiux-appointment-calendar>
```

### With slot info tags

Decorate individual slots with `primaryInfoData` (up to two badges on a single line, centered and floating on the slot's top border, showing their full labels) and `secondaryInfoData` (one line of supporting text under the title). When any slot in the view carries tags, all slots reserve the same top space so the grid stays aligned.

```js
const events = [
  {
    start: '2024-06-10 09:00:00',
    end: '2024-06-10 09:30:00',
    type: 'available',
    primaryInfoData: [
      {label: 'Recommended', color: 'success'},
      {label: 'Limited', color: 'warning', icon: 'triangle-exclamation'}
    ],
    secondaryInfoData: [{label: '3 of 5 slots left'}]
  }
];
```

```html
<aiux-appointment-calendar
  timezone="America/New_York"
  .events="${events}"
></aiux-appointment-calendar>
```

### Disabling past slot dates

Set `disable-previous-slot-dates` to mark all events before today as unavailable and prevent navigation to past dates. Useful when the agent must always book in the future.

```html
<aiux-appointment-calendar
  disable-previous-slot-dates
  timezone="America/New_York"
  .events="${events}"
></aiux-appointment-calendar>
```

### Disabling dates with no available slots

Set `disable-non-available-slot-dates` to grey out dates that contain only `unavailable` events — signalling to the user that those days cannot be booked. Requires your `events` array to include events with `type: 'unavailable'`.

```js
const events = [
  {start: '2024-06-10 09:00:00', end: '2024-06-10 09:30:00', type: 'available'},
  {
    start: '2024-06-11 09:00:00',
    end: '2024-06-11 09:30:00',
    type: 'unavailable'
  }
];
```

```html
<aiux-appointment-calendar
  disable-non-available-slot-dates
  timezone="America/New_York"
  .events="${events}"
></aiux-appointment-calendar>
```

### Showing duration and end time in event chips

Use `show-duration-in-events` to display a duration label (e.g. `30 min`) inside each event chip. Use `show-end-time-in-events` to show the end time alongside the start time. Both can be enabled independently or together.

```html
<!-- Show duration only -->
<aiux-appointment-calendar
  show-duration-in-events
  .events="${events}"
></aiux-appointment-calendar>

<!-- Show end time only -->
<aiux-appointment-calendar
  show-end-time-in-events
  .events="${events}"
></aiux-appointment-calendar>

<!-- Show both -->
<aiux-appointment-calendar
  show-duration-in-events
  show-end-time-in-events
  .events="${events}"
></aiux-appointment-calendar>
```

### Rescheduling — marking the currently booked slot

Set `type: 'selected'` on the existing appointment. The component will dispatch `aiux-appointment-calendar:reschedule-appointment` (instead of `aiux-appointment-calendar:schedule-appointment`) when the user picks a new slot.

```js
const events = [
  {start: '2024-06-10 09:00:00', end: '2024-06-10 09:30:00', type: 'selected'},
  {start: '2024-06-10 10:00:00', end: '2024-06-10 10:30:00', type: 'available'}
];
```

### Handling events

```js
function onSchedule(e) {
  const {event} = e.detail;
  // event = { start, end, type, ... }
  await fetch('/api/appointments', {method: 'POST', body: JSON.stringify(event)});
}

function onPropose(e) {
  const {events} = e.detail;
  // events = [{ start, end, ... }, ...]
  await fetch('/api/proposals', {method: 'POST', body: JSON.stringify(events)});
}

function onRangeUpdated(e) {
  const {startMS, endMS} = e.detail;
  // fetch events for the new visible range
  loadEvents(startMS, endMS);
}
```

## Properties

| Property                       | Attribute                          | Type              | Default        | Description                                                                       |
| ------------------------------ | ---------------------------------- | ----------------- | -------------- | --------------------------------------------------------------------------------- |
| `appTitle`                     | `app-title`                        | `string`          | `''`           | Title displayed in the calendar header                                            |
| `categories`                   | —                                  | `Category[]`      | `[]`           | Category definitions used to group events (requires `enableCategories`)           |
| `configAria`                   | —                                  | `AriaConfig`      | `{}`           | ARIA label overrides for the component region and body                            |
| `contextDate`                  | `context-date`                     | `string`          | `''`           | Date that determines the visible week/day. Format: `YYYY-MM-DD HH:mm:ss`          |
| `dateFormat`                   | `date-format`                      | `string`          | `'YYYY-MM-DD'` | Date format used in the header and labels                                         |
| `applyDateFormatGlobally`      | `apply-date-format-globally`       | `boolean`         | `false`        | When `true`, uses `dateFormat` and `timeFormat` for all date/time display strings |
| `disableNonAvailableSlotDates` | `disable-non-available-slot-dates` | `boolean`         | `false`        | Disables calendar dates that have no available slots                              |
| `disablePreviousSlotDates`     | `disable-previous-slot-dates`      | `boolean`         | `false`        | Marks past events as unavailable and disables navigation to past dates            |
| `enableCategories`             | `enable-categories`                | `boolean`         | `false`        | Groups events by category within each day                                         |
| `enableMultiSelectSlot`        | `enable-multi-select-slot`         | `boolean`         | `false`        | Allows selecting multiple slots at once (for propose flow)                        |
| `events`                       | —                                  | `CalendarEvent[]` | `[]`           | Appointment slots to display                                                      |
| `firstDayOfWeek`               | `first-day-of-week`                | `number`          | `0` (Sunday)   | Start day of the week: `0`=Sunday … `6`=Saturday                                  |
| `locale`                       | `locale`                           | `string`          | `'en'`         | Locale used to render weekday/month names and AM/PM in dates and times. Accepts moment.js/BCP-47 locale codes (e.g. `'fr'`, `'es'`, `'pt-BR'`); the legacy ServiceNow codes `'pb'`, `'fq'`, `'zt'` are automatically normalized to `'pt-BR'`, `'fr-CA'`, `'zh-TW'`. Bind to `session.user.language` for full instance-language coverage |
| `nextAvailableEvent`           | —                                  | `CalendarEvent`   | `{}`           | The next available event, used by the "Next available" footer action              |
| `numberOfEventsInEachRow`      | `number-of-events-in-each-row`     | `number`          | `5`            | Maximum slots shown per row before a "Show more" link appears                     |
| `showDurationInEvents`         | `show-duration-in-events`          | `boolean`         | `false`        | Shows the duration label (e.g. `30 min`) inside each event chip                   |
| `showEndTimeInEvents`          | `show-end-time-in-events`          | `boolean`         | `false`        | Shows the end time alongside the start time in each event chip                    |
| `disableTimeDuration`          | `disable-time-duration`            | `boolean`         | `false`        | Hides all time/duration labels from event chips                                   |
| `showViewSelector`             | `show-view-selector`               | `boolean`         | `false`        | Displays the Week / Day toggle in the header                                      |
| `timeFormat`                   | `time-format`                      | `string`          | `'hh:mm A'`    | Time format used in event chips and the footer                                    |
| `timezone`                     | `timezone`                         | `string`          | `'GMT'`        | IANA timezone identifier (e.g. `'America/New_York'`, `'Asia/Tokyo'`)              |
| `view`                         | `view`                             | `'WEEK' \| 'DAY'` | `'WEEK'`       | Initial calendar view                                                             |

Properties with no attribute must be set as JavaScript properties, not as HTML attributes.

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property                        | Type      | Label                        | Default     | Description                                                                       |
| -------------------------------- | --------- | ----------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `configAppTitle`                 | `String`  | App Title                     | `undefined` | Optional heading title rendered above the calendar body.                          |
| `configDateFormat`                | `String`  | Date Format                   | `undefined` | Moment.js format string used to display dates.                                    |
| `configApplyDateFormatGlobally`   | `Boolean` | Apply Date Format Globally    | `undefined` | Apply the configured date format to all displayed dates rather than only specific fields. |
| `configFirstDayOfWeek`            | `Number`  | First Day Of Week             | `undefined` | The day of week (0 = Sunday .. 6 = Saturday) the calendar week starts on.          |
| `configNumberOfEventsInEachRow`   | `Number`  | Number Of Events In Each Row  | `undefined` | Maximum number of events shown per row before overflow.                           |
| `configShowDurationInEvents`      | `Boolean` | Show Duration In Events       | `undefined` | Show the event duration on each event chip.                                       |
| `configShowEndTimeInEvents`       | `Boolean` | Show End Time In Events       | `undefined` | Show each event's end time in addition to its start time.                         |
| `configDisableTimeDuration`       | `Boolean` | Disable Time Duration         | `undefined` | Suppress duration calculation/display for events entirely.                        |
| `configShowViewSelector`          | `Boolean` | Show View Selector            | `undefined` | Show the Day/Week view selector control in the header.                            |
| `configView`                      | `String`  | View                           | `undefined` | Default calendar view. Choices: `DAY` (Day), `WEEK` (Week)                        |
| `configEnableCategories`          | `Boolean` | Enable Categories             | `undefined` | Show category grouping/legend for events.                                         |
| `configLocale`                    | `String`  | Locale                        | `undefined` | Locale used to render weekday/month names and AM/PM. Accepts moment.js/BCP-47 locale codes. |
| `configTimeFormat`                | `String`  | Time Format                   | `undefined` | Moment.js format string used for the time portion of event chips and the footer.  |
| `configTimezone`                  | `String`  | Timezone                      | `undefined` | IANA timezone identifier (e.g. `America/New_York`, `Asia/Tokyo`) used to render event times. |
| `configDisableNonAvailableSlotDates` | `Boolean` | Disable Non Available Slot Dates | `undefined` | Disables calendar dates that have no available slots.                          |
| `configDisablePreviousSlotDates`  | `Boolean` | Disable Previous Slot Dates   | `undefined` | Marks past events as unavailable and disables navigation to past dates.           |

## Events

All events bubble and are composed.

### `aiux-appointment-calendar:range-updated`

Fired once on initial render (during `firstUpdated`) after the calendar bootstraps and calculates the initial visible date range. Use this to fetch the initial set of events for the visible window.

```ts
detail: {
  startMoment: Moment;
  endMoment: Moment;
  startMS: number; // Unix ms
  endMS: number; // Unix ms
}
```

### `aiux-appointment-calendar:context-date-changed`

Fired when the focused date changes.

```ts
detail: {
  fromMoment: Moment | null;
  toMoment: Moment;
  fromMS: number | null;
  toMS: number;
}
```

### `aiux-appointment-calendar:event-clicked`

Fired when the user clicks an event chip (selects or deselects it).

```ts
detail: {
  event: CalendarEvent;
  isActive: boolean; // true = selected, false = deselected
}
```

### `aiux-appointment-calendar:schedule-appointment`

Fired when the user confirms a single slot selection and no prior booking exists.

```ts
detail: {
  event: ParsedCalendarEvent;
}
```

### `aiux-appointment-calendar:reschedule-appointment`

Fired when the user picks a new slot and a `type: 'selected'` event already exists in the `events` array.

```ts
detail: {
  event: ParsedCalendarEvent; // newly selected slot
  previousEvent: ParsedCalendarEvent; // the existing booked slot
}
```

### `aiux-appointment-calendar:propose-appointment`

Fired when the user confirms a multi-slot selection.

```ts
detail: {
  events: Omit<ParsedCalendarEvent, '_id'>[]; // _id is stripped from each event
}
```

### `aiux-appointment-calendar:cancel-clicked`

Fired when the user clicks the Cancel button in the footer.

```ts
detail: {
}
```

### `aiux-appointment-calendar:view-updated`

Fired when the user switches between Week and Day views.

```ts
detail: {
  from: 'WEEK' | 'DAY' | null;
  to: 'WEEK' | 'DAY';
}
```

## Data types

```ts
interface ParsedCalendarEvent extends CalendarEvent {
  _id: string; // internal identifier (stripped from aiux-appointment-calendar:propose-appointment detail)
  startMoment: Moment; // parsed start as a moment-timezone object
  endMoment: Moment; // parsed end as a moment-timezone object
  label?: string; // formatted display label
}

interface CalendarEvent {
  start: string | number; // 'YYYY-MM-DD HH:mm:ss' or Unix ms timestamp
  end: string | number;
  type?: 'available' | 'unavailable' | 'selected';
  hasConflict?: boolean;
  tooltip?: string;
  title?: string;
  category?: string | number; // must match a Category.id when enableCategories=true
  primaryInfoData?: PrimaryInfoTag[]; // up to 2 badges shown above the slot title
  secondaryInfoData?: SecondaryInfoTag[]; // 1 line of supporting text under the title
}

// Semantic color mapped to a DaisyUI aiux-badge variant so tags theme correctly.
type SlotTagColor =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral';

interface PrimaryInfoTag {
  label: string; // caller must pre-localise; the component renders this verbatim
  icon?: IconNameWithVariant; // icon name from aiux-directive-icon
  color?: SlotTagColor; // defaults to 'neutral'
}

interface SecondaryInfoTag {
  label: string; // caller must pre-localise; the component renders this verbatim
}

interface Category {
  id: string | number;
  label: string;
  icon?: string; // icon name rendered via aiux-directive-icon
  order?: number; // sort order (lower = first)
}

interface AriaConfig {
  ariaTitle?: string; // aria-label on the outer region element
  ariaBodyTitle?: string; // aria-label on the body content area
}
```

### Event start/end formats

| Format                    | Example                 |
| ------------------------- | ----------------------- |
| ISO-style datetime string | `'2024-06-10 09:00:00'` |
| Unix milliseconds         | `1718006400000`         |
| ISO 8601 date string      | `'2024-06-10'`          |

> All times are interpreted in the `timezone` property. When passing Unix ms, the component converts them to the given timezone automatically.

## File structure

```
appointment-calendar/
├── index.js                                         # Package entry point (version-routing shim)
├── package.json
├── vitest.config.js                                 # Unit/render tests (happy-dom)
├── vitest.config.browser.mjs                        # Functional tests (Playwright + chromium)
├── src/
│   ├── index.ts                                     # Public exports
│   ├── appointment-calendar.ts                      # <aiux-appointment-calendar> element
│   ├── constants/
│   │   └── appointment-calendar-constants.ts        # Event names, view names, format strings
│   ├── controllers/
│   │   ├── CalendarStateController.ts               # Core state: moments, event map, selected slots
│   │   ├── CalendarNavigationController.ts          # Navigation: arrows, today, date picker, view switch
│   │   └── CalendarEventController.ts               # Selection: click, schedule, propose, cancel
│   ├── renders/
│   │   ├── header.render.ts                         # Month/week label, nav arrows, date picker, view toggle
│   │   ├── week-view.render.ts                      # 7-column week grid with event chips
│   │   ├── day-view.render.ts                       # Single-day list with inline calendar picker
│   │   ├── event.render.ts                          # Individual event chip
│   │   └── footer.render.ts                         # Schedule/Reschedule/Propose/Cancel actions
│   ├── stories/
│   │   └── appointment-calendar.stories.ts          # Storybook stories for local validation
│   ├── styles/
│   │   └── appointment-calendar.styles.ts           # All component styles
│   ├── types/
│   │   └── appointment-calendar.types.ts            # All TypeScript interfaces and type aliases
│   └── utils/
│       ├── appointment-calendar-helpers.ts          # Date math, event parsing, label formatting
│       └── locale-loaders.ts                        # Lazy-loaded moment.js locale import map
└── test/
    ├── appointment-calendar.test.ts                 # Main component unit tests
    ├── controllers/
    │   ├── CalendarStateController.test.ts
    │   ├── CalendarNavigationController.test.ts
    │   └── CalendarEventController.test.ts
    ├── renders/
    │   ├── day-view.render.test.ts
    │   ├── event.render.test.ts
    │   ├── footer.render.test.ts
    │   ├── header.render.test.ts
    │   └── week-view.render.test.ts
    ├── styles/
    │   └── appointment-calendar.styles.test.ts
    ├── utils/
    │   └── appointment-calendar-helpers.test.ts
    └── functional/                                  # Real-browser tests (Playwright)
        ├── aiux-appointment-calendar.categories.spec.js
        ├── aiux-appointment-calendar.date-picker.spec.js
        ├── aiux-appointment-calendar.disabled-dates.spec.js
        ├── aiux-appointment-calendar.event-click.spec.js
        ├── aiux-appointment-calendar.multi-select.spec.js
        ├── aiux-appointment-calendar.navigation.spec.js
        ├── aiux-appointment-calendar.next-available.spec.js
        ├── aiux-appointment-calendar.rendering.spec.js
        ├── aiux-appointment-calendar.single-slot-flow.spec.js
        ├── aiux-appointment-calendar.timezone-formats.spec.js
        ├── aiux-appointment-calendar.view-toggle.spec.js
        └── appointment-calendar-functional-helpers.js
```

## Architecture

`<aiux-appointment-calendar>` is the **single registered custom element**. All visual sections (header, week view, day view, event chips, footer) are implemented as **pure render helper functions** under `renders/`. Business logic is split across three Lit `ReactiveController` classes:

| Controller                     | Responsibility                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CalendarStateController`      | Owns all derived state: parsed events, `eventStateMap` (events grouped by day), disabled dates, selected slots, date format strings |
| `CalendarNavigationController` | Handles arrow navigation, "today" button, date picker open/select/close/done, view switching, and timezone changes                  |
| `CalendarEventController`      | Handles event chip clicks, single/multi-slot selection, schedule, reschedule, propose, cancel, and next-available actions           |

The bootstrap sequence runs in `firstUpdated` to guarantee identical server and client HTML (no hydration mismatch):

1. `todayMoment` is set from `Date.now()` in the given `timezone`
2. `contextMoment` is resolved from `contextDate` (defaults to today)
3. `recalculateDateRange()` computes `startMoment`/`endMoment` for the visible window
4. `aiux-appointment-calendar:range-updated` is dispatched so the parent can fetch the initial event set
5. `componentInitialized` is set to `true` — subsequent `updated()` calls handle property changes

## Views

### Week view

Displays a 7-column grid (one column per day). Events are grouped by day and rendered as chips. When more events exist than `numberOfEventsInEachRow`, a "Show more" / "Show less" toggle appears. When `enableCategories` is `true`, events are grouped within each day by category with accordion collapse support.

### Day view

Shows a single day's events in a vertical list alongside an inline mini-calendar for date selection. The mini-calendar respects `disablePreviousSlotDates` and `disableNonAvailableSlotDates`.

## Footer actions

| Condition                                              | Button shown       | Event dispatched                                   |
| ------------------------------------------------------ | ------------------ | -------------------------------------------------- |
| One slot selected, no existing booking                 | **Schedule**       | `aiux-appointment-calendar:schedule-appointment`   |
| One slot selected, existing `type: 'selected'` event   | **Reschedule**     | `aiux-appointment-calendar:reschedule-appointment` |
| Multiple slots selected (`enableMultiSelectSlot=true`) | **Propose**        | `aiux-appointment-calendar:propose-appointment`    |
| Any slot selected                                      | **Cancel**         | `aiux-appointment-calendar:cancel-clicked`         |
| `nextAvailableEvent` provided and no slot selected     | **Next available** | `aiux-appointment-calendar:event-clicked`          |

## Accessibility

| Feature            | Implementation                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| Component region   | `role="region"`, `aria-label` from `configAria.ariaTitle`                 |
| Body area          | `role="group"`, `aria-label` from `configAria.ariaBodyTitle`              |
| Event chips        | `aria-label` includes formatted date/time from `ariaDateFormat`; `aria-pressed` reflects selection |
| Navigation buttons | `aria-label` on prev/next/today controls                                  |
| Date picker        | Delegates to the `cally` calendar library which has built-in ARIA support |
| View selector      | Native `<select>` element with `aria-label="Calendar view"`               |

## Styling

All colors use DaisyUI semantic tokens which automatically adapt to light/dark themes. The component renders in a shadow DOM — use CSS custom properties or `::part()` selectors if exposed to override styles from the outside.

## SSR compatibility

This component is compatible with `@lit-labs/ssr`.

| Constraint                        | How it is handled                                               |
| --------------------------------- | --------------------------------------------------------------- |
| No browser globals in `render()`  | `render()` uses only Lit templates and controller state         |
| No DOM access during construction | All DOM-dependent setup deferred to `firstUpdated()`            |
| All properties have safe defaults | Every `@property` has an explicit default value                 |
| Hydration-safe initial render     | Before `firstUpdated`, `render()` returns a minimal empty shell |

## Dependencies

| Package           | Size impact | Why it's needed                                                                                                                                                                              |
| ----------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moment-timezone` | ~600 KB     | IANA timezone resolution (`moment.tz()`), DST-safe date arithmetic (`add`/`subtract` across spring-forward boundaries), and timezone-aware formatting across 9 source files (70+ call sites) |
| `cally`           | ~15 KB      | Lightweight `<calendar-date>` custom element used for the inline date picker in day view and the header date picker dropdown                                                                 |

### Bundle-size mitigation

This package publishes raw TypeScript `src/` plus a small `index.js` version-routing shim — no bundle step in this repo. Consumer applications (e.g. karuna) install the published tarball and run their own Rollup build, which externalizes `moment-timezone` from the SSR bundle and code-splits it on the client so it is fetched only when `<aiux-appointment-calendar>` actually renders.

### Long-term migration path

Once the [TC39 Temporal proposal](https://tc39.es/proposal-temporal/docs/) reaches Stage 4 and ships in all supported browsers, `moment-timezone` can be replaced with the built-in `Temporal.ZonedDateTime` API — eliminating the timezone data bundle entirely. Until then, `moment-timezone` remains the most battle-tested option for timezone-correct calendar arithmetic.

## Running tests

```bash
# Unit + render tests (happy-dom)
pnpm test

# With coverage
pnpm test:coverage

# Functional tests (real Chromium via Playwright)
pnpm test:functional

# Run functional tests in headed mode (visible browser window)
HEADLESS=false pnpm test:functional
```
