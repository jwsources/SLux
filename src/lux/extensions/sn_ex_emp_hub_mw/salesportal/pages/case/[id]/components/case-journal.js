import {css, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

// Journal and work notes as ONE placeable element. The record package is
// already granular here, so this wraps the three tags it ships rather than
// re-implementing any of them, and the inner markup is preserved from the
// composition that renders correctly today.
//
// stream-height is deliberately NOT set. The activity-stream reference states
// it is required only when the stream sits inside a container that already
// scrolls, and that for a full-page record which scrolls the document it must
// be left unset so the viewport drives pagination.
//
// This element never reads this._record, so it cannot throw the
// AIUXRecordElement "read happened too early" error. It declares the Activity
// API only so a client-side reload keeps fetching that data source.

@customElement('x-snc-slux-case-journal')
export default class CaseJournal extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Activity];

  static properties = {
    heading: {attribute: 'heading'}
  };

  static styles = css`
    :host {
      display: block;
    }

    .slux-journal-title {
      margin: 0;
    }
  `;

  render() {
    return html`
      <section
        class="aiux-card aiux-card-border aiux-card-body"
        aria-labelledby="slux-journal-heading"
      >
        <h2
          id="slux-journal-heading"
          class="slux-journal-title aiux-card-title text-base font-semibold"
        >
          ${this.heading || i18n.getMessage('Activity')}
        </h2>
        <aiux-record-activity-layout>
          <aiux-record-activity-compose main></aiux-record-activity-compose>
          <aiux-record-activity-stream></aiux-record-activity-stream>
        </aiux-record-activity-layout>
      </section>
    `;
  }
}
