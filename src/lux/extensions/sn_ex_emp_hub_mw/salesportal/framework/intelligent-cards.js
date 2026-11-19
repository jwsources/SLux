import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {rvTable} from './table-styles.js';
import {recordHref} from './record-href.js';

// THE INTELLIGENT VIEW'S CARDS -- all presentational, all in one module.
//
// COMPONENTS.md: components never query. Every card below takes its data as a
// property and extends AIUXElement, NOT AIUXRecordElement -- none of them
// touches the record context, so none can throw the "read happened too early"
// error and all of them render identically wherever they are placed.
//
// TWO THINGS THEY DO NOT DO, BY DESIGN:
//
// 1. OPENING A RECORD. A card dispatches rv:open-record and stops there. The
//    page owns the single policy point that decides how a record opens -- a
//    card calling the router itself would bypass it, and a card reading the
//    record context would stop being presentational.
//
// 2. LABELLING ITS OWN DATA. The adapter returns stable ids and no wording;
//    the catalogue below turns an id into a translated string. That keeps one
//    source of truth per string and keeps source-language text out of the
//    data layer. Story prose is the exception -- it is model output, passed
//    through verbatim and never handed to i18n.getMessage.

// ---- THE LABEL CATALOGUE ------------------------------------------------
// Functions, not a constant map: i18n.getMessage must be CALLED at render
// time, not once at module load, or the first locale to load wins for the
// life of the page.

function statLabel(id) {
  switch (id) {
    case 'devices':
      return i18n.getMessage('Devices in scope');
    case 'remote':
      return i18n.getMessage('Remote update eligible');
    case 'dispatch':
      return i18n.getMessage('Dispatch required');
    case 'accounts':
      return i18n.getMessage('Accounts affected');
    case 'firmware':
      return i18n.getMessage('Target firmware');
    default:
      return id;
  }
}

function factLabel(id) {
  switch (id) {
    case 'trigger-device':
      return i18n.getMessage('Trigger device');
    case 'product':
      return i18n.getMessage('Product');
    case 'fleet':
      return i18n.getMessage('Fleet size');
    default:
      return id;
  }
}

function partyLabel(key) {
  switch (key) {
    case 'account':
      return i18n.getMessage('Account');
    case 'contact':
      return i18n.getMessage('Contact');
    case 'assignmentGroup':
      return i18n.getMessage('Assignment group');
    case 'assignedTo':
      return i18n.getMessage('Assigned to');
    default:
      return key;
  }
}

function relationLabel(relation) {
  switch (relation) {
    case 'parent':
      return i18n.getMessage('Parent');
    case 'child':
      return i18n.getMessage('Child case');
    case 'self':
      return i18n.getMessage('This record');
    case 'sibling':
      return i18n.getMessage('Related');
    case 'report':
      return i18n.getMessage('Report');
    default:
      return '';
  }
}

export function findingText(finding) {
  switch (finding?.message) {
    case 'cause':
      return i18n.getMessage('Firmware change is the probable cause');
    case 'regulatory':
      return i18n.getMessage('Regulatory status: {status}', {
        status: finding.value || ''
      });
    case 'unassigned':
      return i18n.getMessage('No owner is assigned');
    case 'dispatch':
      return i18n.getMessage('{count} dispatch tasks created', {
        count: finding.count ?? 0
      });
    case 'major':
      return i18n.getMessage('Handled as a major case: {status}', {
        status: finding.value || ''
      });
    case 'sla':
      return i18n.getMessage('{count} service commitments breached', {
        count: finding.count ?? 0
      });
    case 'hierarchy':
      return i18n.getMessage('Part of a case hierarchy');
    default:
      return '';
  }
}

// Shared styles for every card here.
const cardShared = css`
  :host {
    display: block;
    height: 100%;
  }

  /* THE DOCK'S HIGHLIGHT. The page sets data-rv-highlight on the card's HOST
     element when a finding points here, and clears it after 1.5s.
     It is styled with :host() rather than from the page, because a page
     cannot reach into a shadow root -- but a component can read its own
     host's attributes. Without this rule the attribute would be set and
     removed with nothing to show for it, which is the orphan-selector failure:
     two of SPEC's three behaviours would work and the third would silently
     not.
     outline rather than border: a border would reflow the card by 2px on
     every highlight. */
  :host([data-rv-highlight='true']) .rv-card {
    outline: 2px solid var(--rv-action-primary, #0e2b3d);
    outline-offset: 2px;
  }

  /* The heading takes focus programmatically and carries tabindex -1, so it
     must not show a focus ring on a mouse-driven jump -- focus-visible keeps
     the ring for keyboard use only. */
  h2:focus {
    outline: none;
  }

  h2:focus-visible {
    outline: 2px solid var(--rv-action-link, #1f5f8b);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    :host([data-rv-highlight='true']) .rv-card {
      outline-width: 3px;
    }
  }

  .rv-card {
    height: 100%;
    box-sizing: border-box;
  }

  .rv-card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
  }

  .rv-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px 24px;
  }

  @media (min-width: 720px) {
    dl[data-cols='2'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  dt {
    margin: 0 0 2px;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* A value that opens a record. Button reset -- a native button brings its
     own font, border and background, all of which must go or the value reads
     as a form control inside a definition list. */
  .rv-open {
    appearance: none;
    -webkit-appearance: none;
    display: inline;
    margin: -2px -4px;
    padding: 2px 4px;
    border: 0;
    border-radius: var(--rv-radius-control, 8px);
    background: none;
    font: inherit;
    color: var(--rv-action-link, #1f5f8b);
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .rv-open:hover {
    color: var(--rv-action-link-hover, #123f5e);
  }

  @media (forced-colors: active) {
    .rv-open {
      color: LinkText;
    }
  }
`;

