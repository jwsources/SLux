// PER-HOST lifecycle module for the Sales Portal host experience.
//
// Its location is the binding: this file sits at
// extensions/sn_ex_emp_hub_mw/salesportal/ — the host's scope and its
// url_suffix — as a sibling of that host's pages/ directory, not inside it.
// On build the AIUX SDK discovers it, compiles it into a lifecycle widget and
// emits a sys_aix_experience_extension row bound to the Sales Portal
// experience.
//
// No nav item is contributed. The case page is keyed by a record sys_id, so a
// fixed sidebar entry pointing at it would resolve to no record. It is reached
// by deep link, from a list, or from chat. Nav helpers key purely on path
// string with no ownership tracking, so adding one here would also risk
// silently overwriting a host path.
//
// To contribute chrome later, import the helpers from
// '@servicenow/aiux/aiux-components-nav' (addNavItem, removeNavItem, setL3Nav,
// appendL3Nav) and call them from setup().

export default {
  // Runs server-side during SSR after the host's own setup(), and again on the
  // client only as a CSR fallback.
  setup(_ctx) {},

  // Client-only, on each in-app navigation, after the host's navigate().
  // An extension cannot return a redirect — only the host can.
  navigate(_navCtx, _ctx) {},

  // Client-only, after the host's teardown() on app exit.
  teardown(_ctx) {}
};
