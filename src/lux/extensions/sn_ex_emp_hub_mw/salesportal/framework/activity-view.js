import {css, html, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {rvTokens, rvPrimitives} from './tokens.js';
import {toPlainText} from './story-extract.js';
import {experienceBasePath} from './record-href.js';
import {
  interceptPortalLinkClick,
  portaliseLinks
} from './portalise-links.js';

// THE ACTIVITY VIEW -- a collapsed list, one line per entry.
//
// WHY NOT THE PLATFORM STREAM. aiux-record-activity-stream renders every event
// expanded. Measured on the subject case: 9 journal entries, of which FOUR are
// large AI-generated HTML reports and five are one-liners such as "Added as a
// child of CS0001624". Expanded, those four produce a wall of styled markup
// and the five short ones are lost between them. Collapsed to one line each,
// the record reads as a history again.
//
// WHAT COMES FROM THE PLATFORM, AND WHAT DOES NOT.
// The COMPOSE box is the platform's (aiux-record-activity-compose): it posts
// real journal entries, handles mentions and the internal-only hint, and
// re-implementing it would mean re-implementing posting. Only the STREAM is
// ours.
//
// DATA COMES FROM ActivityAPI, NOT FROM A QUERY. Read from
// provider/apis/ActivityAPI.ts:
//
//   get events(): ActivityEvent[]        already filtered; hidden tiles and
//                                        soft-deleted entries removed
//   getUserInfo(user): UserReference     {sysId, displayName, ai, initials...}
//   fetchFullContent(eventSysId)         fills in a truncated body
//   canEditDeleteEvent(event)            time-limited edit window
//
// THREE THINGS THAT SOLVES, which a raw sys_journal_field read did not:
//
// 1. THE AUTHOR. Measured: sys_created_by is the literal string 'system' on 4
//    of the 9 entries, with the real author embedded in the body prefix
//    ("- Jules Weijters (Work notes)"). Parsing that prefix would be deriving
//    a fact from narrative text, which ACCEPTANCE forbids.
//    getUserInfo(event.createdBy).displayName resolves the real author from
//    the stream's own userReferences map instead.
//
// 2. AI AUTHORSHIP, from data. UserReference.ai is a non-NONE value for an AI
//    user, and payload.representedBy marks an event posted on a user's behalf
//    by an agent. So the AI badge is a field read, not a guess from the
//    robot emoji in the body.
//
// 3. TRUNCATION. payload.truncated plus fetchFullContent is the platform's own
//    deferred-body path, so a long note is not shipped until it is opened.
//
// BODIES RENDER AS RICH HTML, THROUGH THE PLATFORM'S OWN ELEMENT.
//
// An earlier version of this file converted journal bodies to plain text,
// reasoning that the AI reports carry inline hex colours and injecting them
// would defeat theming. That was WRONG, and it was the second time the same
// reasoning produced the same defect -- the Otto story field got the identical
// treatment. Stripping to text destroyed the links, tables, headers, lists and
// spacing that the agent generated FOR A HUMAN TO READ. Protecting the palette
// is worth nothing if the content becomes unreadable.
//
// The real answer was already in the package. aiux-record-html-content, read
// from components/activity-stream/html/html-content.ts, is the element the
// platform's own journal tile renders for a body -- the tile calls the
// HTMLContent helper with payload.content and nothing else. That element
// sanitises with sanitize-html and renders through the unsafeHTML directive.
// Its allowlist, read from html-sanitizer.ts, keeps table, thead, tbody, tr,
// th, td, h1 through h6, ul, ol, li, dl, dt, dd, strong, em, code, pre,
// blockquote, img and anchors -- rewriting every anchor to open in a new tab
// with noopener and noreferrer -- while discarding script, style, iframe,
// object, embed, base, link, meta and form, and stripping every on-prefixed
// handler attribute. The style attribute IS on its allowed list, so the
// agent's own formatting survives intact.
//
// It has its own shadow root, so this component cannot and does not restyle
// its internals: the report renders as the agent composed it. Sanitisation is
// the platform's, not ours -- no hand-rolled sanitiser to own or get wrong.
//
// Plain text is still used for exactly two things that are text by nature: the
// collapsed one-line snippet, and the search haystack.

// Journal bodies arrive wrapped in [code] ... [/code] by the platform's HTML
// journal handling. That is a literal string, not a tag, so tag-stripping
// leaves it behind.
const CODE_WRAPPER = /\[\/?code\]/gi;

// Legacy record URLs in generated note bodies -- Configurable Workspace and
// classic .do links -- are rewritten to portal routes, and clicks on them are
// routed client-side. Both live in portalise-links.js, because the regulatory
// report's document field needs exactly the same transform and a second copy
// would drift on the next URL shape anyone adds.
function stripCodeWrapper(content) {
  return String(content).replace(CODE_WRAPPER, '');
}

function bodyText(content) {
  if (!content) return '';
  return toPlainText(stripCodeWrapper(content));
}

// The body handed to the platform's renderer. The [code] wrapper is removed
// first: it is literal text, so sanitising would preserve it and the reader
// would see the marker above every AI report. If the platform already strips
// it upstream this is a no-op.
function richBody(content) {
  if (!content) return '';
  return portaliseLinks(stripCodeWrapper(content).trim());
}

// First meaningful line, for the collapsed row.
function snippetOf(text, max = 140) {
  if (!text) return '';
  const firstLine = text.split('\n').find(line => line.trim().length > 0) || '';
  const clean = firstLine.trim();
  if (clean.length <= max) return clean;
  // Break on a word boundary so the ellipsis does not cut mid-word.
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}\u2026`;
}

const FILTER_ALL = 'all';
const FILTER_NOTES = 'notes';
const FILTER_AI = 'ai';
const FILTER_SYSTEM = 'system';

@customElement('x-snc-slux-rv-activity')
export default class RvActivity extends AIUXRecordElement {
  // Form is declared alongside Activity because the entry's kind label comes
  // from the journal field's own dictionary label via apis.form.fields --
  // the same lookup ActivityAPI itself uses for tile styling.
  static requiredAPIs = [RecordAPIKey.Activity, RecordAPIKey.Form];

  static properties = {
    _expanded: {state: true},
    _loading: {state: true},
    _filter: {state: true},
    _search: {state: true},
    _openGroups: {state: true}
  };

  constructor() {
    super();
    // Assigned here, not as class fields: a class field initializer shadows
    // the accessor Lit generates from static properties and silences
    // reactivity.
    this._expanded = new Set();
    this._loading = new Set();
    this._openGroups = new Set();
    this._filter = FILTER_ALL;
    this._search = '';
  }

  static styles = [
    rvTokens,
    rvPrimitives,
    css`
      :host {
        display: block;
      }

      .rv-stack {
        display: flex;
        flex-direction: column;
        gap: var(--rv-grid-gap, 18px);
      }

      h2 {
        margin: 0 0 14px;
      }

      /* FILTER BAR */
      .rv-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }

      .rv-search {
        flex: 1 1 14rem;
        min-inline-size: 10rem;
        min-height: var(--rv-touch-target, 44px);
        box-sizing: border-box;
        padding: 8px 12px;
        border: 1px solid var(--rv-surface-hairline, #e5e3dd);
        border-radius: var(--rv-radius-control, 8px);
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-primary, #1b1b19);
        font: inherit;
      }

      .rv-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      /* A filter is a toggle, so it is a real button with aria-pressed rather
         than a styled div -- that is what makes its state audible. */
      .rv-filter {
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

      .rv-filter[aria-pressed='true'] {
        background: var(--rv-action-primary, #0e2b3d);
        border-color: transparent;
        color: var(--rv-action-primary-text, #fff);
      }

      /* DAY GROUPS. The header sticks while its own rows scroll past. */
      .rv-day {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 6px 0;
        margin: 0;
        background: var(--rv-surface-card, #fff);
        color: var(--rv-ink-muted, #5b5a55);
        font-size: var(--rv-size-label, 12px);
        font-weight: var(--rv-weight-semibold, 600);
        border-block-end: 1px solid var(--rv-surface-hairline, #e5e3dd);
      }

      ol {
        list-style: none;
        margin: 0 0 4px;
        padding: 0;
      }

      li {
        border-block-end: 1px solid var(--rv-surface-hairline, #e5e3dd);
      }

      li:last-child {
        border-block-end: 0;
      }

      /* THE COLLAPSED ROW. A button spanning the row: the whole line is the
         target, which is what makes a 44px row usable on touch. */
      .rv-row {
        appearance: none;
        -webkit-appearance: none;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        min-height: var(--rv-touch-target, 44px);
        box-sizing: border-box;
        padding: 10px 4px;
        border: 0;
        background: none;
        font: inherit;
        color: var(--rv-ink-primary, #1b1b19);
        text-align: start;
        cursor: pointer;
      }

      .rv-row:hover {
        background: var(--rv-surface-tile, #f4f3ef);
      }

      .rv-initials {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 28px;
        block-size: 28px;
        border-radius: var(--rv-radius-pill, 999px);
        background: var(--rv-surface-control, #dad8d2);
        color: var(--rv-ink-secondary, #3f3e3a);
        font-size: var(--rv-size-caption, 11px);
        font-weight: var(--rv-weight-semibold, 600);
      }

      .rv-row-main {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .rv-row-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      /* Collapsed: exactly one line, clipped. Expanded rows use .rv-body. */
      .rv-snippet {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--rv-ink-secondary, #3f3e3a);
      }

      .rv-caret {
        flex: 0 0 auto;
        margin-block-start: 4px;
        color: var(--rv-ink-muted, #5b5a55);
        /* Literal duration and easing: the theme's motion token NAMES were not
           read from source in this session, and an invented custom-property
           name would silently fall back here anyway. 120ms linear is the
           reduced-risk choice for a decorative caret rotation. */
        transition: transform 120ms linear;
      }

      .rv-row[aria-expanded='true'] .rv-caret {
        transform: rotate(90deg);
      }

      @media (prefers-reduced-motion: reduce) {
        .rv-caret {
          transition: none;
        }
      }

      /* THE EXPANDED BODY. It holds aiux-record-html-content, which renders
         the sanitised report inside its OWN shadow root -- so no rule here can
         reach the tables, headings or links, and none tries to. The agent's
         formatting is the point.
         white-space is deliberately NOT pre-line: that was correct when the
         body was plain text, and would now add a spurious blank line for every
         newline in the HTML source.
         overflow-x contains a wide table inside the card instead of letting it
         scroll the page -- SPEC section 6. */
      .rv-body {
        margin: 0 0 12px 42px;
        padding: 12px 14px;
        border-radius: var(--rv-radius-tile, 8px);
        background: var(--rv-surface-tile, #f4f3ef);
        overflow-x: auto;
        overflow-wrap: anywhere;
        color: var(--rv-ink-primary, #1b1b19);
      }

      .rv-empty {
        margin: 0;
        color: var(--rv-ink-muted, #5b5a55);
      }

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

      @media (forced-colors: active) {
        .rv-filter[aria-pressed='true'] {
          background: Highlight;
          color: HighlightText;
        }
      }
    `
  ];

  // ---- CLASSIFICATION, all from fields ---------------------------------

  // A posted note has journal content and a journal subtype. Anything else --
  // field changes, relationship updates -- is a system update, which is what
  // gets collapsed into a single row when several occur in a run.
  _isNote(event) {
    const payload = event?.payload || {};
    return Boolean(payload.content) && Boolean(event?.subtype);
  }

  _isAi(event) {
    const payload = event?.payload || {};
    if (payload.representedBy) return true;
    const author = this._record.apis.activity.getUserInfo(event.createdBy);
    return Boolean(author?.ai) && author.ai !== 'NONE';
  }

  // The kind label is the journal field's own dictionary label, so it reads
  // "Work notes" / "Additional comments" exactly as the form does, in the
  // user's language, rather than a hardcoded map of field names.
  _kindLabel(event) {
    const field = this._record.apis.form?.fields?.[event.subtype];
    if (field?.label) return field.label;
    if (!this._isNote(event)) return i18n.getMessage('Update');
    return i18n.getMessage('Note');
  }

  _author(event) {
    const info = this._record.apis.activity.getUserInfo(event.createdBy);
    return {
      name: info?.displayName || event.createdBy || '',
      initials: info?.initials || ''
    };
  }

  // ---- FORMATTING, locale-aware ----------------------------------------

  _dayKey(ts) {
    const d = new Date(ts);
    // Local calendar day, not a UTC slice: grouping must match the dates the
    // user sees in the rows.
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  _dayLabel(ts) {
    try {
      return new Intl.DateTimeFormat(undefined, {dateStyle: 'full'}).format(
        new Date(ts)
      );
    } catch {
      return '';
    }
  }

  _timeLabel(ts) {
    try {
      return new Intl.DateTimeFormat(undefined, {timeStyle: 'short'}).format(
        new Date(ts)
      );
    } catch {
      return '';
    }
  }

  // ---- FILTERING -------------------------------------------------------

  _matchesFilter(entry) {
    switch (this._filter) {
      case FILTER_NOTES:
        return entry.isNote && !entry.isAi;
      case FILTER_AI:
        return entry.isAi;
      case FILTER_SYSTEM:
        return !entry.isNote;
      default:
        return true;
    }
  }

  _matchesSearch(entry) {
    const needle = this._search.trim().toLowerCase();
    if (!needle) return true;
    return (
      entry.text.toLowerCase().includes(needle) ||
      entry.author.name.toLowerCase().includes(needle) ||
      entry.kind.toLowerCase().includes(needle)
    );
  }

  // ---- INTERACTION -----------------------------------------------------

  async _toggle(entry) {
    const next = new Set(this._expanded);
    if (next.has(entry.sysId)) {
      next.delete(entry.sysId);
      this._expanded = next;
      return;
    }
    next.add(entry.sysId);
    this._expanded = next;

    // A truncated body is fetched on demand through the platform's own path.
    // Loading is tracked locally rather than reading payload.contentState,
    // whose enum values were not confirmed from source in this session.
    if (entry.truncated && !this._loading.has(entry.sysId)) {
      const loading = new Set(this._loading);
      loading.add(entry.sysId);
      this._loading = loading;
      try {
        await this._record.apis.activity.fetchFullContent(entry.sysId);
      } finally {
        const done = new Set(this._loading);
        done.delete(entry.sysId);
        this._loading = done;
      }
    }
  }

  _toggleGroup(key) {
    const next = new Set(this._openGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._openGroups = next;
  }

  _setFilter(value) {
    this._filter = value;
  }

  // ---- RENDER ----------------------------------------------------------

  _renderFilters() {
    const options = [
      {id: FILTER_ALL, label: i18n.getMessage('All')},
      {id: FILTER_NOTES, label: i18n.getMessage('Notes')},
      {id: FILTER_AI, label: i18n.getMessage('AI')},
      {id: FILTER_SYSTEM, label: i18n.getMessage('Updates')}
    ];

    return html`
      <div class="rv-filters">
        <input
          class="rv-search"
          type="search"
          .value=${this._search}
          placeholder=${i18n.getMessage('Search activity')}
          aria-label=${i18n.getMessage('Search activity')}
          @input=${e => {
            this._search = e.target.value;
          }}
        />
        <div
          class="rv-chips"
          role="group"
          aria-label=${i18n.getMessage('Filter activity by type')}
        >
          ${options.map(
            option => html`
              <button
                type="button"
                class="rv-filter rv-focusable"
                aria-pressed=${this._filter === option.id ? 'true' : 'false'}
                @click=${() => this._setFilter(option.id)}
              >
                ${option.label}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  // Anchors inside a note body route client-side rather than opening the new
  // tab the sanitiser asks for. See portalise-links.js for why the href
  // rewrite alone is not enough.
  _handleBodyClick = e => {
    interceptPortalLinkClick(e, experienceBasePath());
  };

  _renderEntry(entry) {
    const open = this._expanded.has(entry.sysId);
    const loading = this._loading.has(entry.sysId);

    return html`
      <li>
        <button
          type="button"
          class="rv-row rv-focusable"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggle(entry)}
        >
          <span class="rv-initials" aria-hidden="true">${entry.author.initials}</span>
          <span class="rv-row-main">
            <span class="rv-row-meta">
              <span class="rv-type-body">${entry.author.name}</span>
              <span class="rv-chip" data-tone=${entry.isAi ? 'info' : 'neutral'}>
                ${entry.isAi ? i18n.getMessage('AI') : entry.kind}
              </span>
              <span class="rv-type-caption">${entry.time}</span>
            </span>
            ${open
              ? nothing
              : html`<span class="rv-snippet rv-type-caption"
                  >${entry.snippet}</span
                >`}
          </span>
          <span class="rv-caret" aria-hidden="true">&#8250;</span>
        </button>
        ${open
          ? html`<div class="rv-body" @click=${this._handleBodyClick}>
              ${loading
                ? html`<p class="rv-type-body">
                    ${i18n.getMessage('Loading the full note\u2026')}
                  </p>`
                : html`<aiux-record-html-content
                    .content=${entry.rich}
                  ></aiux-record-html-content>`}
            </div>`
          : nothing}
      </li>
    `;
  }

  // A run of consecutive system updates becomes ONE row -- ACCEPTANCE:
  // "consecutive system updates collapse into one expandable row". Expanding
  // it lists the individual updates; it never hides a posted note.
  _renderSystemRun(run, key) {
    const open = this._openGroups.has(key);
    return html`
      <li>
        <button
          type="button"
          class="rv-row rv-focusable"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggleGroup(key)}
        >
          <span class="rv-initials" aria-hidden="true">&#8943;</span>
          <span class="rv-row-main">
            <span class="rv-row-meta">
              <span class="rv-type-body">
                ${i18n.getMessage('{count} system updates', {
                  count: run.length
                })}
              </span>
              <span class="rv-type-caption">${run[run.length - 1].time}</span>
            </span>
          </span>
          <span class="rv-caret" aria-hidden="true">&#8250;</span>
        </button>
        ${open
          ? html`<ol>${run.map(entry => this._renderEntry(entry))}</ol>`
          : nothing}
      </li>
    `;
  }

  render() {
    const activity = this._record.apis.activity;
    const events = activity?.events || [];

    const entries = events
      .map(event => {
        const payload = event.payload || {};
        const text = bodyText(payload.content);
        const isNote = this._isNote(event);
        return {
          sysId: event.sysId,
          timestamp: event.timestamp,
          isNote,
          isAi: this._isAi(event),
          kind: this._kindLabel(event),
          author: this._author(event),
          time: this._timeLabel(event.timestamp),
          truncated: Boolean(payload.truncated),
          text,
          rich: richBody(payload.content),
          snippet: snippetOf(text)
        };
      })
      .filter(entry => this._matchesFilter(entry))
      .filter(entry => this._matchesSearch(entry));

    // Day groups, newest first -- the events arrive sorted descending.
    const days = [];
    for (const entry of entries) {
      const key = this._dayKey(entry.timestamp);
      const last = days[days.length - 1];
      if (last && last.key === key) last.entries.push(entry);
      else days.push({key, label: this._dayLabel(entry.timestamp), entries: [entry]});
    }

    return html`
      <div class="rv-stack">
        <section class="rv-card" aria-labelledby="rv-compose-h">
          <h2 id="rv-compose-h" class="rv-type-section">
            ${i18n.getMessage('Add a note')}
          </h2>
          <aiux-record-activity-compose main></aiux-record-activity-compose>
        </section>

        <section class="rv-card" aria-labelledby="rv-activity-h">
          <h2 id="rv-activity-h" class="rv-type-section">
            ${i18n.getMessage('History')}
          </h2>
          ${this._renderFilters()}
          ${days.length
            ? days.map(
                day => html`
                  <h3 class="rv-day">${day.label}</h3>
                  <ol>
                    ${(() => {
                      // Collapse consecutive system updates into one row.
                      const out = [];
                      let run = [];
                      const flush = () => {
                        if (!run.length) return;
                        if (run.length === 1) out.push(this._renderEntry(run[0]));
                        else
                          out.push(
                            this._renderSystemRun(run, `${day.key}-${run[0].sysId}`)
                          );
                        run = [];
                      };
                      for (const entry of day.entries) {
                        if (entry.isNote) {
                          flush();
                          out.push(this._renderEntry(entry));
                        } else {
                          run.push(entry);
                        }
                      }
                      flush();
                      return out;
                    })()}
                  </ol>
                `
              )
            : html`<p class="rv-empty rv-type-body">
                ${this._search || this._filter !== FILTER_ALL
                  ? i18n.getMessage('No activity matches these filters.')
                  : i18n.getMessage('No activity has been recorded yet.')}
              </p>`}
        </section>
      </div>
    `;
  }
}
