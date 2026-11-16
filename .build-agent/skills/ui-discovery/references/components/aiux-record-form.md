# @servicenow/aiux-components-record

## Import

```js
import '@servicenow/aiux-components-record';
```


Record package that provides data fetching, provider, APIs, and components for ServiceNow records. Most record [components](#components) must be rendered inside an `<aiux-record-provider>`; a few (e.g. `<aiux-record-related-lists>` in standalone mode and `<aiux-email-client-mini-composer>`) can be used outside the provider. Consumers combine these primitives with Record APIs into their own page layouts.

## Architecture Overview

The record package follows a **provider → API → component** layered architecture:

1. **`RecordConfig`** — The shared configuration interface (`table`, `sysId`, `view?`, `ignoreUserViewPreference?`, `forcedViewName?`, `query?`, `isCoreUI?`, plus collection fields) that both `RecordDataManager` and `AIUXRecordProvider` consume. It is the contract that keeps data fetching and the provider aligned on which record to target.

2. **`RecordDataManager`** — A presentation-agnostic data fetching layer. Builds and executes GraphQL queries against ServiceNow instance. Accepts `RecordConfig` and is isolated from the component tree so it can be called in a **loader function** (SSR-compatible).

3. **`AIUXRecordProvider`** (`<aiux-record-provider>`) — The runtime orchestrator. Accepts a `RecordFetchResult` via the `.data` property (from a loader) or fetches data on its own client-side. Extracts config (`table`, `sysId`, `view`, `query`) and raw GraphQL data from the result, transforms it, hydrates the API layer, and sets up the client scripting environment. Publishes `RecordContext` for descendant components.

4. **APIs** — Typed façades (Form, Actions, Activity, Compose, Common, Domain, RelatedList, User, Presence, Email, Citation) that each consume only the data sources they need and expose getters/methods for components.

5. **Components** — Lit elements that extend `AIUXRecordElement`, consume context, and render UI.

```
┌───────────────────────────────────────────────────────┐
│  Loader (SSR)                                         │
│  const result = await RecordDataManager.fetchRecord(  │
│    {table, sysId},                                    │
│    [RecordAPIKey.Form]                                │
│  );                                                   │
└──────────────┬────────────────────────────────────────┘
               │ .data=${result}
               ▼
┌───────────────────────────────────────────────────────┐
│  <aiux-record-provider>                               │
│  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐   │
│  │ FormAPI │ │ActionsAPI│ │UserAPI │ │ActivityAPI │   │
│  └────┬────┘ └────┬─────┘ └───┬────┘ └─────┬──────┘   │
│       │           │           │            │          │
│  ┌────▼───────────▼───────────▼────────────▼──────┐   │
│  │                 RecordContext                  │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
                        │
     ┌──────────────────┼──────────────────┐
     ▼                  ▼                  ▼
  <aiux-record-     <aiux-record-      <aiux-record-
     form>         activity-stream>    activity-compose>
```

> **Working on the provider internals?** This README documents the **public surface** of the package — how to consume it from a page. For contributor-facing deep dives on the provider itself (lifecycle phases, SSR/CSR data flow, services, and how to build new APIs), see:
>
> - [`src/provider/README.md`](./src/provider/README.md) — system overview, SSR + CSR data-flow diagrams, dataSources contract
> - [`src/provider/apis/README.md`](./src/provider/apis/README.md) — building APIs: `BaseAPI` vs `DatalessBaseAPI`, lifecycle hooks, `IXxxAPI` interface contract
> - [`src/provider/services/README.md`](./src/provider/services/README.md) — services architecture, why transport is per-Provider

---

## RecordConfig

`RecordConfig` is the shared configuration interface used by both `RecordDataManager` and `AIUXRecordProvider`. It ensures the two are always aligned on which record to target.

```typescript
interface RecordConfig {
  table: string;
  sysId: string;
  view?: string;
  ignoreUserViewPreference?: boolean;
  forcedViewName?: string;
  query?: string;
  isCoreUI?: boolean;
  // Related-list / collection context (create-from-related-list)
  parentTable?: string;
  parentRecordSysId?: string;
  linkCollection?: string;
  collectionKey?: string;
  collectionRelatedField?: string;
  collectionRelationship?: string;
}
```

- **`RecordDataManager.fetchRecord(config)`** accepts `RecordConfig` to build the GraphQL query variables.
- **`AIUXRecordProvider`** exposes the same fields as element properties (`table`, `sysId`, `view`, `ignoreUserViewPreference`, `forcedViewName`, `query`, `isCoreUI`, and the collection fields below).
- **`isCoreUI`** flags that the consumer is a core-ui style record page. It affects backend view-resolution behavior and controls which client scripts the server returns: `true` requests Desktop + All UI scripts, `false` requests Mobile / Service Portal + All UI scripts. Defaults to `true`.

### View resolution

The `view`, `ignoreUserViewPreference`, and `forcedViewName` props work together in the same way ServiceNow resolves a requested view:

| Props set                           | Behavior                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `view` only                         | Use `view` as the fallback when there is **no user view preference** and **no view rule** that would pick a different view.        |
| `view` + `ignoreUserViewPreference` | Use the supplied `view` and ignore the user's view preference, but still allow **view rules** to resolve a different view.         |
| `view` + `forcedViewName`           | Render with the exact view provided; do **not** honor user preference **or** view rules. `forcedViewName` is the strictest option. |

- **`view`** — Fallback view. It is used only when nothing else (user preference or view rules) overrides it.
- **`ignoreUserViewPreference`** — Skip the user's stored view preference, but still let view rules run against the supplied `view`.
- **`forcedViewName`** — Use this view exactly; bypasses both user preference and view-rule resolution.

By sharing a single interface, the loader and the provider always agree on the record identity, view, and query — no matter whether data is fetched server-side or client-side.

---

## RecordDataManager

A static class responsible for building GraphQL queries and fetching record data. It is **completely decoupled** from the presentation layer, making it safe to call in SSR loader functions.

```javascript
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux-components-record';

// RecordConfig — fetch all data sources (default)
const rawData = await RecordDataManager.fetchRecord({
  table: 'incident',
  sysId: 'abc123',
  view: 'default view'
});

// RecordConfig — fetch only data sources required by specific APIs
const formOnlyData = await RecordDataManager.fetchRecord(
  {table: 'incident', sysId: 'abc123'},
  [RecordAPIKey.Form]
);
```

`RecordDataManager.fetchRecord` returns a `RecordFetchResult` — a single object that combines the `RecordConfig` fields, the GraphQL response (`data`, `errors`), and any `requiredAPIs` that were requested. This result is passed as a single `.data` property to `<aiux-record-provider>`, which extracts config and data internally — no manual remapping needed.

```typescript
type RecordFetchResult = GraphQLResponse<PartialRecordDataQuery> &
  RecordConfig & {
    requiredAPIs?: RecordAPIKey[];
  };
```

It resolves which data sources to query by looking up each `RecordAPIKey` in an internal `API_REGISTRY` that maps API keys to their `requiredDataSources`.

---

## AIUXRecordProvider

The `<aiux-record-provider>` element is the heart of the record package. It:

1. Instantiates all API objects (Form, Actions, Activity, Compose, Common, Domain, RelatedList, User, Presence, Email, Citation)
2. Accepts raw data via the `data` property **or** fetches data on the client autonomously
3. Transforms and hydrates the raw GraphQL response into each API
4. Initializes the **client scripting environment** (required by Form and Actions APIs)
5. Publishes `RecordContext` so descendant components can consume APIs

### Properties

| Property                                                             | Type                          | Default | Description                                                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`                                                               | `RecordFetchResult`           | —       | Pre-fetched result from `RecordDataManager.fetchRecord()`. Contains config, GraphQL data/errors.                                                  |
| `table`                                                              | `String`                      | `''`    | Table name (e.g. `'incident'`). Overrides `data.table` when both are set.                                                                         |
| `sysId`                                                              | `String`                      | `''`    | Record sys_id. Overrides `data.sysId` when both are set.                                                                                          |
| `view`                                                               | `String`                      | `''`    | View name. Overrides `data.view` when both are set.                                                                                               |
| `ignoreUserViewPreference` (attribute `ignore-user-view-preference`) | `Boolean`                     | `false` | Ignore the user's view preference, but still allow view rules to resolve against the supplied `view`.                                              |
| `forcedViewName` (attribute `forced-view-name`)                      | `String`                      | `''`    | Force a specific view, bypassing the user's view preference for the table.                                                                        |
| `query`                                                              | `String`                      | `''`    | Encoded query. Overrides `data.query` when both are set.                                                                                          |
| `isCoreUI` (attribute `is-core-ui`)                                  | `Boolean`                     | `true`  | Backend hint that the consumer is a core-ui style record page.                                                                                    |
| `parentTable` (attribute `parent-table`)                             | `String`                      | `''`    | Parent record's table (create-from-related-list). Carried on all collection types — see [Related-list context](#related-list-collection-context). |
| `parentRecordSysId` (attribute `parent-record-sys-id`)               | `String`                      | `''`    | Parent record's sys_id, paired with `parentTable`.                                                                                                |
| `collectionKey` (attribute `collection-key`)                         | `String`                      | `''`    | Field pointing to the parent. One-to-many: an FK on the new record (prefilled). Many-to-many: the parent-side field on the link table.            |
| `linkCollection` (attribute `link-collection`)                       | `String`                      | `''`    | Many-to-many intermediate link table. On submit the server inserts the link row.                                                                  |
| `collectionRelatedField` (attribute `collection-related-field`)      | `String`                      | `''`    | M2M link-table field pointing to the newly created record.                                                                                        |
| `collectionRelationship` (attribute `collection-relationship`)       | `String`                      | `''`    | Defined relationship (`sys_relationship`) sys_id/name. Prefills the new record and runs its insert callback.                                      |
| `contextId` (attribute `context-id`)                                 | `String`                      | `''`    | Optional identifier for scoped context lookup via `RecordContext.getById()`.                                                                      |
| `requiredAPIs`                                                       | `RecordAPIKey[]`              | —       | Explicitly limit which APIs (and their data sources) to fetch. Overrides `data.requiredAPIs`.                                                     |
| `showErrorDetails` (attribute `show-error-details`)                  | `Boolean`                     | `false` | Show error stack in the UI                                                                                                                        |
| `disablePresence` (attribute `disable-presence`)                     | `Boolean`                     | `false` | Disable presence tracking for contexts (e.g. embeddable apps) that should not expose which users are viewing the record.                          |
| `exposeActionsToChat` (attribute `expose-actions-to-chat`)           | `Boolean`                     | `true`  | When `false`, UI actions are still registered page-wide but not advertised to chat/LLM surfaces.                                                  |
| `onOpenRecord`                                                       | `Function`                    | —       | Callback `(table, sysId) => void` for opening related records.                                                                                    |
| `onOpenList`                                                         | `Function`                    | —       | Callback `(table, query?) => void` for opening a list.                                                                                            |
| `onRecordLoaded`                                                     | `Function`                    | —       | Callback `(table, contextId) => void` fired once per successful full load/reload, after all APIs' `_postInitialize()` have run. Does not fire on partial single-API reloads or on the error path. Resolve `RecordContext.getById(contextId)` inside the callback for the full `RecordContextValue`. |
| `formHandlers`                                                       | `RecordHandlers`              | `{}`    | Handlers (`onChange`, `onSubmitSucceeded`, …) registered with the form environment, used by `g_modal.showForm`.                                   |
| `notifications`                                                      | `NotificationsConfig \| null` | —       | Notification handling overrides. See [Notifications](#notifications) below.                                                                       |

When `.data` is set, the provider uses the GraphQL response from it for the initial render (including SSR). It also extracts `table`, `sysId`, `view`, `query`, and `requiredAPIs` so the provider knows which record to target on subsequent client-side reloads. Config properties set directly on the element (e.g. `view="workspace"`) take precedence over values inside `data` on subsequent client-side reloads.

### Related-list (collection) context

When a record is created from a related list, the provider carries "collection" context describing how the new child relates to its parent. These map to the classic UI16 `sysparm_*` collection params (the core-ui record page performs that URL → property mapping), and the behavior depends on the relationship type:

| Relationship                   | Properties used                                                        | Effect                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Parent context** (all cases) | `parentTable`, `parentRecordSysId`                                     | Sent on the GraphQL fetch; the server loads the parent as the `parent` scripting global, used by reference qualifiers, UI-action conditions, and defined-relationship prefill. |
| **One-to-many**                | `collectionKey` (+ parent)                                             | The child has a foreign-key field to the parent; it's prefilled by an encoded query (`<collectionKey>=<parentRecordSysId>`).                                                   |
| **Many-to-many**               | `linkCollection`, `collectionKey`, `collectionRelatedField` (+ parent) | On submit, the server inserts a row in the link table joining the parent (via `collectionKey`, a field on the link table) and the new record (via `collectionRelatedField`).   |
| **Defined relationship**       | `collectionRelationship` (+ parent)                                    | A `sys_relationship`: on load its "Query with" script prefills the new record; on submit its insert callback runs.                                                             |

These fields are grouped as a `CollectionContext` type shared by `RecordConfig` and the API config. Note that full parent linking/prefill also requires the corresponding backend (glide-ng) support for the form-fetch and submit params.

### Notifications

The provider surfaces form notification events (errors, warnings, info messages, etc.) triggered by client scripts via `g_form`. You can control how these are handled through the `notifications` property.

**Behavior by value:**

- **`undefined` (default)** — Default handling applies. The provider logs notification events internally and will delegate to the page alert service once available.
- **`null`** — Suppresses all notification handling. No callbacks are invoked and no action will be taken.
- **`{ onAdd, onRemove, onClear }`** — Custom handlers. `onAdd` is called when a notification is added (with an optional `id`); `onRemove` is called when a notification is removed by id; `onClear` is called when all notifications are cleared.

```typescript
type NotificationsConfig = {
  onAdd?: (
    type: FormNotificationType,
    message: string,
    preventDuplicates?: boolean,
    id?: string
  ) => void;
  onRemove?: (id: string) => void;
  onClear?: () => void;
};
```

#### Example — custom notification handlers

```javascript
render() {
  return html`
    <aiux-record-provider
      table="incident"
      sysId="abc123"
      .notifications=${{
        onAdd: (type, message, preventDuplicates) => {
          console.log(`[${type}] ${message}`, { preventDuplicates });
        },
        onClear: () => {
          console.log('Notifications cleared');
        }
      }}
    >
      <aiux-record-form></aiux-record-form>
    </aiux-record-provider>
  `;
}
```

#### Example — suppress all notifications

```javascript
render() {
  return html`
    <aiux-record-provider
      table="incident"
      sysId="abc123"
      .notifications=${null}
    >
      <aiux-record-form></aiux-record-form>
    </aiux-record-provider>
  `;
}
```

### Invoking UI Actions (action registry)

The provider registers the record's form UI actions (Save, Update, Delete, and any custom UI actions) into the **page-wide action registry** — done by `ActionsAPI` at the end of `_postInitialize` (and unregistered in `_teardown`). `ActionsAPI` owns its registry identity (an internal owner token), so the provider element is **not** involved — it declares no `aiContext` and uses no widget-context mixin.

By default the registry **advertises** these actions to chat from its own AIEL context slice, so chat sees them up front and can call `execute_action(action_ref, widget_id?, args?)` in a single step. Set the **`expose-actions-to-chat`** attribute to `false` on `<aiux-record-provider>` to register the actions registry-only (still runnable on-page / widget-to-widget, but not surfaced to the LLM). `execute_action` is registered once on the app layout (core-ui ships it on `aiux-nav-layout`; other apps opt in via `layoutOverrides.client_tools` — see `EXECUTE_ACTION_TOOL` in `@servicenow/aiux-components-core`). With `widget_id` omitted `execute_action` **broadcasts** to every widget that owns the ref (e.g. two forms for the same table both run); with `widget_id` given (from an action's `owners`) it targets one form.

Each action is registered under its **sys_id** as `action_ref` (stable across display-name churn); the human-readable name is the registry entry's `label`. Actions are registered **after the record's data has loaded** (`_postInitialize` runs after each load/reload), so look them up after the form renders.

#### Discover and invoke registered actions

The registry is exported from `@servicenow/aiux-components-core` and is global — no element reference needed:

```javascript
import {listActions, executeAction} from '@servicenow/aiux-components-core';

// Inspect available actions and their readable labels
console.table(listActions().map(a => ({ref: a.actionRef, label: a.label})));

// Find an action by label, then run it by ref
const action = listActions().find(a => /set short desc/i.test(a.label));
await executeAction(action.actionRef, {});

// Or, if you already know the action's sys_id:
await executeAction('<sys_id>', {});
```

Subscribe to changes by declaring `static contexts = [actionRegistryContext]` on a consumer; the registry publishes a fresh snapshot whenever a widget registers or removes actions. See `examples/action-registry/` for a runnable end-to-end demo (including custom, non-UI actions and an `<aiux-action-bar>` built with `toActionColumns`).

### SSR with Loader (recommended)

Fetch in the loader, store the `RecordFetchResult` in a context, and pass it as a single `.data` property. The provider extracts config and GraphQL data internally — no manual remapping needed.

```javascript
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux-components-record';
import {AIUXElement, createContext} from '@servicenow/aiux-components-core';

export const record = createContext('record', null);

@customElement('my-record-page')
class MyRecordPage extends AIUXElement {
  static contexts = [record];

  static async loader(ctx) {
    const {table, recordId} = ctx.params;
    const data = await RecordDataManager.fetchRecord({table, sysId: recordId}, [
      RecordAPIKey.Form,
      RecordAPIKey.Activity
    ]);
    record.set(data);
  }

  render() {
    return html`
      <aiux-record-provider .data=${record.get()}>
        <aiux-record-form></aiux-record-form>
        <aiux-record-activity-stream></aiux-record-activity-stream>
      </aiux-record-provider>
    `;
  }
}
```

### Client-Side Connected Mode (no data prop)

If you don't pass the `data` property, the provider will fetch data on its own when `table` and `sysId` are set. This is the "connected" mode — useful for purely client-side rendered pages.

```javascript
render() {
  return html`
    <aiux-record-provider table="incident" sysId="abc123">
      <aiux-record-form></aiux-record-form>
    </aiux-record-provider>
  `;
}
```

---

## Partial Data Fetching (requiredAPIs)

By default, the provider fetches **all** data sources for every API. You can limit this to only what you need.

### Explicit — CSR (provider prop)

Pass `requiredAPIs` on the provider in connected mode:

```javascript
html`
  <aiux-record-provider
    table="incident"
    sysId="abc123"
    .requiredAPIs=${[RecordAPIKey.Form]}
  >
    <aiux-record-form></aiux-record-form>
  </aiux-record-provider>
`;
```

### Explicit — SSR (data manager + provider)

For SSR you must pass `requiredAPIs` to `RecordDataManager.fetchRecord` so only the needed data is queried. The `requiredAPIs` are included in the returned `RecordFetchResult` and extracted by the provider automatically.

```javascript
const data = await RecordDataManager.fetchRecord({table, sysId}, [
  RecordAPIKey.Form
]);

html`
  <aiux-record-provider .data=${data}>
    <aiux-record-form></aiux-record-form>
  </aiux-record-provider>
`;
```

### Auto-Discovery (CSR only)

In connected mode (no `data` prop), the provider **automatically discovers** which APIs are needed by inspecting its child components. Each component that extends `AIUXRecordElement` declares a static `requiredAPIs` array. When the component connects to the DOM, it registers its required APIs with the provider via `connectedCallback()`. The provider then fetches only the union of all registered API data sources.

```
<aiux-record-provider table="incident" sysId="abc123">
  <aiux-record-form>              → registers [Form]
  <aiux-record-activity-stream>   → registers [Activity]
</aiux-record-provider>

Provider sees: {Form, Activity} → fetches only form + activity data sources
```

> **Note:** For SSR, auto-discovery is not available because the loader runs before components connect. You must pass `requiredAPIs` explicitly to `RecordDataManager.fetchRecord()` and/or the provider prop.

### RecordAPIKey Enum

```typescript
enum RecordAPIKey {
  Form = 'form',
  Actions = 'actions',
  Activity = 'activity',
  User = 'user',
  Domain = 'domain'
}
```

> **Note:** `requiredAPIs` gate _data-source fetching_ and are keyed by `RecordAPIKey`. The provider always instantiates the full set of API façades (see [API Layer](#api-layer)) regardless of `requiredAPIs`; keys only control which GraphQL data sources are queried.

---

## Consuming Record Context

There are two ways to access the provider's APIs and data from consuming code.

### 1. Extending AIUXRecordElement

The recommended approach for components rendered inside a provider. Extend `AIUXRecordElement` and access `this._record`.

```javascript
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux-components-record';

@customElement('my-custom-component')
class MyCustomComponent extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Form];

  render() {
    const formAPI = this._record.apis.form;
    return html`<div>${formAPI.table} — ${formAPI.sysId}</div>`;
  }
}
```

`this._record` returns the `RecordContextValue` which contains:

- **`apis`** — All API instances (`form`, `actions`, `activity`, `compose`, `common`, `domain`, `relatedList`, `user`, `presence`, `email`, `citation`)
- **`scripting`** — Read-only client scripting APIs (`g_form`, `g_user`, `g_scratchpad`, etc.) once the scripting environment is initialized
- **`services`** — Shared transport/services (GraphQL, HTTP, AMB) used by the APIs
- **`loading`** — Whether data is currently being fetched
- **`error`** — Any error from fetching or processing
- **`reload()`** — Triggers a full data re-fetch

### 2. RecordContext.getById (outside the component tree)

When you have multiple providers with different `context-id` values, you can access a specific provider's context by ID from anywhere.

```javascript
import {RecordContext} from '@servicenow/aiux-components-record';

