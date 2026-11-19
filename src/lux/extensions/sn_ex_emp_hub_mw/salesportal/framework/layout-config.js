// Layout config loader -- DATA_CONTRACT.md section 1.
//
// Resolves a layout config from a table name plus an optional condition, and
// falls back to a generic default config when nothing matches.
//
// ===========================================================================
// STORAGE DECISION: JS MODULES BEHIND AN INTERFACE. NOT A FLUENT TABLE. NOT
// BOTH.
// ===========================================================================
// DATA_CONTRACT suggests a scoped table (x_record_view_config). This
// implementation reads configs from JS modules in ./configs/ instead, behind
// the LayoutConfigSource interface below. Reasons, in order of weight:
//
// 1. Scope x_snc_slux owns zero tables today. Creating one means authoring
//    Fluent metadata at src/fluent/**.now.ts and running a build and install
//    to bring the table into existence -- and build and install are user
//    actions that this step cannot perform or verify. Shipping a loader that
//    queries a table which does not exist yet would be a loader that cannot
//    run at all, whereas a module source works the moment the page renders.
//
// 2. A config is deployed artefact, not user data. It changes when the app
//    changes, so it travels correctly in the application's source rather than
//    as records that have to be migrated between instances separately.
//
// 3. The read path is identical either way. Resolution, condition matching,
//    normalisation and the default fallback are all in this file and know
//    nothing about where the rows came from. Only listForTable differs.
//
// WHAT THE TABLE-BACKED VERSION WOULD NEED, so this is a seam and not a dead
// end:
//   - A Fluent Table() at src/fluent/ with columns: table (string, the target
//     table name), condition (conditions or string), config (a JSON string, or
//     the schema split into columns), active (boolean), order (integer, to
//     make the most-specific-wins ordering explicit rather than implied).
//     The Fluent Table() and column APIs must be looked up with
//     search_fluent_docs and explain_fluent_doc first -- they must not be
//     written from memory.
//   - A GlideRecordSecure read, which means a server trip: either a page
//     loader using fetchDataResource, or a widget server script. That makes
//     listForTable genuinely async, which is why it is already async here even
//     though the module source resolves synchronously. Nothing downstream has
//     to change when it starts awaiting a network call.
//   - Condition evaluation could then move server-side and use the real
//     encoded-query engine, which would remove the bounded matcher below and
//     its fail-closed limitation entirely. That is the main functional reason
//     to eventually prefer the table.
//
// No part of a table-backed implementation is half-built here. The interface
// is the whole of it.

import {DEFAULT_CONFIG_ID, getConfigsForTable} from './configs/index.js';

// ---------------------------------------------------------------------------
// CONDITION MATCHING
// ---------------------------------------------------------------------------
// A deliberately BOUNDED subset of ServiceNow encoded-query syntax, evaluated
// against a flat map of already-resolved record values.
//
// It is bounded because a faithful client-side encoded-query engine is a large
// thing to get subtly wrong, and a condition that is wrongly judged true would
// put a record into the Intelligent view on the strength of a config that was
// never meant for it.
//
// SUPPORTED:
//   ^            AND between terms
//   ^OR          OR between terms
//   field=value          equals (string compare on the display or raw value)
//   field!=value         not equals
//   field ISEMPTY        empty, null or absent
//   field ISNOTEMPTY     present and non-empty
//   field INa,b,c        value is one of
//   field STARTSWITHx    prefix
//   field LIKEx          substring
//
// EVERYTHING ELSE FAILS CLOSED. An operator this does not recognise makes the
// whole condition evaluate false, so the config does not match and resolution
// falls through to the default config. Failing closed rather than open is the
// point: an unparseable condition must never be treated as "applies to
// everything".
//
// Pure and exported so it can be exercised directly without a render.

const OPERATORS = [
  'ISNOTEMPTY',
  'ISEMPTY',
  'STARTSWITH',
  'LIKE',
  'IN',
  '!=',
  '='
];

function valueOf(values, field) {
  if (!values || typeof values !== 'object') return undefined;
  if (Object.hasOwn(values, field)) return values[field];
  return undefined;
}

function isEmptyValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

// Picks the operator that occurs EARLIEST in the term, breaking ties by the
// longest token.
//
// Choosing by list order instead would misparse any term whose VALUE contains
// an operator token: state=INTAKE would bind IN at index 6 before = at index
// 5, yielding field "state=", operator IN, operand "TAKE" -- a term that then
// evaluates false for a record that genuinely matches. Earliest-wins makes the
// separator the first operator after the field name, which is what encoded
// query syntax actually means. The longest-token tie-break is what keeps != 
// from being read as = at the same position, and ISNOTEMPTY from being read as
// a shorter token sharing its start.
function findOperator(term) {
  let best = null;
  for (const token of OPERATORS) {
    const at = term.indexOf(token);
    // at === 0 would leave an empty field name, so it is not a candidate.
    if (at <= 0) continue;
    if (
      !best ||
      at < best.at ||
      (at === best.at && token.length > best.token.length)
    ) {
      best = {token, at};
    }
  }
  return best;
}

