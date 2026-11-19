import {cellDisplay, cellValue, fetchTable} from './record-data.js';
import {graphEdgesFor} from '../configs/index.js';

// THE NAVIGATION GRAPH'S DATA LAYER.
//
// Roots are resolved by DATA, not by role. Two measured reasons:
//
// 1. gs.hasRole() CANNOT DISCRIMINATE. Measured for the current user: admin
//    true, sn_customerservice_agent true, sn_customerservice.agent true AND
//    sn_sales_agent true -- because admin satisfies every role check. Any
//    selector built on hasRole puts every admin on whichever branch is tested
//    first.
// 2. THERE IS NO SALES ROLE. A scan of sys_user_role for names containing
//    sales, agent or customerservice returned 40 candidates and not one sales
//    role, so the sales branch was undetectable by role even in principle.
//
// What does exist is the sales EDGE, measured on the dictionary:
//     customer_account.sales_owner            -> sys_user
//     customer_account.x_snc_philips_e2_0_kam -> sys_user

const ME = 'javascript:gs.getUserID()';

const ACCOUNT_TABLE = 'customer_account';
const CASE_TABLE = 'sn_customerservice_case';

const ACCOUNT_FIELDS =
  'sys_id,name,parent,sales_owner,x_snc_philips_e2_0_kam,primary_contact';
const CASE_FIELDS =
  'sys_id,number,short_description,state,priority,account,assigned_to,sys_updated_on';

export const ROOT_MY_ACCOUNTS = 'my-accounts';
export const ROOT_MY_CASES = 'my-cases';
export const ROOT_ACCOUNTS = 'accounts';

export const SORTS = {
  COUNT: 'count',
  NAME: 'name',
  RECENT: 'recent'
};

// Timeframe steps, in days. 0 means any age -- the slider's leftmost stop.
export const TIMEFRAMES = [0, 1, 7, 30, 90];

export const DEFAULT_FILTERS = {
  search: '',
  activeOnly: true,
  days: 0,
  state: '',
  priority: '',
  account: '',
  sort: SORTS.COUNT
};

function withFilters(base, filters, opts = {}) {
  const parts = base ? [base] : [];

  if (filters.activeOnly && opts.hasActive !== false) parts.push('active=true');

  // Relative age. The form is the one that demonstrably works on this
  // instance: an ON Last 24 hours variant returned 0 against the same data
  // where the relative form returned 656, so that zero was the query shape
  // rather than the truth.
  const days = Number(filters.days) || 0;
  if (days > 0) parts.push(`sys_updated_onRELATIVEGE@dayofweek@ago@${days}`);

  if (filters.state && opts.stateField) {
    parts.push(`${opts.stateField}=${filters.state}`);
  }
  if (filters.priority && opts.priorityField) {
    parts.push(`${opts.priorityField}=${filters.priority}`);
  }
  if (filters.account && opts.accountField) {
    parts.push(`${opts.accountField}=${filters.account}`);
  }

  const term = String(filters.search || '').trim();
  if (term && opts.searchField) {
    // LIKE on the one field worth searching for THIS root's entity. A
    // multi-field OR needs careful grouping in an encoded query, and a
    // malformed group silently matches everything.
    parts.push(`${opts.searchField}LIKE${term}`);
  }

  return parts.join('^');
}

function caseNode(row) {
  return {
    kind: 'case',
    table: CASE_TABLE,
    sysId: cellValue(row, 'sys_id'),
    title: cellDisplay(row, 'number'),
    subtitle: cellDisplay(row, 'short_description'),
    meta: [
      {label: 'State', value: cellDisplay(row, 'state')},
      {label: 'Priority', value: cellDisplay(row, 'priority')}
    ].filter(m => m.value),
    updated: cellValue(row, 'sys_updated_on')
  };
}

// ---- THE ACCOUNT TREE ------------------------------------------------------
//
// ACCOUNTS ARE HIERARCHICAL and the graph has to respect it. Measured: NYP
// Campus 1 through 4 all carry parent = NewYork-Presbyterian. Both the parent
// and the campuses have their own cases, so aggregating cases by account put a
// site at the same level as the account that owns it -- two routes to the same
// place, which is what made the web confusing.
//
// Every account is fetched once (160 on this instance) rather than resolving
// parents on demand: a child's parent may itself have no cases and so never
// appear in the case aggregation, and without it that child looks like a root.
async function fetchAccountTree(ctx) {
  const result = await fetchTable(ctx, ACCOUNT_TABLE, {
    fields: 'sys_id,name,parent',
    limit: 1000
  });
  const tree = new Map();
  for (const row of result.rows) {
    const id = cellValue(row, 'sys_id');
    if (!id) continue;
    tree.set(id, {
      id,
      name: cellDisplay(row, 'name'),
      parent: cellValue(row, 'parent')
    });
  }
  return tree;
}

