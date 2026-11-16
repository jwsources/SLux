# Adding Extensions to an Existing App

Use this reference when the user's intent is to **overlay pages onto a host application** rather than add a page to the current standalone app. Extensions live in `src/extensions/` and do not modify host application code. This reference is self-contained — no companion skill needs to be invoked for extension work.

## When This Applies

- User says "add an extension page", "extend `<host app>`", "overlay a page on `<host>`", "create an extension for `<host-scope>`"
- The target route belongs to a **different, existing host experience** — not a page under this app's own `pages/` directory
- Distinguish from a normal BUILD-mode page: a normal page lives at `pages/<route>/page.js` in *this* app; an extension page lives at `src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js` (or `src/extensions/<experience-sys_id>/pages/<route>/page.js`) and targets a *host* app.

## Scaffolding Options

**Option A — Scaffold a new extension project from scratch:**

```bash
npx @servicenow/sdk@latest init --template javascript.aiux-extension
```

This scaffolds a complete extension project with `src/extensions/`, `application.js`, a hello-world page, and `now.config.json` pre-configured.

**Option B — Add extensions to an existing AIUX application:**

If you already have a working AIUX app and want it to extend another host experience, no re-scaffold is needed. Just:

1. Create the `src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js` directory structure
2. Optionally add a per-host lifecycle module at `src/extensions/<host-scope>/<host-basename>/application.js` for nav contributions
3. Build and deploy as normal — `pnpm build && pnpm run deploy`

The build auto-discovers `src/extensions/` pages and emits the host-targeting records alongside your app's own pages. **Caution:** combining your own `pages/` with `src/extensions/` pages in the same project is unsafe — see the extensibility doc's Known Limitations.

## Path Conventions

Two equivalent formats — both are discovered identically. A single project can mix conventions across hosts.

**Convention 1 (scope + basename — familiar):**

```
src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js
src/extensions/sn_app_aict_ui/aict/pages/home/page.js
```

**Convention 2 (direct sys_id — explicit):**

```
src/extensions/<experience-sys_id>/pages/<route>/page.js
src/extensions/2f86ed94fdab96a806bbbb5b8573c5d5/pages/home/page.js
```

**Key:** extension pages use `page.js` (not `index.js`). The route is derived from the directory path, not the filename.

If the host scope/basename/sys_id is unknown and cannot be inferred from the workspace (e.g. an existing `src/extensions/` sibling), ask the user before scaffolding.

## Key Concepts

- **Pages = Lit web components** extending `AIUXElement`
- **Loaders = SSR data fetching** via `static async loader(ctx)`
- **Layouts = nested inheritance** with per-level most-specific-wins precedence
- **Extensions = overlay pages** on host applications without modifying host code
- **Host-level chrome** (nav items, etc.) is contributed via `application.js` exporting `setup(ctx)` — `extension.js` is not read by the build

## Extension Page Template

```js
import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {
  AIUXElement,
  decorators,
  getLogger
} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';

const {roles} = decorators;
const log = getLogger('{{TAG_NAME}}');

// Save to: src/extensions/<host-scope>/<host-basename>/pages/<route>/page.js

@customElement('x-scope-page-name') // Replace 'x-scope' with your scope prefix
// @roles(['admin', 'user'])  // Uncomment to restrict access to roles
export default class MyPage extends AIUXElement {
  static styles = css`
    :host { display: block; height: 100%; }
  `;

  constructor() {
    super();
    this._loading = false;
    this._error = null;
  }

  /**
   * Runs on the server during initial render and on the client during
   * navigation. Returned object is embedded as __LOADER_DATA__ and
   * exposed as this.loaderData in render().
   */
  static async loader(ctx) {
    try {
      return {pageTitle: i18n.getMessage('{{PAGE_TITLE}}')};
    } catch (err) {
      log.error({error: err.message}, '{{CLASS_NAME}} loader error');
      throw err;
    }
  }

  render() {
    if (!this.loaderData) {
      return html`<p>${i18n.getMessage('Loading')}</p>`;
    }
    if (this.loaderData.error) {
      return html`<p>${this.loaderData.error}</p>`;
    }
    return html`<h1>${this.loaderData.pageTitle}</h1>`;
  }
}
```

Never use browser APIs (`window`, `document`, `localStorage`) inside `render()` or `loader()` — both run during SSR. Guard with `isServer` per `references/foundation/ssr-safety.md`.

## Loader Module Pattern (optional separate file)

```js
// Location: src/extensions/<host>/pages/<route>/loaders/data.js
import {getHeaders, getLogger} from '@servicenow/aiux/aiux-components-core';

const log = getLogger('fetchPageData');

export async function fetchPageData(ctx) {
  try {
    const url = new URL(`${ctx.protocol}://${ctx.hostname}/api/v2/your-endpoint`);
    if (ctx.params.id) url.searchParams.set('id', ctx.params.id);

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders(ctx),
      credentials: 'include'
    });
    if (!resp.ok) throw new Error(`Failed to fetch data: ${resp.status} ${resp.statusText}`);
    return await resp.json();
  } catch (err) {
    log.error({error: err.message}, 'fetchPageData error');
    throw err;
  }
}
```

Import it in the page: `static async loader(ctx) { return {pageTitle: '...', data: await fetchPageData(ctx)}; }`

## Layout Override Pattern

Nested layout precedence (highest to lowest):

1. Extension layout at this level
2. Extension layout at parent level (inherited)
3. Host layout at this level
4. Host layout at parent level (inherited)
5. Default layout from core-ui

If no `layout.js` is defined at a level, the extension inherits the host's layout at that level automatically.

```js
// Location: src/extensions/<extension>/pages/<route>/layout.js
import {html} from 'lit';
import {NavLayout} from '@servicenow/aiux/aiux-components-nav';

export default class MyLayoutOverride extends NavLayout {
  render() {
    // Option 1: use host layout as-is — return super.render();
    // Option 2: wrap/customize while keeping structure
    return html`<div class="extension-layout">${super.render()}</div>`;
    // Option 3: fully custom layout — must still render <slot> for the child page
  }

  // Override specific regions instead of the whole layout:
  // _renderSidebar() / _renderToolbar() / _renderHeader() / _renderContent()
}
```

**Example:** host defines `layout.js` at `measure/` (L2) and `measure/value/` (L3). Extension defines `layout.js` only at `measure/` (L2). At `/measure/value`: extension L2 layout applies (most-specific), host L3 layout is inherited (no extension override at that level).

## Continue in This Skill

After scaffolding the extension page/loader/layout, run through the normal pipeline for anything the templates above don't cover:

- **Styling** — `references/design/daisyui-patterns.md`, `references/design/css-custom-properties.md`
- **Accessibility** — invoke `accessibility` companion skill (required — extension pages render real UI and must comply with WCAG 2.2 AA)
- **i18n** — invoke `internationalization` companion skill (required — all page/loader strings must use `i18n.getMessage()`, never hardcoded English)
- **UI discovery** — invoke `ui-discovery` before writing any custom UI inside the extension page

## Key Differences From Standalone Pages

| Aspect | Standalone page (this app) | Extension page |
| --- | --- | --- |
| Location | `pages/<route>/page.js` | `src/extensions/<host>/pages/<route>/page.js` |
| Filename | `page.js` | `page.js` (route from directory path, not filename) |
| Layout | `pages/layout.js` or `application.js` | Nested layout override, most-specific-wins |
| Modifies host code | N/A | Never — overlay only |
| Nav wiring | `application.js` setup() / `pages/layout.js` loader | Host-level chrome via `application.js` `setup(ctx)` |
