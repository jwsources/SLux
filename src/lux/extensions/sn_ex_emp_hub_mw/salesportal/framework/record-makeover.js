import {HIDDEN_TYPES, SHAPES, shapeOf} from './loaders/field-meta.js';

// THE GENERIC PAGE MAKEOVER.
//
// Turns a raw record into grouped, typed sections for a table nobody has
// configured. It replaces a derivation that returned ONE group holding every
// populated field in alphabetical order -- correct, complete and unreadable.
//
// A PURE FUNCTION of the row and, when available, the dictionary metadata.
// No I/O and no table names, so it works on any table.
//
// WHEN THE DICTIONARY IS PRESENT it decides every type, and the inference
// below is unused. The inference remains as the fallback for a table whose
// dictionary read failed, and it is strictly weaker: it cannot tell a
// reference from a choice when the value is empty, it cannot see read-only,
// and it cannot recognise a journal or a password at all.
//
// WHAT THE DATA ALONE TELLS US, all measured on this instance:
//
//   reference      the cell carries a link of the form
//                  /api/now/table/<table>/<sys_id>, which is the ONLY place
//                  the referenced table is named
//   choice         value differs from display_value -- priority is 1 against
//                  "1 - Critical"
//   boolean        value is 0 or 1 AND display_value is false or true --
//                  knowledge read 0 against "false"
//   date-time      the RAW value matches the platform's storage format, while
//                  the display value is locale-formatted -- opened_at stored
//                  2026-11-16 09:49:52, displayed 16-11-2026 09:49:52
//   html           the value opens with a tag -- report_document is 26,952
//                  characters of markup
//   plain number   value equals display and is all digits
//
// Everything else is a string, and its NAME is the remaining signal.
//
// GROUPING IS NAME-CLUSTER FIRST, TYPE SECOND. Fields sharing a leading token
// belong together more strongly than fields sharing a type: resolved_by,
// resolved_at and resolution_code are one story, and splitting them across a
// People section, a Dates section and a Status section is precisely the
// scatter that makes a generated page unreadable. So clusters are formed
// first, and the type buckets only receive what is left.

// Housekeeping columns. Present on every table, meaningful on none of them --
// except the four audit fields, which are collected into their own trailing
// section rather than discarded.
const SKIP = new Set([
  'sys_id',
  'sys_class_name',
  'sys_mod_count',
  'sys_tags',
  'sys_domain',
  'sys_domain_path',
  'sys_package',
  'sys_policy',
  'sys_scope',
  'sys_update_name',
  'sys_meta',
  'sys_name'
]);

const AUDIT = new Set([
  'sys_created_by',
  'sys_created_on',
  'sys_updated_by',
  'sys_updated_on'
]);

// Identity fields, in the order a reader looks for them.
const IDENTITY = ['number', 'name', 'short_description', 'description'];

// Tables whose references are PEOPLE rather than records. Matched on the
// referenced table from the link, so no field-name guessing.
const PEOPLE_TABLES = new Set([
  'sys_user',
  'sys_user_group',
  'customer_contact',
  'customer_account',
  'core_company'
]);

const REFERENCE_LINK = /\/api\/now\/table\/([^/]+)\//;
const DATE_RAW = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
const ALL_DIGITS = /^-?\d+(\.\d+)?$/;
const LOOKS_LIKE_HTML = /^\s*<[a-z!/]/i;
// A scope prefix, so a scoped field clusters on its real name rather than on
// the scope it happens to live in.
const SCOPE_PREFIX = /^x_[a-z0-9]+_[a-z0-9]+_/;

function readCell(row, name) {
  const raw = row?.[name];
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const value = raw.value ?? '';
    return {
      value: String(value),
      display: String(raw.display_value ?? value ?? ''),
      link: raw.link ? String(raw.link) : ''
    };
  }
  return {value: String(raw), display: String(raw), link: ''};
}

function classify(name, cell, meta) {
  // THE DICTIONARY WINS when it knows the field. Inference below is the
  // fallback for a table whose dictionary read failed, and it is strictly
  // worse: it cannot distinguish a reference from a choice when the value is
  // empty, and it cannot know read-only at all.
  const declared = meta?.[name]?.type;
  if (declared) {
    if (HIDDEN_TYPES.has(declared)) return {kind: 'hidden'};
    const shape = shapeOf(declared);
    if (shape === SHAPES.REFERENCE) {
      const table = meta[name].reference || '';
      return {kind: PEOPLE_TABLES.has(table) ? 'people' : 'reference', table};
    }
    if (shape === SHAPES.BOOLEAN) {
      return {kind: 'boolean', truthy: cell.value === '1'};
    }
    if (shape === SHAPES.HTML) return {kind: 'html'};
    if (shape === SHAPES.PROSE) return {kind: 'prose'};
    if (shape === SHAPES.DATE || shape === SHAPES.DURATION) {
      return {kind: 'date'};
    }
    if (shape === SHAPES.NUMBER) return {kind: 'number'};
    if (shape === SHAPES.CHOICE) return {kind: 'choice'};
    // A long plain string still earns the full row.
    if (cell.value.length > 180) return {kind: 'prose'};
    return {kind: 'text'};
  }

  if (cell.link) {
    const match = REFERENCE_LINK.exec(cell.link);
    const table = match ? match[1] : '';
    return {
      kind: PEOPLE_TABLES.has(table) ? 'people' : 'reference',
      table
    };
  }
  if (LOOKS_LIKE_HTML.test(cell.value)) return {kind: 'html'};
  const lowerDisplay = cell.display.toLowerCase();
  if (
    (cell.value === '0' || cell.value === '1') &&
    (lowerDisplay === 'false' || lowerDisplay === 'true')
  ) {
    return {kind: 'boolean', truthy: cell.value === '1'};
  }
  if (DATE_RAW.test(cell.value)) return {kind: 'date'};
  if (cell.value !== cell.display) return {kind: 'choice'};
  if (ALL_DIGITS.test(cell.value)) return {kind: 'number'};
  // Long prose earns the full row rather than a narrow column.
  if (cell.value.length > 180) return {kind: 'prose'};
  return {kind: 'text'};
}

