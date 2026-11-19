import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';

import {rvPrimitives, rvTokens} from './tokens.js';

// PageShell -- SPEC section 2 and 6. The page framework: header, switch, a
// 12-column grid, and the dock column.
//
// NOTHING IN THIS FILE NAMES A TABLE, A FIELD OR A RECORD. It knows about
// spans, gaps, columns and breakpoints and nothing else. That is ACCEPTANCE's
// first criterion, and it is what lets steps 3 to 6 drop entirely different
// bodies into the same frame.
//
// ---------------------------------------------------------------------------
// WHY SLOTS, AND WHY THE CELL WRAPPER IS THE GRID ITEM
// ---------------------------------------------------------------------------
// Every region is a named slot, and the shell owns only the wrapper around
// each one. Two constraints force this, and together they make it the only
// correct arrangement:
//
// 1. RECORD CONTEXT. The occupants of these cells are record-aware elements
//    extending AIUXRecordElement, which resolve aiux-record-provider through
//    context. Keeping them in the PAGE's light DOM keeps them where the page
//    author put them -- inside the provider, in the page's own styling scope.
//    Rendering them into this shadow root instead would rely on context
//    requests crossing a shadow boundary, which is an extra assumption this
//    layout has no reason to take on.
//
// 2. GRID PLACEMENT. A shell cannot style slotted content, so the shell could
//    not put a span on the occupant itself. It does not need to: the wrapper
//    div below is the grid item, it lives in this shadow root, and the slotted
//    occupant simply fills it. Styling the thing we own and distributing the
//    thing we do not is what makes the grid work at all.
//
// A cell is rendered for every entry in the entries list, whether or not
// anything is slotted into it, so callers must list exactly the cells they
// fill. Both lists are built from the same layout config, so they cannot
// disagree.
//
// ---------------------------------------------------------------------------
// PROPS
// ---------------------------------------------------------------------------
//   entries   [{key, span}] -- one cell each, slot name "cell-<key>",
//                              span 1..12 and clamped
//   dock      [{key}]       -- one block each, slot name "dock-<key>"
//   bodyLabel accessible name for the view region (see below)
//
// Fixed slots: "header" and "switch".
//
// ---------------------------------------------------------------------------
// WHY THE BODY IS LABELLED WITH aria-label AND NOT aria-labelledby
// ---------------------------------------------------------------------------
// The view region is role=tabpanel, but the tabs that control it live in the
// ViewSwitch's shadow root. An IDREF cannot cross a shadow boundary, so
// aria-labelledby pointing at a tab, or a tab's aria-controls pointing here,
// would both be dangling references. The accessibility skill's documented
// remedy for cross-boundary labelling is aria-label, so the active view's name
// is passed in as bodyLabel and set directly.

// Clamp to the 12-column grid. A config that asks for 0, 19 or "six" gets 12
// rather than a cell that silently collapses to one column.
export function clampSpan(span) {
  const value = Number(span);
  if (!Number.isFinite(value)) return 12;
  return Math.min(12, Math.max(1, Math.round(value)));
}

@customElement('x-snc-slux-rv-shell')
export default class RvPageShell extends AIUXElement {
  static properties = {
    entries: {attribute: false},
    dock: {attribute: false},
    bodyLabel: {attribute: 'body-label'}
  };

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
        /* THE HOST'S OWN PAGE SURFACE.
           The experience treats a custom page as foreign and wraps it in its
           own chrome box with a back button -- we get that for free and must
           not nest a second box inside it. But that wrapper renders white,
           while the host's own pages carry the tinted surface that matches the
           navigation. --rv-surface-page resolves to the host shell's
           --theme-background; see tokens.js for the source it was read from
           and why --color-base-200 is the wrong variable here. */
        background: var(--rv-surface-page, transparent);
        color: var(--rv-ink-primary, #1b1b19);
        font-family: var(--rv-font-ui, 'ServiceNow Sans', system-ui, sans-serif);
        font-size: var(--rv-size-body, 14px);
        /* container-type is NOT set. The breakpoints below are viewport
           breakpoints because SPEC section 6 specifies them against the
           viewport, and a container query here would silently retune every
           one of them to this element's own width. */
      }

