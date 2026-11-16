# @servicenow/aiux-context

## Import

```js
import {experienceContext} from '@servicenow/aiux-context';
```


Logical barrel exports for AIUX Lit contexts, including `routeContext` for the current navigation state, `experienceContext`/`experienceContextManager` for app/experience metadata, and `userPreferencesContext` for pre-fetched user preferences.

## Installation

```bash
pnpm add @servicenow/aiux-context
```

## Usage

Import all contexts from a single package:

```javascript
import {
  widgetRenderingContext,
  mobileAppBridgeContext
} from '@servicenow/aiux-context';

// Or use shorter aliases
import {widgetOrigin, mobileAppBridge} from '@servicenow/aiux-context';
```

## Available Exports

| Export                     | Alias             | Description                                             | Source Package                               |
| --------------------------- | ----------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `widgetRenderingContext`    | `widgetOrigin`    | Context for widget rendering origin                        | `@servicenow/aiux-context-widget-origin`     |
| `mobileAppBridgeContext`    | `mobileAppBridge` | Context for mobile app bridge integration                   | `@servicenow/aiux-context-mobile-app-bridge` |
| `routeContext`              | —                 | Reactive context exposing the current navigation state      | `./src/route-context.js` (this package)      |
| `experienceContext`         | —                 | Reactive metadata for the current app/experience             | `./src/experience-context.js` (this package) |
| `experienceContextManager`  | —                 | Imperative API for setting/reading `experienceContext`       | `./src/experience-context.js` (this package) |
| `userPreferencesContext`    | —                 | Reactive context holding pre-fetched user preferences        | `@servicenow/aiux-components-core`           |

## Examples

### Consuming Contexts

```javascript
import {LitElement, html} from 'lit';
import {consume} from '@lit/context';
import {
  widgetRenderingContext,
  mobileAppBridgeContext
} from '@servicenow/aiux-context';

class MyWidget extends LitElement {
  @consume({context: widgetRenderingContext})
  origin;

  @consume({context: mobileAppBridgeContext})
  bridge;

  render() {
    return html`
      <div>
        <p>Rendering in: ${this.origin}</p>
        <p>Platform: ${this.bridge ? 'Mobile App' : 'Web Browser'}</p>
      </div>
    `;
  }
}
```

### With ContextConsumer

```javascript
import {LitElement, html} from 'lit';
import {ContextConsumer} from '@lit/context';
import {widgetRenderingContext} from '@servicenow/aiux-context';

class MyWidget extends LitElement {
  constructor() {
    super();
    new ContextConsumer(this, {
      context: widgetRenderingContext,
      callback: value => {
        this.origin = value;
        this.requestUpdate();
      }
    });
  }

  render() {
    return html`<div>Origin: ${this.origin}</div>`;
  }
}
```

### Conditional Rendering Based on Context

```javascript
import {LitElement, html} from 'lit';
import {consume} from '@lit/context';
import {
  widgetRenderingContext,
  mobileAppBridgeContext
} from '@servicenow/aiux-context';

class AdaptiveWidget extends LitElement {
  @consume({context: widgetRenderingContext})
  origin;

  @consume({context: mobileAppBridgeContext})
  bridge;

  render() {
    const isChatMode = this.origin === 'chat';
    const isMobile = !!this.bridge;

    return html`
      <div
        class="${isChatMode ? 'compact' : 'full'} ${isMobile
          ? 'mobile'
          : 'web'}"
      >
        ${isChatMode ? this.renderCompactView() : this.renderFullView()}
      </div>
    `;
  }

  renderCompactView() {
    return html`<div class="compact">Compact chat view</div>`;
  }

  renderFullView() {
    return html`<div class="full">Full page view</div>`;
  }
}
```

### Providing Context

Use with `ContextProvider` or the `provideOrigin` directive:

```javascript
import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {widgetRenderingContext} from '@servicenow/aiux-context';

class ParentWidget extends LitElement {
  constructor() {
    super();
    new ContextProvider(this, {
      context: widgetRenderingContext,
      initialValue: 'page'
    });
  }

  render() {
    return html`<child-widget></child-widget>`;
  }
}
```

Or use the `provideOrigin` directive:

```javascript
import {html} from 'lit';
import {provideOrigin} from '@servicenow/aiux-directives';

html`
  <div ${provideOrigin('chat')}>
    <child-widget></child-widget>
  </div>
`;
```

## Context Values

### widgetRenderingContext (alias: widgetOrigin)

Tracks where a widget is rendered:

- `'page'` - Widget is rendered in a page context
- `'chat'` - Widget is rendered in a chat/conversation context

### mobileAppBridgeContext (alias: mobileAppBridge)

Provides access to mobile app bridge functionality:

- `undefined` - Running in web browser
- `object` - Running in mobile app (provides native capabilities)

### routeContext

Exposes the current navigation state (`{path, matched, ...}`) as set by the app's router (`AIUXAppLayoutElement._initRouter` in `@servicenow/aiux-components-core`). Before the router initializes — very early module load, or on the server prior to routing — `get()` returns a frozen `{matched: false}` default rather than throwing.

```javascript
class MyWidget extends AIUXElement {
  static contexts = [routeContext];
  render() {
    const route = routeContext.get();
    return html`<div>${route.path}</div>`;
  }
}
```

### experienceContext / experienceContextManager

`experienceContext` holds a frozen snapshot of the current app/experience metadata (`sysId`, `name`, `title`, `theme`, `properties`, `isLoaded`, etc.). Initially only `name` is populated (derived from the URL); the rest stay `null` and `isLoaded: false` until a layout loader calls `experienceContextManager.setExperienceConfig(config)` — Karuna does not auto-fetch this metadata the way aiux-kit does.

```javascript
class MyWidget extends AIUXElement {
  static contexts = [experienceContext];
  render() {
    const experience = experienceContext.get();
    return html`<div>${experience.title ?? experience.name}</div>`;
  }
}

// From a layout loader, once the metadata is available:
experienceContextManager.setExperienceConfig({sysId, title, theme});
```

`experienceContextManager` also exposes `get(key)`, `subscribe(callback)` (fires immediately with the current value, then on every update), and getters for `sysId`/`name`/`isLoaded`.

### userPreferencesContext

Re-exported from `@servicenow/aiux-components-core`. Holds all pre-fetched user preferences as a flat `Record<string, string>`, seeded at request time from build-time-extracted `getUserPreference()` call sites. Components that declare `static contexts = [userPreferencesContext]` re-render automatically when a preference changes.

```javascript
import {LitElement, html} from 'lit';
import {userPreferencesContext} from '@servicenow/aiux-components-core';

class MyWidget extends LitElement {
  static contexts = [userPreferencesContext];

  render() {
    const prefs = userPreferencesContext.get();
    return html`<div>${prefs['glide.ui.accessibility.voice_input']}</div>`;
  }
}
```

## Benefits

- **Single dependency**: Install one package instead of two separate context packages
- **Convenience**: Import multiple contexts from one location
- **Tree-shaking**: Only imports what you use
- **Discoverability**: Easy to find all available contexts
- **Type safety**: Works with TypeScript decorators

## Individual Packages

If you prefer granular dependencies, you can still install individual packages:

- `@servicenow/aiux-context-widget-origin`
- `@servicenow/aiux-context-mobile-app-bridge`

## Related Packages

- `@servicenow/aiux-directives` - Logical exports for AIUX directives
- `@servicenow/aiux-directive-provider-origin` - Directive for providing widget origin context

## SSR Compatibility

✅ All contexts are SSR-safe and work in both server-side and client-side rendering environments.

## License

See the main repository LICENSE file.