// In a provider template:
html`
  <aiux-record-provider context-id="asset" table="cmdb_ci" sysId="xyz">
    ...
  </aiux-record-provider>
`;

// Later, from any code:
const assetRecord = RecordContext.getById('asset');
const formAPI = assetRecord?.apis.form;
const table = formAPI?.table;
```

---

## Components

Most components below must be used inside `<aiux-record-provider>`. Exceptions are called out in their sections.

| Component                                                                                             | Description                                                                  |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`<aiux-record-form>`](#form--aiux-record-form)                                                       | Dynamic form renderer — layout, sections, fields                             |
| [`<aiux-record-form-messages>`](#record-form-messages--aiux-record-form-messages)                     | Form-level messages (warnings, errors, info)                                 |
| [`<aiux-record-actions>`](#actions--aiux-record-actions)                                              | UI Actions — buttons and overflow menu                                       |
| [`<aiux-record-activity-stream>`](#activity-stream--aiux-record-activity-stream)                      | Chronological activity events                                                |
| [`<aiux-record-activity-compose>`](#compose--aiux-record-activity-compose)                            | Activity composer for comments and work notes                                |
| [`<aiux-record-activity-layout>`](#activity-layout--aiux-record-activity-layout)                      | Container for compose + stream with side-by-side support                     |
| [`<aiux-record-related-lists>`](#related-lists--aiux-record-related-lists)                            | Related lists in tabs or accordion layout (standalone mode supported)        |
| [`<aiux-record-presence>`](#presence--aiux-record-presence)                                           | Record presence tracking (who else is viewing)                               |
| [`<aiux-record-form-modal>`](#form-modal--aiux-record-form-modal)                                     | Modal host for `g_modal.showForm` — sets up its own provider                 |
| [`<aiux-record-form-modal-content>`](#form-modal--aiux-record-form-modal)                             | Body of `g_modal.showForm` — form + related lists + actions inside the modal |
| [`<aiux-email-client-compose-tab>`](#email-client---compose-tab--aiux-email-client-compose-tab)       | Email composer tab for the activity compose area                             |
| [`<aiux-email-client-mini-composer>`](#email-client---mini-composer--aiux-email-client-mini-composer) | Standalone compact email composer (can be used outside the provider)         |

### Form — `<aiux-record-form>`

Dynamic form renderer. Reads the form layout, sections, and fields from the Form API and renders appropriate controls for each field type.

```html
<aiux-record-provider .data="${recordData}">
  <aiux-record-form
    layout-variant="flat"
    edit-mode="default"
    variant="compact"
    label-value-layout="horizontal"
  ></aiux-record-form>
