import {html, css, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import '@servicenow/aiux/aiux-components-record';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

import '../../../framework/page-shell.js';
import '../../../framework/record-fields.js';
import '../../../framework/record-context-actions.js';
import {rvTokens, rvPrimitives} from '../../../framework/tokens.js';
import {fetchDetailGroups} from '../../../framework/loaders/record-data.js';
import {fetchFieldMeta} from '../../../framework/loaders/field-meta.js';
import '../../../framework/record-attachments.js';
import {
  matchesRecord,
  recordFormHandlers,
  reloadProviderIn,
  subscribeRecordChanges
} from '../../../framework/record-events.js';
import {getConfigsForTable} from '../../../framework/configs/index.js';
import {
  applySeamlessChrome,
  releaseSeamlessChrome
} from '../../../shared/host-chrome.js';

// THE REGULATORY REPORT PAGE.
//
// This record is a DOCUMENT, not a form. It carries report_document -- an html
// field, 26,952 characters on REG0001002, labelled "Regulatory Report" in the
// dictionary -- which is the generated MDR report. Through the catch-all's
// label/value grid that read as a field value next to its own metrics; the
// document is the point of the record, so it gets the page.
//
// WHY A DEDICATED PAGE RATHER THAN A CONFIG ON THE CATCH-ALL: the composition
// is different in kind, not in content. There is no view switch -- a report is
// one thing to read -- the figures are presented as figures rather than rows,
// and the document is the body of the page rather than one field among many.
//
// EVERY FIELD NAME LIVES IN THE CONFIG, not here. This page reads
// config.metrics, config.document and config.details.groups, so it carries no
// table knowledge and the same composition would serve another report type.

const TABLE = 'x_snc_pmdemo_reg_report';

@customElement('x-snc-slux-reg-report-page')
export default class RegReportPage extends AIUXElement {
  static properties = {
    // The live row, overlaying the loader's. The loader runs once per
    // navigation, so without this a signing action wrote to the record and the
    // page kept rendering what it was built with.
    _liveRow: {state: true},
    _refreshing: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this._liveRow = null;
    this._refreshing = false;
  }

  // Stable identity -- the provider registers these once at form init, so a
  // fresh object per render stops publishing to the record-change bus. See
  // record-events.js.
  _handlers(sysId) {
    if (!this.__handlers || this.__handlersFor !== sysId) {
      this.__handlers = recordFormHandlers({table: TABLE, sysId});
      this.__handlersFor = sysId;
    }
    return this.__handlers;
  }

  // Live row if a refresh produced one, else the loader's.
  get _row() {
    return this._liveRow ?? this.loaderData?.row ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  // ONE SIGNAL, BOTH HALVES.
  //
  // The provider owns the form payload and the UI action set; this page owns
  // the Table API read behind the report fields and the document. Neither
  // refreshes the other, so a signing action that changed report_status left
  // the fields and the action bar stale in different ways.
  //
  // The attachment panel needs no wiring here: it subscribes to the same bus
  // itself and bumps its own refreshRequested.
  _onRecordChanged = async event => {
    const sysId = this.loaderData?.sysId;
    if (!matchesRecord(event, TABLE, sysId)) return;
    if (this._refreshing || !sysId) return;

    this._refreshing = true;
    try {
      reloadProviderIn(this.renderRoot);

      const config = this.loaderData?.reReadGroups;
      if (!config?.length) return;
      // ctx is null: fetchTable branches on isServer and the client path uses
      // aiuxFetch, which carries its own auth. This only runs from an event.
      const detail = await fetchDetailGroups(null, TABLE, sysId, config);
      if (detail.row) this._liveRow = detail.row;
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
    const sysId = String(ctx.params?.id || '').trim();
    if (!sysId) return {sysId: '', incomplete: true};

    const config =
      getConfigsForTable(TABLE).find(
        candidate => candidate && candidate.active !== false
      ) || null;

    // One read for everything the page shows: the detail groups, the metric
    // fields and the document field. Named together so the document's 27KB is
    // fetched once rather than per section.
    const groups = config?.details?.groups || [];
    const extra = [
      ...(config?.metrics || []).map(metric => metric.field),
      config?.document?.field
    ].filter(Boolean);

    // The combined list is kept so a refresh can re-read exactly the same
    // fields -- the detail groups plus the metric and document fields the page
    // renders outside them.
    const readGroups = [...groups, {id: '_page', fields: extra}];

    const detail = await fetchDetailGroups(ctx, TABLE, sysId, readGroups);

    // Dictionary metadata: real types, labels and read_only for this table.
    const fieldMeta = await fetchFieldMeta(ctx, TABLE, ['task']);
    // The form payload is for UI ACTIONS ONLY -- approve, reject, submit live
    // there. Caught separately so a form failure cannot blank a report that
    // the record read already supplied.
    let data = null;
    try {
      data = await RecordDataManager.fetchRecord({table: TABLE, sysId}, [
        RecordAPIKey.Form,
        RecordAPIKey.Actions
      ]);
    } catch (e) {
      data = null;
    }

    return {
      sysId,
      data,
      row: detail.row,
      groups,
      reReadGroups: readGroups,
      fieldMeta,
      metrics: config?.metrics || [],
      document: config?.document || null,
      chips: config?.header?.chips || [],
      titleField: config?.header?.title || 'short_description',
      readFailed: detail.failed,
      incomplete: false
    };
  }

  firstUpdated() {
    if (!isServer) {
      document.title = i18n.getMessage('Regulatory report');
      applySeamlessChrome();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    releaseSeamlessChrome();
  }

  render() {
    const {sysId, data, groups, metrics, fieldMeta, document: doc, incomplete} =
      this.loaderData || {};
    // Resolved, not raw: a signing action or an external write puts a newer
    // row here and every section below reads it.
    const row = this._row;

    if (incomplete || !row) {
      return html`
        <section class="rv-card" role="alert">
          <p class="rv-type-body">
            ${incomplete
              ? i18n.getMessage('This link does not identify a report.')
              : i18n.getMessage('This report could not be loaded.')}
          </p>
        </section>
      `;
    }

    return html`
      <aiux-record-provider
        .data=${data}
        table=${TABLE}
        sysId=${sysId}
        show-error-details="true"
        .formHandlers=${this._handlers(sysId)}
      >
        <x-snc-slux-rv-shell
          .entries=${[
            {key: 'summary', span: 12},
            {key: 'document', span: 12},
            {key: 'files', span: 12},
            {key: 'detail', span: 12}
          ]}
          .dock=${[]}
          body-label=${i18n.getMessage('Regulatory report')}
        >
          <div slot="header">
            <x-snc-slux-reg-report-header
              .row=${row}
              .titleField=${this.loaderData?.titleField}
              .chips=${this.loaderData?.chips}
              .hasActions=${Boolean(data)}
            ></x-snc-slux-reg-report-header>
            <aiux-record-form-messages></aiux-record-form-messages>
          </div>

          <x-snc-slux-reg-report-metrics
            slot="cell-summary"
            .row=${row}
            .metrics=${metrics}
          ></x-snc-slux-reg-report-metrics>

          ${doc
            ? html`<x-snc-slux-rv-record-fields
                slot="cell-document"
                .row=${row}
                .groups=${[
                  {
                    id: 'document',
                    label: doc.label,
                    // html: true is what routes this through the platform
                    // sanitiser instead of being escaped as text.
                    fields: [{field: doc.field, html: true, wide: true}]
                  }
                ]}
              ></x-snc-slux-rv-record-fields>`
            : nothing}

          <x-snc-slux-rv-attachments
            slot="cell-files"
            table=${TABLE}
            sys-id=${sysId}
            heading=${i18n.getMessage('Signed documents')}
          ></x-snc-slux-rv-attachments>

          <x-snc-slux-rv-record-fields
            slot="cell-detail"
            .row=${row}
            .groups=${groups}
            .fieldMeta=${fieldMeta}
          ></x-snc-slux-rv-record-fields>
        </x-snc-slux-rv-shell>
      </aiux-record-provider>
    `;
  }
}

// Header: title, status chips, action bar. Presentational -- the title and the
// chips come from the record read, so it renders even when the form payload
// failed.
@customElement('x-snc-slux-reg-report-header')
export class RegReportHeader extends AIUXElement {
  static properties = {
    row: {attribute: false},
    titleField: {attribute: false},
    chips: {attribute: false},
    hasActions: {attribute: false}
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

      .rv-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
      }

      /* Declared HERE, not borrowed from page-header.js: a component cannot
         use a class from another component's shadow root, so the class would
         render unstyled and the two action groups would stack. */
      .rv-actions-zone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
    `
  ];

  _cell(name) {
    const cell = this.row?.[name];
    if (!cell) return '';
    const text = typeof cell === 'object' ? cell.display_value || cell.value : cell;
    return text === null || text === undefined ? '' : String(text);
  }

  render() {
    const title = this._cell(this.titleField) || i18n.getMessage('Report');
    const number = this._cell('number');
    const specs = Array.isArray(this.chips) ? this.chips : [];

    return html`
      <header class="rv-head">
        <div>
          <h1 class="rv-type-title">${title}</h1>
          <div class="rv-meta">
            ${number
              ? html`<span class="rv-type-caption rv-mono">${number}</span>`
              : nothing}
            ${specs.map(spec => {
              const field = typeof spec === 'string' ? spec : spec.field;
              const text = this._cell(field);
              if (!text) return nothing;
              return html`<span
                class="rv-chip"
                data-tone=${(typeof spec === 'object' && spec.tone) || 'neutral'}
                >${text}</span
              >`;
            })}
          </div>
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

// The figures, as figures. Each is a typed integer on the record, so a tile is
// a read rather than a calculation. A metric with no value is dropped, because
// an absent count and a zero are different facts.
@customElement('x-snc-slux-reg-report-metrics')
export class RegReportMetrics extends AIUXElement {
  static properties = {
    row: {attribute: false},
    metrics: {attribute: false}
  };

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-tiles {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (min-width: 720px) {
        .rv-tiles {
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        }
      }

      .rv-stat-value {
        display: block;
      }

      h2 {
        margin: 0 0 14px;
      }
    `
  ];

  render() {
    const row = this.row || {};
    const specs = Array.isArray(this.metrics) ? this.metrics : [];

    const tiles = specs
      .map(spec => {
        const cell = row[spec.field];
        const raw =
          cell && typeof cell === 'object' ? cell.value : cell;
        return {label: spec.label, value: raw};
      })
      .filter(
        tile =>
          tile.value !== null && tile.value !== undefined && tile.value !== ''
      );

    if (!tiles.length) return nothing;

    return html`
      <section class="rv-card" aria-labelledby="rv-reg-metrics">
        <h2 id="rv-reg-metrics" class="rv-type-section">
          ${i18n.getMessage('Impact')}
        </h2>
        <div class="rv-tiles">
          ${tiles.map(
            tile => html`
              <div class="rv-tile">
                <span class="rv-stat-value rv-type-stat">${tile.value}</span>
                <span class="rv-type-label">${i18n.getMessage(tile.label)}</span>
              </div>
            `
          )}
        </div>
      </section>
    `;
  }
}
