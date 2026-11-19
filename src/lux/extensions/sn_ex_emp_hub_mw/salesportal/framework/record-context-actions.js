import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';
import {getLogger} from '@servicenow/aiux/aiux-components-core';

import {rvTokens, rvPrimitives} from './tokens.js';

// CONTEXT-MENU UI ACTIONS, which the ribbon was missing entirely.
//
// WHY THIS EXISTS. aiux-record-actions renders ONE bucket:
//
//     const formActions = sortVisibleFormActions(
//       this._record.apis.actions.formButtonActions
//     );
//
// and its only property is overflow-handled-by-host. So an action configured
// as a context-menu item instead of a form button can never appear in it.
//
// Measured on sn_customerservice_case:
//
//   Trigger AI Investigation       form_button 1  form_context_menu 0  -> renders
//   Approve Major Case Candidate   form_button 0  form_context_menu 1  -> absent
//   Reject Major Case Candidate    form_button 0  form_context_menu 1  -> absent
//   Propose Major Case             form_button 0  form_context_menu 1  -> absent
//
// The payload already carries them. The actions data source queries
// contextMenuItems alongside buttons and the transform exposes four buckets --
// buttons, links, contextMenu, executableOnly -- and ActionsAPI publishes
// formContextMenuActions as a public getter. Nothing was missing from the
// platform; only a consumer.
//
// That is why this is a component in our app rather than a change to the
// ServiceNow-shipped UI action records. Setting form_button = 1 on those three
// would also alter the native case form for every other user of it.
//
// THE EXECUTE CONTRACT, taken from the working button bar rather than guessed.
// aiux-record-actions builds each node as:
//
//     id: action.actionName || action.id,
//     label: action.name,
//
// and its handler calls executeAction(actionId) with that id. So the value
// passed to executeAction is actionName (falling back to the sys_id) and
// action.name is the DISPLAY LABEL -- ActionsAPI._resolveBucket assigns
// name: resolved.label ?? resolved.name, so name carries a client relabel.
// Passing name here would look right and resolve nothing, because
// executeAction looks the action up with getActionByName.

