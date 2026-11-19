// THE Customer Account layout config -- one per table, no condition.
//
// Field names and values measured on the NewYork-Presbyterian row before
// being written here, including the scoped PMDemo columns:
//   x_snc_philips_e2_0_health   'Red'
//   x_snc_philips_e2_0_kam      'Daniel Ortiz'
//   x_snc_philips_e2_0_region   'Northeast'
//   active_escalation           'ESC0001001' -> sn_customerservice_escalation
//   revenue_per_year            '$10,700,000,000.00'
//   num_employees               '20,000'
//   account_path                '!!!#6003'
//
// The account is the PARENT of four NYP campus accounts, so the hierarchy is
// carried by the parent field rather than by the account_path string.

const ACCOUNT = 'customer_account';

export default {
  id: ACCOUNT,
  table: ACCOUNT,

  // Unconditional: every account renders this way.
  condition: null,
  active: true,

  // ITS OWN ROUTE, so recordHref sends an account link to this page rather
  // than to the catch-all, and the catch-all hands off anyone who arrives at
  // /record/customer_account/<id>.
  route: 'account',

  // THE VIEWS THIS TABLE OFFERS. Without this key buildViewOptions falls back
  // to all four, which is how an Activity tab appeared on an account --
  // customer_account has no journal field, so that view could only ever render
  // an empty stream.
  //
  // 'intelligent' is listed because buildViewOptions filters by this list
  // BEFORE the gate is consulted, so omitting it would hide the 360 however
  // emphatically the page mandates it.
  views: ['intelligent', 'details', 'related_lists'],

  header: {
    title: 'name',
    chips: [
      // NO label ON THE HEALTH CHIP. _chipsFrom uses
      //   label: spec.label ? spec.label : text
      // so supplying a label REPLACES the value -- the chip rendered the word
      // "Health" and never the measured value "Red". The value is the signal,
      // so the chip prints it and the tone carries the emphasis, exactly as
      // the case page's priority chip does.
      {field: 'x_snc_philips_e2_0_health', tone: 'critical'},
      {field: 'x_snc_philips_e2_0_region', tone: 'neutral'},
      // Here the label IS wanted: the escalation number alone would not say
      // what it is, and the 360 panel below links the record.
      {
        field: 'active_escalation',
        tone: 'critical',
        label: 'Escalation open'
      }
    ]
  },

  // NO metrics LIST HERE, deliberately. The 360's KPI tiles are mostly ROW
  // COUNTS -- installed products, open cases, contracts -- and a count is not
  // a field, so a config list of field names cannot express them. The 360
  // selects its own four and the visual language caps it there. A metrics
  // array declared here would be read by nothing, which is the same defect as
  // a selector nothing renders.

  details: {
    groups: [
      {
        id: 'identity',
        label: 'Account',
        fields: [
          'number',
          'name',
          {field: 'x_snc_philips_e2_0_health', label: 'Health'},
          {field: 'x_snc_philips_e2_0_region', label: 'Region'},
          {field: 'x_snc_philips_e2_0_kam', label: 'Key account manager'},
          'primary_contact',
          'parent',
          {field: 'active_escalation', label: 'Active escalation'},
          {field: 'notes', wide: true}
        ]
      },
      {
        id: 'commercial',
        label: 'Commercial',
        fields: ['revenue_per_year', 'num_employees', 'customer', 'active']
      },
      {
        id: 'location',
        label: 'Location and contact',
        fields: ['street', 'city', 'state', 'zip', 'country', 'phone', 'website']
      }
    ]
  }
};

// HEALTH TONE, resolved from the value.
//
// The field is a string, measured 'Red' on this account. Mapping it to a tone
// here rather than in the component keeps the colour decision with the data
// that defines it -- a different instance could use different words, and this
// is the one file allowed to know them.
//
// An unrecognised value yields neutral rather than a guess, so a new health
// word renders legibly instead of being silently coloured wrong.
export function healthTone(value) {
  switch (String(value || '').trim().toLowerCase()) {
    case 'red':
      return 'critical';
    case 'amber':
    case 'orange':
    case 'yellow':
      return 'warning';
    case 'green':
      return 'success';
    default:
      return 'neutral';
  }
}
