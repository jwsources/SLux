// THE PM Regulatory Report layout config -- one per table, no condition.
//
// This record is a REPORT, not a form. It carries a 26,952-character html
// field, report_document, labelled "Regulatory Report" in the dictionary --
// the generated MDR document. Rendered through the catch-all's label/value
// grid it came out as a field value, and before the html branch existed in
// record-fields it came out as escaped markup.
//
// So this table gets its own route and page, the same way the case does. The
// page composes: identity and status, the impact metrics as figures, the
// assessment prose, then the document itself.
//
// FIELD NAMES AND TYPES MEASURED, not assumed:
//   report_document            html      "Regulatory Report"   26,952 chars
//   event_summary              string    2,092 chars
//   patient_impact             string    1,139 chars
//   regulatory_justification   string    1,261 chars
//   probable_cause             string
//   regulatory_framework       string    "MDR / FDA 21 CFR 803"
//   firmware_version           string    "Alectri ... Firmware 3.8.0"
//   affected_device_count      integer   14
//   remote_eligible_count      integer   11
//   dispatch_required_count    integer   3
//   affected_account_count     integer   3
//   fleet_total_count          integer   25
//   report_status              choice    "approved"
//   source_case                reference -> the originating case
//   event_date                 glide_date_time

export default {
  id: 'x_snc_pmdemo_reg_report',
  table: 'x_snc_pmdemo_reg_report',

  // Unconditional: every report of this type renders this way.
  condition: null,
  active: true,

  // ITS OWN ROUTE. recordHref sends every link to this table here rather than
  // to the catch-all, and the catch-all's hand-off redirects anyone who
  // arrives at /record/x_snc_pmdemo_reg_report/<id> to this page.
  route: 'reg',

  header: {
    title: 'short_description',
    chips: [
      // The approval state is the first thing a reader needs. Measured values:
      // draft, submitted, approved, rejected -- so the chip prints the choice
      // label, and the tone is emphasis on top of text that already says it.
      {field: 'report_status', tone: 'info'},
      {field: 'regulatory_framework', tone: 'neutral'}
    ]
  },

  // No view switch on this page -- a report is one thing to read, not four
  // views to choose between. The page renders its own composition.
  views: [],

  // THE FIGURES, shown as stat tiles rather than label/value rows. Each is a
  // typed integer on the record, so there is nothing to compute.
  metrics: [
    {field: 'affected_device_count', label: 'Devices affected'},
    {field: 'remote_eligible_count', label: 'Remote eligible'},
    {field: 'dispatch_required_count', label: 'Dispatch required'},
    {field: 'affected_account_count', label: 'Accounts affected'},
    {field: 'fleet_total_count', label: 'Fleet total'}
  ],

  // THE DOCUMENT. Named here so the page needs no field name of its own.
  document: {field: 'report_document', label: 'Regulatory report'},

  details: {
    groups: [
      {
        id: 'identity',
        label: 'Report',
        fields: [
          'number',
          'report_status',
          'state',
          'regulatory_framework',
          'event_date',
          'source_case',
          'firmware_version',
          {field: 'probable_cause', wide: true}
        ]
      },
      {
        id: 'assessment',
        label: 'Assessment',
        fields: [
          {field: 'event_summary', wide: true},
          {field: 'patient_impact', wide: true},
          {field: 'regulatory_justification', wide: true},
          {field: 'rejection_reason', wide: true}
        ]
      }
    ]
  }
};
