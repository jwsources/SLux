# @servicenow/aiux-sla

## Import

```js
import '@servicenow/aiux-sla';
```


Migrated from `crm-aiux-sla` (`app-crm-ainpx-agent/widgets/crm-aiux-sla`). This is the published library replacement intended for consumption by any AIUX application, not just CRM.

Displays SLA (Service Level Agreement) status, time remaining, and progress for a given task, built with Lit for the Karuna platform.

Extends `AIUXWidgetElement` and uses a server-script (`server/server-script.js`) to fetch SLA data via `GlideRecordSecure` on the ServiceNow instance.

Supports two display modes:

- **Card mode** (default) -- full layout with progress bars, expand/collapse for multiple SLAs, and a severity-sorted list.
- **Time mode** -- compact inline chip showing the highest-severity SLA.

## Project structure

```
src/
├── styles/
│   └── sla.styles.ts            # Component CSS (card, progress bars, empty-message)
├── templates/
│   └── sla.templates.ts         # Render functions (renderRoot, renderSlaRow, renderTimeMode, etc.)
├── types/
│   └── sla.types.ts             # Shared interfaces and type aliases
├── utils/
│   └── sla.utils.ts             # Pure helpers (sortSlasBySeverity, getStatusLabel, formatSlaTimeText, etc.)
├── sla.ts                       # Main component class (properties, lifecycle, data fetching)
└── index.ts                     # Barrel re-exports
server/
└── server-script.js             # Server-side GlideRecordSecure query (runs on the instance)
```

Render templates are extracted into `templates/sla.templates.ts` as standalone
functions that accept an `SlaRenderContext`, keeping the component class focused
on state, lifecycle, and data fetching.

## Usage

```html
<!-- Server-script fetch via task sys_id -->
<aiux-sla sys-id="a1b2c3d4e5f6"></aiux-sla>

<!-- Pre-populated items (dev/test) -->
<aiux-sla .items="${slaItems}"></aiux-sla>

<!-- Time mode (compact chip) -->
<aiux-sla mode="time" .items="${slaItems}"></aiux-sla>
```

## Properties

| Property | Attribute | Type       | Default  | Description                                                  |
| -------- | --------- | ---------- | -------- | ------------------------------------------------------------ |
| `sysId`  | `sys-id`  | `String`   | `''`     | Task sys_id; triggers a server-script fetch when set         |
| `items`  | `items`   | `SlaItem[]`| `[]`     | Dev/test override; pass SLA items directly to bypass fetch   |
| `mode`   | `mode`    | `String`   | `'card'` | Display mode: `'card'` (full layout) or `'time'` (compact)  |

### `SlaItem` interface

Defined in `src/types/sla.types.ts` and re-exported from the barrel.

```ts
type SlaStatus = 'breached' | 'at-risk' | 'ongoing' | 'paused';
type SlaTimeKind = 'left' | 'elapsed';

interface SlaItem {
  id: string;
  label: string;
  status: SlaStatus;
  timeMs?: number;         // raw remaining/elapsed business time in ms
  timeKind?: SlaTimeKind;  // whether timeMs is time 'left' or 'elapsed'
  progress: number;        // 0-100+, can exceed 100 when breached
}
```

