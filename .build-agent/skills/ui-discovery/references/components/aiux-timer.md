# @servicenow/aiux-timer

## Import

```js
import '@servicenow/aiux-timer';
```


Live timer web component — Karuna (Lit SSR) port of the Seismic `sn-timer`.
Supports two operating modes: **stopwatch** (counts up) and **countdown**
(counts down with start/stop control).

## Usage

```html
<!-- Stopwatch mode (default) — counts up from start-time -->
<aiux-timer start-time="2025-01-01T00:00:00Z"></aiux-timer>

<aiux-timer
  start-time="2025-01-01T00:00:00Z"
  end-time="2025-01-02T00:00:00Z"
  min-resolution="minutes"
  size="md"
  icon="clock"
></aiux-timer>

<!-- Countdown mode — counts down from 5 minutes -->
<aiux-timer mode="countdown" count-down="300" size="md"></aiux-timer>
```

## Properties

| Property        | Attribute        | Type     | Default       | Mode      | Description                                                            |
| --------------- | ---------------- | -------- | ------------- | --------- | ---------------------------------------------------------------------- |
| `mode`          | `mode`           | `String` | `'stopwatch'` | both      | Operating mode: `'stopwatch'` (count up) or `'countdown'` (count down) |
| `startTime`     | `start-time`     | `String` | `''`          | stopwatch | ISO-8601 date string for when the timer starts (must be in the past)   |
| `endTime`       | `end-time`       | `String` | `''`          | stopwatch | ISO-8601 date string for the maximum end time                          |
| `countDown`     | `count-down`     | `Number` | `0`           | countdown | Countdown duration in seconds (max 86 399 = 23:59:59)                  |
| `minResolution` | `min-resolution` | `String` | `'seconds'`   | both      | Smallest unit shown: `'seconds'` or `'minutes'`                        |
| `size`          | `size`           | `String` | `'sm'`        | both      | Display size: `'sm'` or `'md'`                                         |
| `icon`          | `icon`           | `String` | `''`          | both      | Optional icon name rendered before the time label                      |
| `configAria`    | `config-aria`    | `Object` | `null`        | both      | ARIA configuration object (`{ 'aria-label': string }`)                 |

## Config Properties

Set via the platform Config Editor (`configSchema`), **not** as HTML attributes.
Each overrides the matching `@property` when a page admin configures it; the
read site resolves as `configX ?? x`, so an unset config value (the default)
leaves the developer-set property in effect.

| Property              | Type     | Label              | Default     | Description                                                     |
| --------------------- | -------- | ------------------ | ----------- | --------------------------------------------------------------- |
| `configSize`          | `String` | Size               | `undefined` | Overrides `size`: `'sm'` (Small, default) or `'md'` (Medium)    |
| `configIcon`          | `String` | Icon               | `undefined` | Overrides `icon`: optional icon name rendered before the label  |
| `configMinResolution` | `String` | Minimum Resolution | `undefined` | Overrides `minResolution`: `'seconds'` (default) or `'minutes'` |

## Events

All events bubble and are composed.

| Event                      | Detail                   | Description                                                                                                                                                |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiux-timer:timer-ended`   | `{ reason, elapsed }`    | Timer finished (`'End Time Reached'`), misconfigured (`'Invalid Start Time'`), or disconnected (`'Component Disconnected'`). `elapsed` is seconds counted. |
| `aiux-timer:timer-started` | `{ duration, elapsed }`  | Countdown started. `duration` is total seconds; `elapsed` is seconds already counted (relevant after pause/resume).                                        |
| `aiux-timer:timer-stopped` | `{ remaining, elapsed }` | Countdown paused. `remaining` is seconds left; `elapsed` is seconds counted so far.                                                                        |

Event name constants are exported as `TIMER_EVENTS` for programmatic use.

## File Structure

```
src/
├── timer.ts                  # Component class (AIUXElement)
├── index.ts                  # Public entry point (re-exports)
├── controllers/
│   └── TimerController.ts    # Reactive controller: interval, tick, countdown logic
├── types/
│   └── timer.types.ts        # TypeScript types, interfaces, and constants
├── utils/
│   └── timer-utils.ts        # Pure formatting / computation utilities
└── stories/
    ├── timer-stopwatch.stories.ts
    └── timer-countdown.stories.ts