function evaluateTerm(term, values) {
  const trimmed = String(term || '').trim();
  if (!trimmed) return false;

  const found = findOperator(trimmed);
  if (!found) return false;

  const {token, at} = found;
  const field = trimmed.slice(0, at).trim();
  const operand = trimmed.slice(at + token.length).trim();
  if (!field) return false;

  const raw = valueOf(values, field);
  const actual = isEmptyValue(raw) ? '' : String(raw);

  switch (token) {
    case 'ISEMPTY':
      return isEmptyValue(raw);
    case 'ISNOTEMPTY':
      return !isEmptyValue(raw);
    case '=':
      return actual === operand;
    case '!=':
      return actual !== operand;
    case 'IN':
      return operand
        .split(',')
        .map(part => part.trim())
        .includes(actual);
    case 'STARTSWITH':
      return actual.toLowerCase().startsWith(operand.toLowerCase());
    case 'LIKE':
      return actual.toLowerCase().includes(operand.toLowerCase());
    default:
      return false;
  }
}

// Returns true only when every term is satisfied. An empty or absent condition
// means "applies to every record of this table" and matches.
export function matchesCondition(condition, values) {
  const text = String(condition || '').trim();
  if (!text) return true;

  // A design placeholder is not a query. The sample config shipped with an
  // angle-bracketed note where the condition belongs; treating that as a query
  // would make every term unparseable and silently disable the config. Reject
  // it loudly instead by never matching, and let the caller see the reason.
  if (text.startsWith('<') && text.endsWith('>')) return false;

  // OR groups split first, then AND terms inside each group.
  const orGroups = text.split('^OR');
  return orGroups.some(group => {
    const terms = group
      .split('^')
      .map(term => term.trim())
      .filter(Boolean);
    if (!terms.length) return false;
    return terms.every(term => evaluateTerm(term, values));
  });
}

// ---------------------------------------------------------------------------
// NORMALISATION
// ---------------------------------------------------------------------------
// Everything downstream reads a predictable shape, so a config that omits an
// optional key cannot produce an undefined-property crash in a component.
//
// children is preserved here. DATA_CONTRACT: "children on a grid entry
// composes components (SplitProgress with TaskTable)". It is normalised to an
// array of entry-like objects so a child can be either a bare type string --
// as in the shipped sample, which writes "children": ["TaskTable"] -- or a
// full object with its own source, without the consumer having to branch.

export function normalizeGridEntry(entry) {
  if (!entry || !entry.type) return null;
  const children = Array.isArray(entry.children) ? entry.children : [];
  return {
    id: entry.id || entry.type,
    type: entry.type,
    span: entry.span === undefined ? 12 : entry.span,
    source: entry.source || null,
    children: children
      .map(child =>
        typeof child === 'string'
          ? {id: child, type: child, source: null, children: []}
          : normalizeGridEntry(child)
      )
      .filter(Boolean)
  };
}

export function normalizeConfig(config) {
  if (!config) return null;
  const grid = Array.isArray(config.grid) ? config.grid : [];
  const dock = config.dock;

  return {
    id: config.id || null,
    table: config.table || null,
    condition: config.condition || null,
    // The sys_ui_view NAME the Details body reads. Normalised here so every
    // consumer sees the key even when a config omits it; null means "let the
    // platform resolve the view", which is the pre-existing behaviour.
    formView: config.formView || null,
    // The Details field groups. Normalised so every consumer sees the key,
    // and so a config that declares none yields an empty group list rather
    // than undefined -- which a caller would otherwise have to guard.
    details: {
      groups: Array.isArray(config.details?.groups)
        ? config.details.groups
        : []
    },
    header: {
      title: config.header?.title || null,
      chips: Array.isArray(config.header?.chips) ? [...config.header.chips] : []
    },
    views: Array.isArray(config.views) ? [...config.views] : null,
    grid: grid.map(normalizeGridEntry).filter(Boolean),
    // dock is a single entry in the schema, normalised to an array so the
    // shell's dock property has one shape regardless.
    dock: dock
      ? [normalizeGridEntry(dock)].filter(Boolean)
      : [],
    activity: config.activity ? {...config.activity} : null
  };
}

// ---------------------------------------------------------------------------
// THE DEFAULT CONFIG
// ---------------------------------------------------------------------------
// DATA_CONTRACT section 1, verbatim: "fall back to a default config:
// PageHeader, OttoBrief, FactList, OttoDock (and Details only if no Otto
// payload)".
//
// PageHeader is the header block, which is always present, so it appears as
// the header key rather than as a grid entry.
//
// It names NO FIELDS. It is the config that applies to any table at all, so a
// field name here would be a lie on every table but one. header.title is null,
// which tells the caller to use the record's own display value; chips is
// empty. That is also what keeps ACCEPTANCE's no-field-names rule true for the
// generic path.