// Record links are ANCHORS, so there is no programmatic open path here. The
// rv:open-record event and its dispatcher were removed with the buttons: see
// record-href.js for why programmatic navigation was the shared cause of the
// lost basename, the .do exits, the repeated re-render and the stale pages.

function renderValue(host, value, record) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!text) {
    return html`<span aria-hidden="true">&#8212;</span
      ><span class="rv-sr">${i18n.getMessage('Empty')}</span>`;
  }

  // AN ANCHOR, NOT A BUTTON. The host router intercepts anchor clicks and
  // navigates client-side; a button forced a programmatic navigation, which
  // with no global router became a full page load. See record-href.js.
  // A null href means no link can be built here -- during SSR, where there is
  // no window -- so the value renders as text rather than as a dead anchor.
  const href = recordHref(record?.table, record?.sysId);
  if (!href) return text;

  return html`<a class="rv-open" href=${href}>${text}</a>`;
}

const srOnly = css`
  .rv-sr {
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
`;

// ---- OTTO BRIEF ---------------------------------------------------------

@customElement('x-snc-slux-rv-otto-brief')
export class RvOttoBrief extends AIUXElement {
  static properties = {brief: {attribute: false}};

  static styles = [
    rvTokens,
    rvPrimitives,
    cardShared,
    srOnly,
    css`
      .rv-summary {
        margin: 0 0 16px;
        white-space: pre-line;
      }

      /* Stat tiles stay TWO across at the narrowest width -- SPEC section 6
         keeps them two-up while everything else collapses to one. */
      .rv-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      @media (min-width: 720px) {
        .rv-stats {
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        }
      }

      .rv-stat-value {
        display: block;
      }

      .rv-alerts {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 14px;
      }
    `
  ];

  render() {
    const brief = this.brief;
    if (!brief) return nothing;

    const stats = brief.stats || [];
    const alerts = brief.alerts || [];

    return html`
      <section class="rv-card" aria-labelledby="rv-brief-h">
        <div class="rv-card-head">
          <h2 id="rv-brief-h" class="rv-type-section">
            ${i18n.getMessage('Summary')}
          </h2>
        </div>

        ${alerts.length
          ? html`<div class="rv-alerts">
              ${alerts.map(
                alert => html`
                  <div class="rv-row">
                    <span class="rv-chip" data-tone=${alert.tone || 'neutral'}>
                      ${alert.text}
                    </span>
                    ${alert.record
                      ? html`<span class="rv-type-caption">
                          ${renderValue(
                            this,
                            alert.record.number,
                            alert.record
                          )}
                          ${alert.record.status
                            ? html`<span class="rv-chip" data-tone="neutral"
                                >${alert.record.status}</span
                              >`
                            : nothing}
                        </span>`
                      : nothing}
                  </div>
                `
              )}
            </div>`
          : nothing}
        ${brief.summary
          ? html`<p class="rv-summary rv-type-body">${brief.summary}</p>`
          : nothing}
        ${stats.length
          ? html`<div class="rv-stats">
              ${stats.map(
                stat => html`
                  <div class="rv-tile">
                    <span
                      class="rv-stat-value rv-type-stat ${stat.mono
                        ? 'rv-mono'
                        : ''}"
                      >${stat.value}</span
                    >
                    <span class="rv-type-label">${statLabel(stat.id)}</span>
                  </div>
                `
              )}
            </div>`
          : nothing}
      </section>
    `;
  }
}

// ---- ROOT CAUSE ---------------------------------------------------------

@customElement('x-snc-slux-rv-root-cause')
export class RvRootCause extends AIUXElement {
  static properties = {cause: {attribute: false}};

  static styles = [
    rvTokens,
    rvPrimitives,
    cardShared,
    srOnly,
    css`
      .rv-transition {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }

      .rv-arrow {
        color: var(--rv-ink-muted, #5b5a55);
      }
    `
  ];

