// THE Customer Service Case layout config -- ONE PER TABLE, NO CONDITION.
//
// WHY THERE IS NO CONDITION ANY MORE.
//
// This config used to carry condition: 'x_snc_pmdemo_regulatory_flag=reportable'.
// That made a demo field the load-bearing switch for the whole UI: the
// condition decided whether a config matched, and the match decided the header
// title, the chips, the form view, and -- through the richness gate's
// configMatched half -- whether the Intelligence tab existed at all.
//
// The flag records one thing: that a regulatory report was needed. It drives
// nothing else on the record and it must drive nothing in the UI. Measured
// consequence of making it a switch: CS0001624, a major case with 799
// characters of business impact, a probable cause, a child case, an SLA, a work
// order and a change, has an EMPTY flag -- so it failed the condition, fell to
// the table-agnostic default config, and rendered with no title, no tags and no
// Intelligence. The layout was effectively built for one record out of 1411.
//
// So presentation is attached to the TABLE, which is the thing that is actually
// stable. Every case gets this config.
//
// WHEN A CONDITION WOULD BE LEGITIMATE: only to select a different GRID -- a
// genuinely different arrangement of components for a subset of records. Never
// to decide a title, a chip, a form view or whether a tab exists. Those are
// properties of the table. If a device-safety variant ever needs its own grid,
// add a SECOND config above this one with a condition and a grid, and leave
// everything else here.