</aiux-record-provider>
```

**Properties:**

| Property                       | Attribute                         | Type       | Default        | Description                                                                  |
| ------------------------------ | --------------------------------- | ---------- | -------------- | ---------------------------------------------------------------------------- |
| `layoutVariant`                | `layout-variant`                  | `String`   | `"accordions"` | `"accordions"`, `"tabs"`, or `"flat"`                                        |
| `editMode`                     | `edit-mode`                       | `String`   | `"default"`    | `"default"`, `"inline"`, or `"display-only"`                                 |
| `variant`                      | `variant`                         | `String`   | `undefined`    | `"default"` or `"compact"` — visual density (see note below)                 |
| `labelValueLayout`             | `label-value-layout`              | `String`   | `"vertical"`   | `"horizontal"` or `"vertical"`                                               |
| `displayEmptyFields`           | `display-empty-fields`            | `Boolean`  | `false`        | Show fields with empty values                                                |
| `alwaysDisplayFirstSection`    | `always-display-first-section`    | `Boolean`  | `false`        | Always render the first section                                              |
| `hideSectionHeaders`           | `hide-section-headers`            | `Boolean`  | `false`        | Hide section headers                                                         |
| `hideFormMessages`             | `hide-form-messages`              | `Boolean`  | `false`        | Suppress inline form messages so you can place `<aiux-record-form-messages>` |
| `sectionClass`                 | `section-class`                   | `String`   | `''`           | Extra CSS class applied to each section                                      |
| `disableUnsavedFieldIndicator` | `disable-unsaved-field-indicator` | `Boolean`  | `false`        | Hide the unsaved-field indicator                                             |
| `disableSectionFocusRing`      | `disable-section-focus-ring`      | `Boolean`  | `false`        | Suppress the accordion section focus-within ring (useful inside modals)      |
| `autofocusFirstField`          | `autofocus-first-field`           | `Boolean`  | `undefined`    | Override `glide.ui.focus_first_element` for new-record first-field autofocus |
| `onFormMessageAction`          | — (property only)                 | `Function` | `undefined`    | Callback invoked when a form-message action button is clicked                |

> **`variant` note:** `compact` reduces padding and font sizes for denser layouts (e.g. ServiceNow "Compact user interface" preference). Propagated to all child controls via `FormFieldLayoutMixin`.

**Registered APIs:** `[Form, Actions]`

### Record Form Messages — `<aiux-record-form-messages>`

Displays form-level messages (warnings, errors, info). By default, `<aiux-record-form>` renders messages above the form fields — no separate placement needed.

To control placement yourself, set `hide-form-messages` on `<aiux-record-form>` and render `<aiux-record-form-messages>` wherever you need it:

```html
<aiux-record-provider .data="${record.get()}">
  <some-custom-container>
    <aiux-record-form-messages></aiux-record-form-messages>
  </some-custom-container>
  <aiux-record-form hide-form-messages></aiux-record-form>
