import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

// The packaged Cytoscape graph. Subpath verified against the umbrella exports
// map, where it is NOT derivable from the directory name -- the directory is
// components/external/node-map but the export key keeps the package's coe
// segment:
//
//   "./aiux-components-coe-node-map": {
//     "import": "./components/external/node-map/index.js"
//   }
//
// cytoscape and cytoscape-dagre are declared dependencies of @servicenow/aiux.
// Importing the package registers every tag it documents, including the
// companion toolbar, search and minimap elements.
import '@servicenow/aiux/aiux-components-coe-node-map';
import {extensions} from '@servicenow/aiux/aiux-components-coe-node-map';

import {rvTokens, rvPrimitives} from './tokens.js';

// THE PIVOT MODEL.
//
// One hub, one ring. Clicking a ring node makes THAT node the hub and replaces
// the ring with its own neighbours -- the previous ring leaves. It does not
// accumulate.
//
// WHY, having first built the additive version: expanding in place grew a web
// that got denser with every click, so by the third expansion from a 50-node
// cloud nothing was legible and the thing you had just clicked was lost in it.
// Replacing the ring keeps exactly one neighbourhood on screen, which is what
// makes a 50-node start workable.
//
// The cost is that two neighbourhoods are never visible at once. The trail
// above the graph is what carries continuity instead, and it is cheap to walk
// back.
//
// ALL DERIVED STATE IS COMPUTED ONCE PER RENDER and cached in _graph. Handlers
// read that cache, never rebuild. Rebuilding to resolve an event was a real
// defect: the component reports an elementId, a fresh build could order or
// include nodes differently from the one on screen, and the lookup then landed
// on a different record -- which is why a second click opened something
// unrelated or nothing at all.

const ICONS = {
  root: 'star',
  account: 'building',
  case: 'document',
  order: 'wrench',
  change: 'sync',
  report: 'shield-check',
  task: 'checklist',
  device: 'hardware'
};

// LAYOUTS. Rings (concentric) was removed, not just demoted: it arranges
// nodes by degree on fixed circles, which for a hub-and-ring graph puts every
// node on one ring at an arbitrary angle -- it told the reader nothing that
// Web does not tell them better. Web is force-directed and is the default;
// Tree is the one that helps when following a single branch.
const LAYOUTS = [
  {id: 'cose', label: 'Web'},
  {id: 'horizontal', label: 'Tree'},
  {id: 'grid', label: 'Grid'}
];

// A ring node offers both: pivot to it, or open it. A click pivots, so opening
// is always deliberate.
const RING_ACTIONS = [
  {id: 'focus', label: 'Explore from here', action: 'focus', icon: 'target'},
  {id: 'open', label: 'Open record', action: 'open', icon: 'arrow-right'}
];

// The hub is already the centre, so it cannot be pivoted to. It can be opened.
const HUB_ACTIONS = [
  {id: 'open', label: 'Open record', action: 'open', icon: 'arrow-right'}
];

@customElement('x-snc-slux-rv-graph-view')
export default class RvGraphView extends AIUXElement {
  static properties = {
    // The centre. Null means the synthetic view hub -- the root listing.
    hub: {attribute: false},
    // [{node, direction, relation}] -- the neighbourhood around the hub.
    ring: {attribute: false},
    // Label for the synthetic hub when there is no record at the centre.
    rootLabel: {attribute: 'root-label'},
    layout: {attribute: 'layout'},
    // The right-click menu: {x, y, nodeId} or null. Position is relative to
    // the map wrapper, not the viewport, so the menu travels with the card.
    _menu: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as class fields: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this.hub = null;
    this.ring = [];
    this.rootLabel = '';
    this.layout = 'cose';
    this._menu = null;
    // Not reactive: derived from the properties above and rewritten on every
    // render, so declaring it as state would loop.
    this._graph = {nodes: [], edges: []};
    // The node under the pointer or Tab focus, tracked so a right-click knows
    // its target. Deliberately NOT reactive -- it changes on every hover and
    // re-rendering the graph on hover would fight the component's own
    // highlight.
    this._hoverNodeId = '';
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-graph-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }

      h2 {
        margin: 0;
      }

