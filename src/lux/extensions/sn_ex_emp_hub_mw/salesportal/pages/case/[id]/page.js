import {html, css, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXElement,
  getLogger,
  withWidgetContext
} from '@servicenow/aiux/aiux-components-core';
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
// Stubbed to an empty module inside the SSR isolate, so this is undefined
// server-side and real in the client bundle. Only ever called from a click
// handler, never during SSR or from a loader.
//
// getGlobalRouter, NOT navigate: the exported navigate() falls back to a raw
// window.location.href assignment when no global router is registered, which
// drops the experience basename. See _handleOpenRecord for the quoted source
// and the measured consequence.
import {getGlobalRouter} from '@servicenow/aiux/aiux-client';
import '@servicenow/aiux/aiux-components-record';
import {
  RecordDataManager,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';

// The record-view framework. The shell owns the page frame; Details is now
// driven by the record's own form layout.
import '../../../framework/page-shell.js';
import '../../../framework/view-switch.js';
import '../../../framework/header-adapter.js';
import '../../../framework/record-fields.js';
import '../../../framework/record-context-actions.js';
import '../../../framework/record-refresh.js';
// Shared with the generic record page, so the body class and the selector it
// activates have ONE declaration. It lives outside pages/ because a path
// containing a [param] directory CANNOT be used in an import specifier: the
// build rewrites that directory to _id_ on disk, so the bracketed path
// resolves to nothing and the isolate bundle fails.
import {
  applySeamlessChrome,
  releaseSeamlessChrome
} from '../../../shared/host-chrome.js';
import {
  matchesRecord,
  publishRefreshDone,
  recordFormHandlers,
  reloadProviderIn,
  subscribeRecordChanges
} from '../../../framework/record-events.js';
import '../../../framework/intelligent-cards.js';
import '../../../framework/related-records.js';
import '../../../framework/activity-view.js';
import '../../../framework/otto-dock.js';
import {buildRecordIntelligence} from '../../../framework/loaders/record-intelligence.js';
import {
  cellDisplay,
  cellValue,
  fetchDetailGroups,
  fetchTable
} from '../../../framework/loaders/record-data.js';
import {fetchFieldMeta} from '../../../framework/loaders/field-meta.js';
import '../../../framework/record-contact.js';
// Our own glance card, which carries the SLA. aiux-sla was dropped: it renders
// its own square-bordered card with a full-width coloured rule, and its
// reference states there are no CSS parts and no component custom properties,
// so it cannot be brought into line with the cards around it.
import '../../../framework/record-glance.js';
import {
  PAYLOAD_ABSENT,
  PAYLOAD_READY,
  buildViewOptions,
  evaluateRichness,
  resolveActiveView
} from '../../../framework/richness-gate.js';
import {resolveFormView} from '../../../framework/layout-config.js';
import {getConfigsForTable} from '../../../framework/configs/index.js';
import {
  VIEW_ACTIVITY,
  VIEW_INTELLIGENT,
  VIEW_RELATED
} from '../../../framework/views.js';

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

// The route segment this page is mounted at, which is the directory name one
// level up from the [id] folder. Declared once because it is used twice: to
// derive the experience basename from the live URL, and to build the path a
// case-to-case navigation targets.
const CASE_ROUTE = 'case';

// THE ONE IMPLEMENTATION OF "GO TO A CASE PAGE".
//
// Module level, not a method, because two callers need it: the click handler
// wired to the provider, and the client tool the assistant invokes. A tool
// definition is rebound by the platform, so depending on the element context
// inside it would couple the tool to that rebinding -- a module function needs
// no binding at all.
//
// WHY NOT THE EXPORTED navigate(). Read from aiux/client/src/router.js:
//
//     export function navigate(path, options) {
//       if (globalRouter) {
//         return globalRouter.navigate(path, options);
//       }
//       return browserNavigate(path);
//     }
//
// and browserNavigate with no globalRouter falls back to a plain
// window.location.href assignment. The router instance holds basePath in a
// closure and prepends it on every commit; the module-level fallback has no
// basePath at all. This host creates its router through createRouter() but
// never calls setGlobalRouter(), so globalRouter is NULL -- which turned
// navigate('/case/<id>') into window.location.href = '/case/<id>', dropping
// the experience basename and landing on a platform 404.
function goToCase(sysId) {
  if (!sysId || isServer) return false;

  const marker = `/${CASE_ROUTE}/`;
  const appPath = `${marker}${sysId}`;

  const router = getGlobalRouter();
  if (router) {
    // The router instance prepends its own basePath, so it takes the
    // app-relative path.
    router.navigate(appPath);
    return true;
  }

  // No global router: build the full URL instead of handing a basename-less
  // path to a function that will assign it verbatim. The basename is derived
  // from the URL this page is already on rather than assumed -- this module
  // only ever runs on the case route, so everything before that segment is it.
  const {pathname} = window.location;
  const index = pathname.indexOf(marker);
  const basePath = index > -1 ? pathname.slice(0, index) : '';
  window.location.assign(`${basePath}${appPath}`);
  return true;
}

@customElement('x-snc-slux-case-record-page')
export default class CaseRecordPage extends withWidgetContext(AIUXElement) {
  // WHAT THE ASSISTANT IS TOLD THIS PAGE IS.
  //
  // Read from components/core/src/widget-context-mixin.js: the mixin's
  // _registerClientTools bails early when BOTH client_tools is empty and
  // aiContext is null, so aiContext is what makes the page visible to chat at
  // all -- not decoration.
  static aiContext = {
    description:
      'The Customer Service Case record page in this portal. Shows one case ' +
      'as an Intelligence summary, a Details form, an Activity history and ' +
      'its related records.',
    bestFor:
      'Opening a specific customer service case inside the portal so the ' +
      'user can read and act on it, rather than describing the case in chat.'
  };

  // THE TOOL THAT LETS THE ASSISTANT OPEN A CASE IN THE PORTAL.
  //
  // Before this, the assistant had no way to move the portal and told the user
  // to find the case themselves. A tool is a declared capability -- it cannot
  // be inferred from the page existing.
  //
  // THREE CONTRACT POINTS, all from the AIEL reference and the mixin source:
  //
  // 1. definition MUST be a regular function, never an arrow. The platform
  //    rebinds it, an arrow cannot be rebound, and buildWidgetContext warns
  //    when definition.name is empty. Method shorthand is the safe form.
  // 2. ONE arguments object. Everything the assistant supplies arrives in it.
  // 3. RETURN FACTS, not an acknowledgement. The assistant reads the return
  //    value to tell the user what happened, so a bare success string leaves
  //    it guessing. A refusal returns what IS available so the next attempt
  //    needs no extra round trip.
  //
  // SCOPE LIMIT, worth stating because it is structural rather than an
  // oversight: the mixin registers tools per ELEMENT on connect, so this tool
  // exists only while a case page is mounted. From Home the assistant still
  // cannot open a case. Making it always available means registering on the
  // layout, and this host owns the layout.
  static client_tools = {
    open_case_in_portal: {
      description:
        'Open a customer service case in this portal page view, by its case ' +
        'number. Call this instead of telling the user to search for the ' +
        'case themselves. Navigation only -- it changes nothing on the record.',
      arguments: [
        {
          name: 'caseNumber',
          type: 'string',
          description:
            'The case number to open, for example CS0001625. Case-insensitive.'
        }
      ],
      async definition({caseNumber} = {}) {
        const wanted = String(caseNumber || '').trim();
        if (!wanted) {
          return {
            success: false,
            reason: 'No case number was supplied.',
            expected: 'A case number such as CS0001625.'
          };
        }

        // Resolved server-side by number rather than trusting a sys_id from
        // the assistant: a tool validates, the model matches. Table API query
        // values are not escaped by the helper, so the number is constrained
        // to the characters a case number can contain before it is used.
        const safe = wanted.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (safe !== wanted.toUpperCase()) {
          return {
            success: false,
            reason: `"${wanted}" is not a valid case number.`,
            expected: 'Letters and digits only, for example CS0001625.'
          };
        }

        const {rows, failed, reason} = await fetchTable(null, CASE_TABLE, {
          query: `number=${safe}`,
          fields: 'sys_id,number,short_description,state',
          limit: 1
        });

        if (failed) {
          return {
            success: false,
            reason: `Could not look up ${safe}: ${reason}.`,
            navigated: false
          };
        }

        const row = rows[0];
        if (!row) {
          return {
            success: false,
            reason: `No case numbered ${safe} exists, or it is not visible to this user.`,
            navigated: false
          };
        }

        const sysId = cellValue(row, 'sys_id');
        const navigated = goToCase(sysId);

        // Facts, so the assistant can say what it actually did.
        return {
          success: navigated,
          navigated,
          caseNumber: cellDisplay(row, 'number'),
          sysId,
          shortDescription: cellDisplay(row, 'short_description'),
          state: cellDisplay(row, 'state'),
          reason: navigated
            ? undefined
            : 'The case was found but navigation could not run in this context.'
        };
      }
    }
  };

  static properties = {
    _view: {state: true},
    // LIVE DATA, overlaying the loader's payload.
    //
    // Details and Intelligence are read in the static loader, and a loader
    // runs ONCE per navigation. So after a UI action wrote to the record the
    // page kept rendering the values it was built with -- the write landed and
    // the screen did not move.
    //
    // The provider's own reload() refreshes the form and action payloads, but
    // it cannot touch these: they come from the Table API, not from FormAPI.
    // That is the cost of moving Details off the form layout, and this is the
    // other half of it. Null means "nothing newer than the loader".
    _liveRow: {state: true},
    _liveIntel: {state: true},
    _refreshing: {state: true},
    _configMatched: {state: true}
  };

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    /* The Details rail: SLA ring, then contact.

       STICKY, AND IT DOES NOT STRETCH. The shell lays cells out in a grid, and
       a grid item defaults to stretching to the tallest row -- so a short rail
       beside a long field column left a large dead area below the contact
       card. align-self: start stops the stretch; sticky then keeps the ring
       and the owner in view while the fields scroll, which is the whole point
       of putting status in a rail.

       A LITERAL gap, not --rv-grid-gap. This element is slotted INTO the
       shell, so it sits above the shell in the tree -- and the shell declares
       the rv tokens on its own :host, which inherits DOWN into its shadow
       tree, not up to its light-DOM children. A token reference here would
       resolve to nothing and collapse the gap. */
    .rv-rail {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
      align-self: start;
      position: sticky;
      top: 8px;
    }
  `;

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // would shadow the accessor Lit generates from static properties and
    // silence reactivity.
    //
    // _view starts EMPTY on purpose. An empty current view is what tells
    // resolveActiveView to pick a default; once it holds a real id, that
    // function keeps the user there and never auto-switches them.
    this._view = '';
    this._liveRow = null;
    this._liveIntel = null;
    this._refreshing = false;
    // Reported upward by the header adapter, which is the element that can
    // actually evaluate the config's condition against field values.
    this._configMatched = false;
  }

  static async loader(ctx) {
    const sysId = ctx.params?.id || '';

    // THE FORM VIEW, resolved from config before anything is fetched.
    //
    // It has to be decided here because it is part of the fetch: the form
    // payload is view-specific, so asking for the record and then deciding
    // which form to show would mean a second round trip. getConfigsForTable is
    // synchronous for the module-backed source, so this costs nothing.
    //
    // Empty means "let the platform resolve it", which is the behaviour this
    // page had before -- and that behaviour resolved Default view, whose
    // Closure Information section leads with a boolean called Knowledge and
    // which carries no Resolution Information or Major Case Information at
    // all.
    const {view: formView} = resolveFormView(
      CASE_TABLE,
      getConfigsForTable(CASE_TABLE)
    );

    // THE DETAILS FIELD GROUPS, resolved from config at the table level.
    //
    // Table-level rather than per-record because the loader needs them BEFORE
    // the record is fetched -- the group field names decide what the Details
    // read asks for. selectConfig's condition matching needs record values,
    // which is the wrong way round; and the configs here are unconditional, so
    // the first config for the table is the one that applies.
    const detailConfig =
      getConfigsForTable(CASE_TABLE).find(c => c && c.active !== false)
        ?.details || {};
    const detailGroups = detailConfig.groups || [];

    // FETCH LIST versus RENDER LIST. The glance and contact cards read fields
    // that are deliberately NOT rendered as rows -- showing priority both as a
    // chip and as a label/value pair prints the same fact twice. So the read
    // asks for the union and only the groups are handed to the field
    // component.
    const readGroups = [
      ...detailGroups,
      {id: '_glance', fields: detailConfig.glanceFields || []}
    ];

    // New-record form, or no id in the route: nothing to prefetch.
    if (!sysId || sysId === '-1') {
      return {sysId, data: null, error: null, intel: null, formView};
    }

    // TWO INDEPENDENT READS, settled not awaited in series.
    //
    // The form payload and the intelligence payload come from different
    // sources -- the record package's GraphQL form fetch, and the Table API --
    // and neither should be able to take the other down. allSettled is the
    // documented requirement for exactly this: "a single failing fetch must
    // not crash the entire loader". If the intelligence read fails, Details
    // and Activity still render and the richness gate simply closes.
    const [recordSettled, intelSettled, detailsSettled, metaSettled] =
      await Promise.allSettled([
        // requiredAPIs must be explicit for SSR -- auto-discovery is CSR-only,
        // because the loader runs before any child element connects.
        RecordDataManager.fetchRecord(
          {
            table: CASE_TABLE,
            sysId,
            ...(formView ? {view: formView, ignoreUserViewPreference: true} : {})
          },
          [RecordAPIKey.Form, RecordAPIKey.Actions, RecordAPIKey.Activity]
        ),
        buildRecordIntelligence(ctx, {table: CASE_TABLE, sysId}),
        // Details, read straight off the record. Independent of the form
        // payload on purpose: Details must not go blank because a form view
        // failed to resolve, which is exactly what kept happening.
        fetchDetailGroups(ctx, CASE_TABLE, sysId, readGroups),
        // Dictionary metadata: real types, real labels, and read_only. Cached
        // per table, so this costs one read for the first case of a session.
        fetchFieldMeta(ctx, CASE_TABLE, ['task'])
      ]);

    if (recordSettled.status === 'rejected') {
      const reason = recordSettled.reason;
      return {
        sysId,
        data: null,
        error: reason?.message || String(reason),
        intel: null,
        formView
      };
    }

    return {
      sysId,
      data: recordSettled.value,
      error: null,
      intel: intelSettled.status === 'fulfilled' ? intelSettled.value : null,
      formView,
      detailGroups,
      // The FETCH list, kept so a refresh re-reads the same union. Re-reading
      // only the rendered groups would drop the glance and contact fields and
      // blank those cards on the first write.
      readGroups,
      fieldMeta:
        metaSettled.status === 'fulfilled' ? metaSettled.value : {},
      detailRow:
        detailsSettled.status === 'fulfilled'
          ? detailsSettled.value?.row ?? null
          : null
    };
  }

  // SEAMLESS HOST CHROME.
  //
  // The host experience treats a custom page as foreign: for any page that is
  // not the landing page it paints its own wrapper WHITE, while its own home
  // page keeps the tinted surface that matches the navigation. Measured in the
  // mw-integration-layout widget source, the whole treatment hangs off one
  // attribute:
  //     .aiux-main[data-home-page='false'] {
  //       & > .uex-page-header { background-color: var(--color-background-primary, #FFF); ... }
  //       & .page-outer       { background-color: var(--color-background-primary, #FFF); ... }
  //       & .page-container   { background-color: var(--color-background-primary, #FFF); ... }
  //     }
  // There is no page-config flag to opt out -- a search of that source for
  // 'transient' returns nothing -- and we cannot become the landing page.
  //
  // WHY THIS IS DONE FROM THE DOCUMENT AND NOT FROM static styles.
  // Those three elements are ANCESTORS of this page and live in the host
  // layout's LIGHT DOM, styled by a document-level sheet. A page cannot style
  // its own ancestors from inside its shadow root, so the override has to be
  // document-level. It is scoped to a body class this page adds on mount and
  // removes on unmount, so the host's other pages keep their white chrome.
  //
  // WHY HERE RATHER THAN IN THE EXTENSION'S application.js. The lifecycle
  // module's navigate() argument shape was not read from source in this
  // session, and route-matching on an unverified context object is exactly the
  // kind of guess that passes a build and then silently never matches. Lit's
  // firstUpdated and disconnectedCallback are contracts already in use in this
  // file, and they bracket the page's life precisely.
  //
  // SPECIFICITY, not !important. The host rule computes to one class plus one
  // attribute plus one class; the override adds the body class in front, so it
  // wins on specificity alone. The host's own !important rules are confined to
  // its split-view variants, which this route is not.
  firstUpdated() {
    // Runs on both the server and the client, so browser globals are guarded.
    if (!isServer) {
      document.title = i18n.getMessage('Case');
      applySeamlessChrome();
      this._publishAiContext();
    }
  }

  // WHAT CASE IS ON SCREEN, published to the assistant.
  //
  // setAiContext is the live snapshot half of the AIEL contract: aiContext and
  // client_tools describe what this page CAN do, this says what it is
  // currently showing. Without it the assistant knows a case page exists but
  // not which case, so it cannot answer a question about the record in view.
  //
  // The mixin debounces and waits for the AIEL layer itself, so this does not
  // gate on session readiness -- that is explicitly called out in the
  // reference as something not to do.
  //
  // Only facts already fetched for the page are republished; nothing is read
  // just to feed chat.
  _publishAiContext() {
    const {sysId} = this.loaderData || {};
    const intel = this._intel;
    if (!sysId) return;

    const brief = intel?.otto?.brief;
    // The chain's self node is the only place the page already holds this
    // record's number, so it is read from there rather than adding a field.
    const self = (intel?.record?.chain || []).find(node => node.current);
    this.setAiContext({
      table: CASE_TABLE,
      sysId,
      caseNumber: self?.number || null,
      viewOnScreen: this._view || null,
      summary: brief?.summary || null,
      findings: (intel?.otto?.findings || []).map(f => f.message),
      relatedCounts: {
        dispatchTasks: intel?.record?.remediation?.tasks?.length ?? 0,
        commitments: intel?.record?.related?.commitments?.length ?? 0,
        chain: intel?.record?.chain?.length ?? 0
      }
    });
  }

  // THE SINGLE POLICY POINT FOR OPENING A RECORD.
  //
  // Wired to the provider's onOpenRecord prop, so every in-app route to
  // another record funnels here: a reference link in Details, a card in
  // Intelligence, a row in Related records, and a UI action's redirect. Its
  // signature is positional -- (table, sysId, query?, params?) -- NOT an
  // event, so binding it with an @ prefix would silently do nothing.
  //
  // WHY THIS DOES NOT CALL THE EXPORTED navigate().
  //
  // Read from aiux/client/src/router.js:
  //
  //     export function navigate(path, options) {
  //       if (globalRouter) {
  //         return globalRouter.navigate(path, options);
  //       }
  //       return browserNavigate(path);
  //     }
  //
  // and browserNavigate with no globalRouter "falls back to a plain
  // window.location.href assignment". The router instance holds basePath in a
  // closure and prepends it on every commit; the module-level fallback has no
  // basePath at all.
  //
  // This host creates its router through createRouter() but never calls
  // setGlobalRouter(), so globalRouter is NULL here. navigate('/case/<id>')
  // therefore became window.location.href = '/case/<id>' -- the experience
  // basename dropped, landing on a platform 404. That was the repeating
  // rewrite to /case/<sys_id>, and it is deterministic rather than
  // intermittent.
  //
  // So: use the router instance when one is registered, and otherwise build
  // the full URL ourselves rather than handing a basename-less path to a
  // function that will assign it verbatim.
  _handleOpenRecord = (table, sysId) => {
    if (!table || !sysId || isServer) return;

    if (table === CASE_TABLE) {
      goToCase(sysId);
      return;
    }

    // NO .do FALLBACK. A /<table>.do path cannot render inside this portal,
    // so sending the user there either left the experience or failed outright.
    // When this portal has no page for the table there is nowhere correct to
    // go, so this logs and stops rather than breaking the session. Give that
    // table a route in its config and this starts working with no change here.
    getLogger('rv-page').warn(
      {table, sysId},
      'No portal route for this table -- open request ignored'
    );
  };

  // The ViewSwitch reports a user-initiated change. Writing it to _view is
  // what pins the user in place: resolveActiveView will not move them again
  // while that view stays available.
  _handleViewChange = e => {
    const id = e.detail?.id;
    if (id) this._view = id;
  };

  // The header adapter is the only element with the field values needed to
  // evaluate a config condition, so it resolves the config and reports the
  // outcome here. The page needs only the boolean: it feeds the richness
  // gate's first half.
  _handleConfigResolved = e => {
    const matched = e.detail?.matched === true;
    if (matched !== this._configMatched) this._configMatched = matched;
  };

  // THE RESOLVED DATA -- live if a refresh has produced any, else the
  // loader's. Everything that renders reads these two, never loaderData
  // directly, so one refresh updates every view at once.
  get _row() {
    return this._liveRow ?? this.loaderData?.detailRow ?? null;
  }

  get _intel() {
    return this._liveIntel ?? this.loaderData?.intel ?? null;
  }

  // THE PROVIDER'S HANDLERS come from the shared bus now, so this page wires
  // one expression instead of two callbacks. They PUBLISH rather than refresh
  // directly, which is what lets the attachment panel and any other surface
  // watching this record react to the same write.
  //
  // The subscription below is this page's reaction to that signal.
  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribeRecordChanges(this._onRecordChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
    releaseSeamlessChrome();
  }

  _onRecordChanged = event => {
    const sysId = this.loaderData?.sysId;
    if (!matchesRecord(event, CASE_TABLE, sysId)) return;
    this._refreshAll(
      event.detail?.reason || 'record-changed',
      event.detail?.scope
    );
  };

  // THE FORM HANDLERS, WITH A STABLE IDENTITY.
  //
  // These were built inline in the template, which handed the provider a NEW
  // object on every render. Read from Provider.ts, registration happens once
  // inside the form-init path:
  //
  //     this._formEnvironment.registerFormHandlers(this.formHandlers);
  //     await this._formEnvironment.initialize(() => initializeAPIs());
  //
  // so only the identity present at init is ever registered. A fresh object per
  // render is therefore either re-registered on every pass or silently ignored
  // after the first -- and if ignored, onSubmitSucceeded and onLiveUpdated
  // never fire, nothing publishes to the record-change bus, and no page
  // refreshes on a write. Which is exactly the symptom.
  //
  // Cached against the sysId so navigating to another record builds new
  // handlers for that record rather than publishing under the old one.
  _handlers(sysId) {
    if (!this.__handlers || this.__handlersFor !== sysId) {
      this.__handlers = recordFormHandlers({table: CASE_TABLE, sysId});
      this.__handlersFor = sysId;
    }
    return this.__handlers;
  }

  // THE ONE REFRESH ENTRY POINT.
  //
  // Staleness appeared twice from the same cause: this page has TWO
  // independent data sources, and each change signal was wired to only one of
  // them. A UI action click refreshed both; an EXTERNAL change refreshed only
  // the Table API reads, so the action BAR stayed stale.
  //
  // That is exactly what an agent proposing a major case looks like.
  // major_case_state is what the major-case actions condition on -- Approve
  // Major Case Candidate and Reject Major Case Candidate appear, Propose
  // Major Case drops out -- and those conditions are evaluated SERVER-SIDE
  // against the record when the actions payload is fetched. The data refreshed
  // and the buttons did not, because the buttons are not ours: they come from
  // the provider.
  //
  // So every signal goes through here and refreshes both halves:
  //   provider.reload()  -- the form payload AND the UI action set
  //   _refreshData()     -- the Table API reads the provider knows nothing of
  //
  // THIS OWNS THE RE-ENTRANCY GUARD, because it is now the only caller of
  // either half. onLiveUpdated can fire in bursts -- a business rule touching
  // several fields, or another session saving -- and without the guard each
  // burst stacked a provider reload and two round trips across seven tables,
  // with the last to return winning regardless of order.
  async _refreshAll(reason, scope) {
    if (isServer || this._refreshing) return;
    this._refreshing = true;
    try {
      // A SCOPED refresh leaves the provider alone. The provider owns the form
      // payload and the whole UI action set, neither of which belongs to one
      // applet, so reloading it to answer a question about a few related rows
      // discards and refetches the entire form.
      if (!scope) reloadProviderIn(this.renderRoot);
      // Every slice comes from the same intelligence read, so a scoped press
      // repeats that read and the scope decides only whether the provider is
      // reloaded alongside it. Narrowing further would mean a second read
      // path for the same rows, which is how two sources of one truth start
      // disagreeing.
      await this._refreshData(reason);
    } finally {
      this._refreshing = false;
      // The control stops indicating on a REAL completion, never a timer --
      // and still stops if the read threw.
      publishRefreshDone({table: CASE_TABLE, sysId: this.loaderData?.sysId, scope});
    }
  }

  // RE-READ THE RECORD AND REPUBLISH.
  //
  // Called when the record has demonstrably changed: a UI action submitted
  // successfully, or the platform reported a live update from elsewhere.
  //
  // ctx is null on purpose. fetchTable branches on isServer: the server path
  // needs ctx.headers.cookie for the session, the client path uses aiuxFetch
  // which carries its own auth. This only ever runs client-side, from a
  // handler, so there is no ctx to pass and none is needed.
  //
  // allSettled, not all: the intelligence read spans seven tables, and one
  // failing slice must not discard a Details refresh that succeeded.
  async _refreshData(reason) {
    if (isServer) return;
    const sysId = this.loaderData?.sysId;
    const groups = this.loaderData?.readGroups;
    if (!sysId) return;

    const [detail, intel] = await Promise.allSettled([
      fetchDetailGroups(null, CASE_TABLE, sysId, groups),
      buildRecordIntelligence(null, {table: CASE_TABLE, sysId})
    ]);

    // A slice that failed keeps its previous value rather than being
    // overwritten with nothing -- stale data beats data that vanished.
    if (detail.status === 'fulfilled' && detail.value?.row) {
      this._liveRow = detail.value.row;
    }
    if (intel.status === 'fulfilled' && intel.value) {
      this._liveIntel = intel.value;
    }

    // The assistant's snapshot is now stale too -- it carried the old
    // summary, findings and counts.
    this._publishAiContext();

    getLogger('rv-page').info(
      {reason, sysId},
      'Record data refreshed after a change'
    );
  }

  // The provider's handlers and the provider reload both live in
  // framework/record-events.js now -- three pages needed the same pair, so
  // they are shared rather than copied. See that module for the RecordHandlers
  // contract and for why a document event is the bus.

  // Grid cells per view, as [{key, span}]. The shell renders one cell per
  // entry and this page slots a component into each.
  //
  // The Intelligent spans come from the shipped config for this table
  // (ui_design/samples/config.cs0001623.json): brief 12, cause 7, party 5,
  // chain 5, remediation 7, story 12. A cell is OMITTED when its slice of the
  // payload is empty, so a record with no dispatch tasks shows no empty
  // remediation card rather than a card with a heading and nothing under it.
  _cellsFor(view, intel) {
    if (view === VIEW_INTELLIGENT && intel) {
      const cells = [];
      const brief = intel.otto?.brief;
      if (brief && (brief.summary || brief.stats?.length || brief.alerts?.length)) {
        cells.push({key: 'brief', span: 12});
      }
      if (intel.otto?.cause?.from || intel.otto?.cause?.to || intel.otto?.cause?.facts?.length) {
        cells.push({key: 'cause', span: 7});
      }
      if (intel.record?.party) cells.push({key: 'party', span: 5});
      if (intel.record?.chain?.length) cells.push({key: 'chain', span: 5});
      if (
        intel.record?.remediation?.segments?.length ||
        intel.record?.remediation?.tasks?.length
      ) {
        cells.push({key: 'remed', span: 7});
      }
      if (
        intel.otto?.situation?.steps?.length ||
        intel.otto?.situation?.fallbackText
      ) {
        cells.push({key: 'story', span: 12});
      }
      return cells;
    }
    if (view === VIEW_ACTIVITY) {
      return [{key: 'activity', span: 12}];
    }
    if (view === VIEW_RELATED) {
      return [{key: 'related', span: 12}];
    }
    // VIEW_DETAILS, and the floor for any other view.
    //
    // A RAIL AND A BODY, matching the design: contact and SLA in a narrow
    // left column, the fields beside them. 4 and 8 of the shell's 12 columns,
    // which collapses to one column below 720px like every other grid here.
    return [
      {key: 'contact', span: 4},
      {key: 'fields', span: 8}
    ];
  }

  _bodyFor(view, intel) {
    if (view === VIEW_INTELLIGENT && intel) {
      // Each element is slotted into the cell whose key matches, and the cell
      // list above already dropped any slot whose data is empty -- so every
      // element rendered here has something to show.
      return html`
        <x-snc-slux-rv-otto-brief
          slot="cell-brief"
          .brief=${intel.otto?.brief}
        ></x-snc-slux-rv-otto-brief>
        <x-snc-slux-rv-root-cause
          slot="cell-cause"
          .cause=${intel.otto?.cause}
        ></x-snc-slux-rv-root-cause>
        <x-snc-slux-rv-party
          slot="cell-party"
          .party=${intel.record?.party}
        ></x-snc-slux-rv-party>
        <x-snc-slux-rv-chain
          slot="cell-chain"
          .chain=${intel.record?.chain}
        ></x-snc-slux-rv-chain>
        <x-snc-slux-rv-remediation
          slot="cell-remed"
          .remediation=${intel.record?.remediation}
        ></x-snc-slux-rv-remediation>
        <x-snc-slux-rv-narrative
          slot="cell-story"
          .situation=${intel.otto?.situation}
        ></x-snc-slux-rv-narrative>
      `;
    }
    if (view === VIEW_ACTIVITY) {
      return html`<x-snc-slux-rv-activity
        slot="cell-activity"
      ></x-snc-slux-rv-activity>`;
    }
    if (view === VIEW_RELATED) {
      return html`<x-snc-slux-rv-related-records
        slot="cell-related"
        table=${CASE_TABLE}
        sys-id=${this.loaderData?.sysId || ''}
        .related=${intel?.record?.related}
      ></x-snc-slux-rv-related-records>`;
    }
    // THE RAIL carries what a reader needs first -- state, ownership, SLA
    // health, then who to contact -- and the field groups sit beside it.
    // Both halves are our own markup on one token set, so the two columns
    // read as one surface.
    return html`
      <div slot="cell-contact" class="rv-rail">
        <x-snc-slux-rv-glance
          .row=${this._row}
          table=${CASE_TABLE}
          sys-id=${this.loaderData?.sysId || ''}
        ></x-snc-slux-rv-glance>
        <x-snc-slux-rv-contact
          table="customer_contact"
          sys-id=${cellValue(this._row, 'contact')}
        ></x-snc-slux-rv-contact>
      </div>
      <x-snc-slux-rv-record-fields
        slot="cell-fields"
        .groups=${this.loaderData?.detailGroups}
        .row=${this._row}
        .fieldMeta=${this.loaderData?.fieldMeta}
      ></x-snc-slux-rv-record-fields>
    `;
  }

  // Record links are ANCHORS now, so no card dispatches an open-record
  // request and this page listens for none. _handleOpenRecord below survives
  // only for PLATFORM-initiated opens through the provider's onOpenRecord --
  // a UI action's redirect, for instance -- which have no anchor to offer.

  // A dock finding asked for its target component to be revealed. The page
  // does this, not the dock: the cells are slotted into the shell's shadow
  // root, and the dock cannot query across that boundary -- but the slotted
  // elements are in THIS page's light DOM, so they are reachable from here.
  //
  // All three behaviours SPEC asks for: scroll, highlight, and move focus to
  // the heading. The focus move is the one a keyboard user actually needs.
  _handleFocusComponent = e => {
    if (isServer) return;
    const target = e.detail?.target;
    if (!target) return;

    const element = this.renderRoot?.querySelector(`[slot="cell-${target}"]`);
    if (!element) return;

    element.scrollIntoView({behavior: 'smooth', block: 'center'});

    // The heading lives in the card's own shadow root, so it is reached
    // through that root rather than from here. tabindex -1 makes a
    // non-interactive heading focusable without putting it in the tab order.
    const heading = element.shadowRoot?.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
    }

    // The highlight is a transient attribute the card styles itself. Removed
    // after the ring has served its purpose so it does not persist as a
    // permanent decoration on the card.
    element.setAttribute('data-rv-highlight', 'true');
    window.setTimeout(() => element.removeAttribute('data-rv-highlight'), 1500);
  };

  render() {
    const {sysId, data, error, formView} = this.loaderData || {};
    // Resolved, not raw: a refresh after a UI action or a live update puts
    // newer values here, and every view below reads them.
    const intel = this._intel;

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

    // THE RICHNESS GATE, now with a real payload.
    //
    // IT IS HANDED intel.otto, NOT intel. The gate reads payload.brief and
    // payload.findings -- the shape DATA_CONTRACT section 3 defines for the
    // OTTO namespace. The adapter returns {otto, record, meta}, so passing the
    // whole object would make payload.brief undefined, the gate would answer
    // no-brief forever, and the Intelligent option would never appear while
    // diagnostics and the build stayed green.
    const gate = evaluateRichness({
      configMatched: this._configMatched,
      payload: intel?.otto ?? null,
      payloadState: intel ? PAYLOAD_READY : PAYLOAD_ABSENT
    });
    const options = buildViewOptions({config: null, gate});
    const view = resolveActiveView({current: this._view, options});
    const activeLabel =
      options.find(option => option.id === view)?.label || '';

    // The dock belongs to the Intelligent view only -- on any other view it
    // would be a rail of pointers to components that are not on screen.
    const dock =
      view === VIEW_INTELLIGENT && intel?.otto?.findings?.length
        ? [{key: 'otto'}]
        : [];

    return html`
      <aiux-record-provider
        .data=${data}
        table=${CASE_TABLE}
        sysId=${sysId || ''}
        view=${formView || ''}
        ?ignore-user-view-preference=${Boolean(formView)}
        show-error-details="true"
        .formHandlers=${this._handlers(sysId)}
        .onOpenRecord=${this._handleOpenRecord}
      >
        <x-snc-slux-rv-shell
          .entries=${this._cellsFor(view, intel)}
          .dock=${dock}
          body-label=${activeLabel}
          @rv-view-switch:change=${this._handleViewChange}
          @rv-header-adapter:config=${this._handleConfigResolved}
          @rv:focus-component=${this._handleFocusComponent}
        >
          <div slot="header" class="flex flex-col gap-3">
            <x-snc-slux-rv-header-adapter
              table=${CASE_TABLE}
              .hasOttoPayload=${Boolean(intel)}
              .row=${this._row}
              .breadcrumb=${[
                // NO href. A link needs a destination, and the case LIST page
                // does not exist yet -- "/case" resolved to nothing, so the
                // crumb was a link that went nowhere. It stays as text until
                // that route is built, at which point the href goes back.
                {label: i18n.getMessage('Cases')},
                // THE RECORD NUMBER, not the word "Case". The breadcrumb was
                // the only place that could answer "which record am I on",
                // and it read "Cases / Case" on every record -- the title is
                // the short description, which two related cases here share
                // verbatim, so nothing on screen identified the record.
                // Read from the chain's self node, the one place the page
                // already holds this record's number.
                {
                  label:
                    (intel?.record?.chain || []).find(node => node.current)
                      ?.number || i18n.getMessage('Case')
                }
              ]}
            >
              <!--
                The platform action bar goes INTO the header's actions slot, so
                it renders on the right of the title row. Rendering it as a
                sibling of the adapter stacked the buttons under the title on
                the left. It stays in this page's light DOM, inside the
                provider, so it still resolves the record context.
              -->
              <!--
                PAGE-LEVEL REFRESH. First, so it reads as page chrome rather
                than one of the record's own verbs.
                It exists because the live-update signal fires when the WRITE
                lands, and rows a flow creates afterwards -- dispatch tasks,
                work orders -- do not exist yet at that moment. The read is
                correct and still misses them. Nothing client-side can know
                when that asynchronous work finishes, so the honest answer is
                an explicit control rather than a longer guess at a delay.
              -->
              <x-snc-slux-rv-refresh
                slot="actions"
                table=${CASE_TABLE}
                sys-id=${sysId}
              ></x-snc-slux-rv-refresh>
              <aiux-record-actions slot="actions"></aiux-record-actions>
              <!--
                Context-menu UI actions, which aiux-record-actions does not
                render: it reads formButtonActions only. Approve, Reject and
                Propose Major Case are all form_button 0 with
                form_context_menu 1, so they were absent from the ribbon
                entirely. See framework/record-context-actions.js.
              -->
              <x-snc-slux-rv-context-actions
                slot="actions"
              ></x-snc-slux-rv-context-actions>
            </x-snc-slux-rv-header-adapter>
            <aiux-record-form-messages></aiux-record-form-messages>
          </div>
          <x-snc-slux-rv-view-switch
            slot="switch"
            .views=${options}
            active=${view}
            tablist-label=${i18n.getMessage('Record views')}
          ></x-snc-slux-rv-view-switch>
          ${view === VIEW_INTELLIGENT && intel?.otto?.findings?.length
            ? html`<x-snc-slux-rv-otto-dock
                slot="dock-otto"
                .findings=${intel.otto.findings}
                .suggestions=${intel.otto.suggestions}
              ></x-snc-slux-rv-otto-dock>`
            : nothing}
          ${this._bodyFor(view, intel)}
        </x-snc-slux-rv-shell>
      </aiux-record-provider>
    `;
  }
}
