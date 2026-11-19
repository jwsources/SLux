import {css, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXRecordElement,
  RecordAPIKey
} from '@servicenow/aiux/aiux-components-record';
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {getConfigsForTable} from './configs/index.js';
import {selectConfig} from './layout-config.js';
import './page-header.js';

// HEADER ADAPTER -- binds a layout config's header block to the record, and
// hands the result to the generic PageHeader.
//
// PageHeader itself knows nothing about records: it takes a title, chips,
// breadcrumb and actions. Something has to turn "the config says the title is
// this field" into "the title is this text", and that something has to be a
// record-context element. This is it, and it is the only record-aware file in
// the framework.
//
// IT STILL CONTAINS NO FIELD NAMES. Every field name arrives in the config.
// What this file contains is the CONVENTIONS for reading a config header:
//   header.title          a field name; its display value becomes the title
//   header.chips[]        either a field name, or "<field>.empty", or an
//                         object {field, tone, label}
//
// THE ".empty" CONVENTION is why this adapter exists rather than a plain field
// list. ACCEPTANCE requires that a genuinely empty owner field shows a "not
// set" chip rather than silently vanishing, and the subject record has an
// empty owner field. A chip spec ending ".empty" renders ONLY when the field
// is empty, with a warning tone. A plain field spec renders only when the
// field HAS a value. Between them, emptiness is always visible and never
// mistaken for absence.
//
// FIELD-API CONTRACT, taken from the existing components on this page, which
// read it from the installed package (FormAPI.ts):
//   formApi.fields is Record<string, GlideFormField>
//   a field has .visible, .label, .displayValue, .value
// formApi.fields is the getter that applies personalization; getField() does
// not, so it is not used.
//
// this._record is read ONLY in render(). AIUXRecordElement throws
// "AIUXRecordElement must be used within AIUXRecordProvider" when the context
// is read earlier, and names connectedCallback as the usual cause.

const EMPTY_SUFFIX = '.empty';

// A choice field whose dictionary choice attribute is unset does NOT get its
// label resolved by the platform: both value and displayValue come back as the
// stored key. Measured on x_snc_pmdemo_regulatory_flag -- getValue and
// getDisplayValue BOTH returned "reportable", while sys_choice holds
// "reportable = Reportable". So the chip printed the raw key, and
// "needs_review" rendered as that literal string.
//
// This humanises a key rather than inventing a label: underscores to spaces,
// first letter capitalised. It is the same transformation already used for
// section captions, and it is applied ONLY when the display value is
// indistinguishable from the stored value AND looks like a key -- so a real
// label such as "1 - Critical" is never touched.
const KEY_SHAPED = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function humaniseKey(text) {
  return text
    .replace(/_/g, ' ')
    .replace(/^\p{Ll}/u, c => c.toUpperCase());
}

// ONE FIELD READ, RECORD FIRST.
//
// Returns {value, display} for a field, or null when neither source has it.
//
// WHY THE RECORD COMES FIRST. Chips used to resolve only through
// formApi.fields -- the resolved FORM LAYOUT -- and bailed out when the field
// was absent or hidden. So a field the current view does not carry could never
// produce a chip, however real the value.
//
// Measured: major_case_state is on the case, major_case and workspace views and
// NOT on Default view. With no view forced the platform resolves Default, so
// CS0001624 -- major_case_state 'accepted' -- showed no Major case chip. That
// is the fifth symptom of one root cause: a form layout is an agent editing
// surface, not a read model. Details was moved off it; the header kept it.
//
// The record read (the same payload Details uses) is now primary. The layout
// stays as a FALLBACK, and as the only source of a human field LABEL, which
// the Table API does not return.
function cellOf(row, fields, name) {
  const cell = row?.[name];
  if (cell !== undefined && cell !== null) {
    if (typeof cell === 'object') {
      const value = cell.value ?? '';
      return {
        value: String(value),
        display: String(cell.display_value ?? value ?? '')
      };
    }
    return {value: String(cell), display: String(cell)};
  }

  const field = fields?.[name];
  if (!field) return null;
  // A field the layout hides counts as absent -- but only when the record read
  // had nothing to say about it.
  if (field.visible === false) return null;
  const value = field.value ?? '';
  return {
    value: String(value),
    display: String(field.displayValue ?? value ?? '')
  };
}