</aiux-record-provider>
```

Form messages may include action buttons. Handle them via the `onFormMessageAction` callback on `<aiux-record-form>`:

```javascript
render() {
  return html`
    <aiux-record-provider .data=${record.get()}>
      <aiux-record-form
        .onFormMessageAction=${action => console.log('action', action)}
      ></aiux-record-form>
    </aiux-record-provider>
  `;
}
```

**Registered APIs:** `[Form]`

### Activity Stream — `<aiux-record-activity-stream>`

Renders chronological activity events (field changes, comments, work notes, attachments, relationships). Above 250 events the stream uses a sliding-window pagination controller (`SlidingWindowController`) to keep the active DOM bounded — only the current window of pages renders real tiles; previously-loaded pages collapse to height-preserving placeholders.

```html
<aiux-record-activity-stream
  sortdirection="newest"
  stream-height="400px"
></aiux-record-activity-stream>
```

**Properties:**

> **Attribute casing:** Lit lowercases a camelCase property name when no explicit `attribute` is set, so `sortDirection` is written as the `sortdirection` attribute in HTML (not `sort-direction`). Only `streamHeight` has an explicit kebab-case attribute (`stream-height`).

| Property              | Attribute             | Type      | Default | Description                                                    |
| --------------------- | --------------------- | --------- | ------- | -------------------------------------------------------------- |
| `sortDirection`       | `sortdirection`       | `String`  | `null`  | Override sort direction (`"newest"` / `"oldest"`)              |
| `hideSort`            | `hidesort`            | `Boolean` | `false` | Hide the sort toggle                                           |
| `hideSeparators`      | `hideseparators`      | `Boolean` | `false` | Hide activity separators                                       |
| `headerLabel`         | `headerlabel`         | `String`  | `null`  | Override the header label text                                 |
| `hideHeaderLabel`     | `hideheaderlabel`     | `Boolean` | `false` | Hide the header label                                          |
| `hideFilters`         | `hidefilters`         | `Boolean` | `false` | Hide the activity filter controls                              |
| `hideConfigureFields` | `hideconfigurefields` | `Boolean` | `false` | Hide the "configure fields" control                            |
| `hideSearch`          | `hidesearch`          | `Boolean` | `true`  | Hide the activity search control                               |
| `showThreads`         | `showthreads`         | `Boolean` | `true`  | Render threaded replies for journal entries                    |
| `streamHeight`        | `stream-height`       | `String`  | `null`  | Optional CSS height for the scrollable stream (e.g. `"400px"`) |

**Notes on `stream-height`:**

- Accepts any valid CSS `height` value as a string.
- Required when the stream is embedded inside a page that already scrolls (e.g. side panels, drawers); otherwise tiles compete with the outer scroll container and the pagination window never advances.
- For full-page records that scroll the document, leave it unset so the viewport drives pagination.

**Registered APIs:** `[Activity]`

### Compose — `<aiux-record-activity-compose>`

Activity composer for creating comments and work notes. Supports compact (tabbed) and stacked views.

```html
<aiux-record-activity-compose bare></aiux-record-activity-compose>
```

**Attributes:**

- `bare` — Disables default styling (background, padding, border)
- `useDropdown` (attribute `usedropdown`) — Render a dropdown menu instead of tabs in compact view
- `main` — Make this the primary compose instance that initializes the Compose API

**Registered APIs:** `[Form, Activity]`

### Activity Layout — `<aiux-record-activity-layout>`

Container for compose and activity stream with side-by-side layout support. It switches between side-by-side and stacked layouts based on its own measured width (side-by-side requires ≥ 700px) and remembers the user's preferred layout across sessions.

```html
<aiux-record-activity-layout gap="gap-3">
  <aiux-record-activity-compose></aiux-record-activity-compose>
  <aiux-record-activity-stream></aiux-record-activity-stream>
