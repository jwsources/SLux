import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {rvTable} from './table-styles.js';
import {recordHref} from './record-href.js';
import './record-refresh.js';

// RELATED RECORDS -- one applet per relationship kind.
//
// WHY THIS REPLACES aiux-record-related-lists.
// That component renders whatever sys_ui_related_list defines for the resolved
// view, and it renders it faithfully. The problem is that a related list is
// ONE query -- <child table>.<reference field> = current record -- and three
// of the four relationships this record actually has cannot be written that
// way:
//   the parent case      the reference is on THIS record, so no child query
//                        reaches it;
//   work order, change   they point at the PARENT case, needing two hops;
//   the interaction      linked through a document_id column on a join table.
// Measured on the subject case: ZERO inbound work orders and ZERO inbound
// changes. So the platform lists could only ever show the inbound slice, which
// is why the view appeared to hold nothing relevant.
//
// The adapter does the traversal and hands over record.related already
// grouped. This component is presentational: it never queries.
//
// WHY ONE ELEMENT RENDERING SEVERAL CARDS, rather than one element per group.
// Details already works this way -- RecordFields emits a card per form section
// inside a single span-12 cell -- so the page keeps one cell and the boxes come
// out with the same rhythm as the other two views. It also means a group with
// no rows simply contributes no card, with no cell bookkeeping in the page.

@customElement('x-snc-slux-rv-related-records')
export default class RvRelatedRecords extends AIUXElement {
  static properties = {
    // THE CASE PATH, unchanged. record-intelligence.js hands over a
    // purpose-shaped payload and the five _renderX methods below declare the
    // columns for each group.
    related: {attribute: false},
    // THE GENERIC PATH, for every other record type.
    //
    // [{id, heading, rows, columns}] where a column is a CONFIG SPEC --
    // {label, field, link, chip, wrap, mono} -- not a function, because these
    // come from configs/index.js and must stay serialisable data.
    //
    // WHY THIS EXISTS RATHER THAN A SECOND COMPONENT: _applet below was
    // already generic; only the column definitions were case-specific. A
    // parallel renderer (record-applets.js) was written anyway, and it drifted
    // immediately -- three generic columns, a hardcoded mono font and a bare
    // anchor rule instead of .rv-open, so the account's Related view looked
    // nothing like the case's. One renderer, two ways in.
    applets: {attribute: false},
    // The record these applets belong to, so each one can carry a scoped
    // refresh control. Optional: with neither set the control is omitted
    // rather than rendered pointing at nothing.
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this.related = null;
    this.applets = null;
    this.table = '';
    this.sysId = '';
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    rvTable,
    css`
      :host {
        display: block;
      }

      .rv-applets {
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 18px);
      }

      .rv-applet-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      h2 {
        margin: 0;
      }

      .rv-count {
        flex: 0 0 auto;
      }

      /* Count and refresh together, so the applet head stays a two-part
         layout -- heading left, tools right -- rather than becoming three
         space-between children. */
      .rv-applet-tools {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      /* Reference value rendered as a link. Button reset: a native button
         brings its own font, border and background, all of which must go or
         the cell reads as a form control inside a table. */
      .rv-open {
        appearance: none;
        -webkit-appearance: none;
        display: inline;
        margin: -2px -4px;
        padding: 2px 4px;
        border: 0;
        border-radius: var(--rv-radius-control, 8px);
        background: none;
        font: inherit;
        color: var(--rv-action-link, #1f5f8b);
        text-align: left;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }

      .rv-open:hover {
        color: var(--rv-action-link-hover, #123f5e);
      }

      /* SLA ELAPSED BAR. Decorative only -- the percentage is printed beside
         it, so the information never depends on reading a width. */
      .rv-sla-bar {
        display: block;
        inline-size: 100%;
        min-inline-size: 5rem;
        block-size: 8px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-control, #dad8d2);
        overflow: hidden;
      }

      .rv-sla-fill {
        display: block;
        block-size: 100%;
        background: var(--rv-data-positive, #1e6b3a);
      }

      .rv-sla-fill[data-breached='true'] {
        background: var(--rv-tone-critical-text, #8a1717);
      }

      .rv-sla-cell {
        display: flex;
        align-items: center;
        gap: 8px;
        min-inline-size: 9rem;
      }

      .rv-empty-note {
        margin: 0;
      }

      .rv-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      @media (forced-colors: active) {
        .rv-open {
          color: LinkText;
        }

        .rv-sla-fill {
          background: Highlight;
        }
      }
    `
  ];