      .rv-layouts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .rv-layout-btn {
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

      .rv-layout-btn[aria-pressed='true'] {
        background: var(--rv-action-primary, #0e2b3d);
        border-color: transparent;
        color: var(--rv-action-primary-text, #fff);
      }

      .rv-graph-card {
        padding: 14px 16px;
      }

      /* The positioning context for the right-click menu. The map itself has
         its own shadow root, so the menu cannot live inside it -- it is a
         sibling, placed against this wrapper. */
      .rv-map-wrap {
        position: relative;
      }

      .rv-ctx {
        position: absolute;
        z-index: 40;
        min-inline-size: 13rem;
        margin: 0;
        padding: 6px;
        list-style: none;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-card, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .rv-ctx-item {
        appearance: none;
        -webkit-appearance: none;
        display: block;
        width: 100%;
        min-height: var(--rv-touch-target, 44px);
        box-sizing: border-box;
        padding: 8px 12px;
        border: 0;
        border-radius: var(--rv-radius-control, 8px);
        background: none;
        color: var(--rv-ink-primary, #1b1b19);
        font: inherit;
        text-align: start;
        cursor: pointer;
      }

      .rv-ctx-item:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-hint {
        margin: 8px 0 0;
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-empty-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      @media (forced-colors: active) {
        .rv-layout-btn[aria-pressed='true'] {
          background: Highlight;
          color: HighlightText;
        }
      }
    `
  ];

  // ---- GRAPH CONSTRUCTION ----------------------------------------------
  //
  // Node ids are prefixed by kind so an account and a case can never collide:
  // the component keeps the FIRST of any duplicate id and drops the rest, so a
  // collision would silently lose a node rather than report one.

  _hubNode() {
    const hub = this.hub;
    if (!hub) {
      return {
        id: 'hub:view',
        label: this.rootLabel || i18n.getMessage('My work'),
        sublabel: i18n.getMessage('{count} linked', {
          count: (this.ring || []).length
        }),
        icon: ICONS.root,
        rendererTag: 'aiux-node-map-node-ellipse',
        // No rvSysId: the synthetic hub is not a record, so every handler
        // that gates on it correctly ignores this node.
        rvKind: 'root'
      };
    }

    return {
      id: `${hub.kind}:${hub.sysId}`,
      label: hub.title || hub.sysId,
      sublabel: hub.subtitle || '',
      icon: ICONS[hub.kind] || 'document',
      rendererTag: 'aiux-node-map-node-ellipse',
      actionItems: HUB_ACTIONS,
      rvTable: hub.table,
      rvSysId: hub.sysId,
      rvKind: hub.kind,
      tooltip: hub.subtitle || hub.title
    };
  }

  _buildGraph() {
    const nodes = [];
    const edges = [];
    const seen = new Set();

    const hub = this._hubNode();
    nodes.push(hub);
    seen.add(hub.id);

    for (const link of this.ring || []) {
      const entry = link.node || link;
      if (!entry?.sysId) continue;

      const id = `${entry.kind}:${entry.sysId}`;
      if (seen.has(id)) continue;
      seen.add(id);

      nodes.push({
        id,
        label: entry.title || entry.sysId,
        sublabel:
          entry.childCount != null
            ? i18n.getMessage('{count} cases', {count: entry.childCount})
            : entry.meta?.[0]?.value || '',
        icon: ICONS[entry.kind] || 'document',
        // Status drives the accent colour AND is searchable, so a critical
        // record is findable by typing its state.
        status: entry.tone || undefined,
        actionItems: RING_ACTIONS,
        // Extra fields are kept by the component, returned in its events, and
        // included in its search index, so the record identity rides along
        // rather than being parsed back out of the id.
        rvTable: entry.table,
        rvSysId: entry.sysId,
        rvKind: entry.kind,
        tooltip: entry.subtitle || entry.title
      });

      // DIRECTION IS THE POINT. An upstream neighbour points INTO the hub, a
      // downstream one points OUT of it, so the arrow says which way the
      // relationship runs rather than merely that it exists.
      const up = link.direction === 'up';
      edges.push({
        id: `e:${up ? 'up' : 'down'}:${entry.kind}:${entry.sysId}`,
        source: up ? id : hub.id,
        target: up ? hub.id : id,
        label: link.relation || '',
        lineStyle: up ? 'dotted' : 'solid'
      });
    }

    return {nodes, edges};
  }

  // ---- EVENTS ----------------------------------------------------------
  //
  // Both handlers resolve against the CACHED graph, never a rebuild.

  _nodeById(elementId) {
    return this._graph.nodes.find(n => n.id === elementId) || null;
  }

  _emit(type, node) {
    if (!node?.rvSysId) return;
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: {
          table: node.rvTable,
          sysId: node.rvSysId,
          kind: node.rvKind,
          title: node.label
        },
        bubbles: true,
        composed: true
      })
    );
  }

  // A CLICK PIVOTS. It never opens the record -- that is the Open record item
  // on the node's own menu. Clicking the hub does nothing, because it is
  // already the centre.
  _handleNodeClick = e => {
    const node = e.detail?.node;
    if (!node?.rvSysId) return;
    if (this.hub && node.rvSysId === this.hub.sysId) return;
    this._emit('rv-graph:focus', node);
  };

  _handleContextAction = e => {
    const {item, elementId} = e.detail || {};
    if (!item || !elementId) return;
    const node = this._nodeById(elementId);
    if (!node) return;
    this._emit(
      item.action === 'focus' ? 'rv-graph:focus' : 'rv-graph:open',
      node
    );
  };

  // ---- RIGHT-CLICK MENU ------------------------------------------------
  //
  // The packaged component has NO right-click support: its menu opens from a
  // chevron beside a hovered node, and its event list has no contextmenu
  // entry. A packaged component cannot be edited, so the menu is built here
  // from two of its documented events.
  //
  // node-focused is the tracker, chosen over node-mouseover deliberately: the
  // reference says node-mouseover is "not fired by keyboard focus", while
  // node-focused fires "with every node-mouseover, AND when Tab selects a
  // node". So tracking focus covers pointer and keyboard with one listener --
  // which matters because the contextmenu event is also raised by the
  // context-menu key and Shift+F10, so keyboard users get the same menu.
  //
  // THE CHEVRON IS KEPT. It is the touch path -- the reference notes that on
  // touch devices tapping a node shows its chevron -- and right-click has no
  // touch equivalent. Removing it would trade one inconvenience for an
  // unusable surface on tablets.

  _handleNodeFocused = e => {
    const node = e.detail?.node;
    this._hoverNodeId = node?.id || '';
  };

  _handleNodeUnfocused = () => {
    this._hoverNodeId = '';
  };

  _handleContextMenu = e => {
    const nodeId = this._hoverNodeId;
    const node = nodeId ? this._nodeById(nodeId) : null;

    // No node under the pointer: let the browser's own menu open. Suppressing
    // it on empty canvas would remove zoom, back and inspect for no gain.
    if (!node?.rvSysId) {
      this._menu = null;
      return;
    }

    e.preventDefault();

    // Positioned against the wrapper, so the menu stays put when the card
    // scrolls. The keyboard context-menu key reports 0,0 on some browsers --
    // falling back to the node's own position is not available here, so the
    // menu lands at the wrapper origin, which is still reachable.
    const rect = this.renderRoot
      ?.querySelector('.rv-map-wrap')
      ?.getBoundingClientRect();
    this._menu = {
      nodeId,
      x: rect ? Math.max(0, e.clientX - rect.left) : 0,
      y: rect ? Math.max(0, e.clientY - rect.top) : 0
    };
  };

  _closeMenu(refocus) {
    if (!this._menu) return;
    this._menu = null;
    if (refocus) {
      this.renderRoot?.querySelector('aiux-node-map')?.focus?.();
    }
  }

  // Bound only while the menu is open, and removed on close and on disconnect:
  // a document listener that outlives the component fires against a detached
  // tree.
  _onDocumentPointer = e => {
    if (e.composedPath?.().includes(this)) return;
    this._closeMenu(false);
  };

  _onDocumentKey = e => {
    if (e.key === 'Escape') this._closeMenu(true);
  };

  _bindDismiss(on) {
    if (typeof document === 'undefined') return;
    const fn = on ? 'addEventListener' : 'removeEventListener';
    document[fn]('pointerdown', this._onDocumentPointer, true);
    document[fn]('keydown', this._onDocumentKey, true);
  }

  updated() {
    this._bindDismiss(Boolean(this._menu));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._bindDismiss(false);
  }

  _runMenuAction(action) {
    const node = this._nodeById(this._menu?.nodeId);
    this._closeMenu(true);
    if (!node) return;
    this._emit(
      action === 'focus' ? 'rv-graph:focus' : 'rv-graph:open',
      node
    );
  }

  _renderMenu() {
    const menu = this._menu;
    if (!menu) return nothing;
    const node = this._nodeById(menu.nodeId);
    if (!node) return nothing;

    return html`
      <ul
        class="rv-ctx"
        role="menu"
        style="left:${menu.x}px; top:${menu.y}px"
        aria-label=${i18n.getMessage('Actions for {name}', {
          name: node.label || ''
        })}
      >
        <li role="none">
          <button
            type="button"
            class="rv-ctx-item"
            role="menuitem"
            @click=${() => this._runMenuAction('focus')}
          >
            ${i18n.getMessage('Explore from here')}
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            class="rv-ctx-item"
            role="menuitem"
            @click=${() => this._runMenuAction('open')}
          >
            ${i18n.getMessage('Open record')}
          </button>
        </li>
      </ul>
    `;
  }

  render() {
    // Built once, cached for the handlers above.
    this._graph = this._buildGraph();
    const {nodes, edges} = this._graph;

    // One node means the hub alone: a record with no neighbours under the
    // current filters.
    if (nodes.length <= 1 && !this.hub) {
      return html`
        <section class="rv-card" role="status">
          <p class="rv-hint rv-type-body">
            ${i18n.getMessage('Nothing matches the current filters.')}
          </p>
          <div class="rv-empty-actions">
            <button
              type="button"
              class="rv-layout-btn rv-focusable"
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('rv-graph:clear-filters', {
                    bubbles: true,
                    composed: true
                  })
                )}
            >
              ${i18n.getMessage('Clear filters')}
            </button>
          </div>
        </section>
      `;
    }

    return html`
      <section class="rv-card rv-graph-card" aria-labelledby="rv-graph-h">
        <div class="rv-graph-head">
          <h2 id="rv-graph-h" class="rv-type-section">
            ${this.hub
              ? i18n.getMessage('Around {name}', {name: this.hub.title || ''})
              : i18n.getMessage('Map')}
          </h2>
          <div
            class="rv-layouts"
            role="group"
            aria-label=${i18n.getMessage('Choose the graph layout')}
          >
            ${LAYOUTS.map(
              entry => html`
                <button
                  type="button"
                  class="rv-layout-btn rv-focusable"
                  aria-pressed=${entry.id === this.layout ? 'true' : 'false'}
                  @click=${() => {
                    this.layout = entry.id;
                  }}
                >
                  ${i18n.getMessage(entry.label)}
                </button>
              `
            )}
          </div>
        </div>

        <div class="rv-map-wrap" @contextmenu=${this._handleContextMenu}>
          <aiux-node-map
            .nodes=${nodes}
            .edges=${edges}
            layout=${this.layout}
            height="min(70vh, 720px)"
            edge-type="curved"
            popover-trigger="click"
            .renderPopoverContent=${node => html`
              <div class="flex flex-col gap-1">
                <span class="font-semibold">${node.label}</span>
                ${node.sublabel
                  ? html`<span class="text-sm">${node.sublabel}</span>`
                  : nothing}
              </div>
            `}
            @aiux-node-map:node-click=${this._handleNodeClick}
            @aiux-node-map:context-action=${this._handleContextAction}
            @aiux-node-map:node-focused=${this._handleNodeFocused}
            @aiux-node-map:node-unfocused=${this._handleNodeUnfocused}
          >
            <div slot="top-start">${extensions.search()}</div>
            <div slot="top-end">${extensions.toolbar()}</div>
            <div slot="bottom-end">${extensions.minimap()}</div>
          </aiux-node-map>

          ${this._renderMenu()}
        </div>

        <p class="rv-hint rv-type-caption">
          ${i18n.getMessage(
            'Click a node to explore from it, or right-click for its actions. Drag to move, Ctrl and scroll to zoom, Tab to step through.'
          )}
        </p>
      </section>
    `;
  }
}
