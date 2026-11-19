import {recordHref} from './record-href.js';

// LEGACY RECORD URLS IN GENERATED HTML, REWRITTEN TO PORTAL ROUTES.
//
// The AI-generated content on this data was written with links to other UIs.
// Both shapes are measured in real stored values -- in case work notes and in
// the regulatory report's report_document field:
//
//   /now/cwf/agent/record/sn_customerservice_case/<id>/sub/record/customer_account/<id>
//   /change_request.do?sys_id=<id>
//
// The first is a Configurable Workspace URL, the second a classic form URL.
// Neither renders in this portal, and the platform sanitiser rewrites every
// anchor to target="_blank" with rel="noopener noreferrer" -- so following one
// opened a different UI in a new tab.
//
// WHY THIS IS ITS OWN MODULE. The activity note bodies needed it first and it
// lived in activity-view.js. The report document needs exactly the same
// transform, and a second copy would be two implementations of one contract
// that drift on the next URL shape anyone adds.
//
// THE SUB-RECORD PAIR WINS when a cwf URL carries one: the trailing
// /sub/record/<table>/<id> is the record the link targets, while the leading
// pair is only the workspace context it was authored in. Taking the leading
// pair would send every such link back to the record being read.
//
// A sys_id is matched as EXACTLY 32 hex characters so an unrelated href cannot
// be mangled, and recordHref returning null leaves the original untouched.

const CWF_RECORD_URL =
  /\/now\/cwf\/agent\/record\/([a-z0-9_]+)\/([0-9a-f]{32})(?:\/sub\/record\/([a-z0-9_]+)\/([0-9a-f]{32}))?/gi;

const CLASSIC_RECORD_URL =
  /\/([a-z0-9_]+)\.do\?(?:[^"'\s]*&(?:amp;)?)?sys_id=([0-9a-f]{32})[^"'\s]*/gi;

export function portaliseLinks(html) {
  if (!html) return '';
  return String(html)
    .replace(CWF_RECORD_URL, (match, table1, id1, table2, id2) => {
      const href = recordHref(table2 || table1, id2 || id1);
      return href || match;
    })
    .replace(CLASSIC_RECORD_URL, (match, table, sysId) => {
      const href = recordHref(table, sysId);
      return href || match;
    });
}

// A click on an anchor inside sanitised HTML, routed client-side.
//
// Rewriting the href is not enough on its own. The platform sanitiser gives
// every anchor target="_blank", and the host router's own click handler skips
// an anchor whose target is _blank -- so even a correct portal href would open
// a new tab and reload the whole experience.
//
// event.composedPath() is what makes this work: a click is composed, so it
// crosses the sanitising component's shadow boundary and the anchor is
// reachable from outside it.
//
// pushState records the entry, because this is a FORWARD navigation and Back
// must return to the document being read; the dispatched popstate makes the
// router's handlePopstate resolve the route with pushState false, so the
// router adds nothing of its own.
//
// Only this portal's own routes are intercepted. Anything else keeps the new
// tab the sanitiser gave it.
export function interceptPortalLinkClick(event, basePath) {
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : [];
  const anchor = path.find(
    node =>
      node && node.tagName === 'A' && typeof node.getAttribute === 'function'
  );
  if (!anchor) return;

  const href = anchor.getAttribute('href') || '';
  if (!basePath || !href.startsWith(`${basePath}/`)) return;

  event.preventDefault();
  window.history.pushState(null, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