// first_token of a field name, with any scope prefix removed.
function clusterKey(name) {
  const bare = name.replace(SCOPE_PREFIX, '');
  const token = bare.split('_')[0];
  // One-character and purely numeric tokens cluster nothing useful, and sys
  // is handled separately.
  if (!token || token.length < 3 || token === 'sys') return '';
  return token;
}

function humanise(text) {
  const spaced = String(text).replace(SCOPE_PREFIX, '').replace(/_/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function spec(name, info) {
  return {
    field: name,
    // Long prose, markup and references to long names all read better across
    // the full width.
    wide: info.kind === 'html' || info.kind === 'prose',
    mono: info.kind === 'number' && name !== 'number',
    html: info.kind === 'html'
  };
}

/**
 * Grouped, typed sections for an arbitrary record.
 *
 * Returns the same shape record-fields already consumes, so the makeover is a
 * data change and needs no component change:
 *   [{id, label, fields: [{field, wide, mono, html}]}]
 *
 * Only POPULATED fields are included. On a generated page there is no author
 * deciding what matters, so an empty field carries no information -- unlike a
 * configured group, where an empty Resolution field is meaningful because
 * someone chose to show it.
 *
 * A FALSE BOOLEAN IS DROPPED for the same reason it is dropped from configured
 * groups: a flag that is set is worth showing, a flag that is not says only
 * that nothing happened.
 */
export function makeoverGroups(row, meta) {
  if (!row) return [];

  // ---- 1. READ AND CLASSIFY EVERY POPULATED FIELD ----------------------
  const fields = [];
  for (const name of Object.keys(row)) {
    if (SKIP.has(name)) continue;
    const cell = readCell(row, name);
    if (!cell) continue;
    const text = cell.display || cell.value;
    if (!text) continue;

    const info = classify(name, cell, meta);
    // A journal, a secret or form furniture, now that the dictionary can say
    // so. Inference could never identify these.
    if (info.kind === 'hidden') continue;
    if (info.kind === 'boolean' && !info.truthy) continue;

    fields.push({name, cell, info});
  }
  if (!fields.length) return [];

  const used = new Set();
  const groups = [];

  const take = (ids, label, picker) => {
    const picked = fields.filter(f => !used.has(f.name) && picker(f));
    if (!picked.length) return;
    for (const f of picked) used.add(f.name);
    groups.push({
      id: ids,
      label,
      fields: picked.map(f => spec(f.name, f.info))
    });
  };

  // ---- 2. IDENTITY, in reading order rather than alphabetical ----------
  const identity = IDENTITY.map(n => fields.find(f => f.name === n)).filter(
    Boolean
  );
  if (identity.length) {
    for (const f of identity) used.add(f.name);
    groups.push({
      id: 'identity',
      label: 'Overview',
      fields: identity.map(f => spec(f.name, f.info))
    });
  }

  // ---- 3. NAME CLUSTERS, before any type bucket ------------------------
  //
  // A cluster needs at least two members, or it is just a field with a long
  // name sitting alone under its own heading.
  const byCluster = new Map();
  for (const f of fields) {
    if (used.has(f.name) || AUDIT.has(f.name)) continue;
    const key = clusterKey(f.name);
    if (!key) continue;
    if (!byCluster.has(key)) byCluster.set(key, []);
    byCluster.get(key).push(f);
  }

  // Largest clusters first: they are the strongest stories on the record.
  const clusters = [...byCluster.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [key, members] of clusters) {
    for (const f of members) used.add(f.name);
    groups.push({
      id: `cluster-${key}`,
      label: humanise(key),
      fields: members.map(f => spec(f.name, f.info))
    });
  }

  // ---- 4. TYPE BUCKETS for whatever is left ----------------------------
  take('documents', 'Documents', f => f.info.kind === 'html');
  take('notes', 'Notes', f => f.info.kind === 'prose');
  take('people', 'People and organisations', f => f.info.kind === 'people');
  take('related', 'Related records', f => f.info.kind === 'reference');
  take('status', 'Status', f => f.info.kind === 'choice');
  take('dates', 'Dates', f => f.info.kind === 'date' && !AUDIT.has(f.name));
  take('measures', 'Measures', f => f.info.kind === 'number');
  take('flags', 'Flags', f => f.info.kind === 'boolean');
  take(
    'other',
    'Other details',
    f => !AUDIT.has(f.name) && f.info.kind === 'text'
  );

  // ---- 5. AUDIT TRAIL, always last -------------------------------------
  take('history', 'Record history', f => AUDIT.has(f.name));

  return groups;
}
