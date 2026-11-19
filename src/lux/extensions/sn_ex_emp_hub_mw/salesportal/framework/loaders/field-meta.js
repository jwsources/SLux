import {fetchTable} from './record-data.js';

// FIELD METADATA FROM THE DICTIONARY.
//
// WHY THIS EXISTS. The Table API returns values, not types. Details has been
// INFERRING type from value shape -- a 0 or 1 whose display reads false or
// true is a boolean, a value differing from its display is a choice. That
// works, but it is guesswork and it cannot answer the two questions a typed
// layout depends on:
//
//   what IS this field          reference, choice, date, duration, journal
//   can the user change it      read_only on the dictionary entry
//
// sys_dictionary answers both, for ANY table, in one read -- the same read
// measured earlier this session against sn_customerservice_case and wm_task,
// including an inherited task field and a scoped custom field, with a firing
// control on a bogus name.
//
// It also returns column_label, which removes the last guess in the rendering
// path. Details has been humanising field names, which is right often enough
// to look correct and wrong where it matters: cmdb_ci humanises to Cmdb ci
// against the real label Configuration item.
//
// INHERITANCE. A field may be declared on the table or on any ancestor, and
// sys_dictionary has no single column naming the hierarchy, so the caller
// passes the chain it cares about. Omitting an ancestor means those fields
// fall back to inference rather than failing.

const DICT_TABLE = 'sys_dictionary';
const DICT_FIELDS =
  'name,element,internal_type,column_label,reference,read_only,mandatory,max_length';

// Cached per table for the life of the page. The dictionary does not change
// while a user reads a record, and without this it is re-read on every
// refresh.
//
// Module-level, and therefore shared across SSR requests in the same isolate.
// That is safe HERE AND ONLY HERE: dictionary entries are instance-wide
// configuration, identical for every requester. No user data is cached.
const cache = new Map();

function plain(row, field) {
  const raw = row?.[field];
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') return String(raw.value ?? '');
  return String(raw);
}

/**
 * {fieldName: {type, label, reference, readOnly, mandatory, maxLength}} for a
 * table and the ancestors named in bases.
 *
 * Never throws and never returns null: a failed read yields an empty map, so
 * the rendering path degrades to inference rather than blanking the page.
 */
export async function fetchFieldMeta(ctx, table, bases = ['task']) {
  if (!table) return {};

  const key = [table, ...bases].join('|');
  const hit = cache.get(key);
  if (hit) return hit;

  const names = [table, ...bases.filter(b => b && b !== table)];
  const result = await fetchTable(ctx, DICT_TABLE, {
    query: `nameIN${names.join(',')}^elementISNOTEMPTY`,
    fields: DICT_FIELDS,
    limit: 2000
  });

  const meta = {};
  for (const row of result.rows) {
    const element = plain(row, 'element');
    if (!element) continue;

    const owner = plain(row, 'name');
    // The table's OWN entry wins over an inherited one: a dictionary override
    // on the child is the effective definition.
    if (meta[element] && meta[element].owner === table) continue;

    meta[element] = {
      owner,
      type: plain(row, 'internal_type'),
      label: plain(row, 'column_label'),
      reference: plain(row, 'reference'),
      readOnly: plain(row, 'read_only') === 'true',
      mandatory: plain(row, 'mandatory') === 'true',
      maxLength: Number(plain(row, 'max_length')) || 0
    };
  }

  // Only a successful read is cached, so a transient failure does not pin an
  // empty map for the rest of the session.
  if (!result.failed && Object.keys(meta).length) cache.set(key, meta);
  return meta;
}

// ---- SHAPE, derived from the dictionary type -------------------------------
//
// A shape is how a field should LOOK, which is a far smaller vocabulary than
// the platform's internal types. Presentation only: Details is a read view, so
// a reference renders as a search-styled box rather than becoming a live
// typeahead. The affordance says what the field IS without taking on an edit
// surface, its validation, its dirty state and its write path.

export const SHAPES = {
  REFERENCE: 'reference',
  CHOICE: 'choice',
  BOOLEAN: 'boolean',
  DATE: 'date',
  DURATION: 'duration',
  NUMBER: 'number',
  HTML: 'html',
  PROSE: 'prose',
  TEXT: 'text'
};

const REFERENCE_TYPES = new Set([
  'reference',
  'glide_list',
  'document_id',
  'domain_id'
]);

const CHOICE_TYPES = new Set(['choice', 'radio', 'multi_two_way']);

const DATE_TYPES = new Set([
  'glide_date',
  'glide_date_time',
  'due_date',
  'glide_time',
  'glide_utc_time',
  'date',
  'datetime'
]);

const DURATION_TYPES = new Set(['glide_duration', 'timer', 'duration']);

const NUMBER_TYPES = new Set([
  'integer',
  'decimal',
  'float',
  'longint',
  'int',
  'percent_complete',
  'order_index'
]);

const HTML_TYPES = new Set(['html', 'html_script', 'translated_html']);

const PROSE_TYPES = new Set([
  'textarea',
  'str_long',
  'markdown',
  'script',
  'script_plain',
  'xml',
  'json',
  'conditions',
  'condition_string',
  'wide_text',
  'wiki_text'
]);

// Never rendered. Journals are the Activity view's subject, and a secret must
// not be printed in a read view whatever a config asks for.
export const HIDDEN_TYPES = new Set([
  'journal',
  'journal_input',
  'journal_list',
  'password',
  'password2',
  'glide_encrypted',
  'masked',
  'annotation',
  'label',
  'rich_text_label',
  'documentation_field',
  'widget',
  'variables',
  'container',
  'composite_field'
]);

export function shapeOf(type) {
  if (!type) return SHAPES.TEXT;
  if (REFERENCE_TYPES.has(type)) return SHAPES.REFERENCE;
  if (CHOICE_TYPES.has(type)) return SHAPES.CHOICE;
  if (type === 'boolean') return SHAPES.BOOLEAN;
  if (DATE_TYPES.has(type)) return SHAPES.DATE;
  if (DURATION_TYPES.has(type)) return SHAPES.DURATION;
  if (NUMBER_TYPES.has(type)) return SHAPES.NUMBER;
  if (HTML_TYPES.has(type)) return SHAPES.HTML;
  if (PROSE_TYPES.has(type)) return SHAPES.PROSE;
  return SHAPES.TEXT;
}