      /* PAGE BOX. Vertical rhythm only -- no horizontal padding, because the
         host already applies the gutter to its page element
         (uex-page { padding-inline: calc(var(--spacing) * 4) }), so adding our
         own produced a double gutter and stopped the header reaching full
         width.
         The bottom padding is OMNIBAR CLEARANCE, not decoration: the host pins
         its chat omnibar to the viewport bottom with position: fixed, so
         without this the last card sits underneath it and its data cannot be
         read or clicked. See --rv-omnibar-clearance in tokens.js for where the
         value comes from. */
      .rv-page {
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 14px);
        padding: 0 0 var(--rv-omnibar-clearance, 7.5rem);
        max-width: 100%;
        box-sizing: border-box;
      }

      .rv-chrome {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* LAYOUT. Below 1100px this is a column: grid first, dock after it, in
         source order -- the reflow guide requires stacking in source order,
         and the dock is secondary content, so it belongs last. */
      .rv-layout {
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 18px);
        align-items: stretch;
      }

      .rv-main {
        min-width: 0;
        flex: 1 1 auto;
      }

      .rv-dock {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 18px);
        /* No height and no overflow. The reflow guide forbids a nested
           vertical scroll region, so the dock grows with the page and the page
           is the only thing that scrolls. */
      }

      /* THE 12-COLUMN GRID.
         Single column by default, so below 720px every component occupies the
         full width, which is SPEC section 6's rule. 12 columns from 720px up.
         minmax(0, 1fr) rather than 1fr so a wide child -- a table, a long
         unbroken string -- cannot force a track wider than its share and push
         the grid past the viewport. */
      .rv-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-flow: row;
        grid-auto-rows: auto;
        gap: var(--rv-grid-gap, 18px);
      }

      .rv-cell {
        min-width: 0;
        /* Cells align to the top of their row rather than stretching, so a
           short card beside a tall one keeps its natural height. */
        align-self: start;
      }

      /* 720px -- BREAKPOINT_SINGLE_COLUMN in tokens.js. */
      @media (min-width: 720px) {
        .rv-grid {
          grid-template-columns: repeat(12, minmax(0, 1fr));
        }

        /* The span arrives as an inline --rv-span on the cell. The fallback is
           12, so a cell whose property failed to set occupies a full row
           instead of collapsing to one column. */
        .rv-cell {
          grid-column: span var(--rv-span, 12);
        }
      }

      /* 1100px -- BREAKPOINT_DOCK_WRAPS in tokens.js. Above it the grid and the
         dock sit side by side; below it the dock has already wrapped under the
         grid by virtue of the column direction being the default. */
      @media (min-width: 1100px) {
        .rv-layout {
          flex-direction: row;
          align-items: flex-start;
        }

        /* 300px to 380px, from tokens.json grid.dockMin and grid.dockMax.
           clamp keeps it inside that band at every width above the breakpoint
           rather than pinning it to one end. */
        .rv-dock {
          flex: 0 0
            clamp(
              var(--rv-dock-min, 300px),
              24%,
              var(--rv-dock-max, 380px)
            );
          max-width: var(--rv-dock-max, 380px);
        }
      }

      @media (forced-colors: active) {
        :host {
          background: Canvas;
          color: CanvasText;
        }
      }
    `
  ];

  constructor() {
    super();
    this.entries = [];
    this.dock = [];
    this.bodyLabel = '';
  }

  _renderGrid() {
    const entries = Array.isArray(this.entries) ? this.entries : [];
    const visible = entries.filter(entry => entry && entry.key);
    if (!visible.length) return nothing;

    return html`
      <div class="rv-grid">
        ${visible.map(
          entry => html`
            <div
              class="rv-cell"
              data-cell=${entry.key}
              style="--rv-span:${clampSpan(entry.span)}"
            >
              <slot name="cell-${entry.key}"></slot>
            </div>
          `
        )}
      </div>
    `;
  }

  _renderDock() {
    const dock = Array.isArray(this.dock) ? this.dock : [];
    const visible = dock.filter(entry => entry && entry.key);
    if (!visible.length) return nothing;

    return html`
      <div class="rv-dock" data-region="dock">
        ${visible.map(
          entry => html`<slot name="dock-${entry.key}"></slot>`
        )}
      </div>
    `;
  }

  render() {
    return html`
      <div class="rv-page">
        <div class="rv-chrome">
          <slot name="header"></slot>
          <slot name="switch"></slot>
        </div>
        <div class="rv-layout">
          <div
            class="rv-main"
            role="tabpanel"
            aria-label=${this.bodyLabel || nothing}
          >
            ${this._renderGrid()}
          </div>
          ${this._renderDock()}
        </div>
      </div>
    `;
  }
}
