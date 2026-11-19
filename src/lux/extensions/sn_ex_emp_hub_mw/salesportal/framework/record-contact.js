import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {cellDisplay, cellValue, fetchTable} from './loaders/record-data.js';
import {matchesRecord, subscribeRecordChanges} from './record-events.js';
import {recordHref} from './record-href.js';

// THE CONTACT CARD -- plain HTML on our own tokens.
//
// WHY NOT aiux-contact-card. It renders its own bordered, padded card with its
// own type ramp and its own avatar size, and its reference states there are no
// CSS parts and no element-specific custom properties. So it cannot be brought
// into line with the cards around it, and a details column with two different
// card treatments is the inconsistency this pass exists to remove. It is also
// a component that loads nothing -- the host was already doing the read and
// the mapping, so the only thing it contributed was styling we cannot control.
//
// MEASURED ON THE SUBJECT CONTACT, which is why some rows are absent:
//   name     Rebecca Torres
//   title    Clinical Engineering Director
//   email    r.torres@riverside-gen.org
//   account  Riverside General Hospital
//   phone, mobile_phone, photo, vip   ALL EMPTY
// Empty rows are dropped rather than rendered blank, so the card adapts to
// what the record actually holds.
//
// customer_contact inherits from sys_user: title, email, phone, mobile_phone,
// vip and photo are sys_user columns and only account is its own, so one read
// covers them all.

const CONTACT_FIELDS =
  'sys_id,name,title,email,phone,mobile_phone,vip,account,photo';

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

@customElement('x-snc-slux-rv-contact')
export default class RvContact extends AIUXElement {
  static properties = {
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'},
    heading: {attribute: 'heading'},
    _row: {state: true},
    _loaded: {state: true}
  };

  constructor() {
    super();
    this.table = '';
    this.sysId = '';
    this.heading = '';
    this._row = null;
    this._loaded = false;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      h2 {
        margin: 0 0 12px;
        font-size: var(--rv-size-section, 17px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-person {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      /* Same avatar treatment as the glance card, so one person reads the same
         way wherever they appear. */
      .rv-avatar {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-action-primary, #0e2b3d);
        color: var(--rv-action-primary-text, #fff);
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-semibold, 600);
        overflow: hidden;
      }

      .rv-avatar img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
      }

      .rv-person-lines {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .rv-name {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
        overflow-wrap: anywhere;
      }

      .rv-title {
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
        overflow-wrap: anywhere;
      }

      /* Contact rows: a muted label and a value, matching the field grid so
         the two cards read as one system. */
      .rv-rows {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 12px 0 0;
      }

      .rv-row {
        display: flex;
        flex-direction: column;
      }

      .rv-row-label {
        font-size: var(--rv-size-label, 12px);
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-row-value {
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-medium, 500);
        color: var(--rv-ink-primary, #1b1b19);
        overflow-wrap: anywhere;
      }

      a {
        color: var(--rv-action-link, #1f5f8b);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      a:hover {
        color: var(--rv-action-link-hover, #123f5e);
      }

      .rv-note {
        margin: 0;
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
      }

      @media (forced-colors: active) {
        a {
          color: LinkText;
        }
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
    this._load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  updated(changed) {
    if (changed.has('sysId') || changed.has('table')) this._load();
  }

  _onRecordChanged = event => {
    if (!matchesRecord(event, this.table, this.sysId)) return;
    this._load();
  };

  async _load() {
    if (!this.table || !this.sysId) {
      this._row = null;
      this._loaded = true;
      return;
    }
    // ctx is null: fetchTable branches on isServer and the client path carries
    // its own auth. On the server this returns nothing and the card fills in
    // after hydration.
    const result = await fetchTable(null, this.table, {
      query: `sys_id=${this.sysId}`,
      fields: CONTACT_FIELDS,
      limit: 1,
      referenceLinks: true
    });
    this._row = result.rows[0] ?? null;
    this._loaded = true;
  }

  _rows() {
    const row = this._row;
    if (!row) return [];
    const out = [];

    const email = cellDisplay(row, 'email');
    if (email) {
      out.push({
        label: i18n.getMessage('Email'),
        value: email,
        href: 'mailto:' + email
      });
    }

    for (const field of ['phone', 'mobile_phone']) {
      const value = cellDisplay(row, field);
      if (!value) continue;
      out.push({
        label:
          field === 'phone'
            ? i18n.getMessage('Phone')
            : i18n.getMessage('Mobile'),
        value,
        href: 'tel:' + value.replace(/[^+\d]/g, '')
      });
    }

    return out;
  }

  render() {
    const row = this._row;
    const name = row ? cellDisplay(row, 'name') : '';

    if (!name) {
      return html`
        <section class="rv-card">
          <h2>${this.heading || i18n.getMessage('Contact')}</h2>
          <p class="rv-note">
            ${this._loaded
              ? i18n.getMessage('This record has no contact.')
              : i18n.getMessage('Loading\u2026')}
          </p>
        </section>
      `;
    }

    const title = cellDisplay(row, 'title');
    const photo = cellDisplay(row, 'photo');
    const accountId = cellValue(row, 'account');
    const accountName = cellDisplay(row, 'account');
    const accountHref = accountId
      ? recordHref('customer_account', accountId)
      : '';
    const vip = cellValue(row, 'vip') === '1';

    return html`
      <section class="rv-card">
        <h2>${this.heading || i18n.getMessage('Contact')}</h2>

        <div class="rv-person">
          <span class="rv-avatar" aria-hidden="true">
            ${photo
              ? html`<img src=${photo} alt="" />`
              : initialsOf(name)}
          </span>
          <span class="rv-person-lines">
            <span class="rv-name">
              ${name}
              ${vip
                ? html`<span class="rv-chip" data-tone="success"
                    >${i18n.getMessage('VIP')}</span
                  >`
                : nothing}
            </span>
            ${title ? html`<span class="rv-title">${title}</span>` : nothing}
          </span>
        </div>

        <div class="rv-rows">
          ${accountName
            ? html`<div class="rv-row">
                <span class="rv-row-label">${i18n.getMessage('Account')}</span>
                <span class="rv-row-value">
                  ${accountHref
                    ? html`<a href=${accountHref}>${accountName}</a>`
                    : accountName}
                </span>
              </div>`
            : nothing}
          ${this._rows().map(
            entry => html`
              <div class="rv-row">
                <span class="rv-row-label">${entry.label}</span>
                <span class="rv-row-value">
                  <a href=${entry.href}>${entry.value}</a>
                </span>
              </div>
            `
          )}
        </div>
      </section>
    `;
  }
}
