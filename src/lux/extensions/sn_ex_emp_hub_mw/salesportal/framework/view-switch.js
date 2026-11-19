import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvPrimitives, rvTokens} from './tokens.js';

// ViewSwitch -- SPEC section 2, slot "switch". A pill segmented control over
// the four views, identical on every view.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT aiux-tab-group
// ---------------------------------------------------------------------------
// aiux-tab-group was the first candidate and its reference was read in full
// (ui-discovery references/components/aiux-tab-group.md). It owns the complete
// APG tabs pattern and would have been the right answer. Four findings in its
// published contract make it unable to express this control:
//
// 1. NO PER-TAB LOADING AFFORDANCE. SPEC section 4 requires a skeleton on the
//    Intelligent option while the Otto payload loads. A Tab's label is typed
//    string, not TemplateResult, and the only other per-tab visual input is
//    iconStart / iconEnd, which take an icon name. There is nowhere to put a
//    skeleton, and nothing in the element announces a tab as busy.
//
// 2. NO HIDE, ONLY DISABLE. Tab has disabled, but the richness gate must
//    REMOVE the Intelligent option when no config or no payload matches
//    (SPEC section 4: hide that option), not present a permanently dead
//    control. Filtering the array instead would work, but combined with (1)
//    there is no way to distinguish "loading, will appear" from "absent".
//
// 3. THE PALETTE IS NOT OURS TO SET. Its reference states tab colours come
//    from the DaisyUI theme, which resolves to the instance theme, not this
//    design's cream palette. variant is limited to boxed / bordered / lifted;
//    a pill segmented control is not among them, and the element exposes only
//    three CSS custom properties, all for panel transitions.
//
// 4. variant, size and stretch ARE ADMIN-CONFIGURABLE, and its reference says
//    an instance config value overrides what the host sets. The appearance of
//    this control would not be ours to guarantee.
//
// Separately, the views swap whole page bodies rather than tab panels, so the
// built-in panel feature is unwanted: content rendered inside tab-group's
// shadow root cannot be styled by the page, which has already caused one
// silent layout failure in this app.
//
// So this is a hand-built tablist implementing the full APG tabs pattern:
// tablist / tab roles, aria-selected, roving tabindex, arrow keys with wrap,
// Home and End, and manual activation.
//
// ---------------------------------------------------------------------------
// TWO DELIBERATE APG DEVIATIONS, BOTH FORCED AND BOTH DOCUMENTED
// ---------------------------------------------------------------------------
// aria-controls / aria-labelledby ARE OMITTED. The tabs live in this shadow
// root and the view body lives in the shell's. ID-based ARIA references do not
// cross a shadow boundary, so an aria-controls IDREF here would point at
// nothing -- worse than absent, because it reads as a broken reference. The
// accessibility skill's documented remedy is aria-label, so the shell labels
// its own role=tabpanel region with the active view's name instead. That keeps
// the relationship discoverable without a dangling IDREF.
//
// MANUAL ACTIVATION. Arrow keys move focus only; Enter or Space activates. APG
// prescribes manual activation when revealing a panel is expensive, and each
// view here is a whole page body with its own data resources.

// Default view order. SPEC section 1 and 3. Labels are localised by the
// caller; the ids are the stable contract between the switch, the shell and
// the richness gate, and they live in views.js so that a pure module can
// import them without pulling in this element definition. Re-exported here
// for callers that already import the switch.
export {
  ALL_VIEWS,
  VIEW_ACTIVITY,
  VIEW_DETAILS,
  VIEW_INTELLIGENT,
  VIEW_RELATED
} from './views.js';

