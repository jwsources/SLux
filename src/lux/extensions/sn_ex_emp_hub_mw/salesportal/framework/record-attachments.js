import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

// Subpath VERIFIED rather than taken from the component reference, which shows
// the bare package specifier. The platform's own
// components/record/src/components/attachments/attachment-bar.ts imports it as:
//
//     from '@servicenow/aiux/aiux-components-attachment'
//
// so that is the form that resolves in this app.
import '@servicenow/aiux/aiux-components-attachment';

import {rvTokens, rvPrimitives} from './tokens.js';
import {matchesRecord, subscribeRecordChanges} from './record-events.js';

// THE RECORD'S FILES, refreshed when the record changes.
//
// WHY A WRAPPER rather than dropping aiux-record-core-attachment straight into
// each page: the packaged component reloads its own list for uploads, renames
// and deletes the USER performs -- it listens for its own events -- but it
// cannot know about a file the SERVER created. A signing action that generates
// a PDF server-side produces exactly that case: the attachment exists and the
// panel still shows the list it fetched on load.
//
// Its refreshRequested property is the documented hook: "Change to a new
// non-zero number to trigger a list reload." So this wrapper subscribes to the
// record-change bus and bumps the counter, which makes a server-created
// attachment appear on the same signal that refreshes the fields.
//
// Everything else is the packaged component's: drag-and-drop upload, the
// review dialog, type and size validation, per-file menu, preview, search,
// sort, delete confirmation and notifications. Its reference lists those as
// "features the host must not rebuild".

@customElement('x-snc-slux-rv-attachments')
export default class RvAttachments extends AIUXElement {
  static properties = {
    table: {attribute: 'table'},
    sysId: {attribute: 'sys-id'},
    heading: {attribute: 'heading'},
    _refreshToken: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this.table = '';
    this.sysId = '';
    this.heading = '';
    // Starts at 0 because the property's default is 0 and the reload triggers
    // on a change to a new NON-ZERO value, so the first bump to 1 counts.
    this._refreshToken = 0;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      h2 {
        margin: 0 0 10px;
      }
    `
  ];

  connectedCallback() {
    super.connectedCallback();
    // SSR-safe: subscribeRecordChanges is a no-op on the server and returns a
    // no-op unsubscribe, so this needs no isServer guard.
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  _onRecordChanged = event => {
    // Mirrors the platform's own cross-record filter: an event for a different
    // record is ignored, and an event with no table or sysId matches.
    if (!matchesRecord(event, this.table, this.sysId)) return;
    this._refreshToken = this._refreshToken + 1;
  };

  render() {
    if (!this.table || !this.sysId) return nothing;

    return html`
      <section class="rv-card" aria-labelledby="rv-attach-h">
        <h2 id="rv-attach-h" class="rv-type-section">
          ${this.heading || i18n.getMessage('Files')}
        </h2>
        <aiux-record-core-attachment
          table=${this.table}
          .sysId=${this.sysId}
          mode="compact"
          .refreshRequested=${this._refreshToken}
          .inlinePreviewEnabled=${false}
        ></aiux-record-core-attachment>
      </section>
    `;
  }
}
