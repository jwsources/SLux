import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {
  DEFAULT_FILTERS,
  SORTS,
  TIMEFRAMES
} from './loaders/graph-data.js';

// THE FILTER PANEL.
//
// Replaces a search box and two checkboxes. Every control here narrows a
// dimension the data actually has, and the dropdown OPTIONS ARE DERIVED FROM
// THE ROWS IN SCOPE rather than from a choice table -- so an option can never
// be offered that returns nothing, and a value that disappears from the data
// disappears from the list.
//
// Native select and input elements on purpose: they come with keyboard
// handling, screen-reader semantics and mobile pickers that a custom listbox
// would have to re-earn. They are restyled, not replaced.
//
// RESET IS A FIRST-CLASS CONTROL. Six dimensions can combine into an empty
// result, and recovering by reversing each one in turn is the trap the earlier
// two-filter version had: the empty state said to clear the filters while the
// only way to do it was to remember what had been set.

const TIMEFRAME_LABELS = [
  'Any time',
  'Last 24 hours',
  'Last 7 days',
  'Last 30 days',
  'Last 90 days'
];

@customElement('x-snc-slux-rv-graph-filters')
export default class RvGraphFilters extends AIUXElement {
  static properties = {
    filters: {attribute: false},
    // {states, priorities, accounts} collected from the rows in scope.
    facets: {attribute: false},
    busy: {attribute: false, type: Boolean},
    truncated: {attribute: false, type: Boolean}
  };

