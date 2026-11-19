import {isServer} from 'lit';
import {
  aiuxFetch,
  getHeaders,
  getLogger
} from '@servicenow/aiux/aiux-components-core';

const log = getLogger('rv-record-data');

// THE FRAMEWORK'S SECOND DATA PATH, AND WHY IT HAD TO EXIST.
//
// Until this module the framework had exactly one source of record data: the
// record package's FormAPI. That API is form-layout-bound BY DESIGN -- its
// fields getter returns layout.fields, so it can only ever see fields placed
// on the resolved form view, and it can only ever see the CURRENT record.
//
// Three separate things the design needs were unreachable through it, each
// discovered the same way:
//   1. x_snc_pmdemo_regulatory_flag -- a field on the case, not on the layout.
//   2. account -- a field on the case, not on the Default view.
//   3. x_snc_pmdemo_case_story -- the Otto narrative source, not on the layout.
// Two were patched by adding form elements. The third is where that stops:
// adding every field the UI wants to a shared platform form, so that an
// unrelated page can read it, is not a data-access strategy. And it would
// still not reach the rest of the payload, which lives on OTHER TABLES
// entirely: the remediation counts on a regulatory-report record, the firmware
// versions two dot-walks away on a model record, the dispatch rows on
// wm_task.
//
// So this module reads the Table API directly. One mechanism covers arbitrary
// fields, arbitrary tables, dot-walks and related lists.
//
// THE TRANSPORT, and why it branches.
// A loader runs on BOTH the server and the client (see the loader contract:
// "runs before rendering -- on the server (blocking SSR) and again on the
// client during navigation"). Those need different transports:
//   - SSR: raw fetch with getHeaders(ctx). ctx.headers.cookie carries the
//     session, and the absolute URL is built from ctx.protocol/ctx.hostname
//     because there is no document to resolve a relative path against.
//   - Client: aiuxFetch, which adds XSRF and auth headers and handles
//     retries. The guidance is explicit that aiuxFetch is for the client and
//     raw fetch is acceptable in a loader where getHeaders(ctx) supplies the
//     session -- so the branch is on WHERE the code is running, not on who
//     called it.
//
// sysparm_display_value=all is requested throughout: every response field
// then arrives as {value, display_value}, which is what lets a caller render
// a human string AND keep the sys_id needed to open the referenced record.
// Asking for only one of the two is how a reference becomes unclickable or a
// choice renders its raw key.

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}

/**
 * One Table API read. Returns an array of row objects, each field shaped
 * {value, display_value}. Never throws: a failure is logged and returns an
 * empty array, because a missing side panel must not take the page down with
 * it. Callers distinguish "no rows" from "failed" by the second return field.
 */
export async function fetchTable(ctx, table, options = {}) {
  const {
    query = '',
    fields = '',
    limit = 20,
    orderBy = '',
    // Reference links are EXCLUDED by default because most callers only need
    // the value and the display value, and the links roughly double the
    // payload. Details needs them: a reference link is
    // /api/now/table/<table>/<sys_id>, which is the only place in a Table API
    // response that names the REFERENCED TABLE -- and without the table there
    // is no way to build a link to that record.
    referenceLinks = false
  } = options;

  const qs = buildQuery({
    sysparm_query: orderBy ? `${query}^ORDERBY${orderBy}` : query,
    sysparm_fields: fields,
    sysparm_limit: limit,
    sysparm_display_value: 'all',
    sysparm_exclude_reference_link: referenceLinks ? 'false' : 'true'
  });

  const path = `/api/now/table/${encodeURIComponent(table)}?${qs}`;

  try {
    let response;
    if (isServer) {
      // ctx is REQUIRED on the server: without its cookie the request is
      // unauthenticated and the API answers 401, which would read here as an
      // empty table rather than an auth failure.
      if (!ctx?.hostname) {
        return {rows: [], failed: true, reason: 'no ctx on server'};
      }
      response = await fetch(`${ctx.protocol}://${ctx.hostname}${path}`, {
        headers: getHeaders(ctx)
      });
    } else {
      response = await aiuxFetch(path, {
        headers: {'Content-Type': 'application/json'}
      });
    }

    if (!response.ok) {
      log.error(
        {table, status: response.status},
        'Table read failed -- treating as no data, NOT as an empty table'
      );
      return {rows: [], failed: true, reason: `http ${response.status}`};
    }

    const body = await response.json();
    return {rows: body?.result ?? [], failed: false, reason: ''};
  } catch (e) {
    log.error({table, error: e?.message}, 'Table read threw');
    return {rows: [], failed: true, reason: e?.message || String(e)};
  }
}

// Pulls the {value, display_value} pair apart. The API omits display_value for
// a plain string field, so it falls back to value rather than rendering blank.
export function cell(row, field) {
  const raw = row?.[field];
  if (raw === null || raw === undefined) return {value: '', display: ''};
  if (typeof raw === 'object') {
    const value = raw.value ?? '';
    const display = raw.display_value ?? value;
    return {value: String(value), display: String(display)};
  }
  return {value: String(raw), display: String(raw)};
}

