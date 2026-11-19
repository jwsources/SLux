// Layout configs, keyed by table name.
//
// THIS DIRECTORY IS THE ONE PLACE IN THE FRAMEWORK WHERE A TABLE NAME OR A
// FIELD NAME IS ALLOWED TO APPEAR. ACCEPTANCE's first criterion forbids them
// in component and shell code; DATA_CONTRACT puts them here, in config. The
// directory boundary is what makes that rule checkable: grep the framework for
// a table name and every hit should be under configs/.
//
// This is the module-backed store behind ModuleLayoutConfigSource in
// ../layout-config.js. See that file's header for why a JS module rather than
// a Fluent table, and for exactly what a table-backed source would need.

import snCustomerserviceCase from './sn-customerservice-case.js';
import xSncPmdemoRegReport from './x-snc-pmdemo-reg-report.js';
import customerAccount from './customer-account.js';

export const DEFAULT_CONFIG_ID = 'default';

// table name -> ordered configs.
//
// ONE UNCONDITIONAL CONFIG PER TABLE is the normal shape, and the only one
// used today. selectConfig resolves conditional-match, then table-match, then
// the generic default -- so an unconditional entry guarantees every record of
// that table gets a real title, real chips and a real form view. Nothing about
// presentation depends on a per-record field value.
//
// A CONDITIONAL config, placed BEFORE the unconditional one, is for a
// genuinely different GRID only -- never for a title, a chip, a form view or
// whether a tab exists. Order matters there: narrower conditions first,
// because selectConfig takes the first conditional candidate that matches.
//
// This previously held a single CONDITIONAL config keyed on
// x_snc_pmdemo_regulatory_flag and no unconditional fallback, so any case
// whose flag was empty fell through to the table-agnostic DEFAULT config,
// which names no title field and no chips. That rendered a headless, tagless
// page with no Intelligence tab -- CS0001624 is exactly that record, and the
// flag it hinged on means nothing beyond "a regulatory report was needed".
const REGISTRY = {
  [snCustomerserviceCase.table]: [snCustomerserviceCase],
  [xSncPmdemoRegReport.table]: [xSncPmdemoRegReport],
  [customerAccount.table]: [customerAccount]
};

// THE GRAPH EDGE MAP -- what a node's neighbours are, per table.
//
// This is the exploration model. A node expands to show what it is connected
// TO, in both directions, so a user walks the data rather than drilling three
// levels blind:
//
//   upstream   a reference field ON this record pointing outward. Read from
//              the record itself, so one read covers all of them.
//   downstream another table's field pointing AT this record. One query per
//              entry.
//
// It lives here because this directory is the only place a table or field
// name may appear. graph-data.js reads this map and knows no table name of
// its own, so adding a record type to the graph is a config change.
//
// fields and titleField are explicit per entry rather than a guessed superset:
// customer_account has name where a case has number, and asking the Table API
// for a field a table does not have is not something to risk silently.
const CASE = 'sn_customerservice_case';
const ACCOUNT = 'customer_account';

