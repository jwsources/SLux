import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {experienceBasePath, recordHref} from './record-href.js';
import {referencedTable} from './loaders/record-data.js';
import {HIDDEN_TYPES, SHAPES, shapeOf} from './loaders/field-meta.js';
import {
  interceptPortalLinkClick,
  portaliseLinks
} from './portalise-links.js';

// RECORD FIELDS -- label above value, nothing else.
//
// An earlier version wrapped most values in a control-like outline to mirror a
// Figma mock. It made a read view look like a broken form: a title inside a
// one-line box, five grid tracks stretched across the card so each value sat
// far from its label, mono numerals fighting the body text, and two visually
// different boxes for string and choice fields -- a distinction that is real
// in the dictionary and meaningless to a reader. All of it is gone.
//
// What remains is the form the Intelligence cards already use and which reads
// cleanly: one card per group, a muted label, a solid value, two columns at
// most. Consistency across the two views matters more than fidelity to a mock
// of a form.
//
// THE DICTIONARY STILL EARNS ITS READ. It is no longer used to draw control
// affordances, but it supplies the three things inference cannot:
//   the real label        Configuration item, not Cmdb ci
//   which fields to hide  journals, passwords, form furniture
//   which run full width  html and long prose

@customElement('x-snc-slux-rv-record-fields')
export default class RvRecordFields extends AIUXElement {
  static properties = {
    // [{id, label, fields: [name | {field, label, wide, mono, html}]}]
    groups: {attribute: false},
    // The record row: {field: {value, display_value, link}}.
    row: {attribute: false},
    // Dictionary metadata keyed by field name, from loaders/field-meta.js.
    fieldMeta: {attribute: false},
    displayEmptyGroups: {attribute: 'display-empty-groups', type: Boolean}
  };

  constructor() {
    super();
    this.groups = [];
    this.row = null;
    this.fieldMeta = {};
    this.displayEmptyGroups = false;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-sections {
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 14px);
      }

      .rv-section-title {
        margin: 0 0 12px;
        font-size: var(--rv-size-section, 17px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
      }

      /* TWO COLUMNS, NEVER MORE. auto-fit spread to five tracks on a wide
         card, which strands a value far from its own label. Two keeps the pair
         adjacent at every width above the breakpoint. */
      .rv-field-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px 28px;
        margin: 0;
      }

