import {html, css, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXElement,
  getLogger,
  withWidgetContext
} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

import '../../../framework/record-page.js';
import '../../../framework/account-360.js';
import {
  buildAccount,
  buildAccountPhaseTwo,
  refreshRelatedSet
} from '../../../framework/loaders/account-data.js';
import {publishRefreshDone} from '../../../framework/record-events.js';
import {expandNode} from '../../../framework/loaders/graph-data.js';
import {getConfigsForTable} from '../../../framework/configs/index.js';

// THE ACCOUNT PAGE.
//
// Thin by design: the shared record page owns the provider, the form handlers,
// the record-change subscription, the host chrome, the header, the view switch
// and three of the four views. This page supplies the loader data and the one
// view that is specific to an account -- the 360.
//
// That is the structure the case page established, made reusable: a new record
// type is a config entry, a loader and one bespoke Intelligence view.
//
// NO ACTIVITY VIEW. customer_account has no journal field, so an activity
// stream would render an empty shell. The account config's views list omits it,
// which is the mechanism that keeps the switch honest.

const TABLE = 'customer_account';

// Scopes served by buildAccountPhaseTwo rather than by a single descriptor:
// entitlements hang off the CONTRACTS, family cases off the account plus its
// children, and the escalation off the account row's own reference -- so none
// can be re-read from one RELATED entry.
const PHASE_TWO_SCOPES = ['entitlements', 'familyCases', 'escalation'];

@customElement('x-snc-slux-account-page')
export default class AccountPage extends withWidgetContext(AIUXElement) {
  // WHAT THE ASSISTANT IS TOLD THIS PAGE IS.
  //
  // From the AIEL contract: the widget-context mixin's registration bails out
  // early when BOTH client_tools and aiContext are empty, so aiContext is what
  // makes the page visible to the assistant at all -- not decoration.
  static aiContext = {
    description:
      'The customer account page in this portal. Shows one account as a 360 ' +
      'cockpit -- health, active escalation, contracts, installed products, ' +
      'cases, pipeline and the account hierarchy.',
    bestFor:
      'Investigating an account relationship, an active escalation, renewal ' +
      'risk, or what a customer currently runs.'
  };

