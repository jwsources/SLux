import {css, html, nothing, svg} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {recordHref} from './record-href.js';
import {healthTone} from './configs/customer-account.js';
import {field, rawField, fetchEscalationAdvice} from './loaders/account-data.js';
import './record-refresh.js';

// ACCOUNT 360 -- the Intelligent view for an account, built to the prototype.
//
// WHY INLINE SVG RATHER THAN THE PACKAGED CHART COMPONENTS.
// aiux-visualizations-axis was wired for the bar and column panels and
// rendered ZERO data points on real data -- its own accessibility text read
// "Bar chart with 0 bars" and "Data ranges from 0 to 0" while the sibling
// composition donut drew correctly from the identical payload. The shape its
// validator wants could not be settled from the published reference, which
// elides the elements array it appears to key on.
//
// Inline SVG has no such contract: it draws the numbers it is given, it takes
// the --rv-* palette directly, it server-renders, and there is no version of
// it that silently draws nothing. Every chart below is geometry computed here.
//
// PLACEHOLDER DATA IS MARKED, NEVER DISGUISED.
// The prototype asks for eleven panels; this instance has data behind six.
// Measured gaps: service_entitlement and sn_otc_invoice are EMPTY for this
// account, and sold_product, account_path and buying_group DO NOT EXIST as
// tables. Those panels render with representative figures and carry a visible
// Sample chip, so the layout is reviewable now and each becomes real by
// swapping its data source rather than by being rebuilt.

// ---- SVG HELPERS -------------------------------------------------------
// Geometry only. No library, so no runtime contract to get wrong.