@customElement('x-snc-slux-rv-view-switch')
export default class RvViewSwitch extends AIUXElement {
  static properties = {
    // [{id, label, available, pending}]
    //   available true  -> selectable
    //   pending   true  -> rendered, not selectable, skeleton shown
    //   neither         -> not rendered at all
    views: {attribute: false},
    active: {attribute: 'active'},
    tablistLabel: {attribute: 'tablist-label'},
    _focusId: {state: true},
    _announcement: {state: true}
  };

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-switch {
        display: inline-flex;
        /* flex-wrap, not overflow-x. The reflow guide forbids horizontal
           scrolling inside navigation; at 320px the four pills wrap onto
           further lines instead, which loses nothing. */
        flex-wrap: wrap;
        gap: 4px;
        padding: 4px;
        background: var(--rv-surface-control, #dad8d2);
        border-radius: var(--rv-radius-pill, 999px);
        max-width: 100%;
      }

      .rv-view {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: var(--rv-touch-target, 44px);
        padding: 0 20px;
        border: 1px solid transparent;
        border-radius: var(--rv-radius-pill, 999px);
        background: transparent;
        color: var(--rv-ink-secondary, #3f3e3a);
        font-family: var(--rv-font-ui, Inter, system-ui, sans-serif);
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-medium, 500);
        cursor: pointer;
        white-space: nowrap;
      }

      .rv-view:hover:not([aria-disabled='true']) {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      /* SELECTED. Carries a solid fill AND a weight change, so selection is
         not signalled by colour alone (WCAG 1.4.1). aria-selected is the
         single source of truth for the styling, which means the visual state
         and the announced state cannot drift apart. */
      .rv-view[aria-selected='true'] {
        background: var(--rv-surface-card, #ffffff);
        color: var(--rv-ink-primary, #1b1b19);
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-view[aria-disabled='true'] {
        cursor: default;
        color: var(--rv-ink-muted, #5b5a55);
      }

      /* The skeleton on a pending option. Sized to a word so the pill does not
         change width when the real label resolves. */
      .rv-pending-bar {
        width: 3.5rem;
        height: 10px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-hairline, #e5e3dd);
      }

      .rv-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (forced-colors: active) {
        .rv-switch {
          background: Canvas;
          border: 1px solid CanvasText;
        }

        .rv-view {
          forced-color-adjust: none;
          background-color: ButtonFace;
          color: ButtonText;
          border: 2px solid ButtonBorder;
        }

        .rv-view:hover:not([aria-disabled='true']) {
          background-color: Highlight;
          color: HighlightText;
          border-color: Highlight;
        }

        /* Persistent selection takes SelectedItem, never Highlight -- Highlight
           is reserved for pointer and keyboard cursor position. */
        .rv-view[aria-selected='true'] {
          background-color: SelectedItem;
          color: SelectedItemText;
          border-color: ButtonBorder;
        }

        .rv-view[aria-selected='true']:focus-visible {
          outline: 2px solid Highlight;
          outline-offset: 2px;
        }

        .rv-view[aria-disabled='true'] {
          background-color: ButtonFace;
          color: GrayText;
          border-color: GrayText;
        }

        .rv-pending-bar {
          background: GrayText;
        }
      }
    `
  ];

  constructor() {
    super();
    this.views = [];
    this.active = '';
    this.tablistLabel = '';
    this._focusId = '';
    this._announcement = '';
  }

  // The options that actually render: available or pending. An option that is
  // neither is absent from the DOM, which is what "hide the option" means.
  get _rendered() {
    const views = Array.isArray(this.views) ? this.views : [];
    return views.filter(
      view => view && view.id && (view.available === true || view.pending === true)
    );
  }

  // Arrow keys and activation only ever reach an available option.
  get _selectable() {
    return this._rendered.filter(view => view.available === true);
  }

  _isPending(view) {
    return view.available !== true && view.pending === true;
  }

  // Which option owns tabindex=0. APG: the tablist is a single tab stop.
  get _rovingId() {
    const rendered = this._rendered;
    if (!rendered.length) return '';
    const candidates = [this._focusId, this.active];
    for (const id of candidates) {
      if (id && rendered.some(view => view.id === id)) return id;
    }
    return rendered[0].id;
  }

  _select(id) {
    const view = this._selectable.find(item => item.id === id);
    if (!view || id === this.active) return;
    const previousId = this.active;
    this._focusId = id;
    this.dispatchEvent(
      new CustomEvent('rv-view-switch:change', {
        detail: {id, previousId, label: view.label},
        bubbles: true,
        composed: true
      })
    );
  }

  _focusById(id) {
    this._focusId = id;
    // updateComplete, not a raw query: the roving tabindex only moves after
    // the re-render, and focusing an element that still has tabindex=-1 works
    // but leaves the DOM and the state briefly disagreeing.
    this.updateComplete.then(() => {
      const next = this.renderRoot?.querySelector(
        '[data-view-id="' + id + '"]'
      );
      if (next) next.focus();
    });
  }

  _onClick = e => {
    const id = e.currentTarget?.dataset?.viewId;
    if (id) this._select(id);
  };

  _onKeydown = e => {
    // Arrow keys traverse every RENDERED option, including a pending one, so a
    // keyboard user can land on the Intelligent option and hear that it is
    // busy rather than never learning it exists. Activation is then refused by
    // _select, which only accepts an available option.
    const rendered = this._rendered;
    if (!rendered.length) return;

    const currentId = this._rovingId;
    const currentIndex = rendered.findIndex(view => view.id === currentId);
    let nextIndex = -1;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % rendered.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + rendered.length) % rendered.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = rendered.length - 1;
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        this._select(currentId);
        return;
      default:
        return;
    }

    e.preventDefault();
    this._focusById(rendered[nextIndex].id);
  };

  updated(changed) {
    super.updated?.(changed);
    if (!changed.has('views')) return;

    // SPEC section 4: when the payload lands, the option becomes available
    // WITHOUT moving the user off their current view. Nothing here touches
    // this.active -- the only state change is the announcement, so a sighted
    // user who sees the option light up and a screen reader user get the same
    // information (accessibility skill, action feedback pattern).
    const before = changed.get('views');
    if (!Array.isArray(before)) return;

    const wasPending = new Set(
      before
        .filter(view => view && view.available !== true && view.pending === true)
        .map(view => view.id)
    );
    const nowAvailable = this._rendered.filter(
      view => view.available === true && wasPending.has(view.id)
    );
    if (nowAvailable.length) {
      this._announcement = i18n.getMessage(
        'The {viewName} view is now available.',
        {viewName: nowAvailable[0].label}
      );
    }
  }

  render() {
    const rendered = this._rendered;
    if (!rendered.length) return nothing;

    const rovingId = this._rovingId;

    return html`
      <div
        class="rv-switch"
        role="tablist"
        aria-label=${this.tablistLabel || i18n.getMessage('Views')}
        aria-orientation="horizontal"
        @keydown=${this._onKeydown}
      >
        ${rendered.map(view => {
          const pending = this._isPending(view);
          const selected = view.id === this.active;
          return html`
            <button
              type="button"
              role="tab"
              class="rv-view rv-focusable"
              data-view-id=${view.id}
              aria-selected=${selected ? 'true' : 'false'}
              aria-disabled=${pending ? 'true' : 'false'}
              aria-busy=${pending ? 'true' : 'false'}
              tabindex=${view.id === rovingId ? '0' : '-1'}
              @click=${this._onClick}
            >
              <span>${view.label}</span>
              ${pending
                ? html`<span
                    class="rv-pending-bar aiux-skeleton"
                    aria-hidden="true"
                  ></span>`
                : nothing}
            </button>
          `;
        })}
      </div>
      <div class="rv-sr-only" role="status" aria-live="polite">
        ${this._announcement}
      </div>
    `;
  }
}
