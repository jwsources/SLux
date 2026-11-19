import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {cellDisplay, cellValue, fetchTable} from './loaders/record-data.js';
import {matchesRecord, subscribeRecordChanges} from './record-events.js';

// THE SLA COUNTDOWN RING -- the signal from the Visuals library, not a
// hand-rolled gauge.
//
// Its entry: "Use -- time running out against a deadline. Avoid -- targets
// with no time component." Construction, taken from that card:
//
//   a faint track circle and a value circle, both r=40 stroke-width=10
//   pathLength="100" on the value circle
//   transform="rotate(-90 ...)" so the arc starts at twelve o'clock
//   remaining time 18px bold centred, TIME LEFT in mono beneath
//   green above 25% left, amber 25 to 10%, red below 10%
//   past the deadline: BREACHED in red, arc stopped
//
// FOUR THINGS THAT CAME FROM THE LIBRARY AND NOT FROM ME:
//
// 1. A FULL RING, not the 180-degree gauge I had planned. The gauge is a
//    different signal in that library -- "one metric against one clear
//    target", and it explicitly warns against using it for several metrics.
//    The ring is the signal for a deadline.
// 2. pathLength="100" normalises the circumference, so stroke-dasharray is
//    written as a percentage directly. No pi-times-r arithmetic to get wrong,
//    and it cannot drift if the radius changes.
// 3. THRESHOLDS ARE ON TIME REMAINING, not elapsed: 25% and 10% left. I had
//    75% elapsed, which is a different boundary and would have flagged
//    at-risk too late.
// 4. It counts down live and clamps at zero. The packaged aiux-sla component
//    we removed states in its own reference that its "time text does not
//    count down; it reflects the moment the data was loaded" -- so this is a
//    real gain, not a restyle.
//
// THE PALETTE IS OURS. That library renders on deep navy; this portal is
// light, so its hex values would put near-white text on white. What transfers
// is the grammar: ring geometry, stroke weight, centred figure, and status
// carried by a WORD as well as a colour.

const SLA_TABLE = 'task_sla';
const SLA_FIELDS =
  'sys_id,sla,stage,has_breached,business_percentage,active,end_time';