  constructor() {
    super();
    this.filters = {...DEFAULT_FILTERS};
    this.facets = {states: [], priorities: [], accounts: []};
    this.busy = false;
    this.truncated = false;
    // Plain field: a pending debounce is not render state.
    this._searchTimer = null;
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .rv-panel-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      h2 {
        margin: 0;
        font-size: var(--rv-size-section, 17px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-reset {
        appearance: none;
        -webkit-appearance: none;
        padding: 4px 8px;
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

      .rv-reset[disabled] {
        color: var(--rv-ink-muted, #5b5a55);
        text-decoration: none;
        cursor: default;
      }

      .rv-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .rv-group-label {
        font-size: var(--rv-size-label, 12px);
        color: var(--rv-ink-muted, #5b5a55);
      }

      /* One control surface for every input, so the panel reads as one
         system rather than a stack of browser defaults. */
      .rv-input {
        width: 100%;
        min-height: var(--rv-touch-target, 44px);
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-primary, #1b1b19);
        font: inherit;
        font-size: var(--rv-size-body, 14px);
      }

      .rv-check {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: var(--rv-touch-target, 44px);
        font-size: var(--rv-size-body, 14px);
      }

      /* TIMEFRAME SLIDER. A range input over discrete stops, so the value is
         always one of the steps the query supports rather than an arbitrary
         day count. */
      .rv-slider-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .rv-slider {
        flex: 1 1 auto;
        min-width: 0;
        accent-color: var(--rv-action-primary, #0e2b3d);
      }

      .rv-slider-value {
        flex: 0 0 auto;
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-note {
        margin: 0;
        font-size: var(--rv-size-caption, 11px);
        color: var(--rv-ink-muted, #5b5a55);
      }

      .rv-divider {
        block-size: 1px;
        background: var(--rv-surface-hairline, #e5e3dd);
      }
    `
  ];

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  _emit(patch) {
    this.dispatchEvent(
      new CustomEvent('rv-filters:change', {
        detail: patch,
        bubbles: true,
        composed: true
      })
    );
  }

  // Debounced on input, not change. change fires only on blur or Enter, so
  // clearing a search input with its native clear button left the text gone
  // and the query unchanged -- which read as the filters being stuck.
  _onSearch = e => {
    const value = e.target.value;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this._emit({search: value});
    }, 300);
  };

  _onTimeframe = e => {
    const index = Number(e.target.value) || 0;
    this._emit({days: TIMEFRAMES[index] ?? 0});
  };

  _isDirty() {
    const f = this.filters || {};
    return Object.keys(DEFAULT_FILTERS).some(
      key => f[key] !== DEFAULT_FILTERS[key]
    );
  }

  _select(key, label, options, anyLabel) {
    if (!options?.length) return nothing;
    const value = this.filters?.[key] ?? '';
    const id = 'rv-f-' + key;
    return html`
      <div class="rv-group">
        <label class="rv-group-label" for=${id}>${label}</label>
        <select
          class="rv-input rv-focusable"
          id=${id}
          .value=${value}
          @change=${e => this._emit({[key]: e.target.value})}
        >
          <option value="">${anyLabel}</option>
          ${options.map(
            option => html`<option
              value=${option.value}
              ?selected=${option.value === value}
            >
              ${option.label}
            </option>`
          )}
        </select>
      </div>
    `;
  }

  render() {
    const filters = this.filters || DEFAULT_FILTERS;
    const facets = this.facets || {};
    const timeIndex = Math.max(0, TIMEFRAMES.indexOf(Number(filters.days) || 0));
    const dirty = this._isDirty();

    return html`
      <aside
        class="rv-card rv-panel"
        slot="dock-filters"
        aria-label=${i18n.getMessage('Filters and sorting')}
      >
        <div class="rv-panel-head">
          <h2>${i18n.getMessage('Filters')}</h2>
          <button
            type="button"
            class="rv-reset rv-focusable"
            ?disabled=${!dirty}
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('rv-filters:reset', {
                  bubbles: true,
                  composed: true
                })
              )}
          >
            ${i18n.getMessage('Reset')}
          </button>
        </div>

        <div class="rv-group">
          <label class="rv-group-label" for="rv-f-search">
            ${i18n.getMessage('Search')}
          </label>
          <input
            class="rv-input rv-focusable"
            id="rv-f-search"
            type="search"
            .value=${filters.search}
            placeholder=${i18n.getMessage('Account or case')}
            @input=${this._onSearch}
          />
        </div>

        <div class="rv-group">
          <span class="rv-group-label">${i18n.getMessage('Changed')}</span>
          <div class="rv-slider-row">
            <input
              class="rv-slider rv-focusable"
              type="range"
              min="0"
              max=${TIMEFRAMES.length - 1}
              step="1"
              .value=${String(timeIndex)}
              aria-label=${i18n.getMessage('Changed within')}
              aria-valuetext=${i18n.getMessage(TIMEFRAME_LABELS[timeIndex])}
              @input=${this._onTimeframe}
            />
            <span class="rv-slider-value">
              ${i18n.getMessage(TIMEFRAME_LABELS[timeIndex])}
            </span>
          </div>
        </div>

        ${this._select(
          'state',
          i18n.getMessage('State'),
          facets.states,
          i18n.getMessage('Any state')
        )}
        ${this._select(
          'priority',
          i18n.getMessage('Priority'),
          facets.priorities,
          i18n.getMessage('Any priority')
        )}
        ${this._select(
          'account',
          i18n.getMessage('Account'),
          facets.accounts,
          i18n.getMessage('All accounts')
        )}

        <div class="rv-divider" role="presentation"></div>

        <div class="rv-group">
          <label class="rv-group-label" for="rv-f-sort">
            ${i18n.getMessage('Sort by')}
          </label>
          <select
            class="rv-input rv-focusable"
            id="rv-f-sort"
            .value=${filters.sort}
            @change=${e => this._emit({sort: e.target.value})}
          >
            <option
              value=${SORTS.COUNT}
              ?selected=${filters.sort === SORTS.COUNT}
            >
              ${i18n.getMessage('Most work')}
            </option>
            <option
              value=${SORTS.RECENT}
              ?selected=${filters.sort === SORTS.RECENT}
            >
              ${i18n.getMessage('Recently changed')}
            </option>
            <option value=${SORTS.NAME} ?selected=${filters.sort === SORTS.NAME}>
              ${i18n.getMessage('Name')}
            </option>
          </select>
        </div>

        <label class="rv-check">
          <input
            type="checkbox"
            .checked=${filters.activeOnly}
            @change=${e => this._emit({activeOnly: e.target.checked})}
          />
          ${i18n.getMessage('Open work only')}
        </label>

        ${this.busy
          ? html`<p class="rv-note" role="status">
              ${i18n.getMessage('Updating\u2026')}
            </p>`
          : nothing}
        ${this.truncated
          ? html`<p class="rv-note">
              ${i18n.getMessage(
                'Counts are based on the most recent 1000 records. Narrow the filters for exact totals.'
              )}
            </p>`
          : nothing}
      </aside>
    `;
  }
}
