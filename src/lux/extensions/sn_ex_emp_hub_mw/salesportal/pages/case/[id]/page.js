import {html, css, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
// i18n is deep-imported, NOT from the '@servicenow/aiux/aiux-services' barrel.
// The isolate bundler externalizes components-core and components-record and
// stubs aiux-client, but the services barrel matches none of those buckets, so
// it is resolved through the meta-package exports and bundled INLINE. Its ~15
// re-exported service modules reach core/observability, whose logger.js uses
// the Node subpath import '#context' that rollup's node-resolve rejects as
// "outside package" — which fails the whole page's isolate bundle.
// services/src/i18n.js has zero imports and reads
// globalThis.__WIDGET_MESSAGES__ when window is undefined, so it is
// SSR-isolate-safe on its own. Do not "tidy" this back to the barrel.
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import {navigate} from '@servicenow/aiux/aiux-client';
import '@servicenow/aiux/aiux-components-record';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

// Customer Service Case record page, overlaid onto the Sales Portal host
// experience at /aiux/salesportal/case/<sys_id>.
//
// The directory path is the entire coupling to the host: this file sits under
// extensions/sn_ex_emp_hub_mw/salesportal/, which is the host's scope and its
// url_suffix. The [id] directory makes the last segment a route parameter,
// surfaced to the loader as ctx.params.id.
//
// A sys_id of -1 opens a blank form for a new case. In that case no data is
// fetched here and the provider runs in client-side connected mode instead.
const CASE_TABLE = 'sn_customerservice_case';

@customElement('x-snc-slux-case-record-page')
export default class CaseRecordPage extends AIUXElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  static async loader(ctx) {
    const sysId = ctx.params?.id || '';

    // New-record form, or no id in the route: nothing to prefetch.
    if (!sysId || sysId === '-1') {
      return {sysId, data: null, error: null};
    }

    try {
      // requiredAPIs must be explicit for SSR — auto-discovery only works
      // client-side, because the loader runs before any child connects.
      const data = await RecordDataManager.fetchRecord({table: CASE_TABLE, sysId}, [
        RecordAPIKey.Form,
        RecordAPIKey.Actions,
        RecordAPIKey.Activity
      ]);
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
  // arguments. Related cases stay inside this page; anything else is handed
  // to the host router.
  _handleOpenRecord = (table, sysId) => {
    if (!table || !sysId) return;
    if (table === CASE_TABLE) {
      navigate(`/case/${sysId}`);
      return;
    }
    navigate(`/record/${table}/${sysId}`);
  };

  render() {
    const {sysId, data, error} = this.loaderData || {};

    if (error) {
      return html`
        <section class="flex flex-col gap-2 p-8" role="alert">
          <h1 class="text-xl font-bold text-text-primary">
            ${i18n.getMessage('This case could not be loaded')}
          </h1>
          <p class="text-sm text-text-secondary">${error}</p>
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
        <aiux-record-actions></aiux-record-actions>
        <aiux-record-form
          layout-variant="flat"
          label-value-layout="horizontal"
        ></aiux-record-form>
        <aiux-record-activity-layout>
          <aiux-record-activity-compose main></aiux-record-activity-compose>
          <aiux-record-activity-stream></aiux-record-activity-stream>
        </aiux-record-activity-layout>
      </aiux-record-provider>
    `;
  }
}