export function cellValue(row, field) {
  return cell(row, field).value;
}

export function cellDisplay(row, field) {
  return cell(row, field).display;
}

/**
 * Arbitrary fields from the CURRENT record, bypassing the form layout
 * entirely. This is the call that makes the three unreachable fields above
 * reachable.
 */
export async function fetchRecordFields(ctx, table, sysId, fields) {
  if (!table || !sysId || sysId === '-1') {
    return {row: null, failed: false, reason: 'no record'};
  }
  const result = await fetchTable(ctx, table, {
    query: `sys_id=${sysId}`,
    fields,
    limit: 1
  });
  return {
    row: result.rows[0] ?? null,
    failed: result.failed,
    reason: result.reason
  };
}

/**
 * Rows of a related table pointing back at this record through one reference
 * field -- the shape behind the dispatch-task table and the record chain's
 * inbound edge.
 */
export async function fetchRelated(ctx, table, refField, sysId, options = {}) {
  if (!table || !refField || !sysId) {
    return {rows: [], failed: false, reason: 'no parent'};
  }
  return fetchTable(ctx, table, {
    ...options,
    query: `${refField}=${sysId}`
  });
}

// The referenced table, extracted from a Table API reference link.
//
// With reference links included, a reference field arrives as
//   {value: '<sys_id>', display_value: 'Riverside General Hospital',
//    link: 'https://host/api/now/table/customer_account/<sys_id>'}
// and that link is the ONLY part of the response that names the referenced
// table. Without it a reference value can be displayed but not linked.
//
// Returns '' when the field is not a reference or the link is absent, which
// the caller treats as "render as text".
const REFERENCE_LINK = /\/api\/now\/table\/([^/]+)\//;

export function referencedTable(row, field) {
  const raw = row?.[field];
  if (!raw || typeof raw !== 'object' || !raw.link) return '';
  const match = REFERENCE_LINK.exec(String(raw.link));
  return match ? match[1] : '';
}

/**
 * One record, EVERY field, plus its real class.
 *
 * Omitting sysparm_fields makes the Table API return the whole record. That is
 * what lets the catch-all page render a table nobody has configured: there is
 * no field list to declare, so the record itself supplies one.
 *
 * It also returns sys_class_name, which is the fix for a record rendering as
 * the WRONG TYPE. A reference field declares a BASE table -- measured,
 * sn_customerservice_case.parent is a reference to `task` -- so a link built
 * from the declared reference table sends a case to /record/task/<id>. The
 * declared table is all the referring record knows; the real class is only on
 * the target, and this is where it comes from.
 */
export async function fetchWholeRecord(ctx, table, sysId) {
  if (!table || !sysId || sysId === '-1') {
    return {row: null, realClass: '', failed: false, reason: 'no record'};
  }

  const result = await fetchTable(ctx, table, {
    query: `sys_id=${sysId}`,
    // No sysparm_fields on purpose -- every field.
    limit: 1,
    referenceLinks: true
  });

  const row = result.rows[0] ?? null;
  return {
    row,
    // Absent on a table that is not in a hierarchy, in which case the declared
    // table IS the real one.
    realClass: row ? cellValue(row, 'sys_class_name') || table : '',
    failed: result.failed,
    reason: result.reason
  };
}

/**
 * The Details payload: every field named by the config's groups, read straight
 * off the record.
 *
 * THIS IS WHAT REPLACES THE FORM LAYOUT AS THE READ MODEL. A field appears
 * because a config names it, not because it happens to sit on whichever form
 * view the platform resolved -- which is what made state, account and the
 * regulatory flag invisible in turn, and what pulled the classic UI16 script
 * stack in when the view was forced to one that carries formatters.
 */
export async function fetchDetailGroups(ctx, table, sysId, groups) {
  const list = Array.isArray(groups) ? groups : [];
  if (!table || !sysId || sysId === '-1' || !list.length) {
    return {row: null, failed: false, reason: 'nothing to fetch'};
  }

  // Every field named anywhere in the groups, de-duplicated. One request for
  // the whole view rather than one per group.
  const names = new Set();
  for (const group of list) {
    for (const entry of group.fields || []) {
      const name = typeof entry === 'string' ? entry : entry?.field;
      if (name) names.add(name);
    }
  }
  if (!names.size) {
    return {row: null, failed: false, reason: 'no fields declared'};
  }

  const result = await fetchTable(ctx, table, {
    query: `sys_id=${sysId}`,
    fields: [...names].join(','),
    limit: 1,
    // Needed so a reference value can be rendered as a link -- see
    // referencedTable above.
    referenceLinks: true
  });

  return {
    row: result.rows[0] ?? null,
    failed: result.failed,
    reason: result.reason
  };
}