</aiux-record-activity-layout>
```

**Properties:**

| Property                | Attribute                 | Type      | Default   | Description                                                               |
| ----------------------- | ------------------------- | --------- | --------- | ------------------------------------------------------------------------- |
| `defaultForceStacked`   | `default-force-stacked`   | `Boolean` | `false`   | Initial stacked-vs-side-by-side preference before any stored value exists |
| `disablePreserveLayout` | `disable-preserve-layout` | `Boolean` | `false`   | Disable persisting the user's layout choice                               |
| `layoutName`            | `layout-name`             | `String`  | `''`      | Layouts sharing the same name share stored layout state                   |
| `gap`                   | `gap`                     | `String`  | `'gap-3'` | Gap between slotted children (`gap-0`…`gap-6`)                            |

> **`force-stacked` attribute:** The component also reads the HTML attribute `force-stacked` imperatively at connect time. When present, it overrides `defaultForceStacked` and any stored layout preference to force the stacked layout. Setting the attribute to `"false"` (string) disables the forced stacking. This is an HTML-attribute–only API with no matching JS property; use it in static markup when you always want the stacked layout regardless of viewport width or stored state.
>
> ```html
> <aiux-record-activity-layout force-stacked disable-preserve-layout>
>   <aiux-record-activity-compose></aiux-record-activity-compose>
>   <aiux-record-activity-stream></aiux-record-activity-stream>
> </aiux-record-activity-layout>
> ```

**Slot:** default (unnamed) — place `<aiux-record-activity-compose>` and `<aiux-record-activity-stream>` (or any children) directly inside.

### Related Lists — `<aiux-record-related-lists>`

Displays related lists for a record in either tabs or accordion layout. In provider mode it reads the record's table, view, and sys_id from `RecordContext`. In **standalone** mode it fetches its own metadata by supplying `table`.

```html
<!-- Inside a provider -->
<aiux-record-provider .data="${record.get()}">
  <aiux-record-related-lists
    layout-variant="tabs"
    timing-variant="deferred"
  ></aiux-record-related-lists>
