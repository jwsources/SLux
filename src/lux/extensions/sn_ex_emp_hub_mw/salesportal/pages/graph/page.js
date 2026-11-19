import {html, css, isServer, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import '../../framework/page-shell.js';
import '../../framework/graph-view.js';
import '../../framework/graph-filters.js';
import {rvTokens, rvPrimitives} from '../../framework/tokens.js';
import {recordHref} from '../../framework/record-href.js';
import {
  DEFAULT_FILTERS,
  buildGraph,
  expandNode
} from '../../framework/loaders/graph-data.js';
import {
  applySeamlessChrome,
  releaseSeamlessChrome
} from '../../shared/host-chrome.js';

// THE NAVIGATION GRAPH -- the portal entry point for this app.
//
// Registered as a menu item (src/fluent/menu-items.now.ts), which is what makes
// the host treat it as a destination rather than a deep page: no back chrome,
// full width.
//
// THE PIVOT MODEL. One hub with one ring of neighbours. Clicking a ring node
// makes it the hub and replaces the ring with ITS neighbours; the previous ring
// leaves. A trail across the top records where you have been and walks back.
//
// WHY state is this small. The previous version kept an expanded Set and a
// links Map alongside the root id and the filters, and built the graph by
// walking them recursively. Three defects came out of that interaction:
// switching root appeared to do nothing on the second attempt, a second click
// opened an unrelated record, and the web grew unreadable. Each was a symptom
// of derived state that could disagree with what was on screen.
//
// Now there is exactly one source of truth per concern -- focus, ring, trail --
// and the graph is a pure function of them.

@customElement('x-snc-slux-graph-page')
export default class GraphPage extends AIUXElement {
  static properties = {
    _rootId: {state: true},
    _filters: {state: true},
    _roots: {state: true},
    // The record at the centre, or null for the root listing.
    _focus: {state: true},
    // [{node, direction, relation}] around the focused record.
    _ring: {state: true},
    // Where we have been, most recent last. Each entry is a focus descriptor.
    _trail: {state: true},
    _busy: {state: true}
  };

  constructor() {
    super();
    // Assigned here, not as class fields: a class field initializer shadows
    // the accessor Lit generates from static properties and silences
    // reactivity.
    this._rootId = '';
    this._filters = {...DEFAULT_FILTERS};
    this._roots = null;
    this._focus = null;
    this._ring = [];
    this._trail = [];
    this._busy = false;
    // Plain field, not reactive: a pending debounce is not render state.
    this._searchTimer = null;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
        height: 100%;
      }

      h1 {
        margin: 0;
      }

      .rv-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px 18px;
        padding-bottom: 12px;
      }

      .rv-roots {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .rv-root {
        appearance: none;
        -webkit-appearance: none;
        min-height: var(--rv-touch-target, 44px);
        padding: 6px 14px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-secondary, #3f3e3a);
        font: inherit;
        font-size: var(--rv-size-label, 12px);
        cursor: pointer;
      }

      .rv-root[aria-pressed='true'] {
        background: var(--rv-action-primary, #0e2b3d);
        border-color: transparent;
        color: var(--rv-action-primary-text, #fff);
      }

      /* THE TRAIL. A real nav/ol so it is announced as a breadcrumb, with the
         current position marked aria-current rather than only styled. */
      .rv-trail {
        margin: 0 0 10px;
      }

      .rv-trail ol {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .rv-crumb {
        appearance: none;
        -webkit-appearance: none;
        min-height: var(--rv-touch-target, 44px);
        padding: 4px 10px;
        border: 0;
        border-radius: var(--rv-radius-control, 8px);
        background: none;
        color: var(--rv-action-link, #1f5f8b);
        font: inherit;
        font-size: var(--rv-size-label, 12px);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }

      .rv-crumb-current {
        padding: 4px 10px;
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-sep {
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-note {
        margin: 0;
        color: var(--rv-ink-muted, #5b5a55);
      }

      @media (forced-colors: active) {
        .rv-root[aria-pressed='true'] {
          background: Highlight;
          color: HighlightText;
        }
      }
    `
  ];

  static async loader(ctx) {
    const graph = await buildGraph(ctx, DEFAULT_FILTERS);
    return {graph};
  }

  firstUpdated() {
    if (!isServer) {
      document.title = i18n.getMessage('Accounts and cases');
      applySeamlessChrome();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // A pending debounce would otherwise fire a query against a detached
    // component.
    if (this._searchTimer) clearTimeout(this._searchTimer);
    releaseSeamlessChrome();
  }

  get _graph() {
    return this._roots ?? this.loaderData?.graph ?? null;
  }

  get _activeRoot() {
    const graph = this._graph;
    if (!graph) return null;
    const id = this._rootId || graph.activeRootId;
    return graph.roots.find(root => root.id === id) || graph.roots[0] || null;
  }

  // The ring currently on screen. At the root there is no focused record, so
  // the ring is the root's own nodes -- all downstream of the view hub.
  get _currentRing() {
    if (this._focus) return this._ring;
    const root = this._activeRoot;
    return (root?.nodes || []).map(node => ({
      node,
      direction: 'down',
      relation: ''
    }));
  }

  // ---- PIVOTING --------------------------------------------------------

  async _focusOn(descriptor, pushTrail) {
    if (!descriptor?.sysId || !descriptor?.table) return;

    if (pushTrail) {
      // The hub we are leaving becomes the previous crumb. The root listing is
      // represented by the absence of a first entry, so it needs no crumb of
      // its own.
      this._trail = this._focus ? [...this._trail, this._focus] : [];
    }

    this._focus = descriptor;
    this._ring = [];
    this._busy = true;
    try {
      this._ring = await expandNode(
        null,
        descriptor.table,
        descriptor.sysId,
        this._filters
      );
    } finally {
      this._busy = false;
    }
  }

  _handleFocus = e => {
    this._focusOn(e.detail, true);
  };

  // A click on the graph reports open only from a node menu; the page owns
  // navigation. recordHref sends a case to its own page and anything else to
  // the catch-all, which resolves the real class and hands off if that class
  // has its own route.
  _handleOpen = e => {
    const {table, sysId} = e.detail || {};
    if (!table || !sysId || isServer) return;
    const href = recordHref(table, sysId);
    if (!href) return;
    // pushState then popstate: the router's own no-push navigation path, so
    // this is a client-side route change and Back returns to the graph.
    window.history.pushState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Walking back to a crumb drops everything after it. Index -1 is the root
  // listing.
  async _goToCrumb(index) {
    if (index < 0) {
      this._trail = [];
      this._focus = null;
      this._ring = [];
      return;
    }
    const target = this._trail[index];
    this._trail = this._trail.slice(0, index);
    await this._focusOn(target, false);
  }

  // ---- ROOT AND FILTERS ------------------------------------------------
  //
  // Both reset the pivot. A root or filter change replaces the node set the
  // graph is drawn from, so a focus and ring fetched under the previous one
  // describe records that may no longer be in scope -- which is how switching
  // root appeared to do nothing: the stale pivot kept rendering.

  _selectRoot(id) {
    if (!id || id === this._activeRoot?.id) return;
    this._rootId = id;
    this._focus = null;
    this._ring = [];
    this._trail = [];
  }

  // Search, timeframe, state, priority, account and sort all live in the
  // filter panel now, which owns its own debounce. The page only applies the
  // patch it emits.
  _clearFilters() {
    this._applyFilters({...DEFAULT_FILTERS});
  }

  async _applyFilters(patch) {
    this._filters = {...this._filters, ...patch};
    if (isServer) return;
    this._busy = true;
    try {
      const graph = await buildGraph(null, this._filters);
      this._roots = graph;
      this._focus = null;
      this._ring = [];
      this._trail = [];
    } finally {
      this._busy = false;
    }
  }

  // ---- RENDER ----------------------------------------------------------

  _renderTrail() {
    if (!this._focus) return nothing;

    return html`
      <nav class="rv-trail" aria-label=${i18n.getMessage('Exploration trail')}>
        <ol>
          <li>
            <button
              type="button"
              class="rv-crumb rv-focusable"
              @click=${() => this._goToCrumb(-1)}
            >
              ${this._activeRoot?.label
                ? i18n.getMessage(this._activeRoot.label)
                : i18n.getMessage('Start')}
            </button>
          </li>
          ${this._trail.map(
            (crumb, index) => html`
              <li>
                <span class="rv-sep" aria-hidden="true">&#8250;</span>
                <button
                  type="button"
                  class="rv-crumb rv-focusable"
                  @click=${() => this._goToCrumb(index)}
                >
                  ${crumb.title || crumb.sysId}
                </button>
              </li>
            `
          )}
          <li>
            <span class="rv-sep" aria-hidden="true">&#8250;</span>
            <span class="rv-crumb-current" aria-current="page">
              ${this._focus.title || this._focus.sysId}
            </span>
          </li>
        </ol>
      </nav>
    `;
  }

  _renderFilters() {
    const graph = this._graph;
    return html`
      <x-snc-slux-rv-graph-filters
        slot="dock-filters"
        .filters=${this._filters}
        .facets=${graph?.facets}
        .busy=${this._busy}
        .truncated=${Boolean(graph?.truncated)}
        @rv-filters:change=${e => this._applyFilters(e.detail)}
        @rv-filters:reset=${() => this._applyFilters({...DEFAULT_FILTERS})}
      ></x-snc-slux-rv-graph-filters>
    `;
  }

  render() {
    const graph = this._graph;
    const root = this._activeRoot;

    return html`
      <x-snc-slux-rv-shell
        .entries=${[{key: 'graph', span: 12}]}
        .dock=${[{key: 'filters'}]}
        body-label=${root?.label || i18n.getMessage('Accounts and cases')}
      >
        <div slot="header">
          <div class="rv-head">
            <h1 class="rv-type-title">
              ${i18n.getMessage('Accounts and cases')}
            </h1>
            <div
              class="rv-roots"
              role="group"
              aria-label=${i18n.getMessage('Choose what to show')}
            >
              ${(graph?.roots || []).map(
                entry => html`
                  <button
                    type="button"
                    class="rv-root rv-focusable"
                    aria-pressed=${entry.id === root?.id ? 'true' : 'false'}
                    @click=${() => this._selectRoot(entry.id)}
                  >
                    ${i18n.getMessage(entry.label)} (${entry.count})
                  </button>
                `
              )}
            </div>
          </div>
        </div>

        ${this._renderFilters()}

        <div slot="cell-graph">
          ${this._renderTrail()}
          <x-snc-slux-rv-graph-view
            .hub=${this._focus}
            .ring=${this._currentRing}
            root-label=${root?.label || ''}
            @rv-graph:focus=${this._handleFocus}
            @rv-graph:open=${this._handleOpen}
            @rv-graph:clear-filters=${() => this._clearFilters()}
          ></x-snc-slux-rv-graph-view>
        </div>
      </x-snc-slux-rv-shell>
    `;
  }
}
