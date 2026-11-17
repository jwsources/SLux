import {html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {
  fieldListStyles,
  normalizeFieldNames,
  renderFieldList,
  resolveFieldList
} from './record-field-list.js';

// A card of record fields rendered as a label/value grid. The field list is a
// property, never hardcoded here, so the page decides which fields appear in
// which block and can place several of these elements freely.
//
// When every configured field is missing from the current form view the card
// says so instead of rendering an empty box: a field list that silently
// collapses to nothing is the failure mode that hides a typo or a view change.
//
// The heading id is referenced by aria-labelledby on the same element. Ids are
// scoped per shadow root, so several instances on one page do not collide.
//
// Attributes:
//   heading       card heading, rendered as the h2 and the card accessible name
//   fields        comma-separated field names, or set .fields to an array
//   badge-fields  subset rendered as a badge
//   layout        inline (responsive grid, default) or stacked

@customElement('x-snc-slux-case-fields')
export default class CaseFields extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Form];

  static properties = {
    heading: {attribute: 'heading'},
    fields: {attribute: 'fields'},
    badgeFields: {attribute: 'badge-fields'},
    layout: {attribute: 'layout'}
  };

  static styles = [fieldListStyles];

  render() {
    const formApi = this._record.apis.form;
    const names = normalizeFieldNames(this.fields);
    const {resolved, missing} = resolveFieldList(formApi, names);
    const allMissing = names.length > 0 && missing.length === names.length;

    return html`
      <section
        class="aiux-card aiux-card-border aiux-card-body"
        aria-labelledby="slux-fields-heading"
      >
        <h2
          id="slux-fields-heading"
          class="aiux-card-title text-base font-semibold"
        >
          ${this.heading || i18n.getMessage('Details')}
        </h2>
        ${renderFieldList({
          fields: resolved,
          badgeFieldNames: normalizeFieldNames(this.badgeFields),
          layout: this.layout === 'stacked' ? 'stacked' : 'inline'
        })}
        ${allMissing
          ? html`<p class="text-sm text-text-tertiary" role="status">
              ${i18n.getMessage(
                'None of the fields configured for this block are on the current form view.'
              )}
            </p>`
          : nothing}
      </section>
    `;
  }
}