</aiux-record-provider>

<!-- Standalone (no provider required) -->
<aiux-record-related-lists
  table="incident"
  view="default"
></aiux-record-related-lists>
```

**Properties:**

| Property            | Attribute         | Type     | Default       | Description                                                                  |
| ------------------- | ----------------- | -------- | ------------- | ---------------------------------------------------------------------------- |
| `layoutVariant`     | `layout-variant`  | `String` | user fallback | `"accordions"` or `"tabs"`. Falls back to user preference `tabbed.forms`.    |
| `timingVariant`     | `timing-variant`  | `String` | user fallback | `"deferred"` or `"on-demand"`. Falls back to `glide.ui.related_list_timing`. |
| `sectionClass`      | `section-class`   | `String` | `''`          | Extra CSS class applied to each section wrapper                              |
| `table`             | `table`           | `String` | —             | Standalone mode: parent table name                                           |
| `view`              | `view`            | `String` | —             | Standalone mode: view name                                                   |
| `parentRecordSysId` | — (property only) | `String` | —             | Standalone mode: parent record sys_id                                        |
| `listOptions`       | — (property only) | `Object` | —             | Override default list options for every embedded `<aiux-list>`               |

- `timing-variant` values:
  - `"deferred"` — Load immediately after the form sections render
  - `"on-demand"` — Show a "Load Related Lists" button, load on click

**Features:**

- Lazy tab activation — tabs render content only when first activated, preserving scroll and selection state
- Collapsible accordion sections
- Integrates with list component for rendering each related list
- Supports UI actions on related list rows

**Registered APIs:** `[Form, Actions]`

### Actions — `<aiux-record-actions>`

Renders form-level UI Action buttons (save, submit, etc.) with an overflow menu for additional actions.

```html
<aiux-record-provider .data="${recordData}">
  <aiux-record-actions></aiux-record-actions>
