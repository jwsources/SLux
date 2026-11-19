import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {findingText} from './intelligent-cards.js';

// THE OTTO DOCK -- findings and suggestions, in the right rail.
//
// A finding is a pointer, not content: clicking one asks the page to reveal
// the component the finding is about. The dock does NOT reach into the grid
// to do that itself -- the cells are slotted into the shell's shadow root, and
// a component cannot query across that boundary. It dispatches
// rv:focus-component and the page, which owns the light DOM holding those
// cells, performs the scroll and moves focus.
//
// SPEC: "clicking an Otto finding scrolls to and highlights its target
// component and moves focus to its heading" -- all three, and the focus move
// is the part that is easy to skip and the only part a keyboard user benefits
// from.
//
// SPEC: "suggestions always open a confirm step". There is no path here that
// acts on first click. The adapter currently returns no suggestions, so the
// confirm UI is unexercised -- it is implemented because the contract requires
// a suggestion to be confirmable, not because data exists for it today.

@customElement('x-snc-slux-rv-otto-dock')
export default class RvOttoDock extends AIUXElement {
  static properties = {
    findings: {attribute: false},
    suggestions: {attribute: false},
    _pending: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as a class field: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this._pending = null;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-dock {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      h2 {
        margin: 0 0 4px;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* Each finding is a full-width button. min-height carries the 44px
         touch floor; a chip-sized target would fail it. */
      .rv-finding {
        appearance: none;
        -webkit-appearance: none;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        width: 100%;
        min-height: var(--rv-touch-target, 44px);
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-card, #ffffff);
        font: inherit;
        color: var(--rv-ink-primary, #1b1b19);
        text-align: start;
        cursor: pointer;
      }

      .rv-finding:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-dot {
        flex: 0 0 auto;
        inline-size: 8px;
        block-size: 8px;
        margin-block-start: 6px;
        border-radius: var(--rv-radius-pill, 999px);
      }

      /* Tone is carried by the chip TEXT in the finding body as well as this
         dot, so the dot is decorative and never the only signal. */
      .rv-dot[data-tone='info'] {
        background: var(--rv-tone-info-text, #0b3f8f);
      }

      .rv-dot[data-tone='warning'] {
        background: var(--rv-tone-warning-text, #6b4300);
      }

      .rv-dot[data-tone='critical'] {
        background: var(--rv-tone-critical-text, #8a1717);
      }

      .rv-confirm {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 12px;
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-btn {
        appearance: none;
        -webkit-appearance: none;
        min-height: var(--rv-touch-target, 44px);
        padding: 8px 14px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #ffffff);
        font: inherit;
        cursor: pointer;
      }

      .rv-btn[data-variant='primary'] {
        background: var(--rv-action-primary, #0e2b3d);
        color: var(--rv-action-primary-text, #ffffff);
        border-color: transparent;
      }

      @media (forced-colors: active) {
        .rv-finding,
        .rv-btn {
          border: 1px solid ButtonBorder;
          color: ButtonText;
        }
      }
    `
  ];

  _focusTarget(finding) {
    if (!finding?.target) return;
    this.dispatchEvent(
      new CustomEvent('rv:focus-component', {
        detail: {target: finding.target},
        bubbles: true,
        composed: true
      })
    );
  }

  _renderFindings() {
    // SPEC: a finding with no source or target is dropped rather than
    // rendered as something unclickable.
    const findings = (this.findings || []).filter(f => f && f.target);
    if (!findings.length) return nothing;

    return html`
      <div>
        <h2 class="rv-type-section">${i18n.getMessage('What Otto found')}</h2>
        <ul>
          ${findings.map(finding => {
            const text = findingText(finding);
            if (!text) return nothing;
            return html`
              <li>
                <button
                  type="button"
                  class="rv-finding rv-focusable"
                  @click=${() => this._focusTarget(finding)}
                >
                  <span
                    class="rv-dot"
                    data-tone=${finding.tone || 'info'}
                    aria-hidden="true"
                  ></span>
                  <span class="rv-type-body">${text}</span>
                </button>
              </li>
            `;
          })}
        </ul>
      </div>
    `;
  }

  _renderSuggestions() {
    const suggestions = this.suggestions || [];
    if (!suggestions.length) return nothing;

    return html`
      <div>
        <h2 class="rv-type-section">${i18n.getMessage('Suggested next steps')}</h2>
        <ul>
          ${suggestions.map(
            suggestion => html`
              <li>
                ${this._pending === suggestion.id
                  ? html`
                      <div class="rv-confirm" role="group"
                           aria-label=${i18n.getMessage('Confirm this action')}>
                        <span class="rv-type-body">
                          ${i18n.getMessage('Apply this suggestion?')}
                        </span>
                        <button
                          type="button"
                          class="rv-btn rv-focusable"
                          data-variant="primary"
                          @click=${() => {
                            this.dispatchEvent(
                              new CustomEvent('rv:apply-suggestion', {
                                detail: {id: suggestion.id},
                                bubbles: true,
                                composed: true
                              })
                            );
                            this._pending = null;
                          }}
                        >
                          ${i18n.getMessage('Confirm')}
                        </button>
                        <button
                          type="button"
                          class="rv-btn rv-focusable"
                          @click=${() => {
                            this._pending = null;
                          }}
                        >
                          ${i18n.getMessage('Cancel')}
                        </button>
                      </div>
                    `
                  : html`
                      <button
                        type="button"
                        class="rv-finding rv-focusable"
                        @click=${() => {
                          this._pending = suggestion.id;
                        }}
                      >
                        <span class="rv-type-body">${suggestion.text}</span>
                      </button>
                    `}
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  render() {
    const findings = (this.findings || []).filter(f => f && f.target);
    const suggestions = this.suggestions || [];
    if (!findings.length && !suggestions.length) return nothing;

    return html`
      <aside class="rv-dock" aria-label=${i18n.getMessage('Otto insights')}>
        ${this._renderFindings()} ${this._renderSuggestions()}
      </aside>
    `;
  }
}
