import {
  cellDisplay,
  cellValue,
  fetchRecordFields,
  fetchRelated,
  fetchTable
} from './record-data.js';
import {extractStorySections, hasStoryContent} from '../story-extract.js';

// THE OTTO ADAPTER -- builds the Intelligent view's payload FROM RECORDS.
//
// Nothing here invents a value and nothing parses narrative text for facts.
// Every number, state and identity is a field read through the Table API; the
// only prose is the AI-generated story field, and that is used as prose.
// ACCEPTANCE is explicit -- "task and work order states always come from the
// state field, never from narrative text" -- so the one place the design's
// board disagreed with the records, the records win.
//
// WHY A LOADER FUNCTION RATHER THAN A COMPONENT.
// Every component in the Intelligent view is presentational: COMPONENTS.md
// says components never query. This runs in the page's loader, server-side
// during SSR, so the view renders with data already present rather than
// flashing empty cards. It accepts ctx and returns plain data, which is the
// shape the shared-loader guidance requires.
//
// WHY Promise.allSettled AND NOT Promise.all.
// Five independent reads. The loader guidance is explicit that one failing
// fetch must not crash the whole loader -- so a missing regulatory report
// degrades to a payload without counts, and the brief still renders. With
// Promise.all a single 403 would blank the entire view.
//
// THE FIELD NAMES BELOW ARE THIS DEMO'S DATA MODEL, not the framework's.
// They are confined to this file on purpose: the components, the shell and the
// config loader contain no table or field name at all, which is ACCEPTANCE's
// first criterion. Pointing the framework at another record type means
// another adapter, not an edit to any component.

// LABELS ARE NOT THIS FILE'S JOB. Every entry below carries a stable `id` and
// a value, and NO human-readable label. The components translate an id into
// wording through i18n.getMessage, which keeps one source of truth for each
// string and keeps source-language text out of the data layer. An English
// label here would also be untranslatable in practice: it would reach the page
// having never passed through the message catalogue.
//
// The one exception is text that is MODEL OUTPUT -- the story's section labels
// and prose. That is content, not UI, so it is passed through verbatim and
// must never be handed to i18n.getMessage.

const CASE_FIELDS = [
  'number',
  'short_description',
  'state',
  'priority',
  'account',
  'contact',
  'assigned_to',
  'assignment_group',
  'parent',
  'cmdb_ci',
  'product',
  'opened_at',
  // Generic prose and status fields, so a case with no AI story still has a
  // summary and a major-case finding. Without these in the field list the
  // fallback chain below would read empty strings and silently change nothing.
  'description',
  'business_impact',
  'probable_cause',
  'major_case_state',
  'x_snc_pmdemo_case_story',
  'x_snc_pmdemo_regulatory_flag',
  // DOT-WALK. The target firmware is two hops out: the case's product is a
  // cmdb_model, and that model names the latest firmware model, whose version
  // is the value the design shows. sysparm_fields resolves this server-side in
  // the same read, so it costs no extra request.
  'product.x_snc_pmdemo_latest_firmware.version',
  'product.x_snc_pmdemo_latest_firmware.description'
].join(',');

const REG_TABLE = 'x_snc_pmdemo_reg_report';
const REG_FIELDS = [
  'number',
  'sys_id',
  'state',
  'report_status',
  'firmware_version',
  'affected_device_count',
  'remote_eligible_count',
  'dispatch_required_count',
  'affected_account_count',
  'fleet_total_count'
].join(',');

const TASK_TABLE = 'wm_task';
const TASK_FIELDS = [
  'number',
  'sys_id',
  'state',
  'short_description',
  'location',
  'cmdb_ci',
  'assigned_to',
  'parent'
].join(',');

const ORDER_TABLE = 'wm_order';
const CHANGE_TABLE = 'change_request';
const CHAIN_FIELDS = 'number,sys_id,state,short_description,parent';