</aiux-record-provider>
```

**Registered APIs:** `[Actions]`

### Presence — `<aiux-record-presence>`

Displays an avatar group showing other users currently viewing the same record. Subscribes to AMB presence channels and deduplicates viewers by user ID.

```html
<aiux-record-provider .data="${recordData}">
  <aiux-record-presence></aiux-record-presence>
</aiux-record-provider>
```

**Registered APIs:** `[Form]`

### Form Modal — `<aiux-record-form-modal>` / `<aiux-record-form-modal-content>`

Modal wrapper for `g_modal.showForm`. `<aiux-record-form-modal>` creates and owns an `<aiux-record-provider>` internally and renders `<aiux-record-form-modal-content>` inside it. Most consumers only need `<aiux-record-form-modal>`.

```html
<aiux-record-form-modal
  table="incident"
  sysId="abc123"
  view="workspace"
  show-related-lists
></aiux-record-form-modal>
```

**`<aiux-record-form-modal>` properties:**

| Property           | Attribute            | Type       | Default | Description                                                  |
| ------------------ | -------------------- | ---------- | ------- | ------------------------------------------------------------ |
| `table`            | `table`              | `String`   | `''`    | Table name                                                   |
| `sysId`            | `sysId`              | `String`   | `''`    | Record sys_id (`-1` for a new record)                        |
| `view`             | `view`               | `String`   | —       | Optional form view name                                      |
| `showRelatedLists` | `show-related-lists` | `Boolean`  | `true`  | Render related lists alongside the form                      |
| `formProps`        | — (property only)    | `Object`   | —       | Extra props spread onto the inner `<aiux-record-form>`       |
| `reportResult`     | — (property only)    | `Function` | —       | Callback `(result: FormModalResult) => void` on close/submit |

**`<aiux-record-form-modal-content>` properties:**

| Property           | Attribute            | Type       | Default | Description                                                  |
| ------------------ | -------------------- | ---------- | ------- | ------------------------------------------------------------ |
| `showRelatedLists` | `show-related-lists` | `Boolean`  | `true`  | Render related lists alongside the form                      |
| `formProps`        | — (property only)    | `Object`   | —       | Extra props spread onto the inner `<aiux-record-form>`       |
| `reportResult`     | — (property only)    | `Function` | —       | Callback `(result: FormModalResult) => void` on close/submit |

### Email Client - Compose Tab — `<aiux-email-client-compose-tab>`

Email composer tab that integrates into `<aiux-record-activity-compose>`. Renders a mini email composer and manages draft lifecycle, template application, and link insertion through the Email API.

```html
<aiux-record-activity-compose>
  <aiux-email-client-compose-tab></aiux-email-client-compose-tab>
</aiux-record-activity-compose>
```

### Email Client - Mini Composer — `<aiux-email-client-mini-composer>`

Compact email composer. Can be used within `<aiux-record-provider>` or as a standalone component outside the provider. Wraps the composer details component and provides draft lifecycle, recipient fields, templates, and send flow.

```html
<aiux-email-client-mini-composer
  target-table="incident"
  target-record="abc123"
  show-cc-bcc
  show-discard-draft
  show-attachments