```

## Stopwatch Mode

Default mode. Counts **up** from `start-time`, optionally capped by `end-time`.

- Display format auto-adapts: `MM:SS` when < 1 h, `HH:MM:SS` when ≥ 1 h,
  `D.HH:MM:SS` when ≥ 24 h
- Fires `timer-ended` when `end-time` is reached or the component disconnects
- Set `min-resolution="minutes"` to hide seconds (always `HH:MM` / `D.HH:MM`)

## Countdown Mode

Set `mode="countdown"` and `count-down` (seconds, max 86 399).

- Display format adapts: `MM:SS` when < 1 h, `HH:MM:SS` when ≥ 1 h
- Renders a start/stop toggle button next to the badge
- The configured start value (e.g. `05:00` for `count-down="300"`) and the
  enabled toggle button render immediately, deterministically from the
  `count-down` prop — including during SSR (see [SSR Behavior](#ssr-behavior))
- Fires `timer-started` on play, `timer-stopped` on pause, `timer-ended` at zero
- Set `min-resolution="minutes"` to hide seconds (same as stopwatch mode)
- `count-down="0"` displays `00:00` with the start button disabled (no error)

## Accessibility

- **`role="timer"`** on the main element with a human-readable `aria-label`
- **`aria-live="polite"` region** — a visually-hidden status region announces
  elapsed/remaining time to screen readers every 30 seconds and immediately
  when the timer ends
- **`aria-atomic="true"`** ensures the full announcement is read each time
- **`configAria`** supports an `aria-label` override that is prefixed to the
  displayed time
- Countdown toggle button has a dynamic `aria-label` ("Start" / "Stop")

## Localization

All user-facing strings are wrapped with `msg()` and `str` from
[`@lit/localize`](https://lit.dev/docs/localization/overview/), making the
component ready for the Karuna translation pipeline.

| String                           | API                                                    | Example output              |
| -------------------------------- | ------------------------------------------------------ | --------------------------- |
| Static messages                  | `msg('Invalid Time')`                                  | `Invalid Time`              |
| Duration units (singular/plural) | `msg(str\`${n} minute\`)` / `msg(str\`${n} minutes\`)` | `5 minutes`                 |
| Timer ended announcement         | `msg(str\`Timer ended at ${duration}\`)`               | `Timer ended at 30 minutes` |
| Zero fallbacks                   | `msg('0 seconds')` / `msg('0 minutes')`                | `0 seconds`                 |
| Toggle button labels             | `msg('Start')` / `msg('Stop')`                         | `Start` / `Stop`            |

To add a new locale, generate a translation file via the `@lit/localize`
toolchain and register it with `configureLocalization()`.

## Exports

The package entry point (`index.ts`) re-exports:

```typescript
import {
  // Component
  Timer,
  // Constants
  DURATION_FORMATS,
  TIMER_EVENTS,
  END_TIME_REACHED_REASON,
  COMPONENT_DISCONNECTED_REASON,
  INVALID_START_TIME_REASON,
  MAX_COUNTDOWN,
  // Types
  type DurationFormat,
  type TimerSize,
  type TimerMode,
  type MinResolution,
  type TimerAriaConfig,
  type TimerEndedReason,
  type TimerEndedDetail,
  type TimerStartedDetail,
  type TimerStoppedDetail
} from '@servicenow/aiux-timer';
```

## Caveats

- **`startTime` must be in the past (stopwatch mode).** A future `startTime`
  produces negative elapsed time, which is returned as `'Invalid Time'`. The
  component then immediately fires `aiux-timer:timer-ended` with
  reason `'Invalid Start Time'` and stops the interval. An unparseable
  `startTime` (e.g. `'not-a-date'`) behaves the same way. Callers should
  validate that `startTime` is a valid, past date before setting it.
- **`countDown` max is 86 399 seconds (countdown mode).** Negative values,
  `NaN`, or values exceeding 86 399 display `'Invalid Time'`.
  `countDown=0` is valid and displays `00:00` with the start button disabled.

## SSR Behavior

`render()` is deterministic — given the same props it produces identical markup
on the server and the client, so hydration never mismatches (Karuna SSR Rule 3).
The initial display and the toggle button's enabled state are derived from
props, not from client-only state:

- **Stopwatch:** before the client interval starts, the display shows the
  `00:00` placeholder; the first client-side `_tick()` then replaces it with the
  live elapsed time.
- **Countdown:** the start value (e.g. `05:00` for `count-down="300"`) is
  derived from the `count-down` prop and rendered immediately, including during
  SSR — a countdown does not tick until the user presses start, so it must not
  fall back to `00:00`. The start/stop button's `disabled` state is derived the
  same way, so the server renders the button enabled (unless `count-down="0"`)
  and the hydrated client agrees. Matching markup is what lets the play/pause
  `@click` binding survive hydration.

The 1-second interval that drives live updates runs only on the client via
`connectedCallback()` / `updated()`; the constructor stays pure.

This follows Karuna SSR rules:

- **Rule 3** (deterministic render) — no `Date` calls in `render()`; the
  countdown's initial display/enabled state come from the `count-down` prop
- **Rule 4** (pure constructor) — only default values set

## Changelog

### patch — DEF0887352

- **fix:** Countdown mode no longer renders a stale `00:00` with a dead
  start/stop button under SSR. The initial display value and the toggle
  button's enabled state are now derived deterministically from the
  `count-down` prop in `render()`, so the server markup matches the hydrated
  client and the play/pause click binding survives hydration.
- **refactor:** Extracted the countdown validity/clamp rule into a shared
  `isValidCountdown()` helper in `timer-utils.ts`, used by both
  `TimerController.initCountdown()` and `Timer._initialCountdownMs()`.
- **refactor:** Renamed `controllers/timer.controller.ts` to
  `controllers/TimerController.ts` to match the file-naming convention.

### minor — STRY63210328

Rewrite `aiux-timer` in TypeScript with countdown mode, enhanced
accessibility, and full test coverage.

- **feat:** Add countdown mode with start/stop toggle button and
  `timer-started` / `timer-stopped` / `timer-ended` events
- **feat:** Add `configAria` property for ARIA label overrides
- **feat:** Add `min-resolution` property to hide seconds
- **feat:** Add `aria-live="polite"` region with periodic screen-reader
  announcements (every 30 s) and immediate end-of-timer announcement
- **feat:** Add elapsed seconds to all event payloads
- **feat:** Export reason constants, type definitions, and `TIMER_EVENTS`
  from package entry point
- **fix:** `disconnectedCallback` no longer fires a spurious `timer-ended`
  event when the timer was never started or already finished
- **fix:** Unparseable `startTime` now fires `timer-ended` with
  reason `'Invalid Start Time'` instead of `'End Time Reached'`
- **fix:** `_getElapsedSeconds()` returns `0` when `_startTimeMs` is
  uninitialized instead of a bogus value
- **refactor:** Extracted `decomposeMs()` and `pluralize()` helpers to
  reduce cognitive complexity and eliminate duplicate logic
- **refactor:** Moved formatting utilities into `timer-utils.ts`
- **test:** Full Vitest coverage for stopwatch, countdown, utilities,
  edge cases, and accessibility announcements