  _link(row, text) {
    const label = text === null || text === undefined ? '' : String(text);
    if (!label) {
      return html`<span aria-hidden="true">&#8212;</span
        ><span class="rv-sr">${i18n.getMessage('Empty')}</span>`;
    }

    // AN ANCHOR, NOT A BUTTON -- the host router intercepts anchor clicks and
    // navigates client-side. See record-href.js: programmatic navigation was
    // the shared cause of the lost basename, the .do exits and the full page
    // reload on every link. A null href means none can be built (SSR), so the
    // value renders as text rather than as a dead anchor.
    const href = recordHref(row?.table, row?.sysId);
    if (!href) return html`<span class="rv-mono">${label}</span>`;

    return html`<a class="rv-open rv-mono" href=${href}>${label}</a>`;
  }

  _state(value) {
    if (!value) return nothing;
    return html`<span class="rv-chip" data-tone="neutral">${value}</span>`;
  }

  // One applet. The columns argument is an array of {label, cell} so each
  // group declares its own shape -- these records have genuinely different
  // useful columns, and a single shared column set would reduce every group to
  // its lowest common denominator.
  _applet(id, heading, rows, columns) {
    if (!rows?.length) return nothing;
    const headingId = `rv-rel-${id}`;

    return html`
      <section class="rv-card" aria-labelledby=${headingId}>
        <div class="rv-applet-head">
          <h2 id=${headingId} class="rv-type-section">${heading}</h2>
          <span class="rv-applet-tools">
            <span class="rv-count rv-chip" data-tone="neutral">
              ${rows.length}
            </span>
            <!--
              PER-APPLET REFRESH. Every applet gets one because this is the
              shared helper both the case payload path and the generic config
              path render through -- so the control cannot be present on one
              record type and missing on another.
              It matters most here: rows created by a flow AFTER the write
              signal fired -- a dispatch task, a work order -- are absent from
              an otherwise correct refresh, and no client-side signal marks
              the end of that asynchronous work.
            -->
            ${this.table && this.sysId
              ? html`<x-snc-slux-rv-refresh
                  variant="bare"
                  scope=${id}
                  table=${this.table}
                  sys-id=${this.sysId}
                ></x-snc-slux-rv-refresh>`
              : nothing}
          </span>
        </div>
        <div
          class="rv-table-wrap"
          tabindex="0"
          role="group"
          aria-label=${heading}
        >
          <table>
            <thead>
              <tr>
                ${columns.map(
                  col => html`<th scope="col">${col.label}</th>`
                )}
              </tr>
            </thead>
            <tbody>
              ${rows.map(
                row => html`
                  <tr>
                    ${columns.map(
                      col => html`<td class=${col.wrap ? 'rv-wrap' : ''}>
                        ${col.cell(row)}
                      </td>`
                    )}
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  // A Table API cell, which arrives as {value, display_value} under
  // sysparm_display_value=all and as a plain string for a field with no
  // display variant. Both shapes are accepted rather than assuming one.
  _cell(row, name) {
    const cell = row?.raw?.[name];
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object') {
      return String(cell.display_value ?? cell.value ?? '');
    }
    return String(cell);
  }

  // CONFIG COLUMN SPECS -> the {label, cell} shape _applet renders.
  //
  // The spec is serialisable data because it comes from configs/index.js; the
  // cell FUNCTION is built here. That is the seam that lets a column live in
  // config while the rendering -- the link treatment, the state chip, the
  // not-set warning -- stays identical to the case page's.
  _fromSpecs(columns) {
    return (columns || []).map(spec => ({
      label: i18n.getMessage(spec.label),
      wrap: Boolean(spec.wrap),
      cell: row => {
        const value = this._cell(row, spec.field);
        if (spec.link) return this._link(row, value);
        if (spec.chip) return this._state(value);
        if (!value && spec.notSet) {
          return html`<span class="rv-chip" data-tone="warning"
            >${i18n.getMessage('Not set')}</span
          >`;
        }
        return spec.mono ? html`<span class="rv-mono">${value}</span>` : value;
      }
    }));
  }

  _renderOrigin(rows) {
    return this._applet(
      'origin',
      i18n.getMessage('Where this came from'),
      rows,
      [
        {label: i18n.getMessage('Interaction'), cell: r => this._link(r, r.number)},
        {label: i18n.getMessage('Opened'), cell: r => r.opened || ''},
        {label: i18n.getMessage('Duration'), cell: r => r.duration || ''},
        {label: i18n.getMessage('Handled by'), cell: r => r.handledBy || ''},
        {label: i18n.getMessage('State'), cell: r => this._state(r.state)},
        {
          label: i18n.getMessage('Summary'),
          wrap: true,
          cell: r => r.title || ''
        }
      ]
    );
  }

  _renderHierarchy(rows) {
    return this._applet(
      'hierarchy',
      i18n.getMessage('Case hierarchy'),
      rows,
      [
        {label: i18n.getMessage('Case'), cell: r => this._link(r, r.number)},
        {
          label: i18n.getMessage('Relationship'),
          cell: r =>
            r.relation === 'child'
              ? i18n.getMessage('Child of this case')
              : i18n.getMessage('Parent of this case')
        },
        {label: i18n.getMessage('State'), cell: r => this._state(r.state)},
        {
          label: i18n.getMessage('Summary'),
          wrap: true,
          cell: r => r.title || ''
        }
      ]
    );
  }

