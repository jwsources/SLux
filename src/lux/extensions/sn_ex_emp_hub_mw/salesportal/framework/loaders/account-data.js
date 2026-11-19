import {cellDisplay, cellValue, fetchTable} from './record-data.js';
import {aiuxFetch, getLogger} from '@servicenow/aiux/aiux-components-core';
import {isServer} from 'lit';

/**
 * The generated escalation assessment, from the Account Escalation Advisor
 * GenAI skill via /api/x_snc_slux/advisor/escalation_advice.
 *
 * CLIENT ONLY, DELIBERATELY. Measured: ~10 seconds, 2,315 prompt tokens and
 * 755 response tokens for a 50-device account with three escalations. Putting
 * that in a loader would make every account page wait on gpt-4o before first
 * paint. The page renders its record data immediately and calls this after.
 *
 * Returns {ok, advice, reason}. Never throws: a model that is slow, rate
 * limited or unavailable must degrade the panel, not take the page down -- the
 * rest of the 360 is built from record data and stays correct regardless.
 *
 * Sections arrive ALREADY PARSED from the endpoint, because the delimiter
 * contract belongs next to the prompt that emits it rather than duplicated
 * here.
 */
export async function fetchEscalationAdvice(sysId) {
  if (isServer) return {ok: false, advice: null, reason: 'server'};
  if (!sysId) return {ok: false, advice: null, reason: 'no account'};

  const log = getLogger('rv-account-advice');
  const path =
    '/api/x_snc_slux/advisor/escalation_advice?account_sys_id=' +
    encodeURIComponent(sysId);

  try {
    const response = await aiuxFetch(path, {
      // ACCEPT, not just Content-Type. MEASURED: calling this endpoint from a
      // browser returned XML even though both the service definition and the
      // route declare produces: application/json -- the request's Accept
      // header outranks produces. A fetch with no Accept inherits */*, and if
      // the platform answers XML there then response.json() throws and the
      // panel reports a failure for a call that actually succeeded.
      //
      // Content-Type is kept for symmetry with fetchTable, though this GET
      // sends no body.
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // The endpoint distinguishes its failures: 400 bad sys_id, 503 skill not
      // installed, 502 skill failed. Carrying the status through means the
      // panel can say which rather than "something went wrong".
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error || '';
      } catch (e) {
        detail = '';
      }
      log.error(
        {sysId, status: response.status, detail},
        'Escalation advice request failed'
      );
      return {
        ok: false,
        advice: null,
        reason: detail || `http ${response.status}`
      };
    }

    const body = await response.json();

    // UNWRAP THE result ENVELOPE. A Scripted REST body is wrapped by the
    // platform: calling this endpoint from a browser returned
    //   <response><result><generatedAt>...
    // so the JSON equivalent is {result: {...}}, not the object the handler
    // passed to setBody.
    //
    // Reading advice.situation against that shape yields undefined for EVERY
    // field, which is why the panel rendered its READY state with "None
    // identified" and the story fell back to the assembled sentence. A
    // success that looked like an empty account.
    //
    // Both shapes are accepted, so the page survives the envelope changing.
    const advice = body && body.result ? body.result : body;
    log.info(
      {sysId, logId: advice?.logId, parsed: advice?.parsed},
      'Escalation advice generated'
    );
    return {ok: true, advice, reason: ''};
  } catch (e) {
    log.error({sysId, error: e?.message}, 'Escalation advice threw');
    return {ok: false, advice: null, reason: e?.message || String(e)};
  }
}

// THE ACCOUNT PAGE'S DATA.
//
// Every field name below was measured on a real NewYork-Presbyterian row
// before it was written here -- asking the Table API for a field a table does
// not have returns an empty value rather than an error, which renders as a
// blank column and looks like missing data.
//
// WHAT THE DESIGN ASKED FOR THAT DOES NOT EXIST ON THIS INSTANCE:
//   opportunity        no such table -- the real one is
//                      sn_opty_mgmt_core_opportunity
//   sold_product       no such table
//   buying_group       no such table
//   account_path       no such TABLE, but customer_account HAS an
//                      account_path FIELD (measured: '!!!#6003'), and the
//                      hierarchy is really carried by parent
//
// AND WHAT EXISTS BUT IS EMPTY for this account: service_entitlement (0 rows
// here, 156 instance-wide) and sn_otc_invoice (0 here, 18 instance-wide).
// Both are still queried -- they are real relationships that happen to be
// unpopulated, and the applet renderer drops an empty group, so they appear
// if the data ever arrives.
//
// COUNTS ARE ROW COUNTS, NOT AGGREGATES. The Table API has no count parameter
// that was verified from source, and the stats endpoint was not read, so each
// applet reports how many rows it fetched and sets truncated when it hit its
// limit. That is honest about what it knows; an invented count endpoint would
// not be.