export function buildDefaultConfig({hasOttoPayload = false} = {}) {
  const grid = [
    {id: 'brief', type: 'OttoBrief', span: 12, source: 'otto.brief'},
    {id: 'facts', type: 'FactList', span: 12, source: 'record.fields'}
  ];

  // Details earns a place only when there is no Otto payload to show. With a
  // payload the Details view is still reachable from the switch; this is about
  // not leaving the default body empty when Otto has nothing to contribute.
  if (!hasOttoPayload) {
    grid.push({
      id: 'details',
      type: 'RecordFields',
      span: 12,
      source: 'record.fields'
    });
  }

  return normalizeConfig({
    id: DEFAULT_CONFIG_ID,
    table: null,
    condition: null,
    header: {title: null, chips: []},
    grid,
    dock: {type: 'OttoDock', source: 'otto.findings'}
  });
}

// ---------------------------------------------------------------------------
// THE SOURCE INTERFACE
// ---------------------------------------------------------------------------
// One method. A table-backed implementation subclasses this and nothing else
// in the framework changes.

export class LayoutConfigSource {
  // Returns a promise for an array of raw config objects whose table matches.
  // Ordering is the source's responsibility: earlier entries win.
  async listForTable(_table) {
    return [];
  }
}

export class ModuleLayoutConfigSource extends LayoutConfigSource {
  async listForTable(table) {
    return getConfigsForTable(table);
  }
}

// ---------------------------------------------------------------------------
// THE TABLE-LEVEL FORM VIEW
// ---------------------------------------------------------------------------
// The one piece of config a LOADER can resolve, because it depends on the
// table alone and not on any record value.
//
// It exists separately from selectConfig for a sequencing reason: the form
// view has to be known BEFORE the record is fetched, since it is part of the
// fetch itself, while condition matching needs the record values that fetch
// returns. Trying to serve both from one call would be circular.
//
// A condition-bearing config may still name a view -- a config for a subset of
// records could legitimately want a different form -- so conditional entries
// are considered too, in candidate order. Without a record to test against,
// the first declared view for the table is the only defensible choice, and it
// is reported so a caller can see which config supplied it.

export function resolveFormView(table, candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  for (const candidate of list) {
    if (!candidate || candidate.active === false) continue;
    const view = String(candidate.formView || '').trim();
    if (view) return {view, from: candidate.id || null};
  }
  return {view: '', from: null};
}

// ---------------------------------------------------------------------------
// SELECTION -- the pure core
// ---------------------------------------------------------------------------
// Most specific wins: a config WITH a condition that matches beats a config
// with no condition, which beats the default. Within the same specificity the
// candidate order decides.
//
// Separated from resolveLayoutConfig because it is SYNCHRONOUS, and the only
// place real record values exist is inside a record-context element's
// render(), which cannot await. A record-aware caller pairs this with
// getConfigsForTable(); an async source pairs it with resolveLayoutConfig
// below. One algorithm, two entry points -- not two implementations.
//
// Returns {config, matched, reason}. reason is there so a caller can say why a
// record got the default config instead of leaving it a mystery, and the
// richness gate reads matched to decide whether the Intelligent view may be
// offered at all.

export function selectConfig(
  candidates,
  {recordValues = {}, hasOttoPayload = false} = {}
) {
  const list = Array.isArray(candidates) ? candidates : [];

  const conditional = [];
  const unconditional = [];
  for (const candidate of list) {
    if (!candidate || candidate.active === false) continue;
    if (String(candidate.condition || '').trim()) conditional.push(candidate);
    else unconditional.push(candidate);
  }

  for (const candidate of conditional) {
    if (matchesCondition(candidate.condition, recordValues)) {
      return {
        config: normalizeConfig(candidate),
        matched: true,
        reason: 'condition-match'
      };
    }
  }

  if (unconditional.length) {
    return {
      config: normalizeConfig(unconditional[0]),
      matched: true,
      reason: 'table-match'
    };
  }

  return {
    config: buildDefaultConfig({hasOttoPayload}),
    matched: false,
    reason: list.length ? 'condition-no-match' : 'no-config-for-table'
  };
}

// ---------------------------------------------------------------------------
// RESOLUTION -- the async entry point
// ---------------------------------------------------------------------------

export async function resolveLayoutConfig({
  table,
  recordValues = {},
  hasOttoPayload = false,
  source = new ModuleLayoutConfigSource()
} = {}) {
  if (!table) {
    return {
      config: buildDefaultConfig({hasOttoPayload}),
      matched: false,
      reason: 'no-table'
    };
  }

  let candidates = [];
  try {
    candidates = (await source.listForTable(table)) || [];
  } catch (error) {
    // A source failure must not take the page down: the default config is a
    // complete, renderable config.
    return {
      config: buildDefaultConfig({hasOttoPayload}),
      matched: false,
      reason: 'source-error: ' + (error?.message || 'unknown')
    };
  }

  return selectConfig(candidates, {recordValues, hasOttoPayload});
}