  _kindLabel(kind) {
    switch (kind) {
      case 'order':
        return i18n.getMessage('Work order');
      case 'change':
        return i18n.getMessage('Change');
      case 'report':
        return i18n.getMessage('Regulatory report');
      default:
        return '';
    }
  }

  _renderFulfilment(rows) {
    return this._applet(
      'fulfilment',
      i18n.getMessage('Fulfilment and compliance'),
      rows,
      [
        {label: i18n.getMessage('Record'), cell: r => this._link(r, r.number)},
        {label: i18n.getMessage('Type'), cell: r => this._kindLabel(r.kind)},
        {label: i18n.getMessage('State'), cell: r => this._state(r.state)},
        {
          label: i18n.getMessage('Summary'),
          wrap: true,
          cell: r => r.title || ''
        }
      ]
    );
  }

  _renderDispatch(rows) {
    return this._applet(
      'dispatch',
      i18n.getMessage('Field dispatch'),
      rows,
      [
        {label: i18n.getMessage('Task'), cell: r => this._link(r, r.number)},
        {label: i18n.getMessage('Site'), wrap: true, cell: r => r.site || ''},
        {label: i18n.getMessage('Devices'), cell: r => r.devices},
        {label: i18n.getMessage('State'), cell: r => this._state(r.state)},
        {
          label: i18n.getMessage('Assigned to'),
          cell: r =>
            r.assignedTo ||
            html`<span class="rv-chip" data-tone="warning"
              >${i18n.getMessage('Not set')}</span
            >`
        }
      ]
    );
  }

  _renderCommitments(rows) {
    return this._applet(
      'commitments',
      i18n.getMessage('Service commitments'),
      rows,
      [
        {
          label: i18n.getMessage('Agreement'),
          wrap: true,
          cell: r => r.name || ''
        },
        {label: i18n.getMessage('Stage'), cell: r => this._state(r.stage)},
        {
          label: i18n.getMessage('Elapsed'),
          cell: r => {
            if (r.percentage === null || r.percentage === undefined) return '';
            // The bar is clamped to 100 so it cannot overflow its track, but
            // the PRINTED figure is the real one -- a breached SLA measured
            // 1153% on this case, and clamping the number would hide the
            // severity completely.
            const width = Math.max(0, Math.min(100, r.percentage));
            return html`
              <span class="rv-sla-cell">
                <span class="rv-sla-bar">
                  <span
                    class="rv-sla-fill"
                    data-breached=${r.breached ? 'true' : 'false'}
                    style="width:${width}%"
                  ></span>
                </span>
                <span class="rv-type-label rv-mono">
                  ${Math.round(r.percentage)}%
                </span>
              </span>
            `;
          }
        },
        {
          // Breach is carried by a worded chip, never by colour alone.
          label: i18n.getMessage('Breached'),
          cell: r =>
            r.breached
              ? html`<span class="rv-chip" data-tone="critical"
                  >${i18n.getMessage('Breached')}</span
                >`
              : html`<span class="rv-chip" data-tone="success"
                  >${i18n.getMessage('Within target')}</span
                >`
        }
      ]
    );
  }

  render() {
    // THE GENERIC PATH FIRST. A page that supplies applets gets them rendered
    // through the same _applet, _link and _state the case page uses, so the
    // cards, link treatment and state chips are identical by construction
    // rather than by inspection.
    if (this.applets?.length) {
      const cards = this.applets
        .map(applet =>
          this._applet(
            applet.id,
            i18n.getMessage(applet.heading),
            applet.rows,
            this._fromSpecs(applet.columns)
          )
        )
        .filter(card => card !== nothing);

      if (cards.length) return html`<div class="rv-applets">${cards}</div>`;
      return html`
        <section class="rv-card" role="status">
          <p class="rv-empty-note rv-type-body">
            ${i18n.getMessage('Nothing is related to this record yet.')}
          </p>
        </section>
      `;
    }

    const related = this.related;
    if (!related) return nothing;

    const applets = [
      this._renderOrigin(related.origin),
      this._renderHierarchy(related.hierarchy),
      this._renderFulfilment(related.fulfilment),
      this._renderDispatch(related.dispatch),
      this._renderCommitments(related.commitments)
    ].filter(a => a !== nothing);

    if (!applets.length) {
      return html`
        <section class="rv-card" role="status">
          <p class="rv-empty-note rv-type-body">
            ${i18n.getMessage('Nothing is related to this record yet.')}
          </p>
        </section>
      `;
    }

    return html`<div class="rv-applets">${applets}</div>`;
  }
}