// Chip text from a {value, display} pair, humanising a raw key.
//
// A choice field whose dictionary choice attribute is unset does NOT get its
// label resolved: value and display come back identical. Measured on
// x_snc_pmdemo_regulatory_flag -- both read "reportable" while sys_choice holds
// "reportable = Reportable". Humanising applies ONLY when display equals value
// AND the value looks like a key, so a real label such as "1 - Critical" is
// never touched.
function chipTextFrom(cell) {
  if (!cell) return '';
  const {value, display} = cell;
  const text = display || value || '';
  if (!text) return '';
  if (value === text && KEY_SHAPED.test(text)) return humaniseKey(text);
  return text;
}


function textOf(field) {
  if (!field) return '';
  const display = field.displayValue;
  if (display !== undefined && display !== null && String(display) !== '') {
    return String(display);
  }
  const value = field.value;
  if (value === undefined || value === null) return '';
  return String(value);
}

@customElement('x-snc-slux-rv-header-adapter')
export default class RvHeaderAdapter extends AIUXRecordElement {
  static requiredAPIs = [RecordAPIKey.Form];

  static properties = {
    // Table whose configs are candidates. Supplied by the page; the adapter
    // never hardcodes one.
    table: {attribute: 'table'},
    // The record read -- {field: {value, display_value}} from the loader. The
    // PRIMARY source for chips, so a chip no longer depends on the field being
    // on the resolved form view. See cellOf.
    row: {attribute: false},
    // Forwarded to the config selector so the default config can decide
    // whether to include Details.
    hasOttoPayload: {attribute: false},
    // [{label, href}] -- navigation, which the record cannot supply.
    breadcrumb: {attribute: false},
    // [{id, label, kind}] -- passed straight through to PageHeader.
    actions: {attribute: false},
    // Field name whose value is the subtitle, optional.
    subtitleField: {attribute: 'subtitle-field'}
  };

  static styles = css`
    :host {
      display: block;
    }
  `;

  constructor() {
    super();
    this.table = '';
    this.hasOttoPayload = false;
    this.breadcrumb = [];
    this.actions = [];
    this.subtitleField = '';
    this._reportedReason = '';
  }

  // Flattens the form's fields to the {fieldName: value} map the condition
  // matcher expects.
  //
  // RAW VALUES, NOT DISPLAY VALUES -- and this distinction is the whole
  // function. A config condition is an ENCODED QUERY, and an encoded query
  // compares raw stored values: state=10, not state=Open. Supplying display
  // text here made every condition on a choice or reference field fail
  // silently.
  //
  // Measured on the subject record: the condition is
  // x_snc_pmdemo_regulatory_flag=reportable, and that field's choice list is
  // "reportable = Reportable". textOf() prefers displayValue, so the map
  // carried "Reportable" and the comparison was
  //     "Reportable" === "reportable"   ->  false
  // The config never matched, resolution fell through to the default, and the
  // richness gate answered no-config-match and hid the Intelligent option
  // BEFORE ever looking at the payload. The field rendered correctly in
  // Details throughout, which is what made it look like a payload problem.
  //
  // field.value is the raw stored value; field.displayValue is the label.
  // Rendering uses textOf() and keeps preferring the label -- only matching
  // needs the raw value.
  _recordValues(formApi) {
    const fields = formApi?.fields || {};
    const values = {};
    for (const [name, field] of Object.entries(fields)) {
      const raw = field?.value;
      values[name] =
        raw === undefined || raw === null ? '' : String(raw);
    }
    return values;
  }

  // Lets the page learn which config won without the page needing record
  // context of its own. Fired only when the outcome changes, so it cannot loop
  // with a re-render.
  _report(resolution) {
    const signature = resolution.reason + '|' + (resolution.config?.id || '');
    if (signature === this._reportedReason) return;
    this._reportedReason = signature;
    this.dispatchEvent(
      new CustomEvent('rv-header-adapter:config', {
        detail: {
          config: resolution.config,
          matched: resolution.matched,
          reason: resolution.reason
        },
        bubbles: true,
        composed: true
      })
    );
  }

