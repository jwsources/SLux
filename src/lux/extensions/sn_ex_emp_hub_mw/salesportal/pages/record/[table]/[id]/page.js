import {html, css, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import '@servicenow/aiux/aiux-components-record';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

import '../../../../framework/page-shell.js';
import '../../../../framework/record-fields.js';
import '../../../../framework/record-context-actions.js';
import {rvTokens, rvPrimitives} from '../../../../framework/tokens.js';
import {
  fetchDetailGroups,
  fetchWholeRecord
} from '../../../../framework/loaders/record-data.js';
import {makeoverGroups} from '../../../../framework/record-makeover.js';
import {fetchFieldMeta} from '../../../../framework/loaders/field-meta.js';
import {
  getConfigsForTable,
  routeForTable
} from '../../../../framework/configs/index.js';
import {experienceBasePath} from '../../../../framework/record-href.js';
import '../../../../framework/record-attachments.js';
import {
  matchesRecord,
  recordFormHandlers,
  reloadProviderIn,
  subscribeRecordChanges
} from '../../../../framework/record-events.js';
import {
  applySeamlessChrome,
  releaseSeamlessChrome
} from '../../../../shared/host-chrome.js';

// THE CATCH-ALL RECORD PAGE -- any table, configured or not.
//
// THIS ROUTE IS THE PLATFORM'S OWN. In
// aiux/client/src/route-map-navigation.js, the branch that runs when no
// rewrite rule matches a URL derives the table from the path, reads sys_id
// from the query, builds a fallback path of record + table + sys_id and
// navigates to it. Its own comment reads ".do fallback -> record/:table/:sys_id".
// So the router already rewrites every intercepted .do link here; before this
// page existed those clicks landed on a route with no page, which is why they
// appeared to be swallowed.
//
// TWO THINGS IT HAS TO GET RIGHT, both learned from defects:
//
// 1. THE REAL CLASS, not the declared one. A reference field declares a BASE
//    table -- measured, sn_customerservice_case.parent is a reference to the
//    task table -- so clicking Parent on a case arrives here as
//    /record/task/<sys_id> for a record that is really a case. Rendering the
//    declared table showed a case as a task. sys_class_name on the TARGET is
//    the only place the truth lives, so it is read first and everything
//    downstream uses it.
//
// 2. A TABLE NOBODY CONFIGURED must still render. Details reads field groups
//    from config; with no config there were no groups and the page said "No
//    details are available" on a perfectly good CI record. So when no config
//    declares groups, the record describes itself -- every populated field,
//    labels humanised.

@customElement('x-snc-slux-generic-record-page')
export default class GenericRecordPage extends AIUXElement {
  static properties = {
    // Latched once a hand-off starts, so render keeps showing the placeholder
    // after the URL has been replaced. Plain state, not reactive: the hand-off
    // ends with this page being unmounted, so nothing needs to re-render on it.
    _handingOff: {state: true},
    // Live row, overlaying the loader's. The loader runs once per navigation,
    // so without this a UI action wrote the record and the page kept showing
    // the values it was built with.
    _liveRow: {state: true},
    _refreshing: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as a class field: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this._handingOff = false;
    this._liveRow = null;
    this._refreshing = false;
  }

  // Stable identity -- the provider registers these once at form init, so a
  // fresh object per render stops publishing to the record-change bus. See
  // record-events.js.
  _handlers(table, sysId) {
    const key = table + ':' + sysId;
    if (!this.__handlers || this.__handlersFor !== key) {
      this.__handlers = recordFormHandlers({table, sysId});
      this.__handlersFor = key;
    }
    return this.__handlers;
  }

  get _row() {
    return this._liveRow ?? this.loaderData?.row ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
  }

  // Re-reads on the same signal every other surface uses. The two paths mirror
  // the loader's: a CONFIGURED table re-reads its declared groups, while a
  // table with no config re-reads the whole record -- its group list is
  // derived from which fields are populated, so that has to be recomputed
  // rather than reused.
  _onRecordChanged = async event => {
    const {table, sysId, configured, groups} = this.loaderData || {};
    if (!table || !sysId) return;
    if (!matchesRecord(event, table, sysId)) return;
    if (this._refreshing) return;

    this._refreshing = true;
    try {
      reloadProviderIn(this.renderRoot);

      if (configured) {
        const detail = await fetchDetailGroups(null, table, sysId, groups);
        if (detail.row) this._liveRow = detail.row;
      } else {
        const whole = await fetchWholeRecord(null, table, sysId);
        if (whole.row) this._liveRow = whole.row;
      }
    } finally {
      this._refreshing = false;
    }
  };

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  static async loader(ctx) {
    const declaredTable = String(ctx.params?.table || '').trim();
    const sysId = String(ctx.params?.id || '').trim();

    if (!declaredTable || !sysId) {
      return {sysId, incomplete: true};
    }

    // The real class first -- see note 1 above. This read also returns every
    // field, which is what the no-config fallback needs.
    const whole = await fetchWholeRecord(ctx, declaredTable, sysId);
    const table = whole.realClass || declaredTable;

    // Dictionary metadata for the REAL class, so types and labels match the
    // record rather than the table the link happened to name. sys_user is in
    // the base chain because a person-ish table inherits from it; task covers
    // the task family. An ancestor that is not listed simply falls back to
    // inference.
    const fieldMeta = await fetchFieldMeta(ctx, table, ['task', 'sys_user']);

    const config = getConfigsForTable(table).find(
      candidate => candidate && candidate.active !== false
    );
    const configured = config?.details?.groups || [];

    let groups = configured;
    let row = whole.row;

    if (configured.length) {
      // A configured table gets its curated groups, which may name fields the
      // whole-record read did not return as display values.
      const detail = await fetchDetailGroups(ctx, table, sysId, configured);
      if (detail.row) row = detail.row;
    } else {
      // Groups for an unconfigured table are DERIVED IN RENDER, not here, so
      // they stay a function of the row on screen. Deriving them once in the
      // loader would leave the sections stale after a refresh: a field that
      // was empty at load and populated by a write belongs in a group that
      // only a re-derivation can produce.
      groups = [];
    }

    // The form payload is fetched for UI ACTIONS ONLY. Details does not depend
    // on it, so a failure here must not blank the page -- which is why it is
    // caught separately rather than wrapped around everything.
    let data = null;
    let formError = null;
    try {
      data = await RecordDataManager.fetchRecord({table, sysId}, [
        RecordAPIKey.Form,
        RecordAPIKey.Actions
      ]);
    } catch (e) {
      formError = e?.message || String(e);
    }

    return {
      table,
      declaredTable,
      sysId,
      data,
      groups,
      // Which read path a refresh must use: declared groups, or re-derive from
      // the whole record.
      configured: configured.length > 0,
      fieldMeta,
      row,
      formError,
      readFailed: whole.failed,
      readReason: whole.reason,
      incomplete: false,
      // The route that OWNS this record type, when one is configured.
      //
      // A reference field declares a BASE table, so clicking Parent on a case
      // arrives here as /record/task/<sys_id> even though the target is a
      // case. This page can render it -- the real class resolves the right
      // field groups, which is why the data looks right -- but it is the
      // CATCH-ALL: no view switch, so there is no way through to Intelligence,
      // Activity or Related records.
      //
      // So when the real class has its own page, hand off to it rather than
      // rendering a lesser version here. Null for a table with no route, which
      // is the normal case and renders in place.
      ownRoute: routeForTable(table) || null
    };
  }

  firstUpdated() {
    if (isServer) return;

    // HAND OFF to the record type's own page when it has one.
    //
    // CLIENT-SIDE, NOT A PAGE LOAD. window.location.replace() worked but
    // reloaded the entire experience -- host shell, navigation, chat, the lot
    // -- which is far worse than arriving at the wrong route.
    //
    // This uses the router's own no-push navigation path, read from
    // aiux/client/src/router.js:
    //
    //   window.addEventListener('popstate', handlePopstate);   (line 2707)
    //
    //   const handlePopstate = async _event => {
    //     const path = stripBasePath(window.location.pathname, basePath);
    //     ...
    //     if (path !== currentPath || ...) {
    //       await navigate(path + hash, {pushState: false, query});
    //     }
    //   };
    //
    // So replacing the URL and then dispatching popstate makes the router
    // resolve the new route client-side. Two properties matter:
    //
    //   - replaceState, not pushState: the catch-all URL is OVERWRITTEN, so
    //     Back returns to the page the link was clicked on. A synthetic anchor
    //     click would also route client-side -- shouldNavigate checks only
    //     event.button and modifier keys, with no isTrusted test, and
    //     findAnchor uses composedPath() so it pierces shadow DOM -- but it
    //     goes through the pushState path, leaving this page in history and
    //     making Back bounce straight back through the redirect.
    //   - pushState: false inside handlePopstate means the router does not add
    //     an entry of its own either.
    const target = this._redirectTarget();
    if (target) {
      // Latched BEFORE the URL changes. render() also asks whether a hand-off
      // is pending, and once replaceState has run the pathname equals the
      // target, so _redirectTarget() returns '' -- without this flag the next
      // render would show the full catch-all layout for a frame instead of the
      // placeholder, which is the double-render flash this page exists to
      // avoid.
      this._handingOff = true;
      window.history.replaceState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    document.title = i18n.getMessage('Record');
    applySeamlessChrome();
  }

  // The URL of the owning page, or '' when this page should render in place.
  _redirectTarget() {
    const {ownRoute, sysId} = this.loaderData || {};
    if (!ownRoute || !sysId || isServer) return '';

    const basePath = experienceBasePath();
    const target = `${basePath}/${ownRoute}/${encodeURIComponent(sysId)}`;

    // Never redirect to where we already are. Without this a route whose
    // config named its own catch-all segment would reload forever.
    if (window.location.pathname === target) return '';
    return target;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    releaseSeamlessChrome();
  }

  // The title, from the record itself rather than from the form layout -- the
  // whole point of this page is to work without one. First candidate the table
  // actually has wins: a task has short_description, an account has name, a CI
  // has name, a report has number.
  _titleFrom(row) {
    if (!row) return {title: '', number: ''};
    const pick = name => {
      const cell = row[name];
      if (!cell) return '';
      const text =
        typeof cell === 'object' ? cell.display_value || cell.value : cell;
      return text === null || text === undefined ? '' : String(text);
    };

    const number = pick('number');
    const title =
      pick('short_description') || pick('name') || pick('title') || number;

    return {title, number: title === number ? '' : number};
  }

  render() {
    const {table, sysId, data, configured, fieldMeta, formError, readFailed, incomplete} =
      this.loaderData || {};
    // Resolved, not raw: a write puts a newer row here.
    const row = this._row;
    // A configured table uses its declared groups; everything else is grouped
    // from the record itself, derived HERE so it tracks the row. The
    // dictionary metadata makes that grouping typed rather than inferred.
    const groups = configured
      ? this.loaderData?.groups || []
      : makeoverGroups(row, fieldMeta);

    // A hand-off is pending, so render a quiet placeholder rather than a full
    // page the user will never read. Without this the catch-all flashes its
    // own tab-less layout before the owning page loads, which reads as the
    // app rendering twice.
    if (!isServer && (this._handingOff || this._redirectTarget())) {
      return html`
        <section class="rv-card" role="status" aria-live="polite">
          <p class="rv-type-body">${i18n.getMessage('Opening record\u2026')}</p>
        </section>
      `;
    }

    if (incomplete) {
      return html`
        <section class="rv-card" role="alert">
          <p class="rv-type-body">
            ${i18n.getMessage('This link does not identify a record.')}
          </p>
        </section>
      `;
    }

    // Only a genuine read failure is an error. A missing form payload is not:
    // Details comes from the record read, so the page is still useful.
    if (!row) {
      return html`
        <section class="rv-card" role="alert">
          <p class="rv-type-body">
            ${readFailed
              ? i18n.getMessage('This record could not be loaded.')
              : i18n.getMessage('This record was not found.')}
          </p>
        </section>
      `;
    }

    const {title, number} = this._titleFrom(row);

    return html`
      <aiux-record-provider
        .data=${data}
        table=${table}
        sysId=${sysId}
        show-error-details="true"
        .formHandlers=${this._handlers(table, sysId)}
      >
        <x-snc-slux-rv-shell
          .entries=${[
            {key: 'details', span: 12},
            {key: 'files', span: 12}
          ]}
          .dock=${[]}
          body-label=${i18n.getMessage('Record details')}
        >
          <div slot="header">
            <x-snc-slux-generic-record-header
              .recordTitle=${title}
              .recordNumber=${number}
              .tableName=${table}
              ?has-actions=${Boolean(data) && !formError}
            ></x-snc-slux-generic-record-header>
          </div>
          <x-snc-slux-rv-record-fields
            slot="cell-details"
            .groups=${groups}
            .row=${row}
            .fieldMeta=${fieldMeta}
          ></x-snc-slux-rv-record-fields>

          <x-snc-slux-rv-attachments
            slot="cell-files"
            table=${table}
            sys-id=${sysId}
          ></x-snc-slux-rv-attachments>
        </x-snc-slux-rv-shell>
      </aiux-record-provider>
    `;
  }
}

// Presentational only -- it takes the title as a property rather than reading
// the record context, so it renders even when the form payload failed. The
// action bar is a child that resolves the provider context itself.
@customElement('x-snc-slux-generic-record-header')
export class GenericRecordHeader extends AIUXElement {
  static properties = {
    recordTitle: {attribute: false},
    recordNumber: {attribute: false},
    tableName: {attribute: false},
    hasActions: {attribute: 'has-actions', type: Boolean}
  };

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px 18px;
        padding-bottom: 12px;
      }

      h1 {
        margin: 0;
      }

      .rv-sub {
        margin: 2px 0 0;
      }

      /* Declared HERE, not borrowed. rv-actions-zone exists in
         page-header.js, and a component cannot use a class from another
         component's shadow root -- the class would render unstyled and the
         two action groups would stack. */
      .rv-actions-zone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
    `
  ];

  render() {
    return html`
      <header class="rv-head">
        <div>
          <h1 class="rv-type-title">
            ${this.recordTitle || i18n.getMessage('Record')}
          </h1>
          ${this.recordNumber
            ? html`<p class="rv-sub rv-type-caption rv-mono">
                ${this.recordNumber}
              </p>`
            : nothing}
        </div>
        ${this.hasActions
          ? html`<div class="rv-actions-zone">
              <aiux-record-actions></aiux-record-actions>
              <x-snc-slux-rv-context-actions></x-snc-slux-rv-context-actions>
            </div>`
          : nothing}
      </header>
    `;
  }
}