export default {
  id: 'sn_customerservice_case',
  table: 'sn_customerservice_case',

  // Unconditional. This is the point of the restructure.
  condition: null,
  active: true,

  // THE ROUTE THIS TABLE'S RECORDS ARE REACHABLE AT, relative to the
  // experience basename. Declared here because configs/ is the only place a
  // table name may appear, so the table-to-route mapping belongs here too --
  // a component asking "what is the URL for this record" must not know either
  // the table or the route, only that it has a record.
  route: 'case',

  // DETAILS IS READ FROM THE RECORD, NOT FROM A FORM LAYOUT.
  //
  // WHY. Reading Details through FormAPI meant Details could only ever show
  // fields that happened to be on the resolved form view, and that single
  // coupling produced five separate failures: the regulatory flag missing, the
  // account missing, the story field unreachable, state missing, and finally
  // the classic UI16 script stack loading because the agent form view carries
  // formatters. A form layout is an AGENT EDITING SURFACE; using it as a read
  // model is the root cause, not any one of those symptoms.
  //
  // So the groups below name the fields, the loader reads them straight off
  // the record through the Table API, and no view is involved. A field needs
  // no form-layout entry to appear here.
  //
  // label: optional. The platform's own label is used when the field happens
  // to be in the resolved layout; otherwise the field name is humanised
  // (state -> State). An override is only needed where humanising is wrong --
  // a scoped field such as x_snc_pmdemo_regulatory_flag would read
  // "X Snc Pmdemo Regulatory Flag". Overrides go through i18n.
  //
  // A group renders only when it holds real content, and when it renders it
  // shows ALL its fields, empties as an em dash. So Resolution and Major case
  // are absent on an open non-major case and appear when they fill in.
  details: {
    // FETCHED BUT NOT RENDERED AS ROWS. The glance card and the contact card
    // read these, so they must be in the request -- but showing them again in
    // a field group would print the same fact twice, which is the clutter this
    // layout exists to remove.
    glanceFields: [
      'priority',
      'state',
      'major_case_state',
      'x_snc_pmdemo_regulatory_flag',
      'assigned_to',
      'assignment_group',
      'contact',
      'account'
    ],

    groups: [
      {
        id: 'overview',
        // NOT the bare word Case. Every group label is passed through
        // i18n.getMessage, and a single common word is the most likely key to
        // collide with an existing message record -- which is the leading
        // explanation for this heading rendering lowercase while Raised and
        // Major case came through correctly. The cause was not confirmed; a
        // specific label removes the class of problem either way, and reads
        // better as a section heading.
        label: 'Case details',
        fields: [
          'number',
          'contact_type',
          'category',
          'subcategory',
          {field: 'short_description', wide: true},
          {field: 'description', wide: true}
        ]
      },
      {
        id: 'origin',
        label: 'Raised',
        fields: ['opened_by', 'opened_at', 'parent']
      },
      {
        id: 'asset',
        label: 'Product and device',
        fields: [
          'product',
          {field: 'cmdb_ci', label: 'Configuration item'},
          'install_base',
          'asset'
        ]
      },
      {
        id: 'major',
        label: 'Major case',
        fields: [
          {field: 'business_impact', wide: true},
          {field: 'probable_cause', wide: true}
        ]
      },
      {
        id: 'resolution',
        label: 'Resolution',
        fields: [
          'resolved_by',
          'resolved_at',
          'resolution_code',
          'closed_by',
          'closed_at',
          'cause',
          {field: 'close_notes', wide: true}
        ]
      }
    ]
  },

  // NO FORM VIEW IS FORCED, and Details no longer needs one.
  //
  // Measured consequence of forcing one: this carried formView 'case' to pick
  // up Resolution Information and Major Case Information. That view's main
  // section also carries CLASSIC UI FORMATTERS --
  // sn_res_shaper_resolution_shaper.xml, cxs_table_search.xml, a REL.
  // related-list formatter and activity.xml -- and requesting it dragged the
  // entire UI16 script stack into this page. Console timeline on CS0001623,
  // 2026-11-17:
  //
  //   23:48:58  page scripts load
  //   23:49:28  moveworks-sidebar init fails          (+30s)
  //   23:49:30  Overwriting extension point: window, document, $, jQuery,
  //             angular, cabrillo, g_form, g_scratchpad, g_user, NOW
  //   23:49:30  classic client scripts run and throw
  //
  // The record scripting environment did not initialise until 32 SECONDS after
  // load and the AIUX g_form was REPLACED by the classic one -- the slow load
  // and the render churn.
  //
  // Omitting the view lets the platform resolve it. The form payload is still
  // fetched, because the record package needs it for UI actions and for field
  // metadata, but Details no longer depends on WHICH view that is.
  formView: null,

  header: {
    title: 'short_description',

    // CONTENT-DRIVEN TAGS. Each chip renders only when its own field has a
    // value, so a case shows the tags it has earned and no placeholders. Every
    // chip carries TEXT -- tone is emphasis, never the only signal, which also
    // keeps them legible in forced-colors mode and to a colour-blind reader.
    chips: [
      // Priority leads: it is the clearest triage signal on a case. The chip
      // prints its display value, so "1 - Critical" reads correctly even
      // without the tone.
      {field: 'priority', tone: 'critical'},
      {field: 'state', tone: 'neutral'},
      // Only renders when the case is part of a major-case flow.
      {field: 'major_case_state', tone: 'info', label: 'Major case'},
      // The regulatory flag's ONLY remaining job in the UI: a tag, when set.
      // It decides nothing.
      {field: 'x_snc_pmdemo_regulatory_flag', tone: 'warning'},
      // The .empty convention, the inverse of every other chip here: renders
      // only when the field is EMPTY. An unowned critical case is worth
      // surfacing.
      'assigned_to.empty'
    ]
  },

  // All four are CANDIDATES. buildViewOptions filters by this list before the
  // richness gate is consulted, so omitting 'intelligent' would hide the tab
  // regardless of how much the record had to say. Listing it delegates the
  // decision to the gate, which judges the payload.
  views: ['intelligent', 'details', 'activity', 'related_lists'],

  // The Intelligence grid. Cells whose payload slice is empty are dropped by
  // the page, so a case with no remediation data simply has no remediation
  // card rather than an empty one.
  grid: [
    {id: 'brief', type: 'OttoBrief', span: 12, source: 'otto.brief'},
    {id: 'cause', type: 'RootCauseCard', span: 7, source: 'otto.cause'},
    {id: 'party', type: 'PartyCard', span: 5, source: 'record.party'},
    {id: 'chain', type: 'RecordChain', span: 5, source: 'record.chain'},
    {
      id: 'remed',
      type: 'SplitProgress',
      span: 7,
      source: 'record.remediation',
      // DATA_CONTRACT section 1: SplitProgress renders TaskTable inside its own
      // card rather than as a separate grid cell.
      children: ['TaskTable']
    },
    {id: 'story', type: 'NarrativeSteps', span: 12, source: 'otto.situation'}
  ],

  dock: {type: 'OttoDock', source: 'otto.findings'},

  activity: {
    journal: 'record.activity',
    defaultFilter: 'all',
    groupSystemUpdates: true
  }
};