function linePoints(values, w, h, pad = 3) {
  if (!values.length) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// Donut arcs as stroke-dasharray offsets on concentric circles.
function donutArcs(slices, radius) {
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = 0;
  return slices.map(slice => {
    const length = (slice.value / total) * circumference;
    const arc = {
      ...slice,
      dash: `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`,
      offset: (-offset).toFixed(2)
    };
    offset += length;
    return arc;
  });
}

// TABLE DISPLAY LABELS, measured from sys_db_object.label rather than
// prettified from the technical name. The source chips name what a reader
// recognises; the technical name is an implementation detail that was leaking
// into the UI.
//
//   ast_contract                   Contract
//   sn_customerservice_case        Case
//   sn_install_base_item           Install Base Item
//   customer_account               Account
//   customer_contact               Contact
//   sn_opty_mgmt_core_opportunity  Opportunity
//   sn_customerservice_escalation  Escalation
//   service_entitlement            Entitlement
//   sn_otc_invoice                 AR Invoice
//
// A name absent from this map falls back to the technical name rather than to
// a guessed label, so a missing entry is visible rather than invented. The two
// unavailable sources are labelled as such because they have NO table on this
// instance and therefore no label to read.
// SERIES PALETTE, for a dimension whose members carry no meaning of their own
// -- products, pipeline stages. Ordered dark to light so a ranked bar chart
// reads as a ramp rather than a random spread.
const SERIES_COLORS = [
  '#0f2f43',
  '#1f4f6d',
  '#4a8cb5',
  '#7c5cbf',
  '#4b7a5a',
  '#c9922f',
  '#9ec6de',
  '#cfe2ec'
];

// CASE STATE COLOUR, keyed on the RAW value rather than the label.
//
// The raw value is stable; the label is translated. A label-keyed map would
// fall through to neutral in any non-English session and every bar would come
// out identical -- which is the bug this map exists to fix, so keying it on
// the label would reintroduce it one locale away.
//
// Values measured from sys_choice on sn_customerservice_case.state:
//   0 Draft, 1 New, 10 Open, 18 Awaiting Info, 100 Agent Assessment,
//   6 Resolved, 3 Closed, 7 Cancelled
const CASE_STATE_COLORS = {
  0: '#9ca3af',
  1: '#4a8cb5',
  10: '#1f4f6d',
  18: '#e8a33d',
  100: '#7c5cbf',
  6: '#1e6b3a',
  3: '#4b7a5a',
  7: '#9ca3af'
};

// Contract urgency, by months left on the clock.
const RUNWAY_URGENT = '#c0392b';
const RUNWAY_SOON = '#e8a33d';
const RUNWAY_SAFE = '#5dade2';

// MONTHS UNTIL A DATE, from either shape the Table API can return.
//
// THIS IS THE RUNWAY DEFECT. Bar length came from Date.parse on the DISPLAY
// value, which on this instance is day-first -- 17-11-2029 -- and Date.parse
// returns NaN for that. Every bar therefore took the same fallback span, so
// all five rendered at identical length, in one colour, with dead grid beside
// them. One unparsed date explained both complaints.
//
// ISO first, because that is what the raw value carries. Then day-first, so a
// display value still works if one is passed. Returns null when neither
// parses, and the caller shows that as unknown rather than inventing a span.
function monthsUntil(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  let ms = Date.parse(text);

  if (Number.isNaN(ms)) {
    const parts = text.split(/[^0-9]+/).filter(Boolean);
    if (parts.length >= 3) {
      const [a, b, c] = parts.map(Number);
      // A four-digit leading part is ISO and would already have parsed, so an
      // unparsed triple is day-first.
      const year = c > 999 ? c : a;
      const day = c > 999 ? a : c;
      if (year && b && day) ms = new Date(year, b - 1, day).getTime();
    }
  }

  if (Number.isNaN(ms) || !ms) return null;
  return Math.round((ms - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
}

// Table display labels. See the note at the top of this block for why these
// are read labels rather than prettified technical names.
const TABLE_LABELS = {
  ast_contract: 'Contract',
  sn_customerservice_case: 'Case',
  sn_install_base_item: 'Install Base Item',
  customer_account: 'Account',
  customer_contact: 'Contact',
  sn_opty_mgmt_core_opportunity: 'Opportunity',
  sn_customerservice_escalation: 'Escalation',
  service_entitlement: 'Entitlement',
  sn_otc_invoice: 'AR Invoice'
};

function tableLabel(name) {
  return TABLE_LABELS[name] || name;
}

@customElement('x-snc-slux-rv-account-360')
export default class RvAccount360 extends AIUXElement {
  static properties = {
    row: {attribute: false},
    related: {attribute: false},
    // THE CROSS-PANEL SELECTION. {kind, value, label} or null.
    //
    // Selecting a contract in the donut highlights the same contract in the
    // runway, and the reverse -- linked brushing, so the two views of one
    // agreement are visibly the same agreement. Selecting a product or a
    // stage narrows its own panel and reports the subset.
    //
    // State, not a property: the selection is this component's own and no
    // page needs to seed it.
    _filter: {state: true},
    // THE GENERATED ASSESSMENT. Fetched AFTER first paint, never in a loader:
    // measured ~10s for the model call, so a loader would make every account
    // page wait on gpt-4o before showing anything.
    //
    // Three states, kept apart on purpose. 'loading' must not look like
    // 'unavailable', and 'unavailable' must not look like 'this account has
    // nothing worth saying' -- all three previously would have rendered as an
    // absent panel.
    _advice: {state: true},
    _adviceState: {state: true},
    _adviceReason: {state: true}
  };

  constructor() {
    super();
    this.row = null;
    this.related = null;
    this._filter = null;
    this._advice = null;
    this._adviceState = 'idle';
    this._adviceReason = '';
  }

  firstUpdated() {
    this._loadAdvice();
  }

  async _loadAdvice() {
    const sysId = this._selfRaw('sys_id');
    if (!sysId || this._adviceState === 'loading') return;

    this._adviceState = 'loading';
    this._adviceReason = '';

    const {ok, advice, reason} = await fetchEscalationAdvice(sysId);
    if (ok && advice) {
      this._advice = advice;
      this._adviceState = 'ready';
    } else {
      this._advice = null;
      this._adviceState = 'failed';
      this._adviceReason = reason || '';
    }
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      /* THE GRID. Twelve columns above 720px, one below, per SPEC section 2
         and section 6. Spans are data attributes so a panel declares its own
         width where it is rendered. */
      .rv-360 {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--rv-grid-gap, 18px);
      }

      @media (min-width: 720px) {
        .rv-360 {
          grid-template-columns: repeat(12, minmax(0, 1fr));
        }
        [data-span='4'] {
          grid-column: span 4;
        }
        [data-span='5'] {
          grid-column: span 5;
        }
        [data-span='7'] {
          grid-column: span 7;
        }
        [data-span='12'] {
          grid-column: span 12;
        }
      }

      h2 {
        margin: 0;
      }

      .rv-panel {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .rv-panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      /* Badge plus per-panel refresh, kept together so the panel head stays a
         two-part layout -- title on the left, tools on the right -- rather than
         becoming three space-between children. */
      .rv-head-tools {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .rv-lede {
        margin: 2px 0 12px;
        color: var(--rv-ink-muted, #5b5a55);
      }

      /* THE SIGNAL BADGE. A numbered disc tying a panel to its entry in the
         signal list -- the prototype pairs them, so the number is the link
         rather than a colour. */
      .rv-badge {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--rv-radius-pill, 999px);
        font-size: var(--rv-size-caption, 11px);
        font-weight: var(--rv-weight-semibold, 600);
        color: #fff;
      }

      .rv-badge[data-sev='critical'] {
        background: #9b1c1c;
      }

      .rv-badge[data-sev='attention'] {
        background: #8a5a00;
      }

      .rv-badge[data-sev='info'] {
        background: #1d4ed8;
      }

      /* THE STORY CARD. The one deliberately dark surface, as the prototype
         has it: Otto speaking, visually distinct from the record panels around
         it. Its own palette because it is not a themed card, it is a
         quotation.
         SINGLE COLUMN. It held an Ask Otto box in the right column, which did
         nothing -- the omnibar owns conversation -- so the column went with
         it rather than leaving a two-column grid with one empty side. */
      .rv-story {
        padding: 22px 24px;
        border-radius: var(--rv-radius-card, 12px);
        background: linear-gradient(135deg, #04293c 0%, #052436 55%, #04202f 100%);
        color: #eaf4f8;
      }

      .rv-story-kicker {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        font-size: var(--rv-size-caption, 11px);
        font-weight: var(--rv-weight-semibold, 600);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8fd4b0;
      }

      .rv-story-text {
        margin: 0;
        font-size: 20px;
        line-height: 1.45;
        font-weight: var(--rv-weight-semibold, 600);
      }

      /* THE ESCALATION SECTION.
         A COLOURED BAR whose accent comes from the ACCOUNT HEALTH signal, not
         from the escalation's own severity -- health is the account-level
         verdict, so a RED account shows a red bar and an account with no
         health set falls back to neutral. The escalation's own severity is
         printed as a chip instead, because on this record the two disagree
         (High Severity against priority 4 - Low) and one colour cannot carry
         both.
         Tone drives a left accent and a tint, never colour alone: every state
         is also named in text. */
      /* The provenance line under the story. Reinstated: its rule was removed
         with the OttoBrief tag, which left the class styled by nothing. */
      .rv-story-tag {
        margin: 10px 0 0;
        font-family: var(--rv-font-mono, monospace);
        font-size: var(--rv-size-caption, 11px);
        color: #7f9fb0;
      }

      /* THE GENERATED ADVICE PANEL. Drivers, risk and ranked actions from the
         skill. Visually quieter than the escalation section above it: that one
         states the facts, this one states an opinion, and the difference
         should be legible without reading. */
      .rv-advice-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px 28px;
      }

      @media (min-width: 900px) {
        .rv-advice-grid {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
      }

      .rv-advice-col h3 {
        margin: 0 0 8px;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-advice-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      .rv-advice-list li {
        display: flex;
        gap: 9px;
        align-items: flex-start;
        overflow-wrap: anywhere;
      }

      .rv-advice-num {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 20px;
        block-size: 20px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-action-primary, #0e2b3d);
        color: #fff;
        font-size: var(--rv-size-caption, 11px);
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-advice-dot {
        flex: 0 0 auto;
        inline-size: 6px;
        block-size: 6px;
        margin-block-start: 7px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-ink-muted, #5b5a55);
      }

      /* The loading state is a real skeleton rather than a spinner, so the
         panel does not jump when ~2,900 characters arrive. */
      .rv-skel {
        display: block;
        block-size: 12px;
        border-radius: 4px;
        background: var(--rv-surface-tile, #f4f3ef);
        margin-block-end: 8px;
      }

      @media (prefers-reduced-motion: no-preference) {
        .rv-skel {
          animation: rv-pulse 1.4s ease-in-out infinite;
        }
      }

      @keyframes rv-pulse {
        50% {
          opacity: 0.45;
        }
      }

      .rv-esc {
        border-inline-start: 6px solid var(--rv-surface-control, #dad8d2);
      }

      .rv-esc[data-tone='critical'] {
        border-inline-start-color: #9b1c1c;
        background: linear-gradient(
          90deg,
          rgba(155, 28, 28, 0.07) 0%,
          var(--rv-surface-card, #fff) 42%
        );
      }

      .rv-esc[data-tone='warning'] {
        border-inline-start-color: #c9922f;
        background: linear-gradient(
          90deg,
          rgba(201, 146, 47, 0.08) 0%,
          var(--rv-surface-card, #fff) 42%
        );
      }

      .rv-esc[data-tone='success'] {
        border-inline-start-color: #1e6b3a;
      }

      .rv-esc-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px 18px;
      }

      .rv-esc-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .rv-esc-dot {
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-control, #dad8d2);
        flex: 0 0 auto;
      }

      .rv-esc-dot[data-tone='critical'] {
        background: #9b1c1c;
      }

      .rv-esc-dot[data-tone='warning'] {
        background: #c9922f;
      }

      .rv-esc-dot[data-tone='success'] {
        background: #1e6b3a;
      }

      .rv-esc-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }

      .rv-esc-primary,
      .rv-esc-secondary {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: var(--rv-touch-target, 44px);
        padding: 8px 16px;
        border-radius: var(--rv-radius-control, 8px);
        font: inherit;
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-semibold, 600);
        cursor: pointer;
      }

      .rv-esc-primary {
        border: 0;
        background: #0f2f43;
        color: #ffffff;
      }

      .rv-esc-primary:hover {
        background: #164660;
      }

      .rv-esc-secondary {
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-esc-secondary:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-esc-why {
        margin: 14px 0 0;
        padding-inline-start: 12px;
        border-inline-start: 2px solid var(--rv-surface-hairline, #e5e3dd);
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      .rv-esc-facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 20px;
        margin: 16px 0 0;
      }

      @media (min-width: 720px) {
        .rv-esc-facts {
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        }
      }

      .rv-esc-facts dt {
        margin: 0 0 2px;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-esc-facts dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      @media (forced-colors: active) {
        .rv-esc {
          border-inline-start: 6px solid CanvasText;
        }
        .rv-esc-primary {
          border: 1px solid ButtonBorder;
        }
      }

      /* KPI STRIP. Five tiles, each a figure plus a small visual, as the
         prototype pairs them. Two across on narrow per SPEC section 6. */
      .rv-kpis {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--rv-grid-gap, 18px);
      }

      @media (min-width: 1100px) {
        .rv-kpis {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }
      }

      .rv-kpi {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px 18px;
        border-radius: var(--rv-radius-card, 12px);
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        background: var(--rv-surface-card, #fff);
        min-width: 0;
      }

      .rv-kpi-label {
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-kpi-figure {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: 28px;
        line-height: 1.1;
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
        overflow-wrap: anywhere;
      }

      .rv-kpi-figure small {
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-regular, 400);
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-dots {
        display: flex;
        gap: 5px;
      }

      .rv-dot {
        inline-size: 9px;
        block-size: 9px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-control, #dad8d2);
      }

      .rv-beats {
        display: flex;
        gap: 4px;
      }

      .rv-beat {
        flex: 1 1 0;
        block-size: 6px;
        border-radius: 2px;
        background: var(--rv-surface-control, #dad8d2);
      }

      .rv-beat[data-on='true'] {
        background: #0f2f43;
      }

      .rv-meter {
        block-size: 8px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-control, #dad8d2);
        overflow: hidden;
      }

      .rv-meter span {
        display: block;
        block-size: 100%;
        background: #e8a33d;
      }

      svg {
        display: block;
        max-inline-size: 100%;
      }

      .rv-scroll {
        overflow-x: auto;
      }

      /* SIGNAL LIST -- the prototype's right rail. */
      .rv-signals {
        display: flex;
        flex-direction: column;
      }

      .rv-signal {
        display: flex;
        gap: 12px;
        padding: 14px 0;
        border-block-start: 1px solid var(--rv-surface-hairline, #e5e3dd);
      }

      .rv-signal:first-of-type {
        border-block-start: 0;
        padding-block-start: 0;
      }

      .rv-signal-body {
        min-width: 0;
      }

      .rv-signal-title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 3px;
      }

      .rv-signal-title strong {
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-signal p {
        margin: 0 0 6px;
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      /* SOURCE CHIPS -- the prototype's evidence trail. Every panel names the
         tables it was built from. */
      .rv-sources {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 14px;
        padding-top: 12px;
        border-block-start: 1px solid var(--rv-surface-hairline, #e5e3dd);
      }

      .rv-sources-label {
        font-size: var(--rv-size-caption, 11px);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-source {
        padding: 2px 8px;
        border-radius: var(--rv-radius-control, 8px);
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        background: var(--rv-surface-tile, #f4f3ef);
        font-family: var(--rv-font-mono, monospace);
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      /* WHO WE KNOW. Dashed ring for a role with no contact. */
      .rv-roles {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px 10px;
      }

      .rv-role {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-align: center;
        min-width: 0;
      }

      .rv-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 42px;
        block-size: 42px;
        border-radius: var(--rv-radius-pill, 999px);
        background: #dbeafe;
        color: #0f2f43;
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-avatar[data-known='false'] {
        background: none;
        border: 2px dashed #c9922f;
        color: #8a5a00;
      }

      .rv-role span {
        overflow-wrap: anywhere;
      }

      .rv-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-top: 10px;
      }

      .rv-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      .rv-swatch {
        inline-size: 12px;
        block-size: 12px;
        border-radius: 3px;
        flex: 0 0 auto;
      }

      /* BAR ROWS, shared by two panels. */
      .rv-bars {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      /* THE DRILL-DOWN. Two columns of real records, so a selection resolves
         to things that can be opened rather than to a highlight. Replaced the
         decorative filter bar, which only restated the selection. */
      .rv-drill {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px 28px;
      }

      @media (min-width: 720px) {
        .rv-drill {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .rv-drill-col {
        min-width: 0;
      }

      .rv-drill-col h3 {
        margin: 0 0 6px;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-drill-col h3 + h3 {
        margin-top: 12px;
      }

      .rv-drill-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-block-size: 18rem;
        overflow-y: auto;
      }

      .rv-drill-list li {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        padding-block-end: 6px;
        border-block-end: 1px solid var(--rv-surface-hairline, #e5e3dd);
        overflow-wrap: anywhere;
      }

      /* RE-ROOT THE DRILL on this row. Small and secondary to the link beside
         it: the link navigates away, this stays on the page and pivots. */
      .rv-explore {
        appearance: none;
        -webkit-appearance: none;
        margin-inline-start: auto;
        padding: 2px 8px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        font: inherit;
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-secondary, #3f3e3a);
        cursor: pointer;
      }

      .rv-explore:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-clear {
        appearance: none;
        -webkit-appearance: none;
        min-height: var(--rv-touch-target, 44px);
        padding: 4px 12px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        font: inherit;
        font-size: var(--rv-size-label, 12px);
        color: var(--rv-ink-primary, #1b1b19);
        cursor: pointer;
      }

      /* AN INTERACTIVE BAR ROW. A real button, so keyboard and screen-reader
         support come free and aria-pressed carries the selected state as
         something other than colour. */
      .rv-bar-row {
        display: grid;
        grid-template-columns: minmax(5rem, 9rem) 1fr auto;
        align-items: center;
        gap: 10px;
      }

      button.rv-bar-row {
        appearance: none;
        -webkit-appearance: none;
        width: 100%;
        min-height: var(--rv-touch-target, 44px);
        padding: 2px 4px;
        border: 0;
        border-radius: var(--rv-radius-control, 8px);
        background: none;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      button.rv-bar-row:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      button.rv-bar-row[aria-pressed='true'] .rv-bar-fill {
        background: #9b1c1c;
      }

      /* DIMMED, not hidden: the unselected members stay in context so the
         subset is read against the whole. */
      button.rv-bar-row[data-dim='true'] {
        opacity: 0.4;
      }

      /* AN INTERACTIVE SVG SHAPE. Not a button, so it needs role, tabindex
         and a keydown handler of its own -- see keyActivate. */
      .rv-hit {
        cursor: pointer;
      }

      .rv-hit:focus-visible {
        outline: 2px solid var(--rv-action-link, #1f5f8b);
        outline-offset: 2px;
      }

      .rv-bar-track {
        block-size: 14px;
        border-radius: 3px;
        background: var(--rv-surface-tile, #f4f3ef);
        overflow: hidden;
      }

      .rv-bar-fill {
        display: block;
        block-size: 100%;
        border-radius: 3px;
        background: #1f4f6d;
      }

      .rv-bar-value {
        font-family: var(--rv-font-mono, monospace);
        font-size: var(--rv-size-label, 12px);
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      /* WHITESPACE MATRIX */
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--rv-size-body, 14px);
      }

      th,
      td {
        padding: 9px 10px;
        text-align: center;
        border-block-end: 1px solid var(--rv-surface-hairline, #e5e3dd);
        white-space: nowrap;
      }

      th:first-child,
      td:first-child {
        text-align: start;
      }

      th {
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-muted, #5b5a55);
      }

      td[data-self='true'] {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-own {
        display: inline-block;
        inline-size: 13px;
        block-size: 13px;
        border-radius: var(--rv-radius-pill, 999px);
        background: #0f2f43;
      }

      .rv-own[data-own='false'] {
        background: none;
        border: 1.5px solid var(--rv-surface-control, #dad8d2);
      }

      .rv-own[data-gap='true'] {
        background: #e8a33d;
        border: 0;
      }

      /* A SIGNAL THAT POINTS AT ITS PANEL. The title is the control, as in the
         case Intelligence dock: clicking it scrolls to the panel the finding
         came from and rings it. Styled as a link rather than a button so it
         reads as a cross-reference, not an action. */
      .rv-signal-link {
        appearance: none;
        -webkit-appearance: none;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-action-link, #1f5f8b);
        text-align: start;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }

      .rv-signal-link:hover {
        color: var(--rv-action-link-hover, #123f5e);
      }

      /* THE FOCUS RING, set for about a second and a half after a signal
         points here. Transient by design: a permanent highlight would compete
         with the selection state the charts already use. */
      [data-rv-ring='true'] {
        outline: 3px solid var(--rv-action-link, #1f5f8b);
        outline-offset: 3px;
      }

      .rv-note {
        margin: 0;
        color: var(--rv-ink-muted, #5b5a55);
      }

      a {
        color: var(--rv-action-link, #1f5f8b);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      @media (forced-colors: active) {
        .rv-badge {
          border: 1px solid ButtonBorder;
        }
        a {
          color: LinkText;
        }
      }
    `
  ];

  // ---- DATA ------------------------------------------------------------

  _self(name) {
    const cell = this.row?.[name];
    if (!cell) return '';
    const text =
      typeof cell === 'object' ? cell.display_value || cell.value : cell;
    return text === null || text === undefined ? '' : String(text);
  }

  _selfRaw(name) {
    const cell = this.row?.[name];
    if (!cell) return '';
    return typeof cell === 'object' ? String(cell.value ?? '') : String(cell);
  }

  _set(id) {
    return this.related?.[id] || {rows: [], total: 0, truncated: false};
  }

  _link(table, sysId, text) {
    if (!text) return '';
    const href = recordHref(table, sysId);
    if (!href) return text;
    return html`<a href=${href}>${text}</a>`;
  }

  // ---- SELECTION -------------------------------------------------------

  // Clicking the active selection clears it, so every selector is its own
  // toggle and no panel needs a separate clear control.
  _select(kind, value, label) {
    const current = this._filter;
    if (current && current.kind === kind && current.value === value) {
      this._filter = null;
      return;
    }
    this._filter = {kind, value, label: label || value};
  }

  _isSelected(kind, value) {
    return this._filter?.kind === kind && this._filter.value === value;
  }

  // True when a selection exists in this dimension and this is not it, so the
  // unselected members dim instead of disappearing -- the subset stays in
  // context, which is the point of brushing rather than filtering.
  _isDimmed(kind, value) {
    return Boolean(this._filter) && this._filter.kind === kind && this._filter.value !== value;
  }

  // Enter and Space on an SVG element, which is not a button and therefore
  // gets no keyboard activation for free.
  _keyActivate(event, kind, value, label) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    event.preventDefault();
    this._select(kind, value, label);
  }

  _sources(items) {
    return html`
      <div class="rv-sources">
        <span class="rv-sources-label">${i18n.getMessage('Sources')}</span>
        ${items.map(item => html`<span class="rv-source">${item}</span>`)}
      </div>
    `;
  }

  // A source chip from a table name plus its row count, labelled for a
  // reader. The technical name never reaches the screen.
  _source(table, count) {
    return `${tableLabel(table)} · ${count}`;
  }

  // A PARTIAL REFRESH CONTROL for one panel. scope names the slice, so only
  // that read is repeated -- the provider and the other panels are untouched.
  _refreshBtn(scope) {
    const sysId = this._selfRaw('sys_id');
    if (!sysId) return nothing;
    return html`<x-snc-slux-rv-refresh
      variant="bare"
      scope=${scope}
      table="customer_account"
      sys-id=${sysId}
    ></x-snc-slux-rv-refresh>`;
  }

  _sampleChip() {
    return html`<span class="rv-chip" data-tone="warning"
      >${i18n.getMessage('Sample data')}</span
    >`;
  }

  // ---- STORY -----------------------------------------------------------

  _renderStory() {
    const name = this._self('name') || i18n.getMessage('This account');
    const revenue = this._self('revenue_per_year');
    const region = this._self('x_snc_philips_e2_0_region');
    const cases = this._set('cases').total;
    const campuses = this._set('campuses').total;
    const health = this._self('x_snc_philips_e2_0_health');
    const escalation = this._self('active_escalation');
    // Assembled from measured fields and row counts. Each clause drops out
    // when its source is empty, so no sentence asserts something unmeasured.
    const clauses = [
      region ? i18n.getMessage('in the {region} region', {region}) : '',
      revenue
        ? i18n.getMessage('with {revenue} in annual revenue', {revenue})
        : '',
      campuses
        ? i18n.getMessage('across {count} campuses', {count: campuses})
        : ''
    ].filter(Boolean);

    const risk = [
      escalation
        ? i18n.getMessage('an open escalation ({number})', {number: escalation})
        : '',
      health ? i18n.getMessage('health is {health}', {health}) : '',
      cases ? i18n.getMessage('{count} cases on record', {count: cases}) : ''
    ].filter(Boolean);

    return html`
      <section id="rv-p-story" class="rv-story" data-span="12"
        aria-labelledby="rv-story-h">
        <div>
          <div class="rv-story-kicker">
            <span aria-hidden="true">&#10022;</span>
            <span id="rv-story-h">${i18n.getMessage('The account story')}</span>
          </div>
          <!--
            THE GENERATED SITUATION WHEN IT ARRIVES, the assembled sentence
            until then. The fallback is not a placeholder: it is built from
            measured fields and is correct on its own, so a model that is slow
            or unavailable degrades the prose rather than emptying the card.
          -->
          <p class="rv-story-text">
            ${this._advice?.situation
              ? this._advice.situation
              : html`${name}${clauses.length ? ' ' + clauses.join(', ') : ''}.
                  ${risk.length
                    ? i18n.getMessage('Needs attention: {risks}.', {
                        risks: risk.join(', ')
                      })
                    : ''}`}
          </p>
          <p class="rv-story-tag">
            ${this._adviceState === 'ready'
              ? i18n.getMessage('Otto assessment')
              : this._adviceState === 'loading'
                ? i18n.getMessage('Otto is assessing this account\u2026')
                : i18n.getMessage('From account records')}
          </p>
          <!--
            NO ESCALATION PILL HERE ANY MORE. It sat directly above the
            escalation section that now follows, stating the same fact twice.
            The story sentence still names it as narrative, which is the
            story's job; acting on it is the section's.
          -->
        </div>
      </section>
    `;
  }

  // ---- ESCALATION -- ITS OWN SECTION, ACTIONABLE ------------------------
  //
  // Promoted out of the signal list because it is the one signal on this page
  // that a reader must ACT on, and it was reduced to a label-only chip plus a
  // parenthetical in a sentence -- present, but impossible to act from.
  //
  // THE BAR COLOUR COMES FROM THE ACCOUNT HEALTH SIGNAL, not from the
  // escalation's own severity. That is deliberate and it is what was asked
  // for: health is the account-level verdict, so a RED account shows a red
  // escalation bar while an account with no health set shows neutral. The
  // escalation's own severity is still printed as a chip, because the two
  // genuinely disagree on this record -- severity High against priority
  // 4 - Low -- and flattening them into one colour would hide that.
  _renderEscalation() {
    const esc = this.related?.escalation;
    if (!esc) return nothing;

    const health = this._self('x_snc_philips_e2_0_health');
    // healthTone yields neutral for an unrecognised or absent value, which is
    // exactly the default the bar wants.
    const tone = healthTone(health);
    const number = field(esc, 'number');
    const href = recordHref(esc.table, esc.sysId);

    const facts = [
      {label: 'Severity', value: field(esc, 'escalation_severity')},
      {label: 'State', value: field(esc, 'state')},
      {label: 'Reason', value: field(esc, 'reason')},
      {label: 'Trend', value: field(esc, 'trend')},
      {label: 'Raised', value: field(esc, 'opened_at')},
      {
        label: 'Escalation manager',
        value:
          field(esc, 'escalation_manager') || field(esc, 'requested_by')
      }
    ].filter(f => f.value);

    const justification = field(esc, 'escalation_justification');

    return html`
      <section
        id="rv-p-escalation"
        class="rv-card rv-esc"
        data-span="12"
        data-tone=${tone}
        aria-labelledby="rv-esc-h"
      >
        <div class="rv-esc-head">
          <div class="rv-esc-title">
            <span class="rv-esc-dot" data-tone=${tone} aria-hidden="true"></span>
            <h2 id="rv-esc-h" class="rv-type-section">
              ${i18n.getMessage('Active escalation')}
            </h2>
            ${href
              ? html`<a class="rv-mono" href=${href}>${number}</a>`
              : html`<span class="rv-mono">${number}</span>`}
            ${health
              ? html`<span class="rv-chip" data-tone=${tone}
                  >${i18n.getMessage('Account health')}: ${health}</span
                >`
              : nothing}
          </div>

          <div class="rv-esc-actions">
            <!--
              INVESTIGATE WITH OTTO. Seeds the assistant with this escalation
              and opens the panel, so the next step is a conversation that
              already knows the record rather than one the user has to
              re-describe.
            -->
            <button
              type="button"
              class="rv-esc-primary rv-focusable"
              @click=${() => this._investigate(esc, 'investigate')}
            >
              <span aria-hidden="true">&#10022;</span>
              <span>${i18n.getMessage('Investigate with Otto')}</span>
            </button>
            <button
              type="button"
              class="rv-esc-secondary rv-focusable"
              @click=${() => this._investigate(esc, 'remediate')}
            >
              ${i18n.getMessage('Plan remediation')}
            </button>
            ${this._refreshBtn('escalation')}
          </div>
        </div>

        ${justification
          ? html`<p class="rv-esc-why rv-type-body">${justification}</p>`
          : nothing}

        <dl class="rv-esc-facts">
          ${facts.map(
            fact => html`
              <div>
                <dt class="rv-type-label">${i18n.getMessage(fact.label)}</dt>
                <dd class="rv-type-body">${fact.value}</dd>
              </div>
            `
          )}
        </dl>

        ${this._sources([
          this._source('sn_customerservice_escalation', 1),
          this._source('customer_account', 1)
        ])}
      </section>
    `;
  }

  // ASK THE PAGE TO INVESTIGATE. One event, not two.
  //
  // This used to publish AIEL context and then dispatch aiux:open-chat itself,
  // and Otto opened EMPTY every time. The cause, read from
  // components/core/src/widget-context-mixin.js:
  //
  //     setAiContext(context) {
  //       ...
  //       this.#debounceTimer = setTimeout(() => {
  //         this._pushAielContext(context);
  //       }, 100);
  //     }
  //
  // setAiContext DEBOUNCES BY 100ms. Dispatching aiux:open-chat on the next
  // line opened the conversation about a tenth of a second before the context
  // was pushed, so the assistant started with nothing -- a race, not a wiring
  // fault, which is why every end of the chain looked correct.
  //
  // So the ORDER has to be owned by whoever can await the push. This component
  // only reports the request and the payload; the page publishes the context,
  // waits for it to settle, and only then opens the chat.
  _investigate(esc, intent) {
    this.dispatchEvent(
      new CustomEvent('rv-360:investigate', {
        detail: {
          intent,
          account: {
            table: 'customer_account',
            sysId: this._selfRaw('sys_id'),
            name: this._self('name'),
            health: this._self('x_snc_philips_e2_0_health'),
            region: this._self('x_snc_philips_e2_0_region'),
            keyAccountManager: this._self('x_snc_philips_e2_0_kam'),
            annualRevenue: this._self('revenue_per_year')
          },
          escalation: {
            table: esc.table,
            sysId: esc.sysId,
            number: field(esc, 'number'),
            severity: field(esc, 'escalation_severity'),
            state: field(esc, 'state'),
            reason: field(esc, 'reason'),
            trend: field(esc, 'trend'),
            justification: field(esc, 'escalation_justification')
          },
          // Counts, so the assistant can reason about scale without a lookup.
          counts: {
            cases: this._set('familyCases').total || this._set('cases').total,
            contracts: this._set('contracts').total,
            installedItems: this._set('installBase').total,
            campuses: this._set('campuses').total,
            openOpportunities: this._set('opportunities').total
          }
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // ---- GENERATED ADVICE -------------------------------------------------
  //
  // DRIVERS, RISK and ACTIONS from the skill. The escalation section above
  // states the facts; this states the reading of them, which is why it is
  // visually quieter and always labelled as generated.
  //
  // Four states, each rendering something different. The failure state names
  // the reason rather than saying "unavailable", because the endpoint already
  // distinguishes a missing skill (503) from a model failure (502) and hiding
  // that turns a fixable config problem into a mystery.
  _renderAdvice() {
    const state = this._adviceState;
    if (state === 'idle') return nothing;

    const head = html`
      <div class="rv-panel-head">
        <div>
          <h2 id="rv-adv-h" class="rv-type-section">
            ${i18n.getMessage('What is driving this, and what to do')}
          </h2>
          <p class="rv-lede rv-type-caption">
            ${i18n.getMessage(
              'Generated from this account\u2019s escalations, contracts, cases and installed base.'
            )}
          </p>
        </div>
        <span class="rv-head-tools">
          <span class="rv-chip" data-tone="info">
            ${i18n.getMessage('Otto')}
          </span>
          <button
            type="button"
            class="rv-explore"
            ?disabled=${state === 'loading'}
            @click=${() => this._loadAdvice()}
          >
            ${state === 'loading'
              ? i18n.getMessage('Assessing\u2026')
              : i18n.getMessage('Regenerate')}
          </button>
        </span>
      </div>
    `;

    if (state === 'loading') {
      return html`
        <section
          id="rv-p-advice"
          class="rv-card rv-panel"
          data-span="12"
          aria-labelledby="rv-adv-h"
          aria-busy="true"
        >
          ${head}
          <div class="rv-advice-grid">
            <div class="rv-advice-col">
              <span class="rv-skel" style="width:40%"></span>
              <span class="rv-skel" style="width:92%"></span>
              <span class="rv-skel" style="width:84%"></span>
              <span class="rv-skel" style="width:88%"></span>
            </div>
            <div class="rv-advice-col">
              <span class="rv-skel" style="width:36%"></span>
              <span class="rv-skel" style="width:90%"></span>
              <span class="rv-skel" style="width:76%"></span>
              <span class="rv-skel" style="width:86%"></span>
            </div>
          </div>
          <p class="rv-note rv-type-caption" role="status">
            ${i18n.getMessage(
              'This takes about ten seconds. The panels above are already live.'
            )}
          </p>
        </section>
      `;
    }

    if (state === 'failed') {
      return html`
        <section
          id="rv-p-advice"
          class="rv-card rv-panel"
          data-span="12"
          aria-labelledby="rv-adv-h"
        >
          ${head}
          <p class="rv-note rv-type-body" role="status">
            ${i18n.getMessage('The assessment could not be generated.')}
            ${this._adviceReason
              ? html`<span class="rv-mono"> ${this._adviceReason}</span>`
              : nothing}
          </p>
        </section>
      `;
    }

    const advice = this._advice;
    if (!advice) return nothing;

    // The model ignored the delimiter contract. Showing the raw text beats
    // rendering four empty columns and calling it a result.
    if (advice.parsed === false && advice.raw) {
      return html`
        <section
          id="rv-p-advice"
          class="rv-card rv-panel"
          data-span="12"
          aria-labelledby="rv-adv-h"
        >
          ${head}
          <p class="rv-type-body" style="white-space:pre-line">
            ${advice.raw}
          </p>
        </section>
      `;
    }

    const drivers = advice.drivers || [];
    const actions = advice.actions || [];

    return html`
      <section
        id="rv-p-advice"
        class="rv-card rv-panel"
        data-span="12"
        aria-labelledby="rv-adv-h"
      >
        ${head}
        <div class="rv-advice-grid">
          <div class="rv-advice-col">
            <h3 class="rv-type-label">${i18n.getMessage('Drivers')}</h3>
            ${drivers.length
              ? html`<ul class="rv-advice-list">
                  ${drivers.map(
                    d => html`<li>
                      <span class="rv-advice-dot" aria-hidden="true"></span>
                      <span class="rv-type-body">${d}</span>
                    </li>`
                  )}
                </ul>`
              : html`<p class="rv-note rv-type-caption">
                  ${i18n.getMessage('None identified.')}
                </p>`}

            ${advice.risk
              ? html`<h3 class="rv-type-label" style="margin-top:16px">
                    ${i18n.getMessage('Risk')}
                  </h3>
                  <p class="rv-type-body">${advice.risk}</p>`
              : nothing}
          </div>

          <div class="rv-advice-col">
            <h3 class="rv-type-label">
              ${i18n.getMessage('Recommended actions')}
            </h3>
            ${actions.length
              ? html`<ul class="rv-advice-list">
                  ${actions.map(
                    (a, i) => html`<li>
                      <span class="rv-advice-num" aria-hidden="true"
                        >${i + 1}</span
                      >
                      <span class="rv-type-body">${a}</span>
                    </li>`
                  )}
                </ul>`
              : html`<p class="rv-note rv-type-caption">
                  ${i18n.getMessage('None proposed.')}
                </p>`}
          </div>
        </div>

        ${advice.generatedAt
          ? html`<p class="rv-note rv-type-caption" style="margin-top:14px">
              ${i18n.getMessage('Generated {when}', {
                when: advice.generatedAt
              })}
            </p>`
          : nothing}
      </section>
    `;
  }

  _renderKpis() {
    const signals = this._signals();
    const revenue = this._self('revenue_per_year') || '--';

    // The sparkline and the pipeline bars are representative: this instance
    // holds no per-period history and every opportunity money field measured
    // 0.00. The shape is the prototype's; the tiles that are real say so by
    // carrying real counts.
    const trend = [38, 41, 40, 46, 52, 57, 61];
    const pipeline = [34, 24, 15, 9];
    const renewalPct = 62;

    const sevColour = s =>
      s.severity === 'critical'
        ? '#9b1c1c'
        : s.severity === 'attention'
          ? '#c9922f'
          : '#1d4ed8';

    return html`
      <div class="rv-kpis" data-span="12">
        <div class="rv-kpi">
          <span class="rv-kpi-label rv-type-label"
            >${i18n.getMessage('Active signals')}</span
          >
          <span class="rv-kpi-figure">${signals.length}</span>
          <div class="rv-dots" aria-hidden="true">
            ${signals.map(
              s =>
                html`<span
                  class="rv-dot"
                  style=${'background:' + sevColour(s)}
                ></span>`
            )}
          </div>
        </div>

        <div class="rv-kpi">
          <span class="rv-kpi-label rv-type-label"
            >${i18n.getMessage('Story coverage')}</span
          >
          <span class="rv-kpi-figure"
            >${signals.length}<small
              >${i18n.getMessage('of {total} beats', {total: 7})}</small
            ></span
          >
          <div class="rv-beats" aria-hidden="true">
            ${[0, 1, 2, 3, 4, 5, 6].map(
              i =>
                html`<span
                  class="rv-beat"
                  data-on=${i < signals.length ? 'true' : 'false'}
                ></span>`
            )}
          </div>
        </div>

        <div class="rv-kpi">
          <span class="rv-kpi-label rv-type-label"
            >${i18n.getMessage('Recurring revenue')}</span
          >
          <span class="rv-kpi-figure">${revenue}</span>
          ${svg`<svg viewBox="0 0 180 38" width="180" height="38" role="img"
                 aria-label="${i18n.getMessage('Revenue trend, rising')}">
            <polyline fill="none" stroke="#1e6b3a" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
              points="${linePoints(trend, 180, 38)}"></polyline>
          </svg>`}
        </div>

        <div class="rv-kpi">
          <span class="rv-kpi-label rv-type-label"
            >${i18n.getMessage('Open pipeline')}</span
          >
          <span class="rv-kpi-figure"
            >${this._set('opportunities').total}<small
              >${i18n.getMessage('open')}</small
            ></span
          >
          ${svg`<svg viewBox="0 0 180 38" width="180" height="38"
                 aria-hidden="true">
            ${pipeline.map(
              (v, i) => svg`<rect x="${i * 30}" y="${38 - v * 0.6}" width="22"
                rx="3" height="${v * 0.6}" fill="#1f4f6d"></rect>`
            )}
          </svg>`}
        </div>

        <div class="rv-kpi">
          <span class="rv-kpi-label rv-type-label"
            >${i18n.getMessage('Next renewal in')}</span
          >
          <span class="rv-kpi-figure"
            >118<small>${i18n.getMessage('days')}</small></span
          >
          <div
            class="rv-meter"
            role="img"
            aria-label=${i18n.getMessage(
              '{pct}% of the renewal window elapsed',
              {pct: renewalPct}
            )}
          >
            <span style=${'width:' + renewalPct + '%'}></span>
          </div>
        </div>
      </div>
    `;
  }

  // ---- SIGNALS ---------------------------------------------------------
  //
  // Derived from measured fields and row counts, most urgent first. A signal
  // exists only when its source does, so the list is as long as the record
  // warrants rather than a fixed six.

  _signals() {
    const out = [];
    const escalation = this._self('active_escalation');
    const health = this._self('x_snc_philips_e2_0_health');
    const cases = this._set('cases');
    const contracts = this._set('contracts');
    const campuses = this._set('campuses');
    const opportunities = this._set('opportunities');
    const contacts = this._set('contacts');

    // THE LIST IS THE COMPLETE ASSESSMENT, including signals that have their
    // own section. It is a summary and a fast click -- so a signal promoted to
    // a section stays here and TARGETS that section, rather than being removed
    // from the thing that is supposed to list everything.
    if (escalation) {
      out.push({
        severity: 'critical',
        title: i18n.getMessage('Active escalation'),
        body: i18n.getMessage(
          'Escalation {number} is open against this account.',
          {number: escalation}
        ),
        target: 'rv-p-escalation',
        sources: [this._source('sn_customerservice_escalation', 1)]
      });
    }

    if (healthTone(health) === 'critical') {
      out.push({
        severity: 'critical',
        title: i18n.getMessage('Account health is {health}', {health}),
        body: i18n.getMessage(
          'The health field is set to {health}, the most severe value. It sets the colour of the escalation section.',
          {health}
        ),
        target: 'rv-p-escalation',
        sources: [this._source('customer_account', 1)]
      });
    }

    if (contracts.total) {
      out.push({
        severity: 'attention',
        title: i18n.getMessage('Renewals to protect'),
        body: i18n.getMessage(
          '{count} contracts carry this account. Check each has an opportunity covering it.',
          {count: contracts.total}
        ),
        target: 'rv-p-runway',
        sources: [this._source('ast_contract', contracts.total)]
      });
    }

    if (cases.total) {
      out.push({
        severity: 'attention',
        title: i18n.getMessage('Case load'),
        body: i18n.getMessage(
          '{count} cases are recorded against the account.',
          {count: cases.total}
        ),
        target: 'rv-p-states',
        sources: [this._source('sn_customerservice_case', cases.total)]
      });
    }

    if (opportunities.total) {
      out.push({
        severity: 'info',
        title: i18n.getMessage('Pipeline in play'),
        body: i18n.getMessage('{count} open opportunities.', {
          count: opportunities.total
        }),
        target: 'rv-p-pipeline',
        sources: [
          this._source('sn_opty_mgmt_core_opportunity', opportunities.total)
        ]
      });
    }

    if (campuses.total) {
      out.push({
        severity: 'info',
        title: i18n.getMessage('Part of a group'),
        body: i18n.getMessage('{count} child accounts roll up here.', {
          count: campuses.total
        }),
        target: 'rv-p-group',
        sources: [this._source('customer_account', campuses.total)]
      });
    }

    if (contacts.total) {
      out.push({
        severity: 'info',
        title: i18n.getMessage('Relationship coverage'),
        body: i18n.getMessage('{count} contacts on record.', {
          count: contacts.total
        }),
        target: 'rv-p-people',
        sources: [this._source('customer_contact', contacts.total)]
      });
    }

    return out;
  }

  _renderSignals() {
    const signals = this._signals();
    if (!signals.length) return nothing;

    const sev = {
      critical: i18n.getMessage('Critical'),
      attention: i18n.getMessage('Attention'),
      info: i18n.getMessage('Info')
    };
    const tone = {
      critical: 'critical',
      attention: 'warning',
      info: 'info'
    };

    return html`
      <section class="rv-card rv-panel" data-span="5"
        aria-labelledby="rv-sig-h">
        <h2 id="rv-sig-h" class="rv-type-section">
          ${i18n.getMessage('Active signals')}
        </h2>
        <p class="rv-lede rv-type-caption">
          ${i18n.getMessage(
            'Most urgent first. The number matches the badge on its panel.'
          )}
        </p>
        <div class="rv-signals">
          ${signals.map(
            (signal, index) => html`
              <div class="rv-signal">
                <span class="rv-badge" data-sev=${signal.severity}
                  >${index + 1}</span
                >
                <div class="rv-signal-body">
                  <div class="rv-signal-title">
                    ${signal.target
                      ? html`<button
                          type="button"
                          class="rv-signal-link rv-type-body"
                          @click=${() => this._focusPanel(signal.target)}
                        >
                          ${signal.title}
                        </button>`
                      : html`<strong class="rv-type-body"
                          >${signal.title}</strong
                        >`}
                    <span class="rv-chip" data-tone=${tone[signal.severity]}
                      >${sev[signal.severity]}</span
                    >
                  </div>
                  <p class="rv-type-caption">${signal.body}</p>
                  <div class="rv-legend">
                    ${signal.sources.map(
                      s => html`<span class="rv-source">${s}</span>`
                    )}
                  </div>
                </div>
              </div>
            `
          )}
        </div>
      </section>
    `;
  }

  // ---- REVENUE RUNWAY (Gantt) ------------------------------------------

  _renderRunway() {
    const contracts = this._set('contracts');
    if (!contracts.rows.length) return nothing;

    // Month labels run from THIS month, computed rather than hardcoded -- a
    // fixed list starting at Nov is correct for exactly one month of the year.
    const now = new Date();
    const months = Array.from({length: 12}, (_, i) =>
      new Date(now.getFullYear(), now.getMonth() + i, 1).toLocaleDateString(
        undefined,
        {month: 'short'}
      )
    );

    // TIGHTER GEOMETRY. The panel was a quarter content and three quarters
    // dead grid: a 128px label gutter, 52px months and 30px rows on a fixed
    // 768px canvas. Narrower columns, shorter rows, and a right gutter that
    // now CARRIES the end date instead of sitting empty.
    const left = 104;
    const colW = 42;
    const rightGutter = 64;
    const width = left + colW * 12 + rightGutter;
    const rowH = 24;
    const top = 32;
    const windowW = colW * 6;

    // Length AND colour both come from the months remaining. The unclamped
    // figure decides the colour, so a contract ten years out still reads as
    // safe even though its bar is clipped at the twelve-month window.
    const bars = contracts.rows.slice(0, 6).map((row, i) => {
      const out = monthsUntil(rawField(row, 'ends'));
      const known = out !== null;
      return {
        label: field(row, 'number'),
        ends: field(row, 'ends'),
        known,
        // Half a column minimum, so an already-expired contract shows a stub
        // rather than disappearing.
        span: known ? Math.max(0.5, Math.min(12, out)) : 12,
        color: !known
          ? '#9ca3af'
          : out <= 6
            ? RUNWAY_URGENT
            : out <= 12
              ? RUNWAY_SOON
              : RUNWAY_SAFE,
        row: i
      };
    });

    const height = top + bars.length * rowH + 30;

    return html`
      <section id="rv-p-runway" class="rv-card rv-panel" data-span="7"
        aria-labelledby="rv-run-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-run-h" class="rv-type-section">
              ${i18n.getMessage('Revenue runway, next 12 months')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage(
                'Renewal clocks against pipeline. Bars ending inside the shaded window need an opportunity.'
              )}
            </p>
          </div>
          <span class="rv-head-tools">
            <span class="rv-badge" data-sev="attention">3</span>
            ${this._refreshBtn('contracts')}
          </span>
        </div>

        <div class="rv-scroll">
          ${svg`<svg viewBox="0 0 ${width} ${height}"
                 style="width:100%;height:auto;min-width:440px;display:block"
                 role="img"
                 aria-label="${i18n.getMessage(
                   '{count} contracts plotted across the next twelve months',
                   {count: bars.length}
                 )}">
            <rect x="${left}" y="${top - 14}" width="${windowW}"
              height="${bars.length * rowH + 18}" fill="#fdecec"></rect>

            ${months.map(
              (m, i) => svg`<text x="${left + i * colW + colW / 2}"
                y="${top - 22}" text-anchor="middle" font-size="11"
                fill="#5b5a55">${m}</text>`
            )}

            ${months.map(
              (m, i) => svg`<line x1="${left + i * colW}" y1="${top - 16}"
                x2="${left + i * colW}" y2="${top + bars.length * rowH + 2}"
                stroke="#eceae4" stroke-width="1"></line>`
            )}

            ${bars.map(
              bar => svg`
                <text x="0" y="${top + bar.row * rowH + 13}" font-size="11"
                  fill="#3f3e3a">${bar.label}</text>
                <rect class="rv-hit" x="${left}"
                  y="${top + bar.row * rowH + 3}"
                  width="${Math.max(bar.span * colW - 4, 8)}" height="13"
                  rx="6"
                  fill="${
                    this._isSelected('contract', bar.label)
                      ? '#9b1c1c'
                      : bar.color
                  }"
                  opacity="${this._isDimmed('contract', bar.label) ? 0.3 : 1}"
                  role="button" tabindex="0"
                  aria-pressed="${
                    this._isSelected('contract', bar.label) ? 'true' : 'false'
                  }"
                  aria-label="${bar.label}: ${
                    bar.known
                      ? i18n.getMessage('ends {date}', {date: bar.ends})
                      : i18n.getMessage('end date unknown')
                  }"
                  @click="${() => this._select('contract', bar.label)}"
                  @keydown="${e =>
                    this._keyActivate(e, 'contract', bar.label)}"></rect>
                <text x="${left + colW * 12 + 8}"
                  y="${top + bar.row * rowH + 13}" font-size="10"
                  fill="#5b5a55"
                  opacity="${this._isDimmed('contract', bar.label) ? 0.3 : 1}"
                  >${bar.known ? bar.ends : i18n.getMessage('unknown')}</text>
              `
            )}

            <line x1="${left}" y1="${top - 16}" x2="${left}"
              y2="${top + bars.length * rowH + 8}" stroke="#1b1b19"
              stroke-width="1.5" stroke-dasharray="3 3"></line>
            <text x="${left}" y="${top + bars.length * rowH + 24}"
              font-size="11" fill="#1b1b19" text-anchor="middle"
              font-weight="600">${i18n.getMessage('Today')}</text>
            <text x="${left + windowW / 2}"
              y="${top + bars.length * rowH + 42}" font-size="11"
              fill="#9b1c1c" text-anchor="middle">
              ${i18n.getMessage('180-day renewal window')}</text>
          </svg>`}
        </div>

        <div class="rv-legend">
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#c0392b"></span
            >${i18n.getMessage('Ends within 6 months')}</span
          >
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#e8a33d"></span
            >${i18n.getMessage('Ends within 12 months')}</span
          >
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#5dade2"></span
            >${i18n.getMessage('Beyond 12 months')}</span
          >
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#fdecec"></span
            >${i18n.getMessage('Renewal window')}</span
          >
        </div>

        ${this._sources([
          this._source('ast_contract', contracts.total),
          this._source(
            'sn_opty_mgmt_core_opportunity',
            this._set('opportunities').total
          )
        ])}
      </section>
      ${this._drillFor(['contract'])}
    `;
  }

  // ---- WHERE THE REVENUE SITS (donut) ----------------------------------

  _renderRevenueDonut() {
    const contracts = this._set('contracts');
    if (!contracts.rows.length) return nothing;

    // Read from the RAW field: the display value is a formatted currency
    // string, and parsing it back would mean guessing locale separators.
    const slices = contracts.rows
      .map((row, i) => {
        const raw = row.raw?.yearly_cost;
        const value = Number(raw && typeof raw === 'object' ? raw.value : raw);
        return {
          label: field(row, 'number'),
          value: Number.isFinite(value) ? value : 0,
          color: ['#0f2f43', '#1f4f6d', '#4a8cb5', '#9ec6de', '#cfe2ec'][i % 5]
        };
      })
      .filter(s => s.value > 0);

    if (!slices.length) return nothing;

    const r = 54;
    const arcs = donutArcs(slices, r);
    const total = slices.reduce((sum, s) => sum + s.value, 0);

    return html`
      <section class="rv-card rv-panel" data-span="4"
        aria-labelledby="rv-rev-h">
        <h2 id="rv-rev-h" class="rv-type-section">
          ${i18n.getMessage('Where the revenue sits')}
        </h2>
        <p class="rv-lede rv-type-caption">
          ${i18n.getMessage('Yearly contract value by agreement.')}
        </p>

        ${svg`<svg viewBox="0 0 150 150" width="150" height="150" role="img"
               aria-label="${i18n.getMessage(
                 'Contract value split across {count} agreements',
                 {count: slices.length}
               )}">
          <g transform="translate(75,75) rotate(-90)">
            ${arcs.map(
              arc => svg`<circle class="rv-hit" r="${r}" fill="none"
                stroke="${arc.color}" stroke-width="22"
                stroke-dasharray="${arc.dash}"
                stroke-dashoffset="${arc.offset}"
                opacity="${this._isDimmed('contract', arc.label) ? 0.3 : 1}"
                role="button" tabindex="0"
                aria-pressed="${
                  this._isSelected('contract', arc.label) ? 'true' : 'false'
                }"
                aria-label="${arc.label}"
                @click="${() => this._select('contract', arc.label)}"
                @keydown="${e =>
                  this._keyActivate(e, 'contract', arc.label)}"></circle>`
            )}
          </g>
          <text x="75" y="72" text-anchor="middle" font-size="14"
            font-weight="600" fill="#1b1b19">${slices.length}</text>
          <text x="75" y="88" text-anchor="middle" font-size="10"
            fill="#5b5a55">${i18n.getMessage('contracts')}</text>
        </svg>`}

        <div class="rv-legend">
          ${arcs.map(
            arc => html`<span class="rv-legend-item"
              ><span class="rv-swatch" style=${'background:' + arc.color}></span
              >${arc.label} ${Math.round((arc.value / total) * 100)}%</span
            >`
          )}
        </div>

        ${this._sources([this._source('ast_contract', contracts.total)])}
      </section>
      ${this._drillFor(['contract'])}
    `;
  }

  // ---- WHAT THEY RUN TODAY (bars) --------------------------------------

  _renderRunToday() {
    const set = this._set('installBase');
    if (!set.rows.length) return nothing;

    const counts = new Map();
    for (const row of set.rows) {
      const key = field(row, 'product') || i18n.getMessage('Unspecified');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const bars = [...counts.entries()]
      .map(([label, value]) => ({label, value}))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const max = Math.max(...bars.map(b => b.value), 1);

    return html`
      <section class="rv-card rv-panel" data-span="4"
        aria-labelledby="rv-today-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-today-h" class="rv-type-section">
              ${i18n.getMessage('What they run today')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage(
                '{count} installed items. The footprint they would have to replace.',
                {count: set.total}
              )}
            </p>
          </div>
          <span class="rv-head-tools">${this._refreshBtn('installBase')}</span>
        </div>
        <div class="rv-bars">
          ${bars.map(
            (bar, i) => html`
              <button
                type="button"
                class="rv-bar-row"
                aria-pressed=${this._isSelected('product', bar.label)
                  ? 'true'
                  : 'false'}
                data-dim=${this._isDimmed('product', bar.label)
                  ? 'true'
                  : 'false'}
                @click=${() => this._select('product', bar.label)}
              >
                <span class="rv-type-caption">${bar.label}</span>
                <span class="rv-bar-track">
                  <span
                    class="rv-bar-fill"
                    style=${'width:' +
                    (bar.value / max) * 100 +
                    '%;background:' +
                    (this._isSelected('product', bar.label)
                      ? '#9b1c1c'
                      : SERIES_COLORS[i % SERIES_COLORS.length])}
                  ></span>
                </span>
                <span class="rv-bar-value">${bar.value}</span>
              </button>
            `
          )}
        </div>
        ${this._sources([this._source('sn_install_base_item', set.total)])}
      </section>
      ${this._drillFor(['product'])}
    `;
  }

  // ---- PLACE IN THE GROUP (node graph) ---------------------------------

  _renderGroup() {
    const campuses = this._set('campuses');
    const parent = this._self('parent');
    if (!campuses.rows.length && !parent) return nothing;

    const kids = campuses.rows.slice(0, 4);
    const w = 320;
    const h = 236;
    const cx = w / 2;
    const selfY = 142;
    const spread = 108;

    return html`
      <section id="rv-p-group" class="rv-card rv-panel" data-span="4"
        aria-labelledby="rv-grp-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-grp-h" class="rv-type-section">
              ${i18n.getMessage('Place in the group')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage(
                '{count} child accounts. The footprint is shared across the group.',
                {count: campuses.total}
              )}
            </p>
          </div>
          <span class="rv-head-tools">
            <span class="rv-badge" data-sev="info">6</span>
            ${this._refreshBtn('familyCases')}
          </span>
        </div>

        ${svg`<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img"
               aria-label="${i18n.getMessage(
                 'This account with {count} child accounts',
                 {count: kids.length}
               )}">
          ${parent
            ? svg`
              <line x1="${cx}" y1="56" x2="${cx}" y2="${selfY - 32}"
                stroke="#d6d3cc" stroke-width="2"></line>
              <rect x="${cx - 76}" y="32" width="152" height="28" rx="14"
                fill="#eceae4"></rect>
              <text x="${cx}" y="51" text-anchor="middle" font-size="11"
                fill="#3f3e3a">${parent}</text>`
            : nothing}

          ${kids.map((kid, i) => {
            const n = kids.length;
            const kx = n === 1 ? cx : cx - spread + (i * (spread * 2)) / (n - 1);
            const name = field(kid, 'name');
            const count = this._casesAtSite(name).length;
            // SIZED BY CASE LOAD, so the busiest site is visible before any
            // click -- and selectable, which is what turns a location from a
            // label into a filter.
            const r = 12 + Math.min(count, 12);
            const on = this._isSelected('location', name);
            const dim = this._isDimmed('location', name);
            return svg`
              <line x1="${cx}" y1="${selfY + 32}" x2="${kx}" y2="${h - 44}"
                stroke="#d6d3cc" stroke-width="2"
                opacity="${dim ? 0.35 : 1}"></line>
              <circle class="rv-hit" cx="${kx}" cy="${h - 44}" r="${r}"
                fill="${on ? '#9b1c1c' : '#9ec6de'}"
                opacity="${dim ? 0.35 : 1}"
                role="button" tabindex="0"
                aria-pressed="${on ? 'true' : 'false'}"
                aria-label="${name}: ${count} ${i18n.getMessage('cases')}"
                @click="${() => this._select('location', name)}"
                @keydown="${e =>
                  this._keyActivate(e, 'location', name)}"></circle>
              <text x="${kx}" y="${h - 40}" text-anchor="middle" font-size="10"
                font-weight="600" fill="#0f2f43"
                opacity="${dim ? 0.35 : 1}">${count}</text>
              <text x="${kx}" y="${h - 14}" text-anchor="middle" font-size="9"
                fill="#5b5a55" opacity="${dim ? 0.35 : 1}">${i + 1}</text>`;
          })}

          <circle class="rv-hit" cx="${cx}" cy="${selfY}" r="32"
            fill="${
              this._isSelected('location', this._self('name'))
                ? '#9b1c1c'
                : '#0f2f43'
            }"
            role="button" tabindex="0"
            aria-label="${this._self('name')}"
            @click="${() => this._select('location', this._self('name'))}"
            @keydown="${e =>
              this._keyActivate(e, 'location', this._self('name'))}"></circle>
          <text x="${cx}" y="${selfY + 5}" text-anchor="middle" font-size="12"
            font-weight="700" fill="#ffffff"
            pointer-events="none">${i18n.getMessage('Here')}</text>
        </svg>`}

        <div class="rv-legend">
          ${kids.map(
            (kid, i) => html`<span class="rv-legend-item"
              >${i + 1}
              ${this._link('customer_account', kid.sysId, field(kid, 'name'))}</span
            >`
          )}
        </div>

        ${this._sources([
          this._source('customer_account', campuses.total + 1),
          this._source(
            'sn_customerservice_case',
            this._set('familyCases').total
          )
        ])}
      </section>
      ${this._drillFor(['location'])}
    `;
  }

  // Cases at a site, by the case's own account display value. Family cases are
  // read across the account AND its children, so a campus has its own.
  _casesAtSite(name) {
    if (!name) return [];
    return this._set('familyCases').rows.filter(
      r => field(r, 'account') === name
    );
  }

  // ---- PIPELINE --------------------------------------------------------

  _renderPipeline() {
    const set = this._set('opportunities');
    if (!set.rows.length) return nothing;

    const stages = new Map();
    for (const row of set.rows) {
      const key = field(row, 'stage') || i18n.getMessage('Unset');
      stages.set(key, (stages.get(key) || 0) + 1);
    }
    const bars = [...stages.entries()].map(([label, value]) => ({
      label,
      value
    }));
    const max = Math.max(...bars.map(b => b.value), 1);

    return html`
      <section id="rv-p-pipeline" class="rv-card rv-panel" data-span="4"
        aria-labelledby="rv-pipe-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-pipe-h" class="rv-type-section">
              ${i18n.getMessage('Pipeline and win rate')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage('{count} open opportunities by stage.', {
                count: set.total
              })}
            </p>
          </div>
          <span class="rv-head-tools">
            <span class="rv-badge" data-sev="info">5</span>
            ${this._refreshBtn('opportunities')}
          </span>
        </div>
        <div class="rv-bars">
          ${bars.map(
            (bar, i) => html`
              <button
                type="button"
                class="rv-bar-row"
                aria-pressed=${this._isSelected('stage', bar.label)
                  ? 'true'
                  : 'false'}
                data-dim=${this._isDimmed('stage', bar.label)
                  ? 'true'
                  : 'false'}
                @click=${() => this._select('stage', bar.label)}
              >
                <span class="rv-type-caption">${bar.label}</span>
                <span class="rv-bar-track">
                  <span
                    class="rv-bar-fill"
                    style=${'width:' +
                    (bar.value / max) * 100 +
                    '%;background:' +
                    (this._isSelected('stage', bar.label)
                      ? '#9b1c1c'
                      : SERIES_COLORS[i % SERIES_COLORS.length])}
                  ></span>
                </span>
                <span class="rv-bar-value">${bar.value}</span>
              </button>
            `
          )}
        </div>
        ${set.rows.slice(0, 1).map(
          row => html`
            <p class="rv-note rv-type-caption" style="margin-top:10px">
              ${i18n.getMessage('Closest close')}:
              ${field(row, 'estimated_closed_date')} ·
              ${this._link(
                'sn_opty_mgmt_core_opportunity',
                row.sysId,
                field(row, 'number')
              )}
            </p>
          `
        )}
        ${this._sources([
          this._source('sn_opty_mgmt_core_opportunity', set.total)
        ])}
      </section>
      ${this._drillFor(['stage'])}
    `;
  }

  // ---- WHO WE KNOW -----------------------------------------------------

  _renderWhoWeKnow() {
    const set = this._set('contacts');
    if (!set.rows.length) return nothing;

    const people = set.rows.slice(0, 6).map(row => {
      const name = field(row, 'name');
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('');
      return {
        name,
        initials,
        title: field(row, 'title'),
        known: Boolean(name),
        sysId: row.sysId
      };
    });

    return html`
      <section id="rv-p-people" class="rv-card rv-panel" data-span="4"
        aria-labelledby="rv-who-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-who-h" class="rv-type-section">
              ${i18n.getMessage('Who we know')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage('{count} contacts on record.', {
                count: set.total
              })}
            </p>
          </div>
          <span class="rv-head-tools">
            <span class="rv-badge" data-sev="info">7</span>
            ${this._refreshBtn('contacts')}
          </span>
        </div>
        <div class="rv-roles">
          ${people.map(
            person => html`
              <div class="rv-role">
                <span
                  class="rv-avatar"
                  data-known=${person.known ? 'true' : 'false'}
                  >${person.initials || '?'}</span
                >
                <span class="rv-type-caption"
                  >${this._link(
                    'customer_contact',
                    person.sysId,
                    person.name
                  )}</span
                >
                <span class="rv-type-caption rv-note"
                  >${person.title || i18n.getMessage('Contact')}</span
                >
              </div>
            `
          )}
        </div>
        ${this._sources([this._source('customer_contact', set.total)])}
      </section>
    `;
  }

  // ---- WHAT IT IS LIKE TO BE THEM (line plus bars) ---------------------

  _renderExperience() {
    // REAL DATA, NOT A SAMPLE SERIES. This panel drew a six-quarter line from
    // representative numbers because no per-period history and no downtime
    // table exist here. A chart whose shape is invented is worse than a
    // simpler chart that is true, so it now plots CASES BY STATE across the
    // account family -- measured, and selectable.
    const cases = this._set('familyCases').total
      ? this._set('familyCases')
      : this._set('cases');
    if (!cases.rows.length) return nothing;

    // Keyed on the DISPLAY value so the bar reads in the user's language, but
    // the RAW value is carried alongside because that is what picks the
    // colour -- see CASE_STATE_COLORS for why a label-keyed map would make
    // every bar identical in any non-English session.
    const counts = new Map();
    for (const row of cases.rows) {
      const label = field(row, 'state') || i18n.getMessage('Unset');
      const entry = counts.get(label) || {
        label,
        value: 0,
        raw: rawField(row, 'state')
      };
      entry.value += 1;
      counts.set(label, entry);
    }
    const bars = [...counts.values()]
      .map(entry => ({
        ...entry,
        color: CASE_STATE_COLORS[entry.raw] || '#9ca3af'
      }))
      .sort((a, b) => b.value - a.value);
    const max = Math.max(...bars.map(b => b.value), 1);
    const w = 320;
    const h = Math.max(120, bars.length * 34 + 20);

    return html`
      <section
        id="rv-p-states"
        class="rv-card rv-panel"
        data-span="4"
        aria-labelledby="rv-exp-h"
      >
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-exp-h" class="rv-type-section">
              ${i18n.getMessage('Where the cases stand')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage(
                '{count} cases across the account and its sites. Pick a state to list them.',
                {count: cases.total}
              )}
            </p>
          </div>
          <span class="rv-head-tools">
            <span class="rv-badge" data-sev="attention">4</span>
            ${this._refreshBtn('familyCases')}
          </span>
        </div>

        ${svg`<svg viewBox="0 0 ${w} ${h}"
               style="width:100%;height:auto;display:block"
               role="img"
               aria-label="${i18n.getMessage(
                 'Cases by state across {count} cases',
                 {count: cases.total}
               )}">
          ${bars.map((bar, i) => {
            const bw = Math.max((bar.value / max) * (w - 130), 4);
            const y = 10 + i * 34;
            const on = this._isSelected('state', bar.label);
            const dim = this._isDimmed('state', bar.label);
            return svg`
              <text x="0" y="${y + 15}" font-size="12"
                fill="#3f3e3a" opacity="${dim ? 0.4 : 1}">${bar.label}</text>
              <rect class="rv-hit" x="118" y="${y + 3}" width="${bw}"
                height="16" rx="4"
                fill="${on ? '#9b1c1c' : bar.color}"
                opacity="${dim ? 0.35 : 1}"
                role="button" tabindex="0"
                aria-pressed="${on ? 'true' : 'false'}"
                aria-label="${bar.label}: ${bar.value}"
                @click="${() => this._select('state', bar.label)}"
                @keydown="${e =>
                  this._keyActivate(e, 'state', bar.label)}"></rect>
              <text x="${118 + bw + 8}" y="${y + 16}" font-size="12"
                fill="#5b5a55" opacity="${dim ? 0.4 : 1}">${bar.value}</text>
            `;
          })}
        </svg>`}

        ${this._sources([
          this._source('sn_customerservice_case', cases.total)
        ])}
      </section>
      ${this._drillFor(['state'])}
    `;
  }

  // ---- WHITESPACE MATRIX -----------------------------------------------

  _renderWhitespace() {
    const campuses = this._set('campuses');
    if (!campuses.rows.length) return nothing;

    // SAMPLE OWNERSHIP. sold_product and account_path do not exist as tables
    // here, both measured, so ownership cannot be read. The COLUMNS are the
    // real sibling accounts; the dots are representative and the panel is
    // chipped as sample.
    const products = [
      'Patient monitoring',
      'Imaging systems',
      'Informatics',
      'Ultrasound',
      'Sleep and respiratory'
    ];
    const siblings = campuses.rows.slice(0, 4);
    const owns = [
      [true, true, true, true, true],
      [true, true, false, true, false],
      ['gap', true, true, true, false],
      ['gap', true, false, true, true],
      [false, false, true, false, false]
    ];

    return html`
      <section class="rv-card rv-panel" data-span="12"
        aria-labelledby="rv-ws-h">
        <div class="rv-panel-head">
          <div>
            <h2 id="rv-ws-h" class="rv-type-section">
              ${i18n.getMessage('Whitespace against sibling accounts')}
            </h2>
            <p class="rv-lede rv-type-caption">
              ${i18n.getMessage(
                'Products the siblings own that are not owned here.'
              )}
            </p>
          </div>
          ${this._sampleChip()}
        </div>

        <div class="rv-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">${i18n.getMessage('Product')}</th>
                <th scope="col">${i18n.getMessage('This account')}</th>
                ${siblings.map(
                  sib => html`<th scope="col">${field(sib, 'name')}</th>`
                )}
              </tr>
            </thead>
            <tbody>
              ${products.map(
                (product, r) => html`
                  <tr>
                    <td>${product}</td>
                    ${owns[r].map(
                      (own, c) => html`
                        <td data-self=${c === 0 ? 'true' : 'false'}>
                          <span
                            class="rv-own"
                            data-own=${own ? 'true' : 'false'}
                            data-gap=${own === 'gap' ? 'true' : 'false'}
                            role="img"
                            aria-label=${own === 'gap'
                              ? i18n.getMessage('Whitespace')
                              : own
                                ? i18n.getMessage('Owns')
                                : i18n.getMessage('Does not own')}
                          ></span>
                        </td>
                      `
                    )}
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>

        <div class="rv-legend">
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#0f2f43"></span
            >${i18n.getMessage('Owns')}</span
          >
          <span class="rv-legend-item"
            ><span class="rv-swatch" style="background:#e8a33d"></span
            >${i18n.getMessage('Whitespace')}</span
          >
          <span class="rv-legend-item"
            ><span
              class="rv-swatch"
              style="background:#fff;border:1.5px solid #dad8d2"
            ></span
            >${i18n.getMessage('Does not own')}</span
          >
        </div>

        ${this._sources([
          i18n.getMessage('Sold Product (not available)'),
          i18n.getMessage('Account hierarchy (not available)')
        ])}
      </section>
    `;
  }

  // ---- DRILL-DOWN ------------------------------------------------------
  //
  // A selection is NAVIGATION, not decoration: it resolves to the actual
  // records and lists them with links, so the next click opens one.
  //
  // THE JOINS ARE MEASURED, not assumed:
  //   case.product and install_base_item.product BOTH reference cmdb_model,
  //     so a product selection matches real rows on either side.
  //   case.install_base references the install base item directly.
  //   install_base_item.configuration_item is the device -- the field is NOT
  //     cmdb_ci, which does not exist on that table, so naming it that way
  //     would have produced an empty column in silence.
  //
  // Everything here filters data already loaded by the account loader, so a
  // drill-down costs no request.

  _installRows() {
    return this._set('installBase').rows;
  }

  _caseRows() {
    return this._set('cases').rows;
  }

  // Installed items carrying the selected product.
  _itemsForProduct(product) {
    return this._installRows().filter(r => field(r, 'product') === product);
  }

  // Cases raised against the selected product.
  _casesForProduct(product) {
    return this._caseRows().filter(r => field(r, 'product') === product);
  }

  // The item a case points at, by install_base, else by matching product.
  _itemsForCase(caseRow) {
    const ib = field(caseRow, 'install_base');
    if (ib) {
      const direct = this._installRows().filter(r => field(r, 'name') === ib);
      if (direct.length) return direct;
    }
    const product = field(caseRow, 'product');
    return product ? this._itemsForProduct(product) : [];
  }

  // Cases pointing at a given installed item, by install_base then product.
  _casesForItem(itemRow) {
    const name = field(itemRow, 'name');
    const byItem = this._caseRows().filter(
      r => field(r, 'install_base') === name
    );
    if (byItem.length) return byItem;
    const product = field(itemRow, 'product');
    return product ? this._casesForProduct(product) : [];
  }

  // selectKind is what makes the drill TWO-WAY: the link opens the record,
  // and the explore button re-roots the drill on that row. Without it the
  // 'item' and 'case' branches of _renderDrill would be unreachable -- a hook
  // with no emitter.
  _list(heading, table, rows, labelField, subField, selectKind) {
    if (!rows.length) {
      return html`
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${heading}</h3>
          <p class="rv-note rv-type-caption">
            ${i18n.getMessage('None linked.')}
          </p>
        </div>
      `;
    }

    return html`
      <div class="rv-drill-col">
        <h3 class="rv-type-label">${heading} (${rows.length})</h3>
        <ul class="rv-drill-list">
          ${rows.slice(0, 25).map(
            row => html`
              <li>
                ${this._link(table, row.sysId, field(row, labelField))}
                ${subField && field(row, subField)
                  ? html`<span class="rv-note rv-type-caption"
                      >${field(row, subField)}</span
                    >`
                  : nothing}
                ${selectKind
                  ? html`<button
                      type="button"
                      class="rv-explore"
                      @click=${() =>
                        this._select(selectKind, field(row, labelField))}
                    >
                      ${i18n.getMessage('Explore')}
                    </button>`
                  : nothing}
              </li>
            `
          )}
        </ul>
        ${rows.length > 25
          ? html`<p class="rv-note rv-type-caption">
              ${i18n.getMessage('Showing the first 25.')}
            </p>`
          : nothing}
      </div>
    `;
  }

  // THE DRILL RENDERS BENEATH THE PANEL THAT WAS CLICKED.
  //
  // One drill panel at the top of the page meant clicking a bar near the
  // bottom scrolled the answer out of view. Each panel now asks for the drill
  // itself, declaring which selection kinds belong to it, and grid order is
  // DOM order -- so a full-width drill placed right after a panel lands
  // directly below it.
  _drillFor(kinds) {
    if (!this._filter || !kinds.includes(this._filter.kind)) return nothing;
    return this._renderDrill();
  }

  // Scroll a panel into view and ring it briefly. This is the Otto-signal
  // behaviour from the case Intelligence view: a finding points at the panel
  // it came from, and clicking it takes you there.
  //
  // The ring is a transient attribute the panel styles itself, removed after
  // it has served its purpose so it does not become permanent decoration.
  _focusPanel(id) {
    if (!id || typeof document === 'undefined') return;
    const el = this.renderRoot?.querySelector('#' + id);
    if (!el) return;
    el.scrollIntoView({behavior: 'smooth', block: 'center'});
    el.setAttribute('data-rv-ring', 'true');
    window.setTimeout(() => el.removeAttribute('data-rv-ring'), 1600);
  }

  // Entitlements carrying the selected contract -- the measured path from a
  // contract to the devices it covers.
  _entitlementsForContract(number) {
    return this._set('entitlements').rows.filter(
      r => field(r, 'contract') === number
    );
  }

  _renderDrill() {
    const filter = this._filter;
    if (!filter) return nothing;

    let heading = '';
    let columns = nothing;

    if (filter.kind === 'product') {
      const items = this._itemsForProduct(filter.value);
      const cases = this._casesForProduct(filter.value);
      heading = i18n.getMessage('Everything on {product}', {
        product: filter.value
      });
      columns = html`
        ${this._list(
          i18n.getMessage('Installed items'),
          'sn_install_base_item',
          items,
          'name',
          'state',
          'item'
        )}
        ${this._list(
          i18n.getMessage('Cases'),
          'sn_customerservice_case',
          cases,
          'number',
          'short_description',
          'case'
        )}
      `;
    } else if (filter.kind === 'case') {
      const caseRow = this._caseRows().find(
        r => field(r, 'number') === filter.value
      );
      if (!caseRow) return nothing;
      heading = i18n.getMessage('Around case {number}', {
        number: filter.value
      });
      columns = html`
        ${this._list(
          i18n.getMessage('Installed items on this case'),
          'sn_install_base_item',
          this._itemsForCase(caseRow),
          'name',
          'product',
          'item'
        )}
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${i18n.getMessage('Device')}</h3>
          <p class="rv-type-body">
            ${field(caseRow, 'cmdb_ci') || i18n.getMessage('Not set')}
          </p>
          <h3 class="rv-type-label">${i18n.getMessage('Product')}</h3>
          <p class="rv-type-body">
            ${field(caseRow, 'product') || i18n.getMessage('Not set')}
          </p>
        </div>
      `;
    } else if (filter.kind === 'item') {
      const itemRow = this._installRows().find(
        r => field(r, 'name') === filter.value
      );
      if (!itemRow) return nothing;
      heading = i18n.getMessage('Around {item}', {item: filter.value});
      columns = html`
        ${this._list(
          i18n.getMessage('Cases on this item'),
          'sn_customerservice_case',
          this._casesForItem(itemRow),
          'number',
          'state',
          'case'
        )}
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${i18n.getMessage('Product')}</h3>
          <p class="rv-type-body">${field(itemRow, 'product')}</p>
          <h3 class="rv-type-label">
            ${i18n.getMessage('Configuration item')}
          </h3>
          <p class="rv-type-body">
            ${field(itemRow, 'configuration_item') ||
            i18n.getMessage('Not set')}
          </p>
        </div>
      `;
    } else if (filter.kind === 'stage') {
      // The pipeline bars emit this kind, so it needs a branch -- without one
      // selecting a stage dimmed the bars and showed no records, which is the
      // decorative behaviour this panel exists to replace.
      const rows = this._set('opportunities').rows.filter(
        r => field(r, 'stage') === filter.value
      );
      heading = i18n.getMessage('Opportunities at {stage}', {
        stage: filter.value
      });
      columns = html`
        ${this._list(
          i18n.getMessage('Opportunities'),
          'sn_opty_mgmt_core_opportunity',
          rows,
          'number',
          'short_description'
        )}
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${i18n.getMessage('Expected close')}</h3>
          ${rows.length
            ? html`<p class="rv-type-body">
                ${field(rows[0], 'estimated_closed_date')}
              </p>`
            : html`<p class="rv-note rv-type-caption">
                ${i18n.getMessage('None linked.')}
              </p>`}
        </div>
      `;
    } else if (filter.kind === 'location') {
      // Cases belonging to the selected site. Family cases are read across the
      // account AND its children, so a campus has its own -- the parent-only
      // read could not see them.
      const rows = this._set('familyCases').rows.filter(
        r => field(r, 'account') === filter.value
      );
      heading = i18n.getMessage('Cases at {site}', {site: filter.value});
      columns = html`
        ${this._list(
          i18n.getMessage('Cases'),
          'sn_customerservice_case',
          rows,
          'number',
          'short_description',
          'case'
        )}
        ${this._list(
          i18n.getMessage('Installed items at this site'),
          'sn_install_base_item',
          this._installRows().filter(
            r => field(r, 'x_snc_philips_e2_0_campus') === filter.value
          ),
          'name',
          'product',
          'item'
        )}
      `;
    } else if (filter.kind === 'state') {
      const rows = this._set('familyCases').rows.filter(
        r => field(r, 'state') === filter.value
      );
      heading = i18n.getMessage('Cases in {state}', {state: filter.value});
      columns = html`
        ${this._list(
          i18n.getMessage('Cases'),
          'sn_customerservice_case',
          rows,
          'number',
          'short_description',
          'case'
        )}
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${i18n.getMessage('Sites involved')}</h3>
          <ul class="rv-drill-list">
            ${[
              ...new Set(rows.map(r => field(r, 'account')).filter(Boolean))
            ].map(
              site => html`<li>
                <span>${site}</span>
                <button
                  type="button"
                  class="rv-explore"
                  @click=${() => this._select('location', site)}
                >
                  ${i18n.getMessage('Explore')}
                </button>
              </li>`
            )}
          </ul>
        </div>
      `;
    } else if (filter.kind === 'contract') {
      const row = this._set('contracts').rows.find(
        r => field(r, 'number') === filter.value
      );
      if (!row) return nothing;

      // DEVICES ON THIS CONTRACT, through entitlements -- the measured path.
      // install_base_item carries the item's sys_id in its value and its name
      // in the display value, so each entitlement yields a linkable device
      // with no extra read.
      const devices = this._entitlementsForContract(filter.value)
        .map(ent => ({
          table: 'sn_install_base_item',
          sysId: rawField(ent, 'install_base_item'),
          raw: {name: field(ent, 'install_base_item')}
        }))
        .filter(d => d.sysId && d.raw.name);

      heading = i18n.getMessage('Contract {number}', {number: filter.value});
      columns = html`
        ${this._list(
          i18n.getMessage('Devices covered'),
          'sn_install_base_item',
          devices,
          'name',
          '',
          'item'
        )}
        <div class="rv-drill-col">
          <h3 class="rv-type-label">${i18n.getMessage('Summary')}</h3>
          <p class="rv-type-body">${field(row, 'short_description')}</p>
          <h3 class="rv-type-label">${i18n.getMessage('Ends')}</h3>
          <p class="rv-type-body">${field(row, 'ends')}</p>
          <h3 class="rv-type-label">${i18n.getMessage('Yearly')}</h3>
          <p class="rv-type-body rv-mono">${field(row, 'yearly_cost')}</p>
          <h3 class="rv-type-label">${i18n.getMessage('Entitlements')}</h3>
          <p class="rv-type-body">
            ${this._entitlementsForContract(filter.value).length}
          </p>
        </div>
      `;
    } else {
      return nothing;
    }

    return html`
      <section
        class="rv-card rv-panel"
        data-span="12"
        aria-labelledby="rv-drill-h"
      >
        <div class="rv-panel-head">
          <h2 id="rv-drill-h" class="rv-type-section">${heading}</h2>
          <button
            type="button"
            class="rv-clear"
            @click=${() => {
              this._filter = null;
            }}
          >
            ${i18n.getMessage('Clear selection')}
          </button>
        </div>
        <div class="rv-drill">${columns}</div>
      </section>
    `;
  }

  render() {
    if (!this.row) {
      return html`
        <section class="rv-card" role="status">
          <p class="rv-note rv-type-body">
            ${i18n.getMessage('This account could not be summarised.')}
          </p>
        </section>
      `;
    }

    return html`
      <div class="rv-360">
        ${this._renderStory()} ${this._renderEscalation()}
        ${this._renderAdvice()}
        ${this._renderKpis()}
        ${this._renderRunway()}
        ${this._renderSignals()} ${this._renderRevenueDonut()}
        ${this._renderRunToday()} ${this._renderGroup()}
        ${this._renderPipeline()} ${this._renderWhoWeKnow()}
        ${this._renderExperience()} ${this._renderWhitespace()}
      </div>
    `;
  }
}
