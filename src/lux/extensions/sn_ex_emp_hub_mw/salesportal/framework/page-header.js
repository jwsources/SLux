import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
// Deep import, never the aiux-services barrel -- the barrel is bundled inline
// by the isolate builder and fails the page bundle on an unresolvable
// "#context" import. services/src/i18n.js has zero imports and is
// SSR-isolate-safe on its own.
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvPrimitives, rvTokens, safeTone} from './tokens.js';

// PageHeader -- SPEC section 2, slot "header". Always first, always present,
// and identical across all four views.
//
// GENERIC BY CONSTRUCTION. Everything it renders arrives as a prop:
// breadcrumb, title, chips, subtitle, actions. There is no table name, no field
// name and no record number in this file. Whoever builds the props owns the
// mapping from a layout config's header block to these shapes.
//
// PROPS (COMPONENTS.md -> Shell components -> PageHeader):
//   breadcrumb [{label, href}]   an entry with no href is the current page
//   title      string
//   chips      [{label, tone}]   tone in TONES
//   subtitle   string, optional
//   actions    [{label, kind}]   kind is primary or secondary
//
// It raises an event per action rather than taking callbacks, so the page can
// route an action without this component knowing what any action does. SPEC
// section 6: suggestions and actions always confirm; the confirm step belongs
// to the handler, not here.
//
// WHY NOT aiux-record-header. Checked its reference
// (ui-discovery references/components/aiux-record-header.md). It is bound to
// aiux-record-provider and composes its content from platform record metadata:
// the title comes from the record display value, the secondary row from
// sys_aw_form_header, and the action row from sys_ui_action. It has no property
// for a caller-supplied breadcrumb trail, no property for tone-carrying status
// chips, and no property for arbitrary actions -- the only action input is
// visibleActionButtons, which selects from a fixed set of platform buttons. A
// prop-driven generic header is not expressible through it.
//
// WHY NOT the aiux-breadcrumbs DaisyUI class. It is safelisted (verified in
// node_modules/@servicenow/aiux/components/core/src/styles/tailwind.css), but
// its separators and colours come from the instance theme, and APG requires an
// ordered list with CSS-generated separators so the separator is not announced.
// The hand-written rule below is a dozen lines and keeps the palette under
// --rv-* control, which the no-raw-hex rule requires.

@customElement('x-snc-slux-rv-page-header')
export default class RvPageHeader extends AIUXElement {
  static properties = {
    breadcrumb: {attribute: false},
    // attribute: false on purpose. Reflecting this to a "title" attribute
    // would give the whole header element a native browser tooltip, and
    // HTMLElement already owns a title property. The prop name is kept because
    // COMPONENTS.md names it title; the page sets it as a property binding.
    title: {attribute: false},
    subtitle: {attribute: 'subtitle'},
    chips: {attribute: false},
    actions: {attribute: false}
  };

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-header {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* BREADCRUMB. Separator is a CSS pseudo-element so a screen reader never
         announces it (APG breadcrumb: add separators via CSS, not inline
         text). */
      .rv-crumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .rv-crumb {
        display: inline-flex;
        align-items: center;
        min-width: 0;
      }

      .rv-crumb + .rv-crumb::before {
        content: '/';
        margin: 0 8px;
        color: var(--rv-ink-muted, #5b5a55);
        /* Belt and braces: content generated here is already ignored by
           modern screen readers when marked this way. */
        speak: never;
      }

      .rv-crumb a {
        /* 24px minimum pointer target (WCAG 2.5.8 AA). The 44px target in
           SPEC section 6 is applied to the real controls -- buttons and the
           view switch -- where it does not distort an inline text trail. */
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 2px 0;
        max-width: 22ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rv-crumb[aria-current='page'] {
        color: var(--rv-ink-secondary, #3f3e3a);
        font-weight: var(--rv-weight-medium, 500);
      }

      /* TITLE ROW. Title and chips share a line and wrap together; the action
         group sits at the end and drops below on narrow widths. */
      .rv-title-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px 18px;
      }

      .rv-title-block {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1 1 22rem;
        min-width: 0;
      }

      .rv-title-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        min-width: 0;
      }

      .rv-type-title {
        /* Long titles wrap rather than overflow at 320px. */
        overflow-wrap: anywhere;
      }

      .rv-chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      /* ACTIONS. Horizontal at every width per the reflow guide: an action
         group reflows to a row and must not scroll sideways. */
      .rv-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        flex: 0 1 auto;
        min-width: 0;
      }

      /* ACTIONS ZONE. Wraps both the prop-driven buttons and the actions slot
         so the pair sits as one right-aligned group on the title row.
         justify-content: flex-end keeps them at the trailing edge; the
         flex-wrap on the title row is what drops the whole zone beneath the
         title when there is no room beside it. */
      .rv-actions-zone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex: 0 1 auto;
        min-width: 0;
      }