// ORIGIN -- where the case came from.
//
// An interaction is linked through an m2m row, not a reference field on either
// side: interaction_related_record.document_id holds the case and its
// `interaction` field holds the interaction. document_id is a document_id
// column (a sys_id with a companion document_table), which is why no related
// list can express this relationship as a simple child query.
//
// The interaction's own fields are DOT-WALKED through the link row, so this
// stays ONE read instead of a link read followed by a lookup.
const LINK_TABLE = 'interaction_related_record';
const LINK_FIELDS = [
  'sys_id',
  'interaction',
  'document_table',
  'interaction.number',
  'interaction.state',
  'interaction.short_description',
  'interaction.opened_at',
  'interaction.duration',
  'interaction.assigned_to',
  'interaction.opened_for'
].join(',');

// COMMITMENTS -- SLAs attached to this case.
const SLA_TABLE = 'task_sla';
const SLA_FIELDS = [
  'sys_id',
  'sla',
  'stage',
  'has_breached',
  'percentage',
  'end_time',
  'active'
].join(',');

function num(row, field) {
  const raw = cellValue(row, field);
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// A platform boolean crosses the Table API as either '1'/'0' or 'true'/'false'
// depending on the column and the display_value mode, and this was NOT pinned
// down for has_breached on a live payload. Both forms are accepted rather than
// asserting one: reading only '1' would silently report a breached SLA as
// healthy, which is the worst direction for this particular field to fail in.
function isTrue(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Builds the Intelligent view's data in both namespaces DATA_CONTRACT names:
 * otto.* for assistant-derived content and record.* for record-derived
 * structure. They are produced together because they come from the same reads.
 *
 * Returns null when there is nothing to show, which is what closes the
 * richness gate -- an Intelligent view with no brief must never render.
 */
export async function buildRecordIntelligence(ctx, {table, sysId, sanitize}) {
  if (!table || !sysId || sysId === '-1') return null;

  const caseResult = await fetchRecordFields(ctx, table, sysId, CASE_FIELDS);
  const row = caseResult.row;
  if (!row) return null;

  const parentSysId = cellValue(row, 'parent');

  // THE SCOPE SET -- this record, its parent, and its children.
  //
  // WHY THIS EXISTS. Every sibling read used to hang off parentSysId: go UP to
  // the parent, then back DOWN to what else points at it. That works only from
  // a CHILD. Measured on the two records in this hierarchy:
  //
  //                        CS0001623 (child)   CS0001624 (parent, major)
  //   work order via parent        1                    0
  //   change via parent            1                    0
  //   dispatch tasks               3                    0
  //   children                     0           CS0001623, never queried
  //
  // 1624 has NO parent, so every one of those reads returned zero -- while the
  // work order, the change and the three dispatch tasks are attached directly
  // to it (own_wo 1, own_chg 1, own tasks 3), and its child case was never
  // looked for at all. The adapter was written from one record's point of
  // view.
  //
  // So relations are now resolved against a SET: self, the parent if there is
  // one, and every child. One code path serves a parent, a child, and a case
  // with no hierarchy at all.
  //
  // The children read has to come first because it feeds the set, so this is a
  // deliberate second round trip rather than part of the batch below.
  const childResult = await fetchRelated(ctx, table, 'parent', sysId, {
    fields: CHAIN_FIELDS,
    limit: 25,
    orderBy: 'number'
  });
  const children = childResult.rows || [];

  const scopeIds = [
    sysId,
    parentSysId,
    ...children.map(child => cellValue(child, 'sys_id'))
  ].filter(Boolean);

  // Encoded-query IN list: field + 'IN' + comma-separated sys_ids.
  const scopeIn = scopeIds.join(',');

  // Seven independent reads. A rejection or a failure in any one leaves its
  // slice empty rather than failing the page.
  const [
    regSettled,
    taskSettled,
    parentSettled,
    orderSettled,
    changeSettled,
    linkSettled,
    slaSettled
  ] = await Promise.allSettled([
      // The regulatory report points AT a case in scope -- on 1624 it points
      // at the CHILD, not at 1624 itself, so a self-only read missed it.
      fetchTable(ctx, REG_TABLE, {
        query: `source_caseIN${scopeIn}`,
        fields: REG_FIELDS,
        limit: 10
      }),
      // Dispatch tasks hang off a work order, which hangs off a case in scope.
      fetchTable(ctx, TASK_TABLE, {
        query: `parent.parentIN${scopeIn}`,
        fields: TASK_FIELDS,
        limit: 25,
        orderBy: 'number'
      }),
      parentSysId
        ? fetchRecordFields(ctx, table, parentSysId, CHAIN_FIELDS)
        : Promise.resolve({row: null, failed: false, reason: 'no parent'}),
      // Work orders and changes attach to whichever case in scope owns them --
      // the parent on 1623, the record itself on 1624.
      fetchTable(ctx, ORDER_TABLE, {
        query: `parentIN${scopeIn}`,
        fields: CHAIN_FIELDS,
        limit: 15
      }),
      fetchTable(ctx, CHANGE_TABLE, {
        query: `parentIN${scopeIn}`,
        fields: CHAIN_FIELDS,
        limit: 15
      }),
      // Origin: the m2m link row, with the interaction dot-walked through it.
      fetchRelated(ctx, LINK_TABLE, 'document_id', sysId, {
        fields: LINK_FIELDS,
        limit: 10
      }),
      // Commitments: SLAs are inbound on task, so this needs no parent hop.
      fetchRelated(ctx, SLA_TABLE, 'task', sysId, {
        fields: SLA_FIELDS,
        limit: 20
      })
    ]);

  const settled = s => (s.status === 'fulfilled' ? s.value : null);
  const reg = settled(regSettled)?.rows?.[0] ?? null;
  const tasks = settled(taskSettled)?.rows ?? [];
  const parentRow = settled(parentSettled)?.row ?? null;
  const orders = settled(orderSettled)?.rows ?? [];
  const changes = settled(changeSettled)?.rows ?? [];
  const links = settled(linkSettled)?.rows ?? [];
  const slaRows = settled(slaSettled)?.rows ?? [];

  const story = extractStorySections(
    cellValue(row, 'x_snc_pmdemo_case_story'),
    sanitize ? {sanitize} : {}
  );

  // ---- otto.brief -------------------------------------------------------
  // THE SUMMARY IS A FALLBACK CHAIN, not the story field alone.
  //
  // Measured: exactly 1 of 1411 cases on this instance carries
  // x_snc_pmdemo_case_story. Keying the summary on it meant the richness gate
  // answered no-brief for every other case, so Intelligence existed on one
  // record in the entire table -- including on CS0001624, a major case with
  // business impact, a probable cause, a child case, an SLA, a work order and
  // a change.
  //
  // So the story is now the PREFERRED input, not the trigger. Each fallback is
  // a real field holding prose written for a human; none is derived from
  // narrative parsing, and none is fabricated.
  const summary =
    story.sections[0]?.text ||
    story.fallbackText ||
    cellDisplay(row, 'business_impact') ||
    cellDisplay(row, 'probable_cause') ||
    cellDisplay(row, 'description') ||
    '';

  const targetFirmware = cellDisplay(
    row,
    'product.x_snc_pmdemo_latest_firmware.version'
  );

  // Stats carry a null when the field is absent, and the component drops a
  // null rather than printing a zero. A zero and "not measured" are different
  // facts, and a fabricated zero is the worse of the two.
  const stats = [
    {id: 'devices', value: num(reg, 'affected_device_count')},
    {id: 'remote', value: num(reg, 'remote_eligible_count')},
    {id: 'dispatch', value: num(reg, 'dispatch_required_count')},
    {id: 'accounts', value: num(reg, 'affected_account_count')},
    {id: 'firmware', value: targetFirmware || null, mono: true}
  ].filter(stat => stat.value !== null && stat.value !== '');

  // The regulatory alert links the real report and reports its REAL status.
  // The design board said "Draft"; the record says report_status approved and
  // state Open. The record wins -- that is the whole point of the rule.
  const alerts = [];
  const regFlag = cellDisplay(row, 'x_snc_pmdemo_regulatory_flag');
  if (regFlag) {
    alerts.push({
      id: 'regulatory',
      tone: 'warning',
      text: regFlag,
      record: reg
        ? {
            table: REG_TABLE,
            sysId: cellValue(reg, 'sys_id'),
            number: cellDisplay(reg, 'number'),
            state: cellDisplay(reg, 'state'),
            status: cellDisplay(reg, 'report_status')
          }
        : null
    });
  }

  // ---- otto.cause -------------------------------------------------------
  // from/to are firmware versions read from fields. The trigger version comes
  // from the report's own firmware_version string and is shown WHOLE: it is a
  // labelled description, and slicing a version out of it with a regex would
  // be deriving a fact from prose.
  const cause = {
    from: cellDisplay(reg, 'firmware_version') || '',
    to: targetFirmware || '',
    facts: [
      {
        id: 'trigger-device',
        value: cellDisplay(row, 'cmdb_ci'),
        record: cellValue(row, 'cmdb_ci')
          ? {table: 'cmdb_ci', sysId: cellValue(row, 'cmdb_ci')}
          : null
      },
      {id: 'product', value: cellDisplay(row, 'product')},
      {id: 'fleet', value: num(reg, 'fleet_total_count')}
    ].filter(fact => fact.value !== null && fact.value !== '')
  };

  // ---- record.party -----------------------------------------------------
  // assigned_to being EMPTY is itself a fact the design surfaces as a warning
  // chip, so it is reported with a missing flag rather than omitted.
  const party = {
    account: {
      value: cellDisplay(row, 'account'),
      record: cellValue(row, 'account')
        ? {table: 'customer_account', sysId: cellValue(row, 'account')}
        : null
    },
    contact: {
      value: cellDisplay(row, 'contact'),
      record: cellValue(row, 'contact')
        ? {table: 'customer_contact', sysId: cellValue(row, 'contact')}
        : null
    },
    assignmentGroup: {value: cellDisplay(row, 'assignment_group')},
    assignedTo: {
      value: cellDisplay(row, 'assigned_to'),
      missing: !cellValue(row, 'assigned_to')
    }
  };

  // ---- record.chain -----------------------------------------------------
  // The REAL topology, not the board's flat spine. Measured: the work order
  // and the change both parent to the PARENT case, and the regulatory report
  // points inbound at this case through source_case. So the chain is
  // parent -> self, parent -> siblings, self <- report.
  const node = (r, table, relation) =>
    r
      ? {
          table,
          sysId: cellValue(r, 'sys_id'),
          number: cellDisplay(r, 'number'),
          state: cellDisplay(r, 'state'),
          title: cellDisplay(r, 'short_description'),
          relation
        }
      : null;

  const chain = [
    parentRow ? {...node(parentRow, table, 'parent'), sysId: parentSysId} : null,
    {
      table,
      sysId,
      number: cellDisplay(row, 'number'),
      state: cellDisplay(row, 'state'),
      title: cellDisplay(row, 'short_description'),
      relation: 'self',
      current: true
    },
    // CHILD CASES -- the trackback down the hierarchy. The chain only ever
    // went up, so a major case showed nothing of what it coordinates.
    ...children.map(child => node(child, table, 'child')),
    ...orders.map(r => node(r, ORDER_TABLE, 'sibling')),
    ...changes.map(r => node(r, CHANGE_TABLE, 'sibling')),
    reg ? node(reg, REG_TABLE, 'report') : null
  ].filter(Boolean);

  // ---- record.remediation ----------------------------------------------
  // The split is two real counts, and the task rows carry their own real
  // state. Device count per task is DERIVED from the task's single
  // configuration item rather than parsed out of its short description.
  const remediation = {
    segments: [
      {id: 'remote', label: 'Remote update', value: num(reg, 'remote_eligible_count')},
      {id: 'dispatch', label: 'Dispatch', value: num(reg, 'dispatch_required_count')}
    ].filter(seg => seg.value !== null),
    total: num(reg, 'affected_device_count'),
    tasks: tasks.map(t => ({
      table: TASK_TABLE,
      sysId: cellValue(t, 'sys_id'),
      number: cellDisplay(t, 'number'),
      state: cellDisplay(t, 'state'),
      site: cellDisplay(t, 'location'),
      device: cellDisplay(t, 'cmdb_ci'),
      assignedTo: cellDisplay(t, 'assigned_to'),
      devices: cellValue(t, 'cmdb_ci') ? 1 : 0
    }))
  };

  // ---- record.related ---------------------------------------------------
  // THE RELATED RECORDS VIEW, grouped by HOW each record relates.
  //
  // This exists because a related list cannot express what this case is
  // actually related to. A related list is one query --
  // <child table>.<reference field> = current record -- and only ONE of the
  // four relationships here has that shape:
  //
  //   inbound   SLAs, the regulatory report  -> expressible as a related list
  //   outbound  the parent case              -> the reference is on THIS
  //                                             record, so no child query
  //                                             reaches it
  //   sibling   work order, change           -> they point at the PARENT case;
  //                                             needs a two-hop traversal
  //   m2m       the originating interaction  -> linked through a document_id
  //                                             column on a join table
  //
  // Measured on the subject case: parent 1, inbound report 1, inbound SLAs 3,
  // dispatch tasks 3, and ZERO inbound work orders or changes. So the OOTB
  // related lists could only ever show the inbound slice, which is why the
  // view looked empty of anything relevant. The adapter does the traversal
  // instead, and each group is rendered as its own applet.
  const groupRow = (r, table, extra = {}) => ({
    table,
    sysId: cellValue(r, 'sys_id'),
    number: cellDisplay(r, 'number'),
    state: cellDisplay(r, 'state'),
    title: cellDisplay(r, 'short_description'),
    ...extra
  });

  const related = {
    // Where the case came from. The interaction's fields arrive dot-walked
    // through the link row, so they are read with the dotted names.
    origin: links
      .filter(l => cellValue(l, 'interaction'))
      .map(l => ({
        table: 'interaction',
        sysId: cellValue(l, 'interaction'),
        number: cellDisplay(l, 'interaction.number'),
        state: cellDisplay(l, 'interaction.state'),
        title: cellDisplay(l, 'interaction.short_description'),
        opened: cellDisplay(l, 'interaction.opened_at'),
        duration: cellDisplay(l, 'interaction.duration'),
        handledBy: cellDisplay(l, 'interaction.assigned_to'),
        openedFor: cellDisplay(l, 'interaction.opened_for')
      })),

    // Outbound AND inbound: the parent this record hangs off, plus every child
    // that hangs off it. A major case coordinates children, so showing only
    // the upward edge made the Related view look empty on exactly the record
    // where the hierarchy matters most.
    hierarchy: [
      parentRow
        ? {...groupRow(parentRow, table), sysId: parentSysId, relation: 'parent'}
        : null,
      ...children.map(child => ({
        ...groupRow(child, table),
        relation: 'child'
      }))
    ].filter(Boolean),

    // Siblings reached through the parent, plus the inbound report.
    fulfilment: [
      ...orders.map(r => groupRow(r, ORDER_TABLE, {kind: 'order'})),
      ...changes.map(r => groupRow(r, CHANGE_TABLE, {kind: 'change'})),
      ...(reg ? [groupRow(reg, REG_TABLE, {kind: 'report'})] : [])
    ],

    // The same rows the Remediation card shows, read once and shared.
    dispatch: remediation.tasks,

    // Inbound. percentage can exceed 100 on a breached SLA -- measured 1153.06
    // on this case -- so it is passed through unclamped and the component
    // clamps the BAR while printing the real number.
    commitments: slaRows.map(s => ({
      table: SLA_TABLE,
      sysId: cellValue(s, 'sys_id'),
      name: cellDisplay(s, 'sla'),
      stage: cellDisplay(s, 'stage'),
      breached: isTrue(cellValue(s, 'has_breached')),
      active: isTrue(cellValue(s, 'active')),
      percentage: num(s, 'percentage'),
      endTime: cellDisplay(s, 'end_time')
    }))
  };

  // ---- otto.situation ---------------------------------------------------
  // Every story section after the first, in source order. Labels and prose are
  // model output: content, not UI strings.
  const situation = {
    steps: story.sections.slice(1).map((section, index) => ({
      id: `story-${index}`,
      label: section.label,
      text: section.text
    })),
    mode: story.mode,
    fallbackHtml: story.fallbackHtml,
    fallbackText: story.fallbackText
  };

  // ---- otto.findings ----------------------------------------------------
  // Each finding names a MESSAGE ID and the component renders it through
  // i18n.getMessage, with `count` interpolated where the wording needs it.
  // `target` is the grid component id the dock scrolls to.
  //
  // EVERY FINDING MUST CARRY BOTH sources AND target, or the richness gate
  // discards it -- DATA_CONTRACT: "no source or target means no finding", and
  // isRealFinding enforces exactly that. sources is not decoration: it names
  // the field or record the finding was derived from, which is what makes the
  // finding evidence rather than an assertion. A finding with an empty sources
  // array is silently dropped, so the gate can answer no-findings while every
  // card still renders -- the option simply never appears.
  const findings = [
    cause.from || cause.to
      ? {
          id: 'f-cause',
          target: 'cause',
          tone: 'info',
          message: 'cause',
          sources: [
            cellValue(row, 'product') ? 'product' : '',
            reg ? `${REG_TABLE}:${cellValue(reg, 'sys_id')}` : ''
          ].filter(Boolean)
        }
      : null,
    regFlag
      ? {
          id: 'f-regulatory',
          target: 'brief',
          tone: 'warning',
          message: 'regulatory',
          value: regFlag,
          sources: [
            'x_snc_pmdemo_regulatory_flag',
            reg ? `${REG_TABLE}:${cellValue(reg, 'sys_id')}` : ''
          ].filter(Boolean)
        }
      : null,
    party.assignedTo.missing
      ? {
          id: 'f-unassigned',
          target: 'party',
          tone: 'warning',
          message: 'unassigned',
          sources: ['assigned_to']
        }
      : null,
    remediation.tasks.length
      ? {
          id: 'f-dispatch',
          target: 'remed',
          tone: 'info',
          message: 'dispatch',
          count: remediation.tasks.length,
          sources: remediation.tasks
            .map(t => `${TASK_TABLE}:${t.sysId}`)
            .filter(Boolean)
        }
      : null,
    // GENERIC FINDINGS -- these are what let a case with no device-safety
    // report still earn the Intelligence view. Each cites the field or record
    // it came from, so it passes isRealFinding on evidence, not on assertion.
    cellValue(row, 'major_case_state')
      ? {
          id: 'f-major',
          target: 'brief',
          tone: 'warning',
          message: 'major',
          value: cellDisplay(row, 'major_case_state'),
          sources: ['major_case_state']
        }
      : null,
    related.commitments.some(s => s.breached)
      ? {
          id: 'f-sla',
          target: 'brief',
          tone: 'critical',
          message: 'sla',
          count: related.commitments.filter(s => s.breached).length,
          sources: related.commitments
            .filter(s => s.breached)
            .map(s => `${SLA_TABLE}:${s.sysId}`)
        }
      : null,
    related.hierarchy.length
      ? {
          id: 'f-hierarchy',
          target: 'chain',
          tone: 'info',
          message: 'hierarchy',
          sources: related.hierarchy
            .map(n => `${table}:${n.sysId}`)
            .filter(Boolean)
        }
      : null
  ].filter(Boolean);

  const brief = {summary, stats, alerts, generatedAt: story.generatedAt};

  // THE OTTO HALF'S WORTH, reported rather than enforced here.
  //
  // This used to `return null` when the brief was thin, which closed the
  // richness gate. That is now WRONG: record.related feeds the Related
  // records view, which must render on any case whether or not an Otto
  // narrative exists. Returning null would have made a case with no story
  // show an empty Related view as well -- one thin payload silently removing
  // an unrelated view.
  //
  // The gate is handed intel.otto and decides for itself: evaluateRichness
  // answers no-brief and hides the Intelligence option, while record.* still
  // flows to Details and Related. Each view now gates on its own data.
  const ottoWorthShowing =
    Boolean(summary) || stats.length > 0 || findings.length > 0;

  return {
    otto: {brief, cause, situation, findings, suggestions: []},
    record: {party, chain, remediation, related},
    meta: {
      storyMode: story.mode,
      hasStory: hasStoryContent(story),
      ottoWorthShowing,
      regFound: Boolean(reg),
      taskCount: remediation.tasks.length,
      originCount: related.origin.length,
      slaCount: related.commitments.length,
      breachedSlaCount: related.commitments.filter(s => s.breached).length,
      caseFailed: caseResult.failed
    }
  };
}
