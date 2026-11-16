# Pages Cookbook

Patterns for page templates in AIUX applications. All examples work in both JS and TS.

---

## Root Layout (`pages/layout.js`)

Apps using the Polaris sidebar/header shell extend `NavLayout` from `@servicenow/aiux-components-nav` and use `navLayoutContext` to drive the sidebar. Apps that do not need the shell (embedded experiences, lightweight prototypes) extend `AIUXAppLayoutElement` directly.

```js
import {NavLayout, navLayoutContext} from '@servicenow/aiux-components-nav';
import {css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {MyAppTheme} from '../theme.js';

@customElement('my-app-layout')
export default class MyAppLayout extends NavLayout {
  static appTheme = MyAppTheme;

  static styles = [
    ...NavLayout.styles,
    css`
      :host {
        --nav-sidebar-bg: linear-gradient(to bottom, #032d42 0%, #044355 100%);
        --nav-layout-bg: #f5f7fa;
      }
    `
  ];

  static async loader(ctx) {
    await super.loader(ctx, {
      appName: 'My App',
      features: {
        menus: false,
        logo: true,
        userSession: true,
        concoursePicker: false
      }
    });

    const pagePath = ctx.pagePath;

    const items = [
      {icon: 'home', title: 'Home', action: {type: 'navigate', path: '/home'}},
      {
        icon: 'list-outline',
        title: 'Incidents',
        action: {type: 'navigate', path: '/list/incident'}
      }
    ];

    navLayoutContext.set({
      ...navLayoutContext.get(),
      items: items.map(item => {
        const isActive = pagePath?.startsWith(item.action?.path);
        return {...item, ...(isActive && {active: true})};
      })
    });
  }
}
```

---

## Generic List Page (`pages/list/[table]/page.js`)

Uses `ListDataManager` for data and `aiux-list-connected` for rendering. Works with any ServiceNow table.

**Critical — `display: contents`:** The page host MUST be `display: contents` so `aiux-list-connected`'s internal flex layout inherits the NavLayout height chain. Using `display: block` breaks the layout — the list collapses and row affordances render in a detached column.

**Critical — bind `aiux-list-connected:*` events, not `aiux-list:*`:** Row/link clicks come through `@aiux-list-connected:reference-link-clicked` and UI actions through `@aiux-list-connected:ui-action-clicked`. These are the stable public API. The inner `aiux-list:*` events (e.g. `aiux-list:cell-link-clicked`) are internal and can change without notice.

```js
import '@servicenow/aiux-components-list';
import {ListDataManager} from '@servicenow/aiux-components-list';
import {AIUXElement} from '@servicenow/aiux-components-core';
import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {navigate} from '@servicenow/aiux-client';
import {setDocumentTitle} from '../../utils/document-title.js';
import {getMessage} from '../../utils/i18n.js';

@customElement('my-app-list-page')
export default class ListPage extends AIUXElement {
  // REQUIRED: display:contents
  static styles = css`
    :host {
      display: contents;
    }
  `;

  firstUpdated() {
    setDocumentTitle(getMessage('Incidents'));
  }

  static async loader(ctx) {
    const {table} = ctx.params;
    const query = ctx.query?.sysparm_query || '';
    const data = await ListDataManager.fetch({table, query});
    return {table, query, data};
  }

  _handleRowClick(e) {
    const {referenceTable, referenceSysId, listTable, listSysId} = e.detail;
    const table = referenceTable || listTable;
    const sysId = referenceSysId || listSysId;
    if (table && sysId) navigate(`/record/${table}/${sysId}`);
  }

  _handleUIAction(e) {
    const {uiAction, table} = e.detail || {};
    if (uiAction?.name === 'new_record' && table) {
      navigate(`/record/${table}/-1`);
    }
  }

  render() {
    const {data, table, query} = this.loaderData || {};
    return html`
      <aiux-list-connected
        table=${table}
        .query=${query || ''}
        .data=${data}
        @aiux-list-connected:reference-link-clicked=${this._handleRowClick}
        @aiux-list-connected:ui-action-clicked=${this._handleUIAction}
      ></aiux-list-connected>
    `;
  }
}
```

---

## Generic Record Page (`pages/record/[table]/[id]/page.js`)

Uses `RecordDataManager` and `aiux-record-provider`. `sysId="-1"` opens a new-record form.

**Critical — `onOpenRecord` is a property callback**, not a DOM event. Use `.onOpenRecord=${fn}` (dot-binding). The handler receives `(table, sysId)` as separate arguments, not a `CustomEvent`. Using `@onOpenRecord` silently does nothing.

```js
import '@servicenow/aiux-components-record';
import {RecordDataManager} from '@servicenow/aiux-components-record';
import {AIUXElement, getLogger} from '@servicenow/aiux-components-core';
import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {navigate} from '@servicenow/aiux-client';
import {setDocumentTitle} from '../../utils/document-title.js';
import {getMessage} from '../../utils/i18n.js';

const log = getLogger('my-app-record-page');

@customElement('my-app-record-page')
export default class RecordPage extends AIUXElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  firstUpdated() {
    const {table, id} = this.loaderData || {};
    setDocumentTitle(getMessage(table || 'Record'));
  }

  static async loader(ctx) {
    const {table, id} = ctx.params;
    let rawData = null;
    if (table && id && id !== '-1') {
      try {
        rawData = await RecordDataManager.fetchRecord({table, sysId: id});
      } catch (e) {
        log.error({error: e.message}, 'Failed to fetch record');
      }
    }
    return {table, id, rawData};
  }

  _handleOpenRecord(table, sysId) {
    if (table && sysId) navigate(`/record/${table}/${sysId}`);
  }

  render() {
    const {rawData, table, id} = this.loaderData || {};
    return html`
      <aiux-record-provider
        .data=${rawData}
        table=${table || ''}
        sysId=${id || ''}
        show-error-details="true"
        .onOpenRecord=${this._handleOpenRecord}
      >
        <aiux-record-form></aiux-record-form>
      </aiux-record-provider>
    `;
  }
}
```

**Troubleshooting — "Error loading record":** Keep `show-error-details="true"` to see the real error. Common causes:

- Invalid or empty `sysId`
- Instance GraphQL schema older than the package version (instance/build mismatch, not an app bug)

---

## Nested Layout (`pages/[table]/[id]/layout.js`)

For route groups that need shared data via scoped context. The `willUpdate` hook is **required** — without it, navigating between records under the same layout updates `loaderData` but never re-runs `provide()`, leaving child pages with stale data.

```js
import {AIUXElement} from '@servicenow/aiux-components-core';
import {html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {detailContext} from '../../../contexts/detail-context.js';

@customElement('my-app-detail-layout')
export default class DetailLayout extends AIUXElement {
  _prevLoaderData = null;

  static async loader(ctx) {
    const {id} = ctx.params;
    return {id, record: await fetchRecord(id)};
  }

  connectedCallback() {
    super.connectedCallback();
    const {id, record} = this.loaderData || {};
    detailContext.provide(this, {id, record});
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    detailContext.unprovide(this); // REQUIRED — prevents memory leaks
  }

  willUpdate() {
    if (this.loaderData !== this._prevLoaderData) {
      this._prevLoaderData = this.loaderData;
      const {id, record} = this.loaderData || {};
      detailContext.provide(this, {id, record});
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
```

Child pages consume:

```js
static contexts = [detailContext];
render() {
  const {id, record} = detailContext.get(this) || {};
}
```

---

## Custom Page (AIUXElement)

For pages that don't fit list/record patterns:

```js
import {AIUXElement} from '@servicenow/aiux-components-core';
import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {i18n} from '@servicenow/aiux-services';
import {setDocumentTitle} from '../../utils/document-title.js';
import {getMessage} from '../../utils/i18n.js';

@customElement('my-app-dashboard')
export default class DashboardPage extends AIUXElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
      padding: 1rem;
    }
  `;

  firstUpdated() {
    setDocumentTitle(getMessage('Dashboard'));
  }

  static async loader(ctx) {
    const stats = await fetchDashboardStats(ctx);
    return {stats};
  }

  render() {
    const {stats} = this.loaderData || {};
    return html`
      <h1 class="text-lg font-semibold mb-4">
        ${i18n.getMessage('Dashboard')}
      </h1>
      <div class="grid grid-cols-3 gap-4">
        ${stats?.map(s => html`<stat-card .stat=${s}></stat-card>`)}
      </div>
    `;
  }
}
```