  static properties = {
    _live: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as a class field: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this._live = null;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  static async loader(ctx) {
    const sysId = String(ctx.params?.id || '').trim();
    if (!sysId) return {sysId: '', incomplete: true};

    const config =
      getConfigsForTable(TABLE).find(c => c && c.active !== false) || null;

    // Three independent reads. allSettled so one failure cannot blank the
    // page: the 360 needs the account and its related sets, Related needs the
    // edge-map links, and the provider payload is only for the header's action
    // bar and the form environment.
    const [accountSettled, linksSettled, dataSettled] = await Promise.allSettled([
      buildAccount(ctx, sysId),
      expandNode(ctx, TABLE, sysId),
      RecordDataManager.fetchRecord({table: TABLE, sysId}, [
        RecordAPIKey.Form,
        RecordAPIKey.Actions
      ])
    ]);

    const account =
      accountSettled.status === 'fulfilled' ? accountSettled.value : null;

    // PHASE TWO depends on phase one's ids: entitlements hang off the
    // contracts, and family cases off the account plus its children. Merged
    // into the same related map so the 360 reads one shape.
    let related = account?.related || null;
    if (related) {
      const extra = await buildAccountPhaseTwo(ctx, sysId, related, account.row);
      related = {...related, ...extra};
    }

    return {
      sysId,
      incomplete: false,
      config,
      groups: config?.details?.groups || [],
      row: account?.row || null,
      related,
      links: linksSettled.status === 'fulfilled' ? linksSettled.value : [],
      data: dataSettled.status === 'fulfilled' ? dataSettled.value : null
    };
  }

  get _row() {
    return this._live?.row ?? this.loaderData?.row ?? null;
  }

  get _related() {
    return this._live?.related ?? this.loaderData?.related ?? null;
  }

  firstUpdated() {
    if (isServer) return;
    document.title = i18n.getMessage('Account');
    // Publish on first render, so the assistant knows WHICH account from the
    // moment the page is open rather than only after an Investigate click.
    this._publishContext();
  }

  // THE REFRESH HANDLER, scoped or whole.
  //
  // The shared record page reloads the provider and then asks the page to
  // re-read whatever IT loaded -- only the page knows that, which is why this
  // is an event rather than something the shared component does.
  //
  // A SCOPE re-reads one slice through the same descriptor buildAccount used,
  // so a refreshed applet cannot drift from the page around it. No scope
  // re-reads everything, including phase two -- without that a full refresh
  // would silently drop the entitlement and family-case sets and their panels
  // would vanish.
  //
  // publishRefreshDone runs in a finally, so the control stops indicating on a
  // real completion and still stops if the read threw.
  _handleRefresh = async e => {
    if (isServer) return;
    const sysId = this.loaderData?.sysId;
    if (!sysId) return;

    const scope = e?.detail?.scope;

    try {
      if (scope && PHASE_TWO_SCOPES.includes(scope)) {
        const base = this._related || {};
        const extra = await buildAccountPhaseTwo(null, sysId, base, this._row);
        this._live = {
          row: this._row,
          related: {...base, ...extra}
        };
        return;
      }

      if (scope) {
        const set = await refreshRelatedSet(null, sysId, scope);
        if (!set) return;
        this._live = {
          row: this._row,
          related: {...(this._related || {}), [scope]: set}
        };
        return;
      }

      const account = await buildAccount(null, sysId);
      if (!account) return;
      const extra = await buildAccountPhaseTwo(
        null,
        sysId,
        account.related,
        account.row
      );
      this._live = {...account, related: {...account.related, ...extra}};
    } finally {
      publishRefreshDone({table: TABLE, sysId, scope});
      // The assistant's context carried the pre-refresh counts, so it is
      // republished rather than left describing data the page no longer shows.
      this._publishContext();
    }
  };

  // THE AIEL CONTEXT, published as soon as the page has data.
  //
  // Without this the assistant knew only the STATIC aiContext -- "this is an
  // account page" -- and nothing about WHICH account, until someone pressed a
  // button. Asking Otto anything before that got a generic answer.
  //
  // _pushAielContext is used rather than setAiContext deliberately, and this is
  // the fix for Otto opening empty. From the mixin source:
  //
  //     setAiContext(context) {
  //       ...
  //       this.#debounceTimer = setTimeout(() => {
  //         this._pushAielContext(context);
  //       }, 100);
  //     }
  //
  // setAiContext DEBOUNCES BY 100ms and returns nothing, so there is no way to
  // know when the push landed. _pushAielContext is the method it delegates to,
  // it takes the same argument, and it RETURNS THE PROMISE -- which is what
  // lets the chat be opened only after the context is actually there.
  //
  // RISK, stated: _pushAielContext is underscore-prefixed, so it is internal
  // rather than published API. If a future release renames it this throws a
  // TypeError on click -- loud and immediate, not a silent empty context. That
  // is the better failure mode of the two, and the public alternative is a
  // guessed sleep longer than the debounce.
  _aielPayload(extra) {
    const row = this._row;
    const read = name => {
      const cell = row?.[name];
      if (!cell) return '';
      const text =
        typeof cell === 'object' ? cell.display_value || cell.value : cell;
      return text === null || text === undefined ? '' : String(text);
    };

    const set = id => this._related?.[id]?.total ?? 0;

    return {
      table: TABLE,
      sysId: this.loaderData?.sysId,
      account: {
        name: read('name'),
        number: read('number'),
        health: read('x_snc_philips_e2_0_health'),
        region: read('x_snc_philips_e2_0_region'),
        keyAccountManager: read('x_snc_philips_e2_0_kam'),
        primaryContact: read('primary_contact'),
        annualRevenue: read('revenue_per_year'),
        activeEscalation: read('active_escalation')
      },
      counts: {
        cases: set('familyCases') || set('cases'),
        contracts: set('contracts'),
        installedItems: set('installBase'),
        campuses: set('campuses'),
        contacts: set('contacts'),
        openOpportunities: set('opportunities'),
        entitlements: set('entitlements')
      },
      ...(extra || {})
    };
  }

  async _publishContext(extra) {
    if (isServer) return;
    if (typeof this._pushAielContext !== 'function') {
      getLogger('rv-account').error(
        {},
        'AIEL push method missing -- context not published'
      );
      return;
    }
    await this._pushAielContext(this._aielPayload(extra));
  }

  // THE VISIBLE PROMPT.
  //
  // sessionContext alone is INVISIBLE. Proven in ChatController:
  //
  //     // Maps sessionContext from the aiux:open-chat event detail to lbf's
  //     // newConversationContext prop, which lbf forwards to NAP during
  //     // session handshake / new thread creation. DEF0835146.
  //     '.newConversationContext': sessionContext,
  //
  // and the chat wrapper documents newConversationContext as the "initial chat
  // payload (e.g. {searchText: '...'}) passed to LBF when starting a brand-new
  // conversation, SEEDING THE FIRST USER TURN".
  //
  // So the key that produces a visible turn is searchText. Without it the
  // structured payload still reached NAP but nothing appeared in the
  // conversation -- the user saw an empty chat and had no idea what Otto had
  // been told. The instruction is now a real first turn they can read, edit
  // the follow-up to, and hold Otto to.
  //
  // Composed only from measured fields, so a missing one drops its clause
  // rather than printing an empty phrase.
  _promptFor(intent, escalation) {
    const name = this._aielPayload().account.name;
    const bits = [
      escalation?.severity
        ? i18n.getMessage('severity {value}', {value: escalation.severity})
        : '',
      escalation?.trend
        ? i18n.getMessage('a {value} trend', {value: escalation.trend})
        : '',
      escalation?.reason
        ? i18n.getMessage('raised because of {value}', {
            value: escalation.reason
          })
        : ''
    ].filter(Boolean);

    const detail = bits.length ? ' ' + bits.join(', ') + '.' : '';

    if (intent === 'remediate') {
      return (
        i18n.getMessage(
          'Draft a remediation plan for escalation {number} on {account}.',
          {number: escalation?.number || '', account: name}
        ) +
        detail +
        ' ' +
        i18n.getMessage(
          'Give me concrete next actions, in order, with an owner for each.'
        )
      );
    }

    return (
      i18n.getMessage(
        'Investigate escalation {number} on {account}.',
        {number: escalation?.number || '', account: name}
      ) +
      detail +
      ' ' +
      i18n.getMessage(
        'Explain what is driving it and what I should deal with first.'
      )
    );
  }

  // INVESTIGATE: publish, WAIT, then open. The order is the whole fix.
  _handleInvestigate = async e => {
    const detail = e.detail || {};
    const extra = {focus: detail.intent, escalation: detail.escalation};

    await this._publishContext(extra);

    // searchText seeds the VISIBLE first turn; the rest of the payload is the
    // structured context LBF forwards to NAP alongside it. Both matter -- the
    // prompt is what the user reads, the structure is what the assistant can
    // reason over without a lookup.
    this.dispatchEvent(
      new CustomEvent('aiux:open-chat', {
        detail: {
          forceNewConversation: true,
          sessionContext: {
            searchText: this._promptFor(detail.intent, detail.escalation),
            ...this._aielPayload(extra)
          }
        },
        bubbles: true,
        composed: true
      })
    );
  };

  render() {
    const {sysId, config, groups, links, data, incomplete} =
      this.loaderData || {};
    const row = this._row;

    if (incomplete || !row) {
      return html`
        <section class="rv-card" role="alert">
          <p>
            ${incomplete
              ? i18n.getMessage('This link does not identify an account.')
              : i18n.getMessage('This account could not be loaded.')}
          </p>
        </section>
      `;
    }

    const related = this._related;

    return html`
      <x-snc-slux-rv-record-page
        table=${TABLE}
        sys-id=${sysId}
        .data=${data}
        .config=${config}
        .row=${row}
        .groups=${groups}
        .links=${links}
        mandate-intelligence
        .breadcrumb=${[
          {label: i18n.getMessage('Accounts')},
          {label: this._cellText('name') || i18n.getMessage('Account')}
        ]}
        @rv-record-page:refresh=${this._handleRefresh}
      >
        <!--
          TWO DIRECT slotted children, exactly as the case page does it, so the
          header's own action zone lays them out rather than a wrapper of ours.
        -->
        <aiux-record-actions slot="actions"></aiux-record-actions>
        <x-snc-slux-rv-context-actions
          slot="actions"
        ></x-snc-slux-rv-context-actions>

        <x-snc-slux-rv-account-360
          slot="intelligence"
          .row=${row}
          .related=${related}
          @rv-360:investigate=${this._handleInvestigate}
        ></x-snc-slux-rv-account-360>
      </x-snc-slux-rv-record-page>
    `;
  }

  _cellText(name) {
    const cell = this._row?.[name];
    if (!cell) return '';
    const text = typeof cell === 'object' ? cell.display_value || cell.value : cell;
    return text === null || text === undefined ? '' : String(text);
  }
}
