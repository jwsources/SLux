import {isServer} from 'lit';

import {routeForTable} from './configs/index.js';

// The generic record page's route. It is a FRAMEWORK route rather than a
// table's route, so it is not in configs/: no table owns it, and every table
// without its own page falls back to it.
const GENERIC_RECORD_ROUTE = 'record';

// THE ONE PLACE A RECORD LINK URL IS BUILT.
//
// WHY THIS EXISTS -- the structural fault it replaces.
//
// Every link in this framework used to navigate PROGRAMMATICALLY: a button
// whose click handler called the exported navigate(), or window.location
// .assign() directly. Read from aiux/client/src/router.js:
//
//     export function navigate(path, options) {
//       if (globalRouter) {
//         return globalRouter.navigate(path, options);
//       }
//       return browserNavigate(path);
//     }
//
// and browserNavigate with no globalRouter "falls back to a plain
// window.location.href assignment". This host calls createRouter() but never
// setGlobalRouter(), so globalRouter is NULL -- which made EVERY link a full
// page load. That single fact produced four separate reported symptoms:
//
//   - the URL lost the experience basename, landing on a platform 404;
//   - a .do path left the portal entirely;
//   - the page "kept re-rendering and finally showed something" -- that is a
//     full SSR round trip plus rehydration on every click;
//   - links showed stale data -- the unhydrated SSR shell of the new page.
//
// THE FIX IS TO STOP NAVIGATING PROGRAMMATICALLY. The host router binds a
// document-level click handler that intercepts ANCHORS: it reads the href,
// strips its own basePath, and performs a client-side navigation. That handler
// is the only reachable path to the host's router instance, because the
// instance itself is private to the layout and is not registered globally.
// So a link must be a real anchor with a real href.
//
// Verified in the rendered DOM: the host's own nav items are plain anchors
// with full paths such as /aiux/salesportal/home, and they navigate without a
// page load.
//
// Anchors are also simply correct: middle-click, ctrl-click, "open in new
// tab", "copy link" and the browser's own history all work on an anchor and
// none of them work on a button.

// THE EXPERIENCE BASENAME.
//
// Taken as the FIRST TWO segments of the current path. An AIUX experience is
// mounted at /aiux/<url_suffix>, verified against the host's own nav anchors
// in the rendered DOM: /aiux/salesportal/home, /aiux/salesportal/inbox,
// /aiux/salesportal/orgchart.
//
// WHY NOT COUNT FROM THE END. This stripped the LAST TWO segments, which is
// right for a two-segment route such as case/<id> but WRONG for the
// three-segment catch-all record/<table>/<id>: it left /record inside the
// basename, so every link built from it came out as
// /aiux/salesportal/record/record/<table>/<id> and 404'd. Route depth varies,
// so the end of the path cannot locate the mount point. The start can.
//
// Returns '' when it cannot be determined -- during SSR, where there is no
// window -- NOT null. That distinction caused a render loop: returning null
// made callers render plain TEXT on the server and an ANCHOR on the client, and
// a differing ELEMENT STRUCTURE between the two passes is a hydration mismatch,
// so Lit tore the DOM down and re-rendered. A differing ATTRIBUTE is harmless;
// a differing TAG is not. So the structure is identical in both passes now.
export function experienceBasePath() {
  if (isServer || typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  return `/${parts[0]}/${parts[1]}`;
}

/**
 * The href for a record. Null only when there is genuinely nothing to link to
 * -- no table, or no sys_id.
 *
 * EVERY RECORD IS REACHABLE. A table with its own configured route gets that
 * route; everything else gets the generic record page. An earlier version
 * returned null for an unrouted table so the value rendered as plain text --
 * which meant a dispatch task, a work order, a change or the regulatory report
 * could be READ but never OPENED. That is a worse regression than the broken
 * .do link it replaced.
 *
 * The table is never compared against a literal here: routeForTable owns the
 * table-to-route map, so this file names no table and neither does any
 * component that calls it.
 */
export function recordHref(table, sysId) {
  if (!table || !sysId) return null;

  const basePath = experienceBasePath();
  const route = routeForTable(table);

  // A table with its own page -- the richer, purpose-built one.
  if (route) {
    return `${basePath}/${route}/${encodeURIComponent(sysId)}`;
  }

  // Everything else: the PLATFORM'S OWN catch-all route shape,
  // record/<table>/<sys_id>. In aiux/client/src/route-map-navigation.js the
  // no-rule branch builds a fallback path of record, then the table name, then
  // the sys_id, and navigates to it -- its own comment reads
  // ".do fallback -> record/:table/:sys_id".
  //
  // The router rewrites every intercepted .do link to exactly that, so
  // emitting it directly means a link and a rewritten .do link land on the
  // same page. Before the page at that route existed, the rewrite pointed at
  // nothing -- which is why clicks were swallowed.
  return `${basePath}/${GENERIC_RECORD_ROUTE}/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}`;
}
