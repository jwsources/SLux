import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

import {
  fieldListStyles,
  normalizeFieldNames,
  renderFieldList,
  resolveFieldList
} from './record-field-list.js';

// Record header as its own placeable element: a title, an optional subtitle,
// a page-configured set of key fields, and a named slot the page fills with
// the action toolbar.
//
// The title is read from form fields rather than from HeaderAPI. HeaderAPI
// exists (RecordAPIKey.Header is real, confirmed in provider/apis/BaseAPI.ts)
// but FormAPI._initialize notes it is NOT auto-appended alongside Form, and
// the element that renders it was not verified as registered this session. An
// unregistered custom element renders silently inert, so this reads fields it
// is already fetching instead.
//
// this._record is read only in render(). AIUXRecordElement throws
// "AIUXRecordElement must be used within AIUXRecordProvider" when the context
// is read too early, and names connectedCallback as the usual cause.
//
// Attributes:
//   title-field     field whose display value is the heading (default number)
//   subtitle-field  field rendered under the heading (default short_description)
//   fields          comma-separated field names, or set .fields to an array
//   badge-fields    subset of the above rendered as a badge

@customElement('x-snc-slux-case-header')
export default class CaseHeader extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Form];

  static properties = {
    titleField: {attribute: 'title-field'},
    subtitleField: {attribute: 'subtitle-field'},
    fields: {attribute: 'fields'},
    badgeFields: {attribute: 'badge-fields'}
  };

  static styles = [
    fieldListStyles,
    css`
      :host {
        display: block;
      }

      .slux-header-title {
        margin: 0;
      }

      .slux-header-subtitle {
        margin: 0.125rem 0 0;
        overflow-wrap: anywhere;
      }

      .slux-header-main {
        flex: 1 1 18rem;
        min-width: 0;
      }

      .slux-header-actions {
        flex: 0 1 auto;
        min-width: 0;
      }
    `
  ];

  render() {
    const formApi = this._record.apis.form;

    const titleName = this.titleField || 'number';
    const subtitleName =
      this.subtitleField === '' ? '' : this.subtitleField || 'short_description';

    const {resolved: titleFields} = resolveFieldList(formApi, [titleName]);
    const {resolved: subtitleFields} = resolveFieldList(
      formApi,
      subtitleName ? [subtitleName] : []
    );
    const {resolved} = resolveFieldList(
      formApi,
      normalizeFieldNames(this.fields)
    );

    const titleText = titleFields[0]?.text || '';
    const subtitleText = subtitleFields[0]?.text || '';

    return html`
      <header
        class="aiux-card aiux-card-border aiux-card-body flex flex-row flex-wrap items-start justify-between gap-4"
      >
        <div class="slux-header-main flex flex-col gap-3">
          <div>
            <h1 class="slux-header-title aiux-card-title text-xl font-semibold">
              ${titleText}
            </h1>
            ${subtitleText
              ? html`<p class="slux-header-subtitle text-sm text-text-tertiary">
                  ${subtitleText}
                </p>`
              : nothing}
          </div>
          ${renderFieldList({
            fields: resolved,
            badgeFieldNames: normalizeFieldNames(this.badgeFields),
            layout: 'inline'
          })}
        </div>
        <div class="slux-header-actions flex">
          <slot name="actions"></slot>
        </div>
      </header>
    `;
  }
}
