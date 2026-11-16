import {html, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';

// Boilerplate "hello world" page — a starting point for this extension's
// pages. The directory name (`hello-world`) is the route segment: this page
// overlays onto the host experience at /aiux/<host_route_id>/hello-world.
// Rename the directory to change the route, or copy this directory to add
// another page.
//
// This page (and any other pages under this
// <srcDir>/extensions/<host_project_id>/<host_route_id>/pages/ tree) renders directly
// inside the host experience's own nav-layout chrome. To wrap this extension's
// pages in your own section chrome, add a `layout.js` alongside them.
@customElement('x-snc-slux-hello-world-page')
export default class HelloWorldPage extends AIUXElement {
  firstUpdated() {
    // Guard browser globals with `isServer` — this hook runs on both the
    // server (SSR) and the client (CSR).
    if (!isServer) {
      document.title = i18n.getMessage('Hello World');
    }
  }

  render() {
    return html`
      <section
        class="flex flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <h1 class="text-3xl font-bold text-text-primary">
          ${i18n.getMessage('Hello, world!')}
        </h1>
        <p class="text-sm text-text-secondary">
          ${i18n.getMessage(
            'This page was scaffolded by the AIUX extension template. Edit src/lux/extensions/<host_project_id>/<host_route_id>/pages/hello-world/page.js to build on it.'
          )}
        </p>
      </section>
    `;
  }
}
