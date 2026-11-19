import {css, html, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import '@servicenow/aiux/aiux-components-record';

import './page-shell.js';
import './view-switch.js';
import {rvTokens, rvPrimitives} from './tokens.js';
import './header-adapter.js';
import './record-fields.js';
import './related-records.js';
import './record-context-actions.js';
import './record-refresh.js';
import './activity-view.js';
import './record-attachments.js';
import {
  buildViewOptions,
  resolveActiveView
} from './richness-gate.js';
import {
  VIEW_ACTIVITY,
  VIEW_INTELLIGENT,
  VIEW_RELATED
} from './views.js';
import {
  matchesRecord,
  recordFormHandlers,
  reloadProviderIn,
  subscribeRecordChanges
} from './record-events.js';
import {
  applySeamlessChrome,
  releaseSeamlessChrome
} from '../shared/host-chrome.js';

// THE STANDARD RECORD PAGE -- one implementation, every table.
//
// WHY THIS EXISTS. Three record pages had been built -- case, regulatory
// report, and the catch-all -- and each wired the same six things for itself:
// the provider, the form handlers, the record-change subscription, the host
// chrome, the header and the shell. Every fix to one of those had to be
// repeated, and twice it was not: the REG page had no form handlers, so a
// signing action never refreshed it, and the catch-all had no view switch, so
// arriving there from a case link lost Intelligence, Activity and Related.
//
// So the four-view structure is the DEFAULT for every record type now:
//
//   Intelligence   per-table and bespoke -- a SLOT, filled by the page
//   Details        config field groups, read from the record
//   Activity       the journal, where the table has one
//   Related        every relationship in the edge map, as applets
//
// Only Intelligence differs per table. The other three are the same components
// driven by config, which is what makes a new record type a config entry plus
// one bespoke view rather than a new page.
//
// WHICH VIEWS A TABLE OFFERS comes from config.views. That is what keeps
// Activity off an account: customer_account has no journal field, so an
// activity stream there would render an empty shell. The account config simply
// does not list it.

@customElement('x-snc-slux-rv-record-page')
export default class RvRecordPage extends AIUXElement {
  static properties = {
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'},
    // The record package's payload, from the page's loader.
    data: {attribute: false},
    // The layout config for this table.
    config: {attribute: false},
    // The record read behind Details, and the config's field groups.
    row: {attribute: false},
    groups: {attribute: false},
    // [{node, direction, relation}] from expandNode -- grouped into applets
    // for the Related view.
    links: {attribute: false},
    // THE INTELLIGENCE GATE, per SPEC section 4 plus the page-mandate rule.
    //
    // SPEC 4 offers the Intelligent view only when a config matches AND the
    // Otto payload returns a brief plus at least one finding. That is right
    // for a record whose cockpit is Otto-derived, but it would hide the view
    // on a record whose cockpit is built from the RECORD -- an account's 360
    // has no Otto payload at all, so under SPEC 4 alone it could never be
    // offered.
    //
    // So a page may MANDATE the view. Account and case mandate it; every other
    // table falls through to the computed richness. The mandate is a declared
    // flag rather than a truthy row, because "we always have a cockpit" and
    // "this record happened to load" are different claims and only the first
    // belongs in the gate.
    mandateIntelligence: {attribute: 'mandate-intelligence', type: Boolean},
    // Computed richness, for a table that does not mandate.
    intelligenceAvailable: {attribute: false},
    intelligencePending: {attribute: false},
    // SPEC section 2: the dock holds one OttoDock in a 300-380px right column
    // and wraps below the grid on narrow widths. The shell already implements
    // that; this forwards the page's entries so a record type WITH findings
    // gets a dock and one without gets none. It was hardcoded empty, which
    // meant the framework could not express the dock the spec requires.
    dockEntries: {attribute: false},
    // Breadcrumb, which the record cannot supply.
    breadcrumb: {attribute: false},
    // Show the attachment panel in Details. Off by default: most tables have
    // no files worth a panel, and an empty one is noise.
    showFiles: {attribute: 'show-files', type: Boolean},
    _view: {state: true},
    _refreshing: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this.table = '';
    this.sysId = '';
    this.data = null;
    this.config = null;
    this.row = null;
    this.groups = [];
    this.links = [];
    this.mandateIntelligence = false;
    this.intelligenceAvailable = false;
    this.intelligencePending = false;
    this.dockEntries = [];
    this.breadcrumb = [];
    this.showFiles = false;
    this._view = '';
    this._refreshing = false;
  }

  static styles = [
    // rvTokens FIRST. Without it every var(--rv-*) in this shadow root falls
    // back to the raw design literal instead of the theme value, so the page
    // frame rendered with different shading and fonts from the case page even
    // though both use the same child components. rvPrimitives supplies rv-card
    // for the error branches below.
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
        height: 100%;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
  }

  firstUpdated() {
    if (!isServer) applySeamlessChrome();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    releaseSeamlessChrome();
  }

  // The provider owns the form payload AND the UI action set; the page owns the
  // Table API reads. Neither refreshes the other, so both run -- that split is
  // why an agent changing major_case_state updated the fields and left the
  // action bar stale.
  //
  // The page's own data refresh is its business: this component asks for it
  // with an event rather than re-reading, because only the page knows what it
  // read and how.
  _onRecordChanged = event => {
    if (!matchesRecord(event, this.table, this.sysId)) return;
    if (this._refreshing) return;
    const scope = event.detail?.scope;
    this._refreshing = true;
    try {
      // A SCOPED refresh leaves the provider alone. The provider owns the form
      // payload and the UI action set, neither of which belongs to one applet,
      // so reloading it for a single slice would discard and refetch the whole
      // form to answer a question about a few rows.
      if (!scope) reloadProviderIn(this.renderRoot);
      this.dispatchEvent(
        new CustomEvent('rv-record-page:refresh', {
          detail: {table: this.table, sysId: this.sysId, scope},
          bubbles: true,
          composed: true
        })
      );
    } finally {
      this._refreshing = false;
    }
  };

  // THE FORM HANDLERS, WITH A STABLE IDENTITY. Built inline in the template
  // this handed the provider a new object on every render, and Provider.ts
  // registers them ONCE inside the form-init path -- so after the first init
  // the fresh identity is ignored, onSubmitSucceeded and onLiveUpdated never
  // fire, and nothing publishes to the record-change bus. Cached against the
  // record so navigating to another one builds handlers for that record.
  _handlers() {
    const key = this.table + ':' + this.sysId;
    if (!this.__handlers || this.__handlersFor !== key) {
      this.__handlers = recordFormHandlers({
        table: this.table,
        sysId: this.sysId
      });
      this.__handlersFor = key;
    }
    return this.__handlers;
  }

  _handleViewChange = e => {
    const id = e.detail?.id;
    if (id) this._view = id;
  };

  // RELATED LISTS FROM THE EDGE MAP, grouped by relation.
  //
  // expandNode already resolves every upstream and downstream neighbour for a
  // table from configs/index.js. Grouping those by relation gives one applet
  // per relationship -- so Related is generic for any table in the edge map
  // with no per-table code, and it stays consistent with what the graph shows.
  _relatedApplets() {
    // The spec used when a descriptor declares no columns, so a newly added
    // edge still renders something sensible rather than an empty card.
    const FALLBACK = [
      {label: 'Record', field: 'number', link: true},
      {label: 'Summary', field: 'short_description', wrap: true},
      {label: 'State', field: 'state', chip: true}
    ];

    const groups = new Map();

    for (const link of this.links || []) {
      const node = link?.node;
      if (!node?.sysId) continue;
      const key = link.relation || node.kind || 'related';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key.replace(/\s+/g, '-').toLowerCase(),
          heading: key,
          rows: [],
          // THE DESCRIPTOR'S OWN COLUMNS, from configs/index.js. Columns are
          // config next to the fields that feed them, so a relation keeps the
          // columns that suit it and this component names no table and no
          // field.
          columns: link.columns?.length ? link.columns : FALLBACK
        });
      }
      groups.get(key).rows.push({
        table: node.table,
        sysId: node.sysId,
        // THE WHOLE FETCHED ROW. Flattening to title/subtitle/state was what
        // made this view poorer than the case's: each descriptor's fields
        // were fetched and then thrown away.
        raw: node.raw || {}
      });
    }

    return [...groups.values()];
  }

  _cellsFor(view) {
    // ONE intelligence cell, span 12. A single forwarded slot can only target
    // one shell slot, so per-card spans cannot be expressed here -- the
    // bespoke intelligence component owns its own internal grid instead, which
    // is what a dense multi-panel view such as Account 360 wants anyway.
    if (view === VIEW_INTELLIGENT) return [{key: 'intelligence', span: 12}];
    if (view === VIEW_ACTIVITY) return [{key: 'activity', span: 12}];
    if (view === VIEW_RELATED) return [{key: 'related', span: 12}];
    // Details, and the floor for anything else. RecordFields emits a card per
    // group itself, so a multi-column grid here would nest cards in cards.
    return this.showFiles
      ? [
          {key: 'details', span: 12},
          {key: 'files', span: 12}
        ]
      : [{key: 'details', span: 12}];
  }

  _bodyFor(view) {
    if (view === VIEW_INTELLIGENT) {
      // SLOT FORWARDING. A slot that is itself assigned to the shell's slot:
      // content the PAGE puts in this component's "intelligence" slot is
      // re-exposed to the shell's "cell-intelligence" slot. A bare
      // <slot name="intelligence"> placed here would land in the shell's
      // UNNAMED slot, which does not exist -- so the view would render empty.
      //
      // The dock is forwarded the same way, one slot per declared entry, so a
      // record type with Otto findings can fill the 300-380px right column
      // SPEC section 2 defines while one without declares no entries and gets
      // no dock.
      return html`
        <slot name="intelligence" slot="cell-intelligence"></slot>
        ${(this.dockEntries || []).map(
          entry =>
            html`<slot
              name="dock-${entry.key}"
              slot="dock-${entry.key}"
            ></slot>`
        )}
      `;
    }

    if (view === VIEW_ACTIVITY) {
      return html`<x-snc-slux-rv-activity
        slot="cell-activity"
      ></x-snc-slux-rv-activity>`;
    }

    if (view === VIEW_RELATED) {
      return html`<x-snc-slux-rv-related-records
        slot="cell-related"
        table=${this.table}
        sys-id=${this.sysId}
        .applets=${this._relatedApplets()}
      ></x-snc-slux-rv-related-records>`;
    }

    return html`
      <x-snc-slux-rv-record-fields
        slot="cell-details"
        .groups=${this.groups}
        .row=${this.row}
      ></x-snc-slux-rv-record-fields>
      ${this.showFiles
        ? html`<x-snc-slux-rv-attachments
            slot="cell-files"
            table=${this.table}
            sys-id=${this.sysId}
          ></x-snc-slux-rv-attachments>`
        : nothing}
    `;
  }

  render() {
    if (!this.table || !this.sysId) return nothing;

    const options = buildViewOptions({
      config: this.config,
      gate: {
        // The mandate wins; otherwise the computed richness decides. SPEC 4's
        // "never render an empty Intelligent view" still holds, because a
        // mandating page is asserting it always has a cockpit to render.
        intelligentAvailable:
          this.mandateIntelligence === true ||
          this.intelligenceAvailable === true,
        intelligentPending: this.intelligencePending === true
      }
    });
    const view = resolveActiveView({current: this._view, options});
    const activeLabel = options.find(o => o.id === view)?.label || '';

    return html`
      <aiux-record-provider
        .data=${this.data}
        table=${this.table}
        sysId=${this.sysId}
        show-error-details="true"
        .formHandlers=${this._handlers()}
      >
        <x-snc-slux-rv-shell
          .entries=${this._cellsFor(view)}
          .dock=${view === VIEW_INTELLIGENT ? this.dockEntries || [] : []}
          body-label=${activeLabel}
          @rv-view-switch:change=${this._handleViewChange}
        >
          <!--
            THE HEADER FRAME, IDENTICAL TO THE CASE PAGE'S.
            flex flex-col gap-3 is what separates the title block from the form
            messages; without it the two sat flush and the whole header read
            differently from the case page even though both use the same
            adapter. Those utilities are safelisted (flex, flex-col, gap-0..14).
          -->
          <div slot="header" class="flex flex-col gap-3">
            <x-snc-slux-rv-header-adapter
              table=${this.table}
              .row=${this.row}
              .hasOttoPayload=${this.intelligenceAvailable === true}
              .breadcrumb=${this.breadcrumb}
            >
              <!--
                SLOT FORWARDING, not a wrapper div. The case page puts the
                action bar and the context menu in as TWO DIRECT slotted
                children, so the header's own rv-actions-zone lays them out.
                Wrapping them in a div of mine nested a second flex container
                inside that zone and changed the gaps.
              -->
              <!--
                PAGE-LEVEL REFRESH, before the forwarded actions so it reads
                as page chrome rather than one of the record's own verbs. No
                scope, so it re-reads everything -- which is the control to
                reach for when a flow created rows after the write signal had
                already fired.
              -->
              <x-snc-slux-rv-refresh
                slot="actions"
                table=${this.table}
                sys-id=${this.sysId}
              ></x-snc-slux-rv-refresh>
              <slot name="actions" slot="actions"></slot>
            </x-snc-slux-rv-header-adapter>
            <aiux-record-form-messages></aiux-record-form-messages>
          </div>

          <x-snc-slux-rv-view-switch
            slot="switch"
            .views=${options}
            active=${view}
            tablist-label=${i18n.getMessage('Record views')}
          ></x-snc-slux-rv-view-switch>

          ${this._bodyFor(view)}
        </x-snc-slux-rv-shell>
      </aiux-record-provider>
    `;
  }
}