const ACCOUNT_TABLE = 'customer_account';

// Measured populated fields on the NYP row. Those that were empty are left
// out rather than rendering as em dashes in a header.
const ACCOUNT_FIELDS = [
  'sys_id',
  'number',
  'name',
  'website',
  'phone',
  'street',
  'city',
  'state',
  'zip',
  'country',
  'num_employees',
  'revenue_per_year',
  'primary_contact',
  'parent',
  'notes',
  'active',
  'customer',
  'account_path',
  'active_escalation',
  // Scoped PMDemo fields, all measured populated on this account.
  'x_snc_philips_e2_0_health',
  'x_snc_philips_e2_0_kam',
  'x_snc_philips_e2_0_region',
  'x_snc_philips_e2_0_is_campus'
].join(',');

// One descriptor per related set. table/field is the inbound edge, fields are
// the measured column names, and limit caps the read.
const RELATED = [
  {
    id: 'campuses',
    heading: 'Campuses and sites',
    table: ACCOUNT_TABLE,
    field: 'parent',
    fields: 'sys_id,name,number,city,state,x_snc_philips_e2_0_health,primary_contact',
    order: 'name',
    limit: 25
  },
  {
    id: 'cases',
    heading: 'Cases',
    table: 'sn_customerservice_case',
    field: 'account',
    fields:
      'sys_id,number,short_description,state,priority,assigned_to,sys_updated_on,product,install_base,cmdb_ci',
    order: 'DESCsys_updated_on',
    // 50, not 15. The count shown in the UI is the ROW COUNT, so a limit
    // below the real volume turns the figure into a lie: measured 15 cases
    // for this account against a limit of 15, which set truncated and
    // rendered "15+" for an exact 15. Limits now sit above the measured
    // volumes, so truncation means genuine overflow.
    limit: 50
  },
  {
    id: 'contracts',
    heading: 'Contracts',
    table: 'ast_contract',
    field: 'account',
    fields:
      'sys_id,number,short_description,state,starts,ends,yearly_cost,payment_schedule,renewable',
    order: 'DESCends',
    limit: 15
  },
  {
    id: 'opportunities',
    heading: 'Opportunities',
    table: 'sn_opty_mgmt_core_opportunity',
    field: 'account',
    fields:
      'sys_id,number,short_description,stage,assigned_to,estimated_closed_date,forecast_category,x_snc_philips_e2_0_deal_margin_pct,primary_quote',
    order: 'estimated_closed_date',
    limit: 15
  },
  {
    id: 'installBase',
    heading: 'Installed products',
    table: 'sn_install_base_item',
    field: 'account',
    fields:
      'sys_id,number,name,product,state,life_cycle_stage,health_status,contact,configuration_item',
    order: 'name',
    // Measured 50 install-base items for this account; 25 reported "25+".
    limit: 100
  },
  {
    id: 'contacts',
    heading: 'Contacts',
    table: 'customer_contact',
    // name, email, phone and title are inherited from sys_user rather than
    // declared on customer_contact -- a dictionary query scoped to the child
    // table alone does not list them, which is why they are named explicitly
    // here from the record read instead.
    field: 'account',
    fields: 'sys_id,name,email,phone,title,active',
    order: 'name',
    limit: 25
  },
  // NO entitlements DESCRIPTOR HERE. Entitlements do not hang off the account
  // -- measured, service_entitlement filtered by account returns 0 rows while
  // the same table filtered by the account's CONTRACTS returns 79. So the set
  // is built in phase two from the contract ids, and a descriptor here would
  // be a request that can only ever return nothing, overwritten moments later.
  {
    id: 'interactions',
    heading: 'Interactions',
    table: 'interaction',
    field: 'account',
    fields:
      'sys_id,number,short_description,state,opened_at,assigned_to,duration',
    order: 'DESCopened_at',
    limit: 15
  },
  {
    id: 'invoices',
    heading: 'Invoices',
    table: 'sn_otc_invoice',
    field: 'account',
    fields: 'sys_id,number,state,amount,due_date',
    order: 'DESCdue_date',
    limit: 15
  }
];

