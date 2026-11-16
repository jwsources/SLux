# Config Modes — `static configMode`

In addition to `@configProperty` (**simple config** — persists values to the `sys_aix_configuration` table) and `@externalConfig` (**external config** — opens a platform table in a record-list editor), a component can set `static configMode` to defer configuration entirely to the widget author. Config modes do **not** persist data to `sys_aix_configuration` — the component author is responsible for their own storage.

A component can combine both — e.g., use `@configProperty` decorators for some properties while also setting `static configMode = 'inline-simple'` (**custom-url**) to expose a custom config URL.

> **Important:** All `@configProperty` decorator **options** accept static values only — dynamic option values are never supported. This does not constrain the field initializer, which is ordinary field-initializer code and commonly `i18n.getMessage('…')`.

> If a component needs its configuration persisted to the `sys_aix_configuration` table, it must use the `@configProperty` decorator pattern instead of (or in addition to) a config mode.

## `custom-url` — Custom URL Config

Components whose configuration lives in an external platform tool use this mode. The config editor discovers the component, renders a link-icon deep-linking button on its outline, and opens the returned URL in an iframe modal when clicked.

> **Naming note:** `custom-url` is a documentation-only label for this mode — it never appears as a literal in code. `static configMode` stays `'inline-simple'`.

A component can combine `custom-url` with `@configProperty` props — the config editor will show both the deep-linking button and the props pane pencil button.

`provideConfigDeepLinking()` is defined on the `AIUXElement` base class and returns `null` by default. Components that set `static configMode = 'inline-simple'` **override** this method to return a `{label, url}` object (or an array of them for multiple deep-linking buttons). The config editor calls `el.provideConfigDeepLinking()` on each discovered `inline-simple` element and renders a link-icon button for each returned entry.

> **Browser-only — browser APIs are safe here.** The config editor is never
> defined on the server (it bails on `isServer`), and its DOM scan that discovers
> `inline-simple` elements returns early there too. `provideConfigDeepLinking()`
> therefore only ever runs in the browser, so reading `window.location.origin`
> inside it needs **no** `isServer` guard. This is the exception to the usual
> no-unguarded-browser-APIs rule — which still applies to `constructor`,
> `connectedCallback`, and `render`.

```js
import {customElement} from 'lit/decorators.js';
import {i18n} from '@servicenow/aiux-services';
import {AIUXElement} from '@servicenow/aiux-components-core';

@customElement('my-list-config')
export class MyListConfig extends AIUXElement {
  static configMode = 'inline-simple'; // custom-url

  // Override the base class method — return one or more deep-linking entries.
  provideConfigDeepLinking() {
    return {
      label: i18n.getMessage('Configure Incident List'),
      url: `${window.location.origin}/incident_list.do`
    };
  }
}
```

### `provideConfigDeepLinking()` Return Shape

| Return type           | Description                        |
| --------------------- | ---------------------------------- |
| `{label, url}`        | Single deep-linking button           |
| `[{label, url}, ...]` | Multiple deep-linking buttons        |
| `null`                | No deep link (base class default)    |

| Property | Type     | Description                                                             |
| -------- | -------- | ----------------------------------------------------------------------- |
| `label`  | `string` | Button label shown on the outline deep-linking button — wrap in `i18n.getMessage()` for i18n |
| `url`    | `string` | URL loaded in the full-screen iframe modal                              |

The iframe modal is provided by `<aiux-config-editor-iframe-modal>` and emits `external-tool-modal:close` when dismissed.

## `inline-auto` — Self-Contained Config (Self-Config)

The component owns its entire config UI. When config mode opens, the config editor calls `openConfigEditor()` on the element with callbacks for change propagation. When config mode closes (save or cancel), the editor calls `closeConfigEditor()`.

The element is **not** set to `inert` during config mode (unlike `@configProperty` components), so it can render its own editing UI.

```js
import {customElement, state} from 'lit/decorators.js';
import {AIUXElement} from '@servicenow/aiux-components-core';

@customElement('my-self-config-card')
export class MySelfConfigCard extends AIUXElement {
  static configMode = 'inline-auto';
  @state() _editing = false;
  _onChange = null;
  _onSave = null;
  _onClose = null;

  openConfigEditor({fieldValues, onChange, onSave, onClose}) {
    this._onChange = onChange;
    this._onSave = onSave;
    this._onClose = onClose;
    this._editing = true;
  }

  closeConfigEditor() {
    this._editing = false;
    this._onChange = null;
    this._onSave = null;
    this._onClose = null;
  }

  // Call this._onChange(key, value) when user edits a field
  // Call this._onSave() to persist and exit config mode
  // Call this._onClose() to exit config mode without persisting
}
```

### `openConfigEditor()` Parameter Shape

| Property      | Type                                | Description                                                                                        |
| ------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `fieldValues` | `object`                            | Current persisted config values (`aiuxConfigData`) for the component                               |
| `onChange`    | `(key: string, value: any) => void` | Notify the config editor that a field value changed. The editor tracks the change for persistence. |
| `onSave`      | `() => void`                        | Signal the config editor to persist and exit config mode                                           |
| `onClose`     | `() => void`                        | Signal the config editor to exit config mode                                                       |

> **Note:** Unlike `@configProperty` (simple config) components — where the config editor manages dirty state and shows a confirmation modal — `inline-auto` (self-config) and `custom-url` components own their entire editing lifecycle. The component author decides how to handle unsaved changes — e.g., auto-save after every `onChange`, show a custom dirty-state prompt before calling `onClose`, or simply discard.

**`closeConfigEditor()`** — Called by the config editor when config mode exits (via save, cancel, or page navigation). The component should tear down its editing UI and clear callback references.