  _chipsFrom(formApi, config, row) {
    const specs = Array.isArray(config?.header?.chips)
      ? config.header.chips
      : [];
    const fields = formApi?.fields || {};
    const chips = [];

    for (const spec of specs) {
      const isObject = spec && typeof spec === 'object';
      const raw = isObject ? spec.field : spec;
      if (!raw || typeof raw !== 'string') continue;

      const wantsEmpty = raw.endsWith(EMPTY_SUFFIX);
      const fieldName = wantsEmpty
        ? raw.slice(0, -EMPTY_SUFFIX.length)
        : raw;

      const cell = cellOf(row, fields, fieldName);

      // Neither the record nor the layout knows this field, so a stale config
      // shows up as a missing chip rather than an empty pill.
      if (!cell) continue;

      const text = chipTextFrom(cell);
      // The layout is the only source of a human label; humanise the field
      // name when there is no layout entry.
      const label = fields[fieldName]?.label || humaniseKey(fieldName);

      if (wantsEmpty) {
        if (text) continue;
        chips.push({
          // "Assigned to not set" -- the chip carries the meaning as TEXT, so
          // the warning tone is emphasis and never the only signal.
          label:
            isObject && spec.label
              ? spec.label
              : i18n.getMessage('{fieldLabel} not set', {fieldLabel: label}),
          tone: isObject && spec.tone ? spec.tone : 'warning'
        });
        continue;
      }

      if (!text) continue;
      chips.push({
        label: isObject && spec.label ? spec.label : text,
        tone: isObject && spec.tone ? spec.tone : 'neutral'
      });
    }

    return chips;
  }

  render() {
    const formApi = this._record.apis.form;
    const fields = formApi?.fields || {};

    // The config is resolved HERE, not by the page, because this is the only
    // place real field values exist -- the page sits above the provider, and
    // the loader's record data is a raw GraphQL response with no flat value
    // map (verified in the record package's RecordDataManager). selectConfig
    // is the synchronous core of the same algorithm resolveLayoutConfig uses.
    const resolution = selectConfig(getConfigsForTable(this.table), {
      recordValues: this._recordValues(formApi),
      hasOttoPayload: this.hasOttoPayload === true
    });
    // Stashed for updated() rather than dispatched here: render() must stay
    // free of side effects.
    this._resolution = resolution;
    const config = resolution.config;

    const titleField = config?.header?.title;
    // A config with no title field leaves the title empty. The default config
    // deliberately has no title field, because it applies to every table and
    // could not name one honestly.
    // THE TITLE FALLS BACK TO THE RECORD READ.
    //
    // textOf(fields[titleField]) resolves against formApi.fields -- the FORM
    // LAYOUT -- so a title field the resolved view does not carry yields an
    // EMPTY h1. Measured on the account page: header.title is 'name', which
    // customer_account's form view does not expose, so the heading rendered
    // with no text at all while the breadcrumb beside it showed the name
    // correctly.
    //
    // This is the same form-layout-as-read-model coupling that cost five
    // fields on the case page. cellOf already prefers the record row over the
    // layout, so the title uses it too.
    const titleText = titleField
      ? chipTextFrom(cellOf(this.row, fields, titleField))
      : '';

    const subtitleText = this.subtitleField
      ? textOf(fields[this.subtitleField])
      : '';

    return html`
      <x-snc-slux-rv-page-header
        .breadcrumb=${this.breadcrumb || []}
        .title=${titleText}
        .subtitle=${subtitleText}
        .chips=${this._chipsFrom(formApi, config, this.row)}
        .actions=${this.actions || []}
      >
        <!--
          SLOT FORWARDING. A slot that is itself assigned to the parent's slot:
          content the PAGE puts in this adapter's "actions" slot is re-exposed
          to PageHeader's "actions" slot, so it lands on the right of the title
          row. Without the forward, the page would have to render the action
          bar as a sibling of the adapter, which is what previously stacked the
          buttons under the title. The slotted element stays in the page's
          light DOM throughout, which is what lets it resolve the record
          provider through context.
        -->
        <slot name="actions" slot="actions"></slot>
      </x-snc-slux-rv-page-header>
    `;
  }

  updated(changed) {
    super.updated?.(changed);
    if (this._resolution) this._report(this._resolution);
  }
}