/**
 * The account and every related set, in one pass.
 *
 * allSettled throughout: nine independent reads, and one unreachable table
 * must not blank the page. A rejected read yields an empty set, which the
 * applet renderer drops -- so a failure looks like an absent relationship
 * rather than a broken page. The distinction is recorded in meta.failed.
 */
// ---------------------------------------------------------------------------
// PARTIAL REFRESH -- one slice, re-read on demand
// ---------------------------------------------------------------------------
//
// Reuses the SAME descriptor buildAccount uses, so a refreshed slice cannot
// drift from the one loaded initially -- same table, same fields, same order,
// same limit, and the same row shape. Re-declaring the query here would be two
// definitions of one read, which is how a refreshed applet starts disagreeing
// with the page it sits on.
//
// Returns null for an unknown id rather than an empty set: a caller naming a
// slice that does not exist has a bug, and an empty set would hide it by
// looking like a relationship with no rows.

function shapeSet(entry, rows) {
  return {
    id: entry.id,
    heading: entry.heading,
    table: entry.table,
    rows: rows.map(r => ({
      table: entry.table,
      sysId: cellValue(r, 'sys_id'),
      raw: r
    })),
    total: rows.length,
    truncated: rows.length >= entry.limit
  };
}

export async function refreshRelatedSet(ctx, sysId, setId) {
  const entry = RELATED.find(e => e.id === setId);
  if (!entry || !sysId) return null;

  const result = await fetchTable(ctx, entry.table, {
    query: `${entry.field}=${sysId}`,
    fields: entry.fields,
    limit: entry.limit,
    orderBy: entry.order
  });

  return shapeSet(entry, result.failed ? [] : result.rows || []);
}

/**
 * The account and every related set, in one pass. See the module note above
 * for the allSettled contract and what meta.failed records.
 */
export async function buildAccount(ctx, sysId) {
  if (!sysId) return null;

  const [selfResult, ...relatedResults] = await Promise.allSettled([
    fetchTable(ctx, ACCOUNT_TABLE, {
      query: `sys_id=${sysId}`,
      fields: ACCOUNT_FIELDS,
      limit: 1,
      // Needed so the reference values -- primary contact, KAM, parent,
      // escalation -- can be rendered as links. The reference link is the only
      // part of a Table API response that names the referenced table.
      referenceLinks: true
    }),
    ...RELATED.map(entry =>
      fetchTable(ctx, entry.table, {
        query: `${entry.field}=${sysId}`,
        fields: entry.fields,
        limit: entry.limit,
        orderBy: entry.order
      })
    )
  ]);

  const row =
    selfResult.status === 'fulfilled' ? selfResult.value.rows?.[0] : null;
  if (!row) return null;

  const related = {};
  const failed = [];

  RELATED.forEach((entry, index) => {
    const settled = relatedResults[index];
    const ok = settled?.status === 'fulfilled' && !settled.value.failed;
    if (!ok) failed.push(entry.id);

    const rows = ok ? settled.value.rows || [] : [];
    related[entry.id] = {
      id: entry.id,
      heading: entry.heading,
      table: entry.table,
      rows: rows.map(r => ({
        // table and sysId are what the applet renderer needs to build a link.
        table: entry.table,
        sysId: cellValue(r, 'sys_id'),
        raw: r
      })),
      total: rows.length,
      // The read hit its cap, so the count is a floor rather than a total.
      truncated: rows.length >= entry.limit
    };
  });

  return {row, related, meta: {failed}};
}

// ---------------------------------------------------------------------------
// PHASE TWO -- reads that depend on phase one's results
// ---------------------------------------------------------------------------
//
// CONTRACT TO DEVICE IS MAPPED, THROUGH ENTITLEMENTS. Measured:
//   clm_m2m_contract_asset   0 rows for these contracts (98 instance-wide)
//   alm_asset.contract       THE FIELD DOES NOT EXIST
//   service_entitlement      79 rows across the 5 NYP contracts, and 121 of
//                            156 instance-wide carry install_base_item
//
// So the path is contract -> service_entitlement -> install_base_item. An
// earlier read of service_entitlement by ACCOUNT returned 0 and I reported the
// relationship as absent; that query was simply wrong -- entitlements hang off
// the contract, not the account.
//
// CASES ACROSS THE FAMILY. Cases attach to whichever account owns them, so a
// campus account holds its own. Reading only the parent made a cases-per-site
// chart impossible -- measured, Campus 1 alone has 9 cases that the
// parent-only read never saw.
//
// Both depend on phase-one ids, which is why they are a second round trip
// rather than part of the batch.