The display string (e.g. "2h 30m left", "1h 15m elapsed") is **not** carried on
`SlaItem`. It is built on the client at render time from `timeMs` + `timeKind`
via `formatSlaTimeText()`, so both the duration units and the "left" / "elapsed"
wrapper are localised for the active locale (see [Localisation](#localisation-i18n)).

### `TaskSlaRecord` interface

Raw REST API record shape (mirrors the fields the server-script reads from
`task_sla`).

```ts
interface TaskSlaRecord {
  sys_id?: {value?: string} | string;
  sla?: {value?: string; display_value?: string} | string;
  stage?: {value?: string} | string;
  has_breached?: {value?: boolean | string} | boolean | string;
  business_percentage?: {value?: string | number} | string | number;
  planned_end_time?: {value?: string} | string;
  start_time?: {value?: string} | string;
  business_time_left?: {display_value?: string} | string;
  business_elapsed_time?: {display_value?: string} | string;
}
```

## Data fetching

The component uses a server-script (`server-script.js`) that runs on the
ServiceNow instance when `this.server.get({ sysId })` is called. The script
queries the `task_sla` table using `GlideRecordSecure` (ACL-enforced) and
returns pre-transformed `SlaItem[]` on `response.slas`.

Data resolution priority:

1. `items` property (direct injection, for dev/test) -- a non-empty value is a complete override and suppresses loading/error UI and the server fetch
2. `this.data?.slas` (SSR server data) -- only used while `this.data.sysId` matches the current `sysId`, so stale SSR records are discarded once the task changes
3. `_fetchedSlas` (data fetched via `server.get()`)

## Visual states

### Card mode

| State        | Condition                            | Renders                                  |
| ------------ | ------------------------------------ | ---------------------------------------- |
| **Empty**    | No items, not loading, no error      | Card with "No SLAs" text                |
| **Loading**  | Fetch in progress, no items          | Card with "Loading..." text             |
| **Error**    | Fetch failed, no items               | Card with error message                  |
| **Single**   | One item                             | Single card with label, time, badge, bar |
| **Multiple** | Multiple items                       | Card with list, footer, toggle button    |

### Time mode

| State        | Condition                            | Renders                                  |
| ------------ | ------------------------------------ | ---------------------------------------- |
| **Visible**  | Items present, not loading/error     | Compact badge with clock, time, status   |
| **Hidden**   | No items, loading, or error          | `nothing` (empty host)                   |

## SLA selection rules

### Step 1 -- Filter

Records with `stage = Complete` are excluded from display.

### Step 2 -- Status classification

Each remaining `task_sla` record is assigned a status using the first matching rule:

| # | Condition                      | Status       |
|---|-------------------------------|--------------|
| 1 | `has_breached = true`          | **Breached** |
| 2 | `stage = Paused`               | **Paused**   |
| 3 | `business_percentage >= 75%`   | **At Risk**  |
| 4 | _(none of the above)_          | **Ongoing**  |

### Step 3 -- Sort order

SLAs are sorted by severity (highest first):

```
Breached  >  At Risk  >  Ongoing  >  Paused
```

Within the same status, the SLA with the higher `progress` value ranks first.

### Step 4 -- Display

- **Top SLA** (position 1 after sort) is always visible.
- Remaining SLAs are collapsed behind a "Show all" toggle.
- The footer summarises hidden SLAs: e.g. `+ 1 at risk . 2 ongoing`.

## Progress bar colours

| Status    | CSS Class         | Colour                                   |
| --------- | ----------------- | ---------------------------------------- |
| Breached  | `progress-error`  | `var(--color-error)` (red)               |
| At Risk   | `progress-warning`| `var(--color-warning)` (yellow/orange)   |
| Ongoing   | `progress-success`| `var(--color-success)` (green)           |
| Paused    | `progress-neutral`| `var(--color-border-default)` (grey)     |

## Accessibility

- SLA list uses `role="list"` / `role="listitem"`.
- Progress bars have `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- The expand/collapse toggle uses `aria-expanded` and `aria-controls`.
- The summary text for hidden SLAs uses `aria-live="polite"` for screen reader announcements.
- Time mode chip has an `aria-label`.

## Localisation (i18n)

All user-facing strings (status labels, button text, empty-state and loading messages, accessible labels, and the SLA time text) are wrapped in `msg()` / `str` from `@lit/localize`, per the repo's localisation rules, and resolved at render time so the active locale is picked up correctly.

Time text is fully localised: the server-script returns a raw duration (`timeMs`) plus a `timeKind` discriminator, and the client builds the display string via `formatSlaTimeText()`. This uses `Intl.NumberFormat({style: 'unit', unitDisplay: 'narrow'})` for the duration (so the `d`/`h`/`m`/`s` unit markers are locale-correct rather than hard-coded English) combined with a translatable "left" / "elapsed" phrase. Formatting deliberately does not run in the server-script, which executes in the ServiceNow Rhino runtime with no access to `@lit/localize` or `Intl` unit formatting.

## Public API

The package's public surface is the `<aiux-sla>` custom element (the `SLA`
class) plus the `SlaItem`, `SlaStatus`, `SlaDisplayMode`, and `TaskSlaRecord`
types for typing the `items` property. The internal transform/formatting
helpers are implementation details and are intentionally not exported.

## Development

```bash
pnpm dev          # Launch local dev sandbox
pnpm test         # Run unit tests
pnpm test:coverage # Run tests with coverage
pnpm lint         # ESLint
```