  render() {
    const cause = this.cause;
    if (!cause) return nothing;
    const facts = cause.facts || [];

    return html`
      <section class="rv-card" aria-labelledby="rv-cause-h">
        <div class="rv-card-head">
          <h2 id="rv-cause-h" class="rv-type-section">
            ${i18n.getMessage('Probable cause')}
          </h2>
        </div>

        ${cause.from || cause.to
          ? html`<div class="rv-transition">
              ${cause.from
                ? html`<span class="rv-chip rv-mono" data-tone="critical"
                    >${cause.from}</span
                  >`
                : nothing}
              ${cause.from && cause.to
                ? html`<span class="rv-arrow" aria-hidden="true">&#8594;</span
                    ><span class="rv-sr">${i18n.getMessage('changes to')}</span>`
                : nothing}
              ${cause.to
                ? html`<span class="rv-chip rv-mono" data-tone="success"
                    >${cause.to}</span
                  >`
                : nothing}
            </div>`
          : nothing}
        ${facts.length
          ? html`<dl data-cols="2">
              ${facts.map(
                fact => html`
                  <div>
                    <dt class="rv-type-label">${factLabel(fact.id)}</dt>
                    <dd class="rv-type-body">
                      ${renderValue(this, fact.value, fact.record)}
                    </dd>
                  </div>
                `
              )}
            </dl>`
          : nothing}
      </section>
    `;
  }
}

// ---- PARTY --------------------------------------------------------------

@customElement('x-snc-slux-rv-party')
export class RvParty extends AIUXElement {
  static properties = {party: {attribute: false}};

  static styles = [rvTokens, rvPrimitives, cardShared, srOnly];

  render() {
    const party = this.party;
    if (!party) return nothing;

    const order = ['account', 'contact', 'assignmentGroup', 'assignedTo'];

    return html`
      <section class="rv-card" aria-labelledby="rv-party-h">
        <div class="rv-card-head">
          <h2 id="rv-party-h" class="rv-type-section">
            ${i18n.getMessage('Parties')}
          </h2>
        </div>
        <dl>
          ${order.map(key => {
            const entry = party[key];
            if (!entry) return nothing;
            return html`
              <div>
                <dt class="rv-type-label">${partyLabel(key)}</dt>
                <dd class="rv-type-body">
                  ${entry.missing
                    ? html`<span class="rv-chip" data-tone="warning">
                        ${i18n.getMessage('Not set')}
                      </span>`
                    : renderValue(this, entry.value, entry.record)}
                </dd>
              </div>
            `;
          })}
        </dl>
      </section>
    `;
  }
}

// ---- RECORD CHAIN -------------------------------------------------------

@customElement('x-snc-slux-rv-chain')
export class RvChain extends AIUXElement {
  static properties = {chain: {attribute: false}};

  static styles = [
    rvTokens,
    rvPrimitives,
    cardShared,
    srOnly,
    css`
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-tile, #f4f3ef);
      }

      /* The current record is marked by a left bar AND by its relation text,
         never by colour alone. */
      li[data-current='true'] {
        border-inline-start: 3px solid var(--rv-action-primary, #0e2b3d);
      }

      .rv-node-main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1 1 auto;
      }

      .rv-node-title {
        overflow-wrap: anywhere;
      }
    `
  ];

  render() {
    const chain = this.chain || [];
    if (!chain.length) return nothing;

    return html`
      <section class="rv-card" aria-labelledby="rv-chain-h">
        <div class="rv-card-head">
          <h2 id="rv-chain-h" class="rv-type-section">
            ${i18n.getMessage('Related records')}
          </h2>
        </div>
        <ol>
          ${chain.map(
            node => html`
              <li data-current=${node.current ? 'true' : 'false'}>
                <div class="rv-node-main">
                  <span class="rv-type-label">
                    ${relationLabel(node.relation)}
                  </span>
                  <span class="rv-type-body rv-mono">
                    ${node.current
                      ? node.number
                      : renderValue(this, node.number, node)}
                  </span>
                  ${node.title
                    ? html`<span class="rv-node-title rv-type-caption"
                        >${node.title}</span
                      >`
                    : nothing}
                </div>
                ${node.state
                  ? html`<span class="rv-chip" data-tone="neutral"
                      >${node.state}</span
                    >`
                  : nothing}
              </li>
            `
          )}
        </ol>
      </section>
    `;
  }
}

// ---- SPLIT PROGRESS + TASK TABLE ---------------------------------------

@customElement('x-snc-slux-rv-remediation')
export class RvRemediation extends AIUXElement {
  static properties = {remediation: {attribute: false}};