const ENTITLEMENT_FIELDS =
  'sys_id,number,short_description,contract,install_base_item,asset,active';

const FAMILY_CASE_FIELDS =
  'sys_id,number,short_description,state,priority,account,assigned_to,product,install_base,cmdb_ci';

// THE ESCALATION'S OWN FIELDS. The account carries only a REFERENCE
// (active_escalation), so its severity, reason, trend and justification need a
// read of the escalation record itself. Field names measured on ESC0001001:
//   escalation_severity  'High Severity'  -> sn_customerservice_escalation_severity
//   reason               'Customer Imposed Deadline'
//   trend                'Declining'
//   escalation_justification  the sentence a reader actually needs
//   state                'Escalated'
//
// NOTE the account link is company, NOT account -- sn_customerservice_escalation
// has no account field, and a predicate naming one is DISCARDED with only a log
// line, which is how a count of "3 for this account" turned out to be the
// unfiltered total.
const ESCALATION_FIELDS = [
  'sys_id',
  'number',
  'state',
  'active',
  'escalation_severity',
  'reason',
  'trend',
  'escalation_justification',
  'escalation_manager',
  'requested_by',
  'opened_at',
  'priority',
  'company'
].join(',');

export async function buildAccountPhaseTwo(ctx, sysId, related, row) {
  const contractIds = (related?.contracts?.rows || [])
    .map(r => r.sysId)
    .filter(Boolean);

  // The account itself plus every child, so a case on a campus is reachable.
  const familyIds = [
    sysId,
    ...(related?.campuses?.rows || []).map(r => r.sysId)
  ].filter(Boolean);

  // The escalation sys_id comes from the account row's reference, so this read
  // can only happen once that row exists -- which is why it is in phase two.
  const escalationId = row ? cellValue(row, 'active_escalation') : '';

  const [entSettled, familySettled, escSettled] = await Promise.allSettled([
    contractIds.length
      ? fetchTable(ctx, 'service_entitlement', {
          query: `contractIN${contractIds.join(',')}`,
          fields: ENTITLEMENT_FIELDS,
          limit: 200
        })
      : Promise.resolve({rows: [], failed: false}),
    familyIds.length > 1
      ? fetchTable(ctx, 'sn_customerservice_case', {
          query: `accountIN${familyIds.join(',')}`,
          fields: FAMILY_CASE_FIELDS,
          limit: 200,
          orderBy: 'DESCsys_updated_on'
        })
      : Promise.resolve({rows: [], failed: false}),
    escalationId
      ? fetchTable(ctx, 'sn_customerservice_escalation', {
          query: `sys_id=${escalationId}`,
          fields: ESCALATION_FIELDS,
          limit: 1
        })
      : Promise.resolve({rows: [], failed: false})
  ]);

  const wrap = (settled, table) => {
    const rows =
      settled.status === 'fulfilled' ? settled.value.rows || [] : [];
    return {
      rows: rows.map(r => ({
        table,
        sysId: cellValue(r, 'sys_id'),
        raw: r
      })),
      total: rows.length,
      truncated: rows.length >= 200
    };
  };

  return {
    entitlements: wrap(entSettled, 'service_entitlement'),
    familyCases: wrap(familySettled, 'sn_customerservice_case'),
    // ONE record, not a set -- the account has at most one active escalation,
    // so a list shape here would be a collection the UI has to unwrap for no
    // reason. Null when there is none, which the panel reads as absent.
    escalation:
      escSettled.status === 'fulfilled' && escSettled.value.rows?.[0]
        ? {
            table: 'sn_customerservice_escalation',
            sysId: cellValue(escSettled.value.rows[0], 'sys_id'),
            raw: escSettled.value.rows[0]
          }
        : null
  };
}

// Convenience for the page: a display value from a related row's raw payload.
export function field(row, name) {
  return cellDisplay(row?.raw, name);
}

export function rawField(row, name) {
  return cellValue(row?.raw, name);
}
