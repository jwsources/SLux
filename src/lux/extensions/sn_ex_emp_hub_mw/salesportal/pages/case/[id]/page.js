import {html, css, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
// Deep import, NOT the aiux-services barrel. The isolate bundler externalizes
// components-core and components-record and stubs aiux-client, but the
// services barrel matches none of those buckets, so it resolves through the
// meta-package exports and is bundled INLINE. Its re-exported service modules
// reach core/observability, whose logger.js uses a Node subpath import that
// rollup's node-resolve rejects as "outside package" -- which already failed
// this page's isolate bundle once. services/src/i18n.js has zero imports and
// reads globalThis.__WIDGET_MESSAGES__ when window is undefined, so it is
// SSR-isolate-safe on its own. Do not "tidy" this back to the barrel.
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
// Stubbed to an empty module inside the SSR isolate, so navigate is undefined
// server-side and real in the client bundle. Safe to call from a click
// handler; never call it during SSR or from a loader.
import {navigate} from '@servicenow/aiux/aiux-client';
import '@servicenow/aiux/aiux-components-record';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
// Same specifier the record package's own tabs-layout.ts uses. Owns the full
// APG tabs pattern: tablist/tab/tabpanel roles, aria-selected, aria-controls,
// roving tabindex and arrow-key navigation.
import '@servicenow/aiux/aiux-components-tabs';

import './components/case-header.js';
import './components/case-fields.js';
import './components/case-journal.js';

// Customer Service Case record page, overlaid onto the Sales Portal host
// experience at /aiux/salesportal/case/<sys_id>.
//
// The directory path is the entire coupling to the host: this file sits under
// extensions/sn_ex_emp_hub_mw/salesportal/, which is the host's scope and its
// url_suffix. The [id] directory makes the last segment a route parameter,
// surfaced to the loader as ctx.params.id.
//
// DECOMPOSED, NOT A PLATFORM FORM. There is exactly one aiux-record-provider
// as the data and context root; every visible block below it is its own
// element that extends AIUXRecordElement, declares its own static requiredAPIs
// and reads this._record.apis.*.
//
// aiux-record-form is deliberately NOT rendered. Its _renderSectionContent
// calls renderFormatter() for the Notes section's activity.xml formatter,
// which emitted a SECOND compose tablist and a second activity feed alongside
// the page's own. FormAPI.sections only strips journal FIELDS from a section
// carrying that formatter -- never the formatter itself -- so no
// hide-a-section flag removes the duplicate. Not rendering the whole form
// does, at the root.
//
// aiux-record-form-messages is therefore rendered on its own, so UI action
// errors and successes, which the form used to host, are still surfaced.
//
// A sys_id of -1 opens a blank form for a new case. Nothing is prefetched in
// that case and the provider runs in client-side connected mode instead.
const CASE_TABLE = 'sn_customerservice_case';

// The page owns field placement. Each list is handed to a separately
// placeable element, so moving a field between blocks is an edit here rather
// than inside a component.
const HEADER_FIELDS = 'account,contact,state,priority';
const BADGE_FIELDS = 'state';
const SUMMARY_FIELDS = 'short_description,category,subcategory,contact_type';
const CONTACT_FIELDS = 'contact,account,opened_at,opened_by';
const ASSIGNMENT_FIELDS = 'assignment_group,assigned_to,priority,state';

@customElement('x-snc-slux-case-record-page')
export default class CaseRecordPage extends AIUXElement {
  static properties = {
    _activeSection: {state: true}
  };

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  constructor() {
    super();
    // Assigned here rather than as a class field: a class field initializer
    // would shadow the accessor Lit generates from static properties and
    // silence reactivity.
    this._activeSection = 'overview';
  }

  static async loader(ctx) {
    const sysId = ctx.params?.id || '';

    // New-record form, or no id in the route: nothing to prefetch.
    if (!sysId || sysId === '-1') {
      return {sysId, data: null, error: null};
    }

    try {
      // requiredAPIs must be explicit for SSR -- auto-discovery is CSR-only,
      // because the loader runs before any child element connects.
      const data = await RecordDataManager.fetchRecord(
        {table: CASE_TABLE, sysId},
        [RecordAPIKey.Form, RecordAPIKey.Actions, RecordAPIKey.Activity]
      );
      return {sysId, data, error: null};
    } catch (e) {
      return {sysId, data: null, error: e?.message || String(e)};
    }
  }

  firstUpdated() {
    // Runs on both the server and the client, so browser globals are guarded.
    if (!isServer) {
      document.title = i18n.getMessage('Case');
    }
  }

  // Property callback, not a DOM event: receives (table, sysId) as separate
  // arguments. Binding it with an @ prefix would silently do nothing. Related
  // cases stay on this page; anything else is handed to the host router.
  _handleOpenRecord = (table, sysId) => {
    if (!table || !sysId) return;
    if (table === CASE_TABLE) {
      navigate(`/case/${sysId}`);
      return;
    }
    navigate(`/record/${table}/${sysId}`);
  };

  // aiux-tab-group dispatches a namespaced event whose detail carries the tab
  // id, and getTabId returns the explicit tab.id when one is supplied.
  _handleSectionChange = e => {
    const id = e.detail?.id;
    if (id) this._activeSection = id;
  };

  _sections() {
    return [
      {
        id: 'overview',
        label: i18n.getMessage('Overview'),
        content: html`
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start"
          >
            <x-snc-slux-case-fields
              heading=${i18n.getMessage('Case summary')}
              fields=${SUMMARY_FIELDS}
              layout="stacked"
            ></x-snc-slux-case-fields>
            <x-snc-slux-case-fields
              heading=${i18n.getMessage('Contact')}
              fields=${CONTACT_FIELDS}
              layout="stacked"
            ></x-snc-slux-case-fields>
            <x-snc-slux-case-fields
              heading=${i18n.getMessage('Assignment')}
              fields=${ASSIGNMENT_FIELDS}
              badge-fields=${BADGE_FIELDS}
              layout="stacked"
            ></x-snc-slux-case-fields>
          </div>
        `
      },
      {
        id: 'activity',
        label: i18n.getMessage('Activity'),
        content: html`<x-snc-slux-case-journal></x-snc-slux-case-journal>`
      },
      {
        id: 'related',
        label: i18n.getMessage('Related lists'),
        content: html`<aiux-record-related-lists></aiux-record-related-lists>`
      }
    ];
  }

  render() {
    const {sysId, data, error} = this.loaderData || {};

    if (error) {
      return html`
        <section class="flex flex-col gap-2 p-8" role="alert">
          <h1 class="text-xl font-bold">
            ${i18n.getMessage('This case could not be loaded')}
          </h1>
          <p class="text-sm text-text-tertiary">${error}</p>
        </section>
      `;
    }

    return html`
      <aiux-record-provider
        .data=${data}
        table=${CASE_TABLE}
        sysId=${sysId || ''}
        show-error-details="true"
        .onOpenRecord=${this._handleOpenRecord}
      >
        <div class="flex flex-col gap-4 p-4">
          <x-snc-slux-case-header
            fields=${HEADER_FIELDS}
            badge-fields=${BADGE_FIELDS}
          >
            <aiux-record-actions slot="actions"></aiux-record-actions>
          </x-snc-slux-case-header>
          <aiux-record-form-messages></aiux-record-form-messages>
          <aiux-tab-group
            variant="lifted"
            tablist-label=${i18n.getMessage('Case sections')}
            .activeTab=${this._activeSection}
            .tabs=${this._sections()}
            @aiux-tab-group:tab-change=${this._handleSectionChange}
          ></aiux-tab-group>
        </div>
      </aiux-record-provider>
    `;
  }
}