@customElement('x-snc-slux-rv-context-actions')
export default class RvContextActions extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Actions];

  static properties = {
    _open: {state: true},
    // The label of the action currently executing, or empty.
    //
    // A server UI action is a round trip: the menu closes on click and then
    // NOTHING on screen changes until the write lands and the refresh signal
    // arrives, which reads as a dead control. This is the only thing the page
    // can honestly say in that window -- that the action is running -- so it
    // says it.
    _running: {state: true}
  };

  constructor() {
    super();
    // Assigned here rather than as a class field: a class field initializer
    // shadows the accessor Lit generates from static properties and silences
    // reactivity.
    this._open = false;
    this._running = '';
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: inline-block;
        position: relative;
      }

      .rv-trigger {
        appearance: none;
        -webkit-appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: var(--rv-touch-target, 44px);
        padding: 6px 14px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-primary, #1b1b19);
        font: inherit;
        cursor: pointer;
      }

      .rv-trigger:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-caret {
        color: var(--rv-ink-muted, #5b5a55);
      }

      /* The live region is for announcement only -- the trigger label already
         carries the same information visually, so showing this too would
         duplicate it on screen. */
      .rv-sr-live {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      .rv-trigger[disabled] {
        opacity: 0.65;
        cursor: progress;
      }

      /* The menu is absolutely positioned against the host rather than
         teleported. It sits in the header, which is not a clipping or
         stacking context here, so a teleport would add a dependency for no
         gain. */
      .rv-menu {
        position: absolute;
        inset-inline-end: 0;
        inset-block-start: calc(100% + 4px);
        z-index: 30;
        min-inline-size: 15rem;
        margin: 0;
        padding: 6px;
        list-style: none;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-card, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .rv-item {
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

      .rv-item:hover:not([disabled]) {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-item[disabled] {
        color: var(--rv-ink-muted, #5b5a55);
        cursor: default;
      }

      @media (forced-colors: active) {
        .rv-trigger,
        .rv-menu {
          border: 1px solid ButtonBorder;
        }

        .rv-item:hover:not([disabled]) {
          background: Highlight;
          color: HighlightText;
        }
      }
    `
  ];

  // Mirrors the package's own sortVisibleFormActions. Replicated rather than
  // imported: it is exported from the record package's actions module, but
  // whether the umbrella barrel re-exports it is unverified, and a wrong
  // import specifier fails the build for two lines of logic.
  _visibleActions() {
    const actions = this._record.apis.actions.formContextMenuActions || [];
    return actions
      .filter(action => action.visible)
      .sort((a, b) => a.order - b.order);
  }

  _close(refocus) {
    if (!this._open) return;
    this._open = false;
    if (refocus) {
      this.renderRoot?.querySelector('.rv-trigger')?.focus();
    }
  }

  // Click-outside and Escape are bound only while the menu is open, and
  // removed on close and on disconnect -- a document listener that outlives
  // the component is a leak that fires against a detached tree.
  _onDocumentPointer = e => {
    if (e.composedPath?.().includes(this)) return;
    this._close(false);
  };

  _onDocumentKey = e => {
    if (e.key === 'Escape') this._close(true);
  };

  _bind(on) {
    const fn = on ? 'addEventListener' : 'removeEventListener';
    document[fn]('pointerdown', this._onDocumentPointer, true);
    document[fn]('keydown', this._onDocumentKey, true);
  }

  updated() {
    this._bind(this._open);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._bind(false);
  }

  // EXECUTE, AND REFUSE TO FAIL SILENTLY.
  //
  // ActionsAPI.executeAction has two guards that return undefined with no log:
  //
  //     const uiActions = this._config.formEnvironment.uiActions;
  //     if (!uiActions) return;
  //     const action = uiActions.getActionByName(actionName);
  //     if (!action) return;
  //
  // Either one produces a click that does nothing, with no error and no
  // console line -- which is what a context-menu action was doing. So the
  // attempt is logged with the identifier used, and a throw is caught and
  // reported rather than swallowed.
  //
  // THE IDENTIFIER. getActionByName matches actionName, id OR name (read from
  // GlideUIActions), and the platform logs
  //   "Action Bar action name provided should be the UI Action action_name field"
  // when only the label matched. actionName first, sys_id as the fallback --
  // the same pair the packaged button bar passes.
  async _execute(action) {
    this._close(true);

    const id = action.actionName || action.id;
    const log = getLogger('rv-context-actions');

    this._running = action.name || id;
    try {
      await this._record.apis.actions.executeAction(id);
      log.info(
        {id, label: action.name, isClient: action.isClient},
        'Context-menu UI action dispatched'
      );
    } catch (error) {
      // A rejected submit lands here -- GlideUIActions.submit rejects with
      // "Action not found" or "Validation failed", both of which were
      // invisible before.
      log.error(
        {id, label: action.name, error: error?.message || String(error)},
        'Context-menu UI action failed'
      );
    } finally {
      // Cleared whatever happened, so a failed action cannot leave the
      // trigger stuck reporting work that is no longer running.
      this._running = '';
    }
  }

  render() {
    const actions = this._visibleActions();
    if (!actions.length) return nothing;

    return html`
      <button
        type="button"
        class="rv-trigger rv-focusable"
        aria-haspopup="menu"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-busy=${this._running ? 'true' : 'false'}
        ?disabled=${Boolean(this._running)}
        @click=${() => {
          this._open = !this._open;
        }}
      >
        <span
          >${this._running
            ? i18n.getMessage('{action}\u2026', {action: this._running})
            : i18n.getMessage('More actions')}</span
        >
        ${this._running
          ? nothing
          : html`<span class="rv-caret" aria-hidden="true">&#9662;</span>`}
      </button>

      ${this._running
        ? html`<span class="rv-sr-live" role="status" aria-live="polite"
            >${i18n.getMessage('{action} is running', {
              action: this._running
            })}</span
          >`
        : nothing}

      ${this._open
        ? html`<ul class="rv-menu" role="menu">
            ${actions.map(
              action => html`
                <li role="none">
                  <button
                    type="button"
                    class="rv-item"
                    role="menuitem"
                    ?disabled=${action.disabled}
                    title=${action.hint || nothing}
                    @click=${() => this._execute(action)}
                  >
                    ${action.name}
                  </button>
                </li>
              `
            )}
          </ul>`
        : nothing}
    `;
  }
}