export const GRAPH_EDGES = {
  [CASE]: {
    upstream: [
      {
        field: 'account',
        table: ACCOUNT,
        label: 'Account',
        kind: 'account'
      },
      {field: 'parent', table: CASE, label: 'Parent case', kind: 'case'},
      {
        field: 'cmdb_ci',
        table: 'cmdb_ci',
        label: 'Device',
        kind: 'device'
      }
    ],
    downstream: [
      {
        table: CASE,
        field: 'parent',
        label: 'Child case',
        kind: 'case',
        fields: 'sys_id,number,short_description,state',
        titleField: 'number'
      },
      {
        table: 'wm_order',
        field: 'parent',
        label: 'Work order',
        kind: 'order',
        fields: 'sys_id,number,short_description,state',
        titleField: 'number'
      },
      {
        table: 'change_request',
        field: 'parent',
        label: 'Change',
        kind: 'change',
        fields: 'sys_id,number,short_description,state',
        titleField: 'number'
      },
      {
        table: 'x_snc_pmdemo_reg_report',
        field: 'source_case',
        label: 'Regulatory report',
        kind: 'report',
        fields: 'sys_id,number,short_description,state,report_status',
        titleField: 'number'
      }
    ]
  },

  [ACCOUNT]: {
    // ACCOUNTS ARE HIERARCHICAL. Measured: NYP Campus 1 through 4 all carry
    // parent = NewYork-Presbyterian, so the campuses are child accounts of the
    // health system rather than separate organisations. Without these edges a
    // campus looked like an unrelated account, which is exactly what made the
    // search results confusing.
    upstream: [
      {
        field: 'parent',
        table: ACCOUNT,
        label: 'Parent account',
        kind: 'account'
      }
    ],
    downstream: [
      {
        table: ACCOUNT,
        field: 'parent',
        label: 'Child account',
        kind: 'account',
        fields: 'sys_id,name,parent',
        titleField: 'name',
        // customer_account has no active field in the task sense, so the
        // open-work filter must not be applied here -- it would silently match
        // nothing and the children would vanish.
        hasActive: false,
        searchField: 'name'
      },
      {
        table: CASE,
        field: 'account',
        label: 'Case',
        kind: 'case',
        fields: 'sys_id,number,short_description,state,priority',
        titleField: 'number'
      },
      // Measured on NewYork-Presbyterian: 4 contracts, 50 installed products,
      // 8 contacts, 1 opportunity. service_entitlement and sn_otc_invoice are
      // real relationships that are EMPTY for this account (0 rows against 156
      // and 18 instance-wide), so they are left out of the graph rather than
      // contributing an always-absent edge.
      {
        table: 'ast_contract',
        field: 'account',
        label: 'Contract',
        kind: 'contract',
        fields: 'sys_id,number,short_description,state,ends,yearly_cost',
        titleField: 'number',
        // COLUMNS LIVE WITH THE FIELDS THAT FEED THEM. Every field named here
        // is in the fields list above, so a column can never read something
        // the query did not fetch.
        columns: [
          {label: 'Contract', field: 'number', link: true},
          {label: 'Summary', field: 'short_description', wrap: true},
          {label: 'State', field: 'state', chip: true},
          {label: 'Ends', field: 'ends'},
          {label: 'Yearly', field: 'yearly_cost', mono: true}
        ]
      },
      {
        table: 'sn_install_base_item',
        field: 'account',
        label: 'Installed product',
        kind: 'install',
        fields:
          'sys_id,number,name,product,state,life_cycle_stage',
        titleField: 'name',
        columns: [
          {label: 'Item', field: 'number', link: true},
          {label: 'Product', field: 'product', wrap: true},
          {label: 'State', field: 'state', chip: true},
          {label: 'Lifecycle', field: 'life_cycle_stage'}
        ]
      },
      {
        table: 'customer_contact',
        field: 'account',
        label: 'Contact',
        kind: 'contact',
        // name, email and title are inherited from sys_user rather than
        // declared on customer_contact, so they are named explicitly here.
        fields: 'sys_id,name,email,title',
        titleField: 'name',
        searchField: 'name',
        columns: [
          {label: 'Name', field: 'name', link: true},
          {label: 'Title', field: 'title', wrap: true},
          {label: 'Email', field: 'email'}
        ]
      },
      {
        table: 'sn_opty_mgmt_core_opportunity',
        field: 'account',
        label: 'Opportunity',
        kind: 'opportunity',
        fields: 'sys_id,number,short_description,stage,estimated_closed_date',
        titleField: 'number',
        // No active field on the opportunity table in the task sense.
        hasActive: false,
        columns: [
          {label: 'Opportunity', field: 'number', link: true},
          {label: 'Summary', field: 'short_description', wrap: true},
          {label: 'Stage', field: 'stage', chip: true},
          {label: 'Expected close', field: 'estimated_closed_date'}
        ]
      }
    ]
  },

  wm_order: {
    upstream: [{field: 'parent', table: CASE, label: 'Case', kind: 'case'}],
    downstream: [
      {
        table: 'wm_task',
        field: 'parent',
        label: 'Dispatch task',
        kind: 'task',
        fields: 'sys_id,number,short_description,state,location',
        titleField: 'number'
      }
    ]
  },

  x_snc_pmdemo_reg_report: {
    upstream: [
      {field: 'source_case', table: CASE, label: 'Source case', kind: 'case'}
    ]
  }
};

export function graphEdgesFor(table) {
  if (!table) return null;
  return GRAPH_EDGES[table] || null;
}

export function getConfigsForTable(table) {
  if (!table) return [];
  return REGISTRY[table] ? [...REGISTRY[table]] : [];
}

// THE TABLE-TO-ROUTE MAP, for building a record link.
//
// Returns the route segment a table's records are reachable at, relative to
// the experience basename, or null when this portal has no page for that
// table. Null is meaningful: it tells the caller the link must leave the
// portal for the platform form.
//
// It lives here because this directory is the only place a table name is
// allowed, and a table-to-route mapping is table knowledge. A component
// asking for a record's URL knows neither the table nor the route.
export function routeForTable(table) {
  if (!table) return null;
  const candidates = REGISTRY[table] || [];
  for (const candidate of candidates) {
    const route = String(candidate?.route || '').trim();
    if (route) return route;
  }
  return null;
}

// Exposed so a genericity proof (step 6) can assert what is registered without
// reaching into the private object.
export function listRegisteredTables() {
  return Object.keys(REGISTRY);
}