      @media (min-width: 720px) {
        .rv-field-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .rv-field {
        min-width: 0;
      }

      /* Long text and documents take the whole row. */
      .rv-field[data-wide='true'] {
        grid-column: 1 / -1;
      }

      .rv-field-label {
        display: block;
        margin: 0 0 2px;
        font-size: var(--rv-size-label, 12px);
        line-height: 1.1rem;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-field-value {
        margin: 0;
        font-size: var(--rv-size-body, 14px);
        line-height: 1.35rem;
        font-weight: var(--rv-weight-medium, 500);
        color: var(--rv-ink-primary, #1b1b19);
        overflow-wrap: anywhere;
      }

      /* Only prose keeps its line breaks. A short value inheriting pre-line
         turns an ordinary string into a ragged block. */
      .rv-field[data-wide='true'] .rv-field-value {
        white-space: pre-line;
      }

      .rv-empty {
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-field-link {
        color: var(--rv-action-link, #1f5f8b);
        text-decoration: underline;
        text-underline-offset: 2px;
        overflow-wrap: anywhere;
      }

      .rv-field-link:hover {
        color: var(--rv-action-link-hover, #123f5e);
      }

      .rv-field-link:focus-visible {
        outline: 2px solid var(--rv-action-link, #1f5f8b);
        outline-offset: 1px;
      }

      .rv-visually-hidden {
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
        .rv-field-link {
          color: LinkText;
        }
      }
    `
  ];

  // name to Name, as a fallback only. The dictionary's column_label is the
  // real answer and wins when present.
  static _humanise(name) {
    const spaced = String(name).replace(/_/g, ' ').trim();
    if (!spaced) return '';
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  _entriesFor(group) {
    const row = this.row || {};
    const meta = this.fieldMeta || {};
    const out = [];

    for (const raw of group.fields || []) {
      const spec = typeof raw === 'string' ? {field: raw} : raw || {};
      const name = spec.field;
      if (!name) continue;

      const field = meta[name];
      const type = field?.type || '';

      // Journals belong to Activity; a secret is never printed in a read view.
      if (HIDDEN_TYPES.has(type)) continue;

      const cell = row[name];
      // display_value=all returns an object per field, but a plain string for
      // a field with no display variant. Both shapes are accepted.
      let value = '';
      let display = '';
      if (cell && typeof cell === 'object') {
        value = cell.value ?? '';
        display = cell.display_value ?? '';
      } else if (cell !== null && cell !== undefined) {
        value = String(cell);
        display = String(cell);
      }

      const shape = shapeOf(type);

      out.push({
        name,
        text: String(display || value || ''),
        value: String(value),
        label:
          field?.label ||
          (spec.label ? i18n.getMessage(spec.label) : null) ||
          RvRecordFields._humanise(name),
        wide:
          Boolean(spec.wide) ||
          shape === SHAPES.HTML ||
          shape === SHAPES.PROSE,
        html: Boolean(spec.html) || shape === SHAPES.HTML,
        refTable: referencedTable(row, name) || field?.reference || ''
      });
    }

    return out;
  }

  // A GROUP RENDERS WHOLE, OR NOT AT ALL. One surviving field under its own
  // heading says nothing about what the group is, which is how an open case
  // ended up showing a Closure card containing only a false boolean.
  _hasContent(entries) {
    return entries.some(entry => entry.text !== '');
  }

  _handleHtmlClick = e => {
    interceptPortalLinkClick(e, experienceBasePath());
  };

  _renderValue(entry) {
    if (!entry.text) {
      return html`<span aria-hidden="true" class="rv-empty">&#8212;</span
        ><span class="rv-visually-hidden">${i18n.getMessage('Empty')}</span>`;
    }

    // A document field renders through the platform's sanitiser, with the
    // legacy workspace and .do links rewritten to portal routes.
    if (entry.html) {
      return html`<span @click=${this._handleHtmlClick}
        ><aiux-record-html-content
          .content=${portaliseLinks(entry.value || entry.text)}
        ></aiux-record-html-content
      ></span>`;
    }

    if (entry.refTable && entry.value) {
      const href = recordHref(entry.refTable, entry.value);
      if (href) {
        return html`<a
          class="rv-field-link"
          href=${href}
          aria-label=${entry.label + ': ' + entry.text}
          >${entry.text}</a
        >`;
      }
    }

    return entry.text;
  }

  render() {
    const groups = Array.isArray(this.groups) ? this.groups : [];

    const rendered = groups
      .map(group => ({group, entries: this._entriesFor(group)}))
      .filter(
        item =>
          item.entries.length > 0 &&
          (this.displayEmptyGroups || this._hasContent(item.entries))
      );

    if (!rendered.length) return nothing;

    return html`
      <div class="rv-sections">
        ${rendered.map(({group, entries}) => {
          const headingId = 'rv-grp-' + group.id;
          return html`
            <section class="rv-card" aria-labelledby=${headingId}>
              ${group.label
                ? html`<h2 id=${headingId} class="rv-section-title">
                    ${i18n.getMessage(group.label)}
                  </h2>`
                : nothing}
              <dl class="rv-field-grid">
                ${entries.map(
                  entry => html`
                    <div
                      class="rv-field"
                      data-wide=${entry.wide ? 'true' : 'false'}
                    >
                      <dt class="rv-field-label">${entry.label}</dt>
                      <dd class="rv-field-value">
                        ${this._renderValue(entry)}
                      </dd>
                    </div>
                  `
                )}
              </dl>
            </section>
          `;
        })}
      </div>
    `;
  }
}
