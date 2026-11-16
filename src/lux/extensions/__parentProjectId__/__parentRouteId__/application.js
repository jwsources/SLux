// This is a PER-HOST lifecycle module. Its location is what binds it: sitting
// at <srcDir>/extensions/<host_project_id>/<host_route_id>/ — as a sibling of that host's
// pages/ directory, not inside it — targets exactly that host. On `now-sdk
// build` the AIUX SDK discovers it, compiles it into a lifecycle widget, and
// emits a sys_aix_experience_extension row bound to that host experience.
//
// Two things this buys you over a root-level application.js:
//
//   1. It is built on its own. A root application.js is only compiled when the
//      app has pages under <srcDir>/extensions/ — delete the hello-world page and it
//      silently stops being built. This module does not have that coupling, so
//      you can contribute nav without contributing a page.
//   2. It targets one named host. To extend a SECOND host, add another module
//      at that host's directory with its own setup() — a root application.js
//      binds to only one host and cannot express per-host logic.
//
// The equivalent convention-2 path, when you target a host by experience sys_id
// rather than project id + route id, is:
//
//   <srcDir>/extensions/<experience_sys_id>/application.js
//
// When a host has a per-host module, a root application.js is NOT additionally
// registered against that host, so the two never double-run.
//
// At runtime the host's isolate runs this setup() AFTER the host's own setup(),
// so the nav helpers below layer additional chrome on top of what the host
// already configured (features, logo, items, …) without clobbering it. Unlike a
// standalone app's application.js, an extension does NOT own navLayoutContext.
//
// The nav helpers read and write navLayoutContext directly and are SSR-safe
// (no window guard needed), so calling them from setup() is supported. Only
// addNavItem is imported below — add removeNavItem, setL3Nav, appendL3Nav, or
// prependL3Nav to the same import when you uncomment those examples.

import {addNavItem} from '@servicenow/aiux/aiux-components-nav';
import {i18n} from '@servicenow/aiux/aiux-services';

export default {
  // Called once per SSR request before loaders run, and again on the client
  // only as a CSR fallback (when the page was not server-rendered). Contribute
  // host-level chrome (nav items, L3 tabs) here so it persists across
  // navigation.
  //
  // Caution: addNavItem/removeNavItem/setL3Nav/appendL3Nav mutate a nav layout
  // shared with the host and any other extensions, keyed only by path string.
  // Colliding with a path the host or another extension already uses will result
  // in modification or removal — there is no ownership distinction, so setL3Nav
  // can replace any item's tabs (host, extension, or page-owned) by path.
  setup(_ctx) {
    // L1 — a sidebar item for the scaffolded ./pages/hello-world/page.js
    // sitting next to this file. Rename or remove this alongside that page.
    addNavItem({
      icon: 'document',
      title: i18n.getMessage('Hello World'),
      action: {type: 'navigate', path: '/hello-world'}
    });

    // L1 — remove a host item you want to hide:
    //
    // removeNavItem('/about');
    //
    // L3 — set (replace) tabs on any item by path (works for L1 and L2, smart
    // lookup handles items by action.path, activePath, or across L2s):
    //
    // setL3Nav('/hello-world', [
    //   {label: 'Overview', path: '/hello-world/overview'},
    //   {label: 'Details', path: '/hello-world/details'}
    // ]);
    //
    // L3 — replace a host item's tabs entirely (works the same as any other
    // item — setL3Nav has no ownership check):
    //
    // setL3Nav('/settings/integrations', [
    //   {label: 'Connectors', path: '/settings/integrations/connectors'},
    //   {label: 'Traces', path: '/settings/integrations/traces'}
    // ]);
    //
    // L3 — append tabs to an item without replacing the ones already there:
    //
    // appendL3Nav('/dashboard', [
    //   {label: 'Custom Analytics', path: '/dashboard/custom'},
    //   {label: 'Reports', path: '/dashboard/reports'}
    // ]);
  },

  // Client-only. Runs on each in-app (CSR) navigation, after the host's own
  // navigate(). Receives (navCtx, ctx) where navCtx is
  // {to, from, toAppPath, fromAppPath}. Unlike the host, an extension cannot
  // return a redirect here — use it for per-route state such as marking an
  // active nav item.
  navigate(_navCtx, _ctx) {},

  // Client-only. Runs after the host's teardown() when the app exits. Revert
  // anything setup() added that should not outlive this app.
  teardown(_ctx) {}
};