  static styles = [
    rvTokens,
    rvPrimitives,
    cardShared,
    srOnly,
    rvTable,
    css`
      /* The bar is decorative: every segment's number is also printed in the
         legend below it, so the information never depends on reading widths
         or colours. */
      .rv-bar {
        display: flex;
        height: 10px;
        border-radius: var(--rv-radius-pill, 999px);
        overflow: hidden;
        background: var(--rv-surface-control, #dad8d2);
        margin-bottom: 10px;
      }

      .rv-seg[data-seg='remote'] {
        background: var(--rv-data-positive, #1e6b3a);
      }

      .rv-seg[data-seg='dispatch'] {
        background: var(--rv-data-attention, #f0b44c);
      }

      .rv-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 16px;
      }

      /* Table rules come from rvTable in table-styles.js, imported into the
         styles array below -- the same declaration the Related records applets
         use, so the two views cannot drift apart. */
    `
  ];

  render() {
    const data = this.remediation;
    if (!data) return nothing;

    const segments = data.segments || [];
    const tasks = data.tasks || [];
    const total =
      data.total ?? segments.reduce((sum, seg) => sum + (seg.value || 0), 0);

    return html`
      <section class="rv-card" aria-labelledby="rv-remed-h">
        <div class="rv-card-head">
          <h2 id="rv-remed-h" class="rv-type-section">
            ${i18n.getMessage('Remediation')}
          </h2>
        </div>

        ${segments.length && total
          ? html`
              <div class="rv-bar" role="presentation">
                ${segments.map(seg => {
                  const pct = Math.max(
                    0,
                    Math.min(100, ((seg.value || 0) / total) * 100)
                  );
                  return html`<span
                    class="rv-seg"
                    data-seg=${seg.id}
                    style="width:${pct}%"
                  ></span>`;
                })}
              </div>
              <div class="rv-legend">
                ${segments.map(
                  seg => html`<span class="rv-type-label">
                    ${statLabel(seg.id)}: <strong>${seg.value}</strong>
                  </span>`
                )}
              </div>
            `
          : nothing}
        ${tasks.length
          ? html`
              <div class="rv-table-wrap" tabindex="0" role="group"
                   aria-label=${i18n.getMessage('Dispatch tasks')}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">${i18n.getMessage('Task')}</th>
                      <th scope="col">${i18n.getMessage('Site')}</th>
                      <th scope="col">${i18n.getMessage('Devices')}</th>
                      <th scope="col">${i18n.getMessage('State')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tasks.map(
                      task => html`
                        <tr>
                          <td class="rv-mono">
                            ${renderValue(this, task.number, task)}
                          </td>
                          <td class="rv-wrap">${task.site || ''}</td>
                          <td>${task.devices}</td>
                          <td>
                            <span class="rv-chip" data-tone="neutral"
                              >${task.state}</span
                            >
                          </td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>
            `
          : nothing}
      </section>
    `;
  }
}

// ---- NARRATIVE STEPS ----------------------------------------------------

@customElement('x-snc-slux-rv-narrative')
export class RvNarrative extends AIUXElement {
  static properties = {situation: {attribute: false}};

  static styles = [
    rvTokens,
    rvPrimitives,
    cardShared,
    srOnly,
    css`
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      @media (min-width: 1100px) {
        ol {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      .rv-step-text {
        white-space: pre-line;
        margin: 4px 0 0;
      }

      .rv-step-index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-action-primary, #0e2b3d);
        color: var(--rv-action-primary-text, #ffffff);
        font-size: var(--rv-size-caption, 11px);
        font-weight: var(--rv-weight-semibold, 600);
        margin-inline-end: 8px;
      }
    `
  ];

  render() {
    const situation = this.situation;
    if (!situation) return nothing;

    const steps = situation.steps || [];
    if (!steps.length) {
      // Extraction found no sections. Show the narrative as prose rather than
      // nothing -- the text is the content, and the fallback is already
      // sanitised and style-stripped upstream.
      const text = situation.fallbackText;
      if (!text) return nothing;
      return html`
        <section class="rv-card" aria-labelledby="rv-story-h">
          <div class="rv-card-head">
            <h2 id="rv-story-h" class="rv-type-section">
              ${i18n.getMessage('How this happened')}
            </h2>
          </div>
          <p class="rv-step-text rv-type-body">${text}</p>
        </section>
      `;
    }

    return html`
      <section class="rv-card" aria-labelledby="rv-story-h">
        <div class="rv-card-head">
          <h2 id="rv-story-h" class="rv-type-section">
            ${i18n.getMessage('How this happened')}
          </h2>
        </div>
        <ol>
          ${steps.map(
            (step, index) => html`
              <li>
                <h3 class="rv-type-label">
                  <span class="rv-step-index" aria-hidden="true"
                    >${index + 1}</span
                  >${step.label}
                </h3>
                <p class="rv-step-text rv-type-body">${step.text}</p>
              </li>
            `
          )}
        </ol>
      </section>
    `;
  }
}