></aiux-email-client-mini-composer>
```

**Properties:**

| Property                 | Attribute                   | Type      | Default       | Description                                     |
| ------------------------ | --------------------------- | --------- | ------------- | ----------------------------------------------- |
| `targetTable`            | `target-table`              | `String`  | `''`          | Target record table for the email               |
| `targetRecord`           | `target-record`             | `String`  | `''`          | Target record sys_id                            |
| `sysId`                  | `sys-id`                    | `String`  | `'-1'`        | Email draft sys_id                              |
| `replyType`              | `reply-type`                | `String`  | `''`          | Type of reply (`reply`, `replyAll`, `forward`)  |
| `replyId`                | `reply-id`                  | `String`  | `''`          | Sys_id of the email being replied to/forwarded  |
| `emailTitle`             | `email-title`               | `String`  | `''`          | Optional title shown above the composer         |
| `showCcBcc`              | `show-cc-bcc`               | `Boolean` | `true`        | Show CC/BCC fields                              |
| `disableToCcBcc`         | `disable-to-cc-bcc`         | `Boolean` | `false`       | Disable editing of To/CC/BCC fields             |
| `fitToParent`            | `fit-to-parent`             | `Boolean` | `false`       | Stretch to fill the parent container            |
| `forceHorizontalLayout`  | `force-horizontal-layout`   | `Boolean` | `false`       | Force recipient fields into a horizontal layout |
| `showEmailDetails`       | `show-email-details`        | `Boolean` | `false`       | Expand the email-details section by default     |
| `showSendButtonAsIcon`   | `show-send-button-as-icon`  | `Boolean` | `true`        | Render the send button as an icon button        |
| `showPopOut`             | `show-pop-out`              | `Boolean` | `true`        | Show the pop-out button                         |
| `showDiscardDraft`       | `show-discard-draft`        | `Boolean` | `true`        | Show the discard-draft button                   |
| `hideSend`               | `hide-send`                 | `Boolean` | `false`       | Hide the send button                            |
| `showAttachments`        | `show-attachments`          | `Boolean` | `true`        | Show the attachments section                    |
| `initiateSendEmail`      | `initiate-send-email`       | `Boolean` | `false`       | Trigger the send flow on initial connection     |
| `loadLatestDraft`        | `load-latest-draft`         | `Boolean` | `false`       | Automatically load the latest saved draft       |
| `showCreateNewEmail`     | `show-create-new-email`     | `Boolean` | `true`        | Show the create-new-email control               |
| `showViewDrafts`         | `show-view-drafts`          | `Boolean` | `true`        | Show the view-drafts control                    |
| `showRecentDrafts`       | `show-recent-drafts`        | `Boolean` | `true`        | Show the recent-drafts list                     |
| `showEmailTemplates`     | `show-email-templates`      | `Boolean` | `true`        | Show the email-templates control                |
| `showQuickMessages`      | `show-quick-messages`       | `Boolean` | `true`        | Show quick-message templates                    |
| `showResponseTemplates`  | `show-response-templates`   | `Boolean` | `true`        | Show response templates                         |
| `enableMentioningUsers`  | `enable-mentioning-users`   | `Boolean` | `true`        | Enable `@user` mentions in the body             |
| `sendEmailButtonVariant` | `send-email-button-variant` | `String`  | `'secondary'` | Variant for the send button                     |
| `sendEmailButtonColor`   | `send-email-button-color`   | `String`  | `'neutral'`   | Color for the send button                       |
| `sendEmailButtonSize`    | `send-email-button-size`    | `String`  | `'sm'`        | Size for the send button                        |
| `templateMessage`        | `template-message`          | `Object`  | `{}`          | Pre-filled template message payload             |
| `templateDetails`        | `template-details`          | `Object`  | `{}`          | Pre-filled template details payload             |
| `dirtyFields`            | `dirty-fields`              | `Array`   | `[]`          | List of dirty field names for change tracking   |

---

## API Layer

### Available APIs on RecordContextValue

| API                        | Key                     | Description                                                                    |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `_record.apis.form`        | `RecordAPIKey.Form`     | Form layout, field values, sections, save/submit, dirty tracking, header data  |
| `_record.apis.actions`     | `RecordAPIKey.Actions`  | UI Actions — button and context-menu actions, executeAction()                  |
| `_record.apis.activity`    | `RecordAPIKey.Activity` | Activity events, filter options, sort direction                                |
| `_record.apis.user`        | `RecordAPIKey.User`     | Current user data, preferences (get/set)                                       |
| `_record.apis.domain`      | `RecordAPIKey.Domain`   | Domain separation data                                                         |
| `_record.apis.compose`     | —                       | Compose fields, selected field, view mode (compact/stacked)                    |
| `_record.apis.common`      | —                       | Modal helpers, record navigation, notifications                                |
| `_record.apis.relatedList` | —                       | Related list metadata and rows                                                 |
| `_record.apis.presence`    | —                       | Record presence tracking                                                       |
| `_record.apis.email`       | —                       | Email composition, reply/forward actions, link insertion, template application |
| `_record.apis.citation`    | —                       | Citation / source references                                                   |

---

## Usage Examples

### Composition with SSR

```javascript
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux-components-record';
import {AIUXElement, createContext} from '@servicenow/aiux-components-core';

export const record = createContext('record', null);

@customElement('my-record-page')
class MyRecordPage extends AIUXElement {
  static contexts = [record];

  static async loader(ctx) {
    const {table, id} = ctx.params;
    const data = await RecordDataManager.fetchRecord(
      {table, sysId: id, view: 'workspace'},
      [RecordAPIKey.Form, RecordAPIKey.Activity]
    );
    record.set(data);
  }

  render() {
    return html`
      <aiux-record-provider .data=${record.get()}>
        <aiux-record-form
          layout-variant="flat"
          edit-mode="display-only"
          label-value-layout="horizontal"
        ></aiux-record-form>
        <aiux-record-activity-layout>
          <aiux-record-activity-compose></aiux-record-activity-compose>
          <aiux-record-activity-stream></aiux-record-activity-stream>
        </aiux-record-activity-layout>
      </aiux-record-provider>
    `;
  }
}
```

### Multiple Providers with context-id

```javascript
render() {
  return html`
    <aiux-record-provider
      context-id="asset"
      .data=${assetData}
    >
      <aiux-record-form></aiux-record-form>
    </aiux-record-provider>

    <aiux-record-provider
      context-id="useAndPurpose"
      table="sn_ai_governance_asset_use_purpose"
      sysId=${unpId}
    >
      <aiux-record-form layout-variant="flat"></aiux-record-form>
    </aiux-record-provider>
  `;
}

// Access a specific provider from outside:
const assetRecord = RecordContext.getById('asset');
if (assetRecord) {
  assetRecord.apis.form.setValue('short_description', 'New description');
}
```

---

## File Structure

```
record/
├── src/
│   ├── components/
│   │   ├── actions/              # Form UI action bar
│   │   ├── activity-stream/      # Activity stream, compose, layout, reply, filter, search
│   │   ├── commons/              # Shared internal UI helpers
│   │   ├── email-client/         # Mini composer and compose-tab email integration
│   │   ├── form/                 # Form renderer, sections, fields, inline config, form messages
│   │   ├── form-modal/           # g_modal.showForm modal host + content
│   │   ├── presence/             # Record presence / co-viewing avatars
│   │   ├── related-lists/        # Related-lists tabs/accordion wrapper
│   │   └── timeago/              # Internal time-ago helper
│   ├── constants/                # Package-wide constants
│   ├── provider/                 # AIUXRecordProvider, APIs, data sources, services — see provider/README.md
│   ├── types/                    # Shared TypeScript types
│   ├── utils/                    # Shared utilities
│   └── index.ts                  # Package entry point and exports
├── test/
├── package.json
└── README.md
```

## Testing

```bash
pnpm run test # or pnpm run test:coverage

pnpm run typecheck

pnpm run lint

pnpm run format:write

pnpm run ssr-verify

pnpm run build
```