// A platform boolean crosses the Table API as 1/0 or true/false depending on
// the column and display mode. Both are accepted: reading only one form would
// report a breached SLA as healthy, which is the worst direction to fail in.
function isTrue(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// REMAINING TIME, from end_time.
//
// Computed from the RAW value with an explicit Z. A glide_date_time stores UTC
// in value and renders the user's timezone in display_value, so parsing the
// display string would be read as local time and shift the answer by the
// user's offset.
function msLeft(rawEnd) {
  if (!rawEnd) return null;
  const at = Date.parse(String(rawEnd).replace(' ', 'T') + 'Z');
  if (Number.isNaN(at)) return null;
  return at - Date.now();
}

function formatLeft(ms) {
  if (ms === null || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (days > 0) return days + 'd ' + hours + 'h';
  if (hours > 0) return hours + 'h ' + rest + 'm';
  return rest + 'm';
}

@customElement('x-snc-slux-rv-glance')
export default class RvGlance extends AIUXElement {
  static properties = {
    row: {attribute: false},
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'},
    _slas: {state: true},
    // Bumped by the ticker so the ring and the figure recompute.
    _tick: {state: true}
  };

  constructor() {
    super();
    this.row = null;
    this.table = '';
    this.sysId = '';
    this._slas = [];
    this._tick = 0;
    // Plain field: the interval handle is not render state.
    this._timer = null;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-glance {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* Ring on the left, reading on the right. The ring carries the feel,
         the words carry the fact. */
      .rv-ring-row {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .rv-ring {
        flex: 0 0 auto;
        inline-size: 92px;
        block-size: 92px;
      }

      /* The arc draws in once on load -- entrance motion inside the
         200-700ms band the library asks for. It clarifies the value rather
         than looping, and it is suppressed for reduced motion. */
      .rv-ring-fill {
        animation: rv-ring-draw 600ms ease-out both;
      }

      @keyframes rv-ring-draw {
        from {
          stroke-dasharray: 0 100;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rv-ring-fill {
          animation: none;
        }
      }

      .rv-read {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .rv-status {
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-status[data-tone='critical'] {
        color: var(--rv-tone-critical-text, #8a1717);
      }

      .rv-status[data-tone='warning'] {
        color: var(--rv-tone-warning-text, #6b4300);
      }

      .rv-status[data-tone='success'] {
        color: var(--rv-tone-success-text, #1e6b3a);
      }

      .rv-sla-name {
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
        overflow-wrap: anywhere;
      }

      .rv-owner {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .rv-avatar {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-action-primary, #0e2b3d);
        color: var(--rv-action-primary-text, #fff);
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
      }

      /* Unassigned reads as absent, not as a person with no name. */
      .rv-avatar[data-empty='true'] {
        background: transparent;
        border: 1px dashed var(--rv-surface-control, #dad8d2);
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-owner-lines {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .rv-owner-name {
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-medium, 500);
        color: var(--rv-ink-primary, #1b1b19);
        overflow-wrap: anywhere;
      }

      .rv-owner-group {
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
        overflow-wrap: anywhere;
      }

      .rv-divider {
        block-size: 1px;
        background: var(--rv-surface-hairline, #e5e3dd);
      }

      .rv-more {
        margin: 0;
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
    this._loadSlas();
    // 30s, not 1s: the figure is minute-resolution, so a per-second tick would
    // re-render sixty times for the same text.
    if (typeof window !== 'undefined') {
      this._timer = window.setInterval(() => {
        this._tick = this._tick + 1;
      }, 30000);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  updated(changed) {
    if (changed.has('sysId')) this._loadSlas();
  }

  _onRecordChanged = event => {
    if (!matchesRecord(event, this.table, this.sysId)) return;
    this._loadSlas();
  };

  async _loadSlas() {
    if (!this.sysId) {
      this._slas = [];
      return;
    }
    const result = await fetchTable(null, SLA_TABLE, {
      // active=true drops cancelled and complete rows. A cancelled SLA is not
      // a commitment, and showing it beside a live breach is noise -- the
      // packaged component included them, which is how two cancelled rows
      // came to sit next to a real breach.
      query: `task=${this.sysId}^active=true`,
      fields: SLA_FIELDS,
      limit: 10
    });

    const rows = (result.rows || []).map(row => ({
      id: cellValue(row, 'sys_id'),
      name: cellDisplay(row, 'sla'),
      elapsed: Number(cellValue(row, 'business_percentage')) || 0,
      breached: isTrue(cellValue(row, 'has_breached')),
      endRaw: cellValue(row, 'end_time')
    }));

    // MOST SEVERE LEADS. Breach outranks everything, then the highest elapsed
    // share, so the ring always shows the commitment that matters.
    rows.sort(
      (a, b) => Number(b.breached) - Number(a.breached) || b.elapsed - a.elapsed
    );
    this._slas = rows;
  }

  _renderRing(sla) {
    const ms = msLeft(sla.endRaw);
    const left = formatLeft(ms);
    // Past the deadline counts as breached even if the flag has not caught up
    // -- the clock is the more current fact.
    const breached = sla.breached || (ms !== null && ms <= 0);

    // PERCENT REMAINING drives both the arc and the threshold. business_percentage
    // is elapsed, and it exceeds 100 once breached -- measured 2104 on this
    // data -- so the remainder is clamped at zero.
    const pctLeft = Math.max(0, Math.min(100, 100 - sla.elapsed));

    // The library's thresholds, on REMAINING time.
    const tone = breached
      ? 'critical'
      : pctLeft < 10
        ? 'critical'
        : pctLeft < 25
          ? 'warning'
          : 'success';

    const stroke =
      tone === 'critical'
        ? 'var(--rv-tone-critical-text, #8a1717)'
        : tone === 'warning'
          ? 'var(--rv-data-attention, #f0b44c)'
          : 'var(--rv-data-positive, #1e6b3a)';

    // Breached stops the arc at empty, which is what "stop the arc" means for
    // a countdown that has run out.
    const dash = breached ? 0 : pctLeft;

    const headline = breached
      ? i18n.getMessage('Breached')
      : left
        ? left
        : i18n.getMessage('{pct}% left', {pct: Math.round(pctLeft)});

    const centre = breached ? i18n.getMessage('0m') : left || '--';
    const label = breached
      ? i18n.getMessage('BREACHED')
      : i18n.getMessage('TIME LEFT');

    return html`
      <div class="rv-ring-row">
        <svg
          class="rv-ring"
          viewBox="0 0 110 110"
          role="img"
          aria-label=${sla.name + ': ' + headline}
        >
          <circle
            cx="55"
            cy="55"
            r="40"
            fill="none"
            stroke="var(--rv-surface-control, #dad8d2)"
            stroke-width="10"
          />
          <circle
            class="rv-ring-fill"
            cx="55"
            cy="55"
            r="40"
            fill="none"
            pathLength="100"
            stroke=${stroke}
            stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray=${dash + ' 100'}
            transform="rotate(-90 55 55)"
          />
          <text
            x="55"
            y="57"
            text-anchor="middle"
            font-size="17"
            font-weight="700"
            fill="var(--rv-ink-primary, #1b1b19)"
          >
            ${centre}
          </text>
          <text
            x="55"
            y="72"
            text-anchor="middle"
            font-size="7"
            letter-spacing="1"
            fill="var(--rv-ink-muted, #5b5a55)"
          >
            ${label}
          </text>
        </svg>

        <span class="rv-read">
          <span class="rv-status" data-tone=${tone}>${headline}</span>
          <span class="rv-sla-name">${sla.name}</span>
        </span>
      </div>
    `;
  }

  render() {
    const row = this.row;
    if (!row) return nothing;

    const assignee = cellDisplay(row, 'assigned_to');
    const group = cellDisplay(row, 'assignment_group');
    const slas = this._slas;
    const lead = slas[0];

    return html`
      <section class="rv-card rv-glance" aria-label=${i18n.getMessage('Status')}>
        ${lead
          ? html`
              ${this._renderRing(lead)}
              ${slas.length > 1
                ? html`<p class="rv-more">
                    ${i18n.getMessage('{count} more commitments', {
                      count: slas.length - 1
                    })}
                  </p>`
                : nothing}
              <div class="rv-divider" role="presentation"></div>
            `
          : nothing}

        <div class="rv-owner">
          <span
            class="rv-avatar"
            data-empty=${assignee ? 'false' : 'true'}
            aria-hidden="true"
            >${assignee ? initialsOf(assignee) : '\u2014'}</span
          >
          <span class="rv-owner-lines">
            <span class="rv-owner-name">
              ${assignee || i18n.getMessage('Unassigned')}
            </span>
            ${group
              ? html`<span class="rv-owner-group">${group}</span>`
              : nothing}
          </span>
        </div>
      </section>
    `;
  }
}
