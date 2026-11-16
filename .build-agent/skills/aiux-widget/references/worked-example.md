# Worked example — a complete `sys_aix_widget` from Fluent

Loaded on demand by the `aiux-widget` skill.

## Why it is shaped this way

Every `data` value is a **plain literal**. The build does not evaluate expressions
in `data` — it stringifies the AST node, so a variable, a function call, a
`.join()` or a `+` concatenation installs the literal text
`Symbol(CallExpressionShape)` into the column with a clean build and no warning.

`component` is **one double-quoted string literal with `\n` escapes**. Inside a
double-quoted literal, backticks and `${` need no escaping — they are only special
inside a template literal. So the embedded Lit source keeps its backtick templates
and its `${}` interpolation verbatim, and stays on single quotes throughout.

`importBoundaries` arithmetic for this file: the three import lines measure
32 + 1 + 69 + 1 + 49 = **152** characters, so `[0, 152]`. **Always confirm by
substring** rather than trusting the count — `component.substring(0, 152)` must
begin `import`, end `;`, and no `import` may appear after 152.

```typescript
import '@servicenow/sdk/global'
import { Record } from '@servicenow/sdk/core'

export const helloWidget = Record({
  $id: Now.ID['hello_widget'],
  table: 'sys_aix_widget',
  data: {
    name: 'Hello Widget',
    id: 'hello-widget',
    type: 'aix_widget',
    purpose: 'component',
    category: 'custom',
    servicenow: 'false',
    chat_compatible: 'false',
    interactive_view_compatible: 'false',
    simple_widget: 'false',
    has_loader: 'false',
    description:
      'Shows a personalized greeting for the current user. Choose it when a page needs a friendly opening line rather than data.',
    best_for:
      'Greeting users by name with a personalized hello message. Ideal for home pages or welcome screens where a friendly first impression is needed.',
    component:
      "import { html, css } from 'lit';\nimport { AIUXWidgetElement } from '@servicenow/aiux-components-core';\nimport { i18n } from '@servicenow/aiux-services';\n\nclass HelloWidget extends AIUXWidgetElement {\n\n  static properties = {\n    userName: { type: String, attribute: 'user-name' },\n    greeting: { type: String, state: true },\n    loading: { type: Boolean, state: true },\n    error: { type: String, state: true }\n  };\n\n  static styles = css`\n    :host { display: block; }\n\n    .hello {\n      box-sizing: border-box;\n      padding: calc(var(--spacing, 0.25rem) * 4);\n      border-radius: var(--radius-lg, 0.5rem);\n      color: var(--color-text-primary, #0F172A);\n      background: var(--color-background-primary, #FFFFFF);\n      font-size: var(--text-base, 16px);\n    }\n\n    .muted {\n      color: var(--color-text-secondary, #475569);\n      font-size: var(--text-sm, 14px);\n    }\n\n    @media (max-width: 480px) {\n      .hello { padding: calc(var(--spacing, 0.25rem) * 2); }\n    }\n  `;\n\n  constructor() {\n    super();\n    this.userName = '';\n    this.greeting = '';\n    this.loading = true;\n    this.error = '';\n    this.MSG = {\n      hello: i18n.getMessage('Hello'),\n      loading: i18n.getMessage('Loading'),\n      failed: i18n.getMessage('Could not load the greeting.'),\n      empty: i18n.getMessage('No greeting available.')\n    };\n  }\n\n  onDataChange(newData) {\n    this.loading = false;\n    if (!newData) { this.error = this.MSG.failed; return; }\n    if (newData.error) { this.error = newData.error; return; }\n    this.greeting = newData.greeting || '';\n  }\n\n  render() {\n    if (this.loading) {\n      return html`<div class='hello muted' role='status'>${this.MSG.loading}</div>`;\n    }\n    if (this.error) {\n      return html`<div class='hello muted' role='alert'>${this.error}</div>`;\n    }\n    if (!this.greeting) {\n      return html`<div class='hello muted'>${this.MSG.empty}</div>`;\n    }\n    return html`<div class='hello'>${this.MSG.hello}, ${this.greeting}!</div>`;\n  }\n}\n",
    script:
      "(function (data, options, input) {\n  if (!input || !input.action) return;\n  switch (input.action) {\n    case 'getGreeting':\n      data.greeting = (input.name || '').trim() || gs.getUserDisplayName();\n      break;\n    default:\n      data.error = 'Invalid action';\n  }\n})(data, options, input);",
    component_compile_metadata:
      '{"imports":{"lit":["html","css"],"@servicenow/aiux-components-core":["AIUXWidgetElement"],"@servicenow/aiux-services":["i18n"]},"elementClassName":"HelloWidget","importBoundaries":[0,152],"hasServerScript":true}',
    input_schema:
      '{"type":"object","properties":{"userName":{"type":"string","title":"User name","description":"The name to greet. Falls back to the current user when empty."}},"required":[]}',
  },
})
```

Note what the component does and does not do:

- renders **all four states** — loading, error, empty, data
- `role='status'` on loading, `role='alert'` on error
- every string through `i18n.getMessage` with a **plain literal**
- every CSS custom property carries a **literal fallback**
- `state: true` on internal properties, so they are dropped from `input_schema`
- no `customElements.define`, no decorators, no `export` of the class
- no property named `data` or `server`

## Verified working reference on this instance

`case-correlation-card` — a real Fluent-authored widget that installs and renders.
Read the record when the example above is not enough; its measured shape is the
basis for these rules.

| Aspect | What it does |
|---|---|
| `component` | one double-quoted literal with `\n` escapes, 5,097 characters stored |
| `importBoundaries` | `[0, 161]` for three imports of 41 + 1 + 69 + 1 + 49 characters. Verified against the stored component — starts `import`, ends `;`, next characters are `\n\nclass CaseCorrel`, no import after |
| `hasServerScript` | **omitted**, against a 62-character empty-IIFE `script` — and it renders |
| Flags | sent `'true'` / `'false'`, stored `"1"` / `"0"` |
| `input_schema` | JSON-Schema shape with a populated `required` array |
| CSS | DaisyUI-layer tokens with literal fallbacks throughout, plus one `--now-color_background--secondary` |
| Decorators | none; plain class, no `customElements.define` |
| `servicenow` | `0`, and `sys_policy` is empty — the record stays editable |

Two things it does that are **not** exemplary:

1. It writes `client_tools: '{}'` and `required_translations: '[]'`. Both land
   verbatim despite being `strict_read_only`, and the next compile overwrites them.
   Leave them out.
2. Its `script` uses a backtick template literal rather than a double-quoted
   literal. Safe only because it contains no `${}` — one interpolation away from
   the AST-stringification failure above.

## Post-install check

```javascript
var g = new GlideRecord('sys_aix_widget');
g.get('id', 'hello-widget');
var comp = g.getValue('component') || '';
var ccm = g.getValue('component_compile_metadata') || '';
gs.info('ccm non-empty   = ' + (ccm !== ''));
gs.info('no Symbol(      = ' + (comp.indexOf('Symbol(') === -1));
gs.info('substring ok    = ' + (comp.substring(0, 152).indexOf('import') === 0
      && comp.charAt(151) === ';'
      && comp.substring(152).indexOf('import') === -1));
gs.info('sys_policy      = ' + (g.getValue('sys_policy') || '(empty)'));
```

⚠ The post-install working-set refresh may write fields **back into source** — an
empty `script` IIFE appearing in a `.now.ts` that never declared one is the sync,
not drift. Diff after install and attribute before editing.