      .rv-action {
        min-height: var(--rv-touch-target, 44px);
        min-width: var(--rv-touch-target, 44px);
        padding: 0 18px;
        border-radius: var(--rv-radius-control, 22px);
        font-family: var(--rv-font-ui, Inter, system-ui, sans-serif);
        font-size: var(--rv-size-body, 14px);
        font-weight: var(--rv-weight-medium, 500);
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-action[data-kind='primary'] {
        background: var(--rv-action-primary, #0e2b3d);
        color: var(--rv-action-primary-text, #ffffff);
        border-color: var(--rv-action-primary, #0e2b3d);
      }

      .rv-action[data-kind='secondary'] {
        background: var(--rv-surface-card, #ffffff);
        color: var(--rv-ink-primary, #1b1b19);
        border-color: var(--rv-surface-control, #dad8d2);
      }

      .rv-action[data-kind='secondary']:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-subtitle {
        overflow-wrap: anywhere;
      }

      /* Windows High Contrast Mode. Buttons are interactive, so they take
         forced-color-adjust: none and the ButtonFace/ButtonText pair, and the
         secondary button -- which has a near-invisible border in normal mode
         -- gets an explicit ButtonBorder. */
      @media (forced-colors: active) {
        .rv-action {
          forced-color-adjust: none;
          background-color: ButtonFace;
          color: ButtonText;
          border: 2px solid ButtonBorder;
        }

        .rv-action:hover {
          background-color: Highlight;
          color: HighlightText;
          border-color: Highlight;
        }

        .rv-action:focus-visible {
          outline: 2px solid Highlight;
          outline-offset: 2px;
        }

        .rv-crumb a {
          color: LinkText;
        }

        .rv-crumb::before {
          color: CanvasText;
        }
      }
    `
  ];

  constructor() {
    super();
    // Assigned in the constructor, not as class fields: a class field
    // initializer shadows the accessor Lit generates from static properties
    // and silences reactivity.
    this.breadcrumb = [];
    this.title = '';
    this.subtitle = '';
    this.chips = [];
    this.actions = [];
  }

  _onAction = e => {
    const index = Number(e.currentTarget?.dataset?.index);
    const action = this.actions?.[index];
    if (!action) return;
    this.dispatchEvent(
      new CustomEvent('rv-page-header:action', {
        detail: {
          id: action.id || action.label,
          label: action.label,
          kind: action.kind || 'secondary',
          index
        },
        bubbles: true,
        composed: true
      })
    );
  };

  _renderBreadcrumb() {
    const crumbs = Array.isArray(this.breadcrumb) ? this.breadcrumb : [];
    const visible = crumbs.filter(crumb => crumb && crumb.label);
    if (!visible.length) return nothing;

    return html`
      <nav aria-label=${i18n.getMessage('Breadcrumb')}>
        <ol class="rv-crumbs rv-type-label">
          ${visible.map(crumb =>
            crumb.href
              ? html`<li class="rv-crumb">
                  <a class="rv-link rv-focusable" href=${crumb.href}
                    >${crumb.label}</a
                  >
                </li>`
              : html`<li class="rv-crumb" aria-current="page">
                  ${crumb.label}
                </li>`
          )}
        </ol>
      </nav>
    `;
  }

  _renderChips() {
    const chips = Array.isArray(this.chips) ? this.chips : [];
    const visible = chips.filter(chip => chip && chip.label);
    if (!visible.length) return nothing;

    return html`
      <ul class="rv-chips" aria-label=${i18n.getMessage('Status')}>
        ${visible.map(
          chip => html`
            <li>
              <span class="rv-chip" data-tone=${safeTone(chip.tone)}
                >${chip.label}</span
              >
            </li>
          `
        )}
      </ul>
    `;
  }

  _renderActions() {
    const actions = Array.isArray(this.actions) ? this.actions : [];
    const visible = actions.filter(action => action && action.label);
    if (!visible.length) return nothing;

    return html`
      <div class="rv-actions">
        ${visible.map(
          (action, index) => html`
            <button
              type="button"
              class="rv-action rv-focusable"
              data-kind=${action.kind === 'primary' ? 'primary' : 'secondary'}
              data-index=${index}
              @click=${this._onAction}
            >
              ${action.label}
            </button>
          `
        )}
      </div>
    `;
  }

  render() {
    return html`
      <header class="rv-header">
        ${this._renderBreadcrumb()}
        <div class="rv-title-row">
          <div class="rv-title-block">
            <div class="rv-title-line">
              <h1 class="rv-type-title">${this.title}</h1>
            </div>
            ${this.subtitle
              ? html`<p class="rv-subtitle rv-type-body">${this.subtitle}</p>`
              : nothing}
            <!--
              CHIPS ON THEIR OWN ROW, beneath the title.
              They were inline with the h1, which meant five tags competed
              with the title for the same line and with the action buttons for
              the remaining width -- so they overflowed rather than wrapping
              usefully. A record can carry any number of tags, so the row that
              holds them must be free to wrap without squeezing the title.
            -->
            ${this._renderChips()}
          </div>
          <div class="rv-actions-zone">
            ${this._renderActions()}
            <!--
              ACTIONS SLOT. The prop-driven buttons above stay for a caller
              that supplies plain action descriptors, but the platform's own
              action bar is an ELEMENT (aiux-record-actions) that resolves the
              record provider through context, so it cannot be expressed as a
              descriptor and must stay in the page's light DOM. Slotting it
              here is what puts it on the right of the title row: before this
              slot existed the page rendered it as a sibling BELOW the header,
              which stacked the buttons under the title on the left.
            -->
            <slot name="actions"></slot>
          </div>
        </div>
      </header>
    `;
  }
}
