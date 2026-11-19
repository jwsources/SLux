import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {
  publishRecordChange,
  scopeMatches,
  subscribeRefreshDone
} from './record-events.js';

// THE REFRESH CONTROL -- one component, page level and per applet.
//
// WHY IT IS NEEDED even with the live-update bus working. A write publishes a
// change immediately, but a record whose related rows are created by a FLOW or
// a business rule has not got them yet when that signal fires -- the read
// lands before the rows exist, so a freshly created dispatch task is absent
// from an otherwise correct refresh. Nothing in the client can know when that
// asynchronous work finishes, so the honest answer is an explicit control
// rather than a longer guess at a delay.
//
// IT PUBLISHES, IT DOES NOT REFRESH. The component asks on the shared bus and
// the page that owns the data does the read. That keeps one refresh path for a
// UI action, a live update and a manual press -- three causes, one mechanism.
//
// SCOPE IS WHAT MAKES IT PARTIAL. With no scope the whole record re-reads;
// with a scope only that slice does. A scope absent from the detail matches
// everything, so an existing subscriber keeps working when a new scope appears.
//
// THE BUSY STATE CLEARS ON A REAL COMPLETION EVENT, never a timer. The page
// publishes REFRESHED when its read returns; a timer would stop the spinner
// while the request was still in flight and report a success nobody observed.

@customElement('x-snc-slux-rv-refresh')
export default class RvRefresh extends AIUXElement {
  static properties = {
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'},
    // Omit for a whole-record refresh; name a slice for a partial one.
    scope: {attribute: 'scope'},
    // 'bare' is the icon-only form that sits in an applet heading.
    variant: {attribute: 'variant'},
    _busy: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this.table = '';
    this.sysId = '';
    this.scope = '';
    this.variant = '';
    this._busy = false;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: inline-flex;
      }

      button {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: var(--rv-touch-target, 44px);
        padding: 4px 12px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        font: inherit;
        font-size: var(--rv-size-label, 12px);
        color: var(--rv-ink-secondary, #3f3e3a);
        cursor: pointer;
      }

      button:hover:not([disabled]) {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      button[disabled] {
        cursor: progress;
        opacity: 0.7;
      }

      /* The applet form: icon only, no border, so a heading carries it without
         competing with the heading itself. */
      :host([variant='bare']) button {
        min-height: 28px;
        padding: 2px 6px;
        border: 0;
        background: none;
      }

      .rv-spin {
        display: inline-block;
        line-height: 1;
      }

      button[disabled] .rv-spin {
        animation: rv-rotate 900ms linear infinite;
      }

      @keyframes rv-rotate {
        to {
          transform: rotate(360deg);
        }
      }

      /* An animation must stop when the user has asked for less motion. The
         control still reports through the disabled state and the live region,
         so nothing is lost by holding it still. */
      @media (prefers-reduced-motion: reduce) {
        button[disabled] .rv-spin {
          animation: none;
        }
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
        button {
          border: 1px solid ButtonBorder;
        }
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRefreshDone(this._onDone);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  _onDone = event => {
    // Only clear for a completion that covers this control's scope.
    if (!scopeMatches(event, this.scope || undefined)) return;
    this._busy = false;
  };

  _request() {
    if (this._busy) return;
    this._busy = true;
    publishRecordChange({
      table: this.table,
      sysId: this.sysId,
      reason: 'manual',
      scope: this.scope || undefined
    });
  }

  render() {
    if (!this.sysId) return nothing;

    const label = this.scope
      ? i18n.getMessage('Refresh this section')
      : i18n.getMessage('Refresh');

    return html`
      <button
        type="button"
        class="rv-focusable"
        ?disabled=${this._busy}
        aria-busy=${this._busy ? 'true' : 'false'}
        title=${label}
        aria-label=${label}
        @click=${() => this._request()}
      >
        <span class="rv-spin" aria-hidden="true">&#8635;</span>
        ${this.variant === 'bare'
          ? nothing
          : html`<span>${this._busy
              ? i18n.getMessage('Refreshing\u2026')
              : i18n.getMessage('Refresh')}</span>`}
      </button>
      ${this._busy
        ? html`<span class="rv-sr" role="status" aria-live="polite"
            >${i18n.getMessage('Refreshing\u2026')}</span
          >`
        : nothing}
    `;
  }
}