// The top of an account's chain. Depth-capped because a cycle in the data
// would otherwise hang the page, and a self-parent is a real possibility.
function rootAncestor(id, tree) {
  let current = id;
  for (let depth = 0; depth < 12; depth++) {
    const node = tree.get(current);
    if (!node?.parent || node.parent === current) return current;
    if (!tree.has(node.parent)) return current;
    current = node.parent;
  }
  return current;
}

function sortNodes(nodes, sort) {
  const copy = [...nodes];
  if (sort === SORTS.NAME) {
    return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
  if (sort === SORTS.RECENT) {
    return copy.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  }
  // COUNT, the default: busiest first. Falls back to name for nodes with no
  // children, so the order is stable rather than arbitrary.
  return copy.sort(
    (a, b) =>
      (b.childCount || 0) - (a.childCount || 0) ||
      (a.title || '').localeCompare(b.title || '')
  );
}

async function fetchMyAccounts(ctx, filters) {
  const base = `sales_owner=${ME}^ORx_snc_philips_e2_0_kam=${ME}`;
  const result = await fetchTable(ctx, ACCOUNT_TABLE, {
    query: withFilters(base, filters, {
      // customer_account has no active field in the task sense, so the
      // open-work filter must not be applied -- it would match nothing.
      hasActive: false,
      searchField: 'name'
    }),
    fields: ACCOUNT_FIELDS,
    limit: 100
  });
  return result.rows.map(row => ({
    kind: 'account',
    table: ACCOUNT_TABLE,
    sysId: cellValue(row, 'sys_id'),
    title: cellDisplay(row, 'name'),
    subtitle: cellDisplay(row, 'primary_contact'),
    meta: [],
    updated: cellValue(row, 'sys_updated_on')
  }));
}

async function fetchMyCases(ctx, filters) {
  const result = await fetchTable(ctx, CASE_TABLE, {
    query: withFilters(`assigned_to=${ME}`, filters, {
      searchField: 'short_description',
      stateField: 'state',
      priorityField: 'priority',
      accountField: 'account'
    }),
    fields: CASE_FIELDS,
    limit: 100,
    orderBy: 'DESCsys_updated_on'
  });
  return result.rows.map(caseNode);
}

/**
 * The browse root: TOP-LEVEL accounts carrying open work, with counts that
 * include their descendants.
 *
 * One case read, aggregated client-side -- the Table API has no group-by, so
 * the alternative was a count query per account. Facet values are collected
 * from the same rows, which is why the filter dropdowns only ever offer
 * options that exist in the data.
 */
async function fetchAccountsWithCases(ctx, filters, tree) {
  const result = await fetchTable(ctx, CASE_TABLE, {
    query: withFilters('accountISNOTEMPTY', filters, {
      // SEARCHES THE ACCOUNT NAME, because this root's nodes ARE accounts.
      // It read short_description before, which searched the wrong entity:
      // "NewYork" matched one case belonging to an unrelated account while
      // NewYork-Presbyterian never appeared.
      searchField: 'account.name',
      stateField: 'state',
      priorityField: 'priority',
      accountField: 'account'
    }),
    fields: CASE_FIELDS,
    limit: 1000,
    orderBy: 'DESCsys_updated_on'
  });

  const byRoot = new Map();
  const states = new Map();
  const priorities = new Map();
  const accounts = new Map();

  for (const row of result.rows) {
    const accountId = cellValue(row, 'account');
    if (!accountId) continue;

    // FACETS come from the rows in scope, so an option can never return an
    // empty result.
    const stateValue = cellValue(row, 'state');
    if (stateValue) states.set(stateValue, cellDisplay(row, 'state'));
    const priorityValue = cellValue(row, 'priority');
    if (priorityValue) priorities.set(priorityValue, cellDisplay(row, 'priority'));
    accounts.set(accountId, cellDisplay(row, 'account'));

    // ROLL UP to the top of the account chain, so a site's cases count toward
    // the account that owns it and the site appears only on expansion.
    const rootId = rootAncestor(accountId, tree);
    if (!byRoot.has(rootId)) {
      byRoot.set(rootId, {
        id: rootId,
        name: tree.get(rootId)?.name || cellDisplay(row, 'account'),
        count: 0,
        updated: ''
      });
    }
    const entry = byRoot.get(rootId);
    entry.count += 1;
    const updated = cellValue(row, 'sys_updated_on');
    if (updated > entry.updated) entry.updated = updated;
  }

  const nodes = [...byRoot.values()].map(entry => ({
    kind: 'account',
    table: ACCOUNT_TABLE,
    sysId: entry.id,
    title: entry.name,
    subtitle: '',
    meta: [],
    childCount: entry.count,
    updated: entry.updated
  }));

  return {
    nodes,
    truncated: result.rows.length >= 1000,
    facets: {
      states: [...states.entries()].map(([value, label]) => ({value, label})),
      priorities: [...priorities.entries()].map(([value, label]) => ({
        value,
        label
      })),
      accounts: [...accounts.entries()]
        .map(([value, label]) => ({value, label}))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
  };
}

export async function buildGraph(ctx, filters = DEFAULT_FILTERS) {
  // The tree is needed before the aggregation can roll up, so it is awaited
  // first rather than raced with it.
  const treeSettled = await Promise.allSettled([fetchAccountTree(ctx)]);
  const tree =
    treeSettled[0].status === 'fulfilled' ? treeSettled[0].value : new Map();

  const [mineAcct, mineCases, browse] = await Promise.allSettled([
    fetchMyAccounts(ctx, filters),
    fetchMyCases(ctx, filters),
    fetchAccountsWithCases(ctx, filters, tree)
  ]);

  const myAccounts = mineAcct.status === 'fulfilled' ? mineAcct.value : [];
  const myCases = mineCases.status === 'fulfilled' ? mineCases.value : [];
  const browsed =
    browse.status === 'fulfilled'
      ? browse.value
      : {nodes: [], truncated: false, facets: {states: [], priorities: [], accounts: []}};

  const sort = filters.sort || SORTS.COUNT;
  const roots = [
    {
      id: ROOT_MY_ACCOUNTS,
      label: 'My accounts',
      nodes: sortNodes(myAccounts, sort),
      count: myAccounts.length
    },
    {
      id: ROOT_MY_CASES,
      label: 'My cases',
      nodes: sortNodes(myCases, sort),
      count: myCases.length
    },
    {
      id: ROOT_ACCOUNTS,
      label: 'Accounts with open work',
      nodes: sortNodes(browsed.nodes, sort),
      count: browsed.nodes.length
    }
  ];

  const active = roots.find(root => root.count > 0) || roots[2];

  return {
    roots,
    activeRootId: active.id,
    truncated: browsed.truncated,
    facets: browsed.facets
  };
}

/**
 * ONE LEVEL OUT FROM ANY NODE, in both directions.
 *
 * The edge map comes from configs/index.js, so this function names no table.
 *   upstream   reference fields ON this record. ONE read covers all of them.
 *   downstream one query per related table whose field points back here.
 *
 * Returns [{node, direction, relation}] -- the caller draws the edge
 * accordingly, so the web shows which way a relationship runs.
 */
export async function expandNode(ctx, table, sysId, filters = DEFAULT_FILTERS) {
  const edges = graphEdgesFor(table);
  if (!edges || !sysId) return [];

  const upstream = edges.upstream || [];
  const downstream = edges.downstream || [];
  const upstreamFields = upstream.map(entry => entry.field).join(',');

  const [selfResult, ...downResults] = await Promise.allSettled([
    upstreamFields
      ? fetchTable(ctx, table, {
          query: `sys_id=${sysId}`,
          fields: `sys_id,${upstreamFields}`,
          limit: 1
        })
      : Promise.resolve({rows: []}),
    ...downstream.map(entry =>
      fetchTable(ctx, entry.table, {
        query: withFilters(`${entry.field}=${sysId}`, filters, {
          hasActive: entry.hasActive,
          searchField: entry.searchField
        }),
        fields: entry.fields,
        limit: 25,
        orderBy: entry.titleField || ''
      })
    )
  ]);

  const out = [];

  const selfRow =
    selfResult.status === 'fulfilled' ? selfResult.value.rows?.[0] : null;
  if (selfRow) {
    for (const entry of upstream) {
      const value = cellValue(selfRow, entry.field);
      if (!value) continue;
      out.push({
        direction: 'up',
        relation: entry.label,
        // AN UPSTREAM NEIGHBOUR HAS NO FETCHED ROW -- it is a reference field
        // on THIS record, so the only thing known about it is the reference's
        // display value. It therefore declares a single column reading that
        // value, rather than inheriting a spec whose fields it cannot supply
        // and rendering a row of blanks.
        columns: [{label: entry.label, field: 'title', link: true}],
        node: {
          kind: entry.kind,
          table: entry.table,
          sysId: value,
          title: cellDisplay(selfRow, entry.field) || value,
          subtitle: '',
          meta: [],
          raw: {title: cellDisplay(selfRow, entry.field) || value}
        }
      });
    }
  }

  downstream.forEach((entry, index) => {
    const settled = downResults[index];
    if (!settled || settled.status !== 'fulfilled') return;
    for (const row of settled.value.rows || []) {
      const id = cellValue(row, 'sys_id');
      if (!id) continue;
      out.push({
        direction: 'down',
        relation: entry.label,
        // The descriptor's own column spec travels with the link, so the
        // renderer needs no table knowledge and each relation keeps the
        // columns that suit it.
        columns: entry.columns || null,
        node: {
          kind: entry.kind,
          table: entry.table,
          sysId: id,
          title: cellDisplay(row, entry.titleField || 'number') || id,
          subtitle: cellDisplay(row, 'short_description'),
          meta: [{label: 'State', value: cellDisplay(row, 'state')}].filter(
            m => m.value
          ),
          // THE WHOLE ROW. Every field the descriptor asked for was being
          // fetched and then discarded into title/subtitle/meta, which is why
          // a generic Related view could only ever show three columns.
          raw: row
        }
      });
    }
  });

  return out;
}
