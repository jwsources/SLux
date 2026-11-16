# Field reference — `sys_aix_widget`

Loaded on demand by the `aiux-widget` skill. The hint record
`aiux-widget-development-guide` is the authority; this is the portable subset.

## Table shape

`sys_aix_widget` **extends `sys_ux_widget`**, and the core authoring fields
(`component`, `input_schema`, `id`, `type`, `chat_compatible`, `description`) live
on the **parent**. A `sys_dictionary` query filtered on the child table silently
omits every inherited column — read `sys_db_object.table_fields` instead.

A widget needs a host supplying the AIUX loader and import map. It is **not**
consumable by a plain React or Jelly UI Page; without such a host the record
installs and never renders.

⚠ **Every row count from this table is a floor.** A `Widget Query` before-query
business rule adds `category!=internal^ORcategoryISEMPTY` unless the caller holds
`maint`. Measured: the child table returned 192 rows against 562 on the parent for
the same class. State the role context beside any figure, or publish no figure.

## Source fields

| Field | Notes |
|---|---|
| `name` | human-readable |
| `id` | the custom element tag, kebab-case. Its own BR aborts the save unless it contains a hyphen, starts `[a-z]`, has no uppercase, matches `[a-z0-9._-]` only, does not start `xml`, and is not one of eight reserved SVG/font names |
| `component` | the Lit source. `max_length` 8000 is **not a cap** — the largest real widget is 310,353 characters |
| `script` | the server IIFE. The shipped dictionary default is an **empty** IIFE |
| `input_schema` | stringified JSON-Schema. `read_only = 0` — writable |
| `type` | `aix_widget`. Its `sys_choice` rows live on the **parent**, so a choice query on the child returns zero. Also empty on a large minority of rows; the only other value is `openai_standard` |
| `purpose` | `component` \| `layout` \| `page` \| `other`. Dropdown-with-none, so the DB does not constrain it |
| `category` | normally `custom`. `internal` triggers the visibility filter above |
| `best_for` | **mandatory by Data Policy**, not by the dictionary. Format: "[-ing gerund]. Ideal for [scenario]." Written **for the agent**, not for developers |
| `description` | also written for the agent — concrete about what the widget shows and when to choose it |
| `servicenow` | **keep false.** The `Update protection policy` BR sets `sys_policy = read` when true, making the record update-protected |
| `source_aix_project` | references `sys_aix_project`; marks a widget as SDK-built |

## Configuration flags

The platform **coerces** these — `'true'` / `'false'` sent from Fluent are stored
as `"1"` / `"0"`. Either spelling works.

`simple_widget` · `has_loader` · `chat_compatible` · `interactive_view_compatible`

`chat_compatible` must be `"1"` for an Otto conversation card.

## The compile gate

`sys_aix_widget` carries an active **`Compile Widget`** business rule (before
insert+update, order 100) that parses `component` with acorn and **derives five
fields**:

`component_compile_metadata` · `input_schema` · `client_tools` ·
`required_translations` · `dependent_widget_ids`

A widget whose `component_compile_metadata` is empty **lists in the Builder and
never registers or renders.**

### Three independent ways it does not run

| Gate | Effect |
|---|---|
| The install path bypasses business rules | A Fluent or XML install applies records with BRs skipped |
| Its `condition` requires `sourcemap` to be empty | A record already carrying a `sourcemap` (an SDK-built widget) is never recompiled, on any write path |
| Its `filter_condition` requires `component` or `script` to change | Editing any other field — including via the Table API — does not recompile |

🔑 A `before` insert+update rule normally fires on any write, so an observed skip
on an ordinary write is usually one of the last two gates, not the install path.

**Conversely:** a Builder or Table API save is a write that changes `component`, so
it **recompiles** — the cheapest way to populate the compiler outputs after a
bypassed install.

### What the compiler aborts on, versus only warns about

| Outcome | Trigger |
|---|---|
| 🛑 **Aborts the save** | `component` fails to parse · no class declared · a `static properties` key named **`data`** or **`server`** · an unrecognised `schema['x-ui-control'].kind` · any `x-ui-control` or nested-schema validation error |
| ⚠ **Warns, saves anyway** | an `export` declaration · a `customElements.define` call · a `type` key inside `schema` · `i18n.getMessage` given an interpolated template literal |
| ℹ️ Informs | more than one class — **the first declared class wins** |

`customElements.define` detection matches the bare call only, so
`window.customElements.define` escapes the warning while still double-registering.

## `component_compile_metadata`

```json
{
  "imports": { "<module>": ["<export>"] },
  "elementClassName": "<ClassName>",
  "importBoundaries": [0, 152],
  "hasServerScript": true
}
```

| Key | Truth |
|---|---|
| `imports` | module specifier to the export names used. A renamed import is recorded as `imported~local`. A specifier starting `@servicenow/glide-widgets/` is **excluded** and belongs to `dependent_widget_ids` as `<scope>.<widgetId>`, comma-joined with a trailing comma. Every other specifier goes into `imports`, **including a bare side-effect import**, which lands with an empty list |
| `elementClassName` | the **first** class declared in `component` |
| `importBoundaries` | `[start of FIRST import, end of LAST import]`. The end stops at that import's semicolon — it does not include the trailing newline and does not run into following code. 🛑 **`start` is not always 0**: a licence header or leading comment pushes it down |
| `hasServerScript` | **optional.** Omitting it equals `false`, and a working widget omits it entirely. Also **not** "`script` is non-empty": the IIFE is parsed, and one whose body holds only empty statements counts as no server script |

**Sanity check, always:** `component.substring(start, end)` must begin `import`,
end `;`, and no `import` may appear after `end`.

### Two shapes exist — identify the producer by a KEY

| Producer | `component_compile_metadata` | `isolate_compile_metadata` |
|---|---|---|
| Build pipeline | `{"asset":"<name>-<buildhash>.js", ...}` plus `isSimpleWidget`, and `coreComponentClosure` when core components are pulled in | populated |
| Hand-authored | `{imports, elementClassName, importBoundaries}` | **empty — the correct state, not a fault** |

`elementClassName` and `imports` are the only keys in **both** shapes. `asset` /
`isSimpleWidget` / `coreComponentClosure` mean the pipeline wrote the row;
`importBoundaries` means a human did. There is **no hash column** on the table —
the only hash is a Vite/Rollup build-output suffix inside `asset`, which you
cannot fabricate and do not need.

Hand-authoring is **vendor-shipped**, not a workaround: 15 `polaris-widget-*`
records use exactly that shape.

⚠ Do not reverse-engineer `importBoundaries` arithmetic from stored records —
SDK-built widgets carry a `sourcemap`, so the BR never compiled them and their
metadata came from a different producer.

## Compiler-output fields — do not author

`client_tools` · `required_translations` · `dependent_widget_ids` ·
`isolate_compile_metadata`

🛑 **`strict_read_only` does NOT block a Fluent `data` write.** A `Record()`
sending `client_tools: '{}'` and `required_translations: '[]'` installs both
values verbatim. The reason not to author them is that the next compile overwrites
them — not that the write is rejected. Do not read `read_only = 1` as a guarantee
that a write was refused.

## `input_schema`

The compiler emits **one** shape: `type: object`, a `properties` map, and a
top-level `required` array. Flat shapes exist on real records but are **legacy and
unstable** — the next compile overwrites them.

| In the component | In `input_schema` |
|---|---|
| `type: String / Number / Boolean / Array / Object` | `string / number / boolean / array / object`; anything unrecognised silently becomes `string` |
| `state: true` | **dropped** — internal state is not configurable |
| `name` | `title` |
| `description` | `description`, and it becomes the label the server `options` shows |
| `required: true` | promoted into the top-level `required` array |
| `schema: { ... }` | flattened onto the property; a `schema.type` key is ignored and warned |

### `x-ui-control`

`schema['x-ui-control'].kind` accepts exactly **`reference`, `table`, `choice`,
`multiChoice`**. Anything else aborts the save.

| kind | Validated |
|---|---|
| `reference` | `table` **required**, a string; `displayField` and `qualifier` optional strings |
| `table` | `baseTable` a string; `includeExtensions` a boolean |
| `choice` | `options` a non-empty array; a `default` must be one of the option values |
| `multiChoice` | `options` a non-empty array; `default` must be an **array** of valid options |

Numeric properties use `minimum` / `maximum` (numbers, `minimum` ≤ `maximum`).
Nested `properties` and `items` validate recursively to depth 16.

## Component source rules

- Extend `AIUXWidgetElement` from `@servicenow/aiux-components-core`. The parent
  table's dictionary default still seeds the legacy `ux_kit/core` / `UxKitElement`
  pair — that is the UX-Kit base, not the AIX one. Do not copy it.
- `static fetchDataOnConnect = false` is correct for a widget with no server script.
- Every user-facing string through `i18n.getMessage` with a **plain literal** or a
  `{ code, message, comment }` object. Only these are statically extracted into
  `required_translations`. An interpolated template literal is warned about and the
  string is **never extracted**, so it ships untranslated. Recognised call chains
  are `i18n.getMessage` and `this.services.i18n.getMessage`. Use placeholder
  substitution, never concatenation.
- Because every string is localised, **do not encode meaning in emoji or ASCII
  art.** Icons are `<aiux-icon>` with `aria-hidden` when decorative; status and
  severity come from the `aiux-badge` / `aiux-btn` vocabulary.
- **Reuse shipped components before writing your own.** Import one by its
  `@servicenow/glide-widgets/<scope>/<id>` specifier and it is recorded as a
  dependency for you.
- **Bind non-string props as properties: `.propName=${value}`.** The attribute form
  lowercases, so a camelCase prop arrives `undefined`.
- **Accessibility is structural:** `role=status` for loading, `role=alert` plus a
  retry for errors, `aria-label` on icon-only buttons. `aria-labelledby` /
  `aria-describedby` targets must live in the **same shadow root** or they do not
  resolve — fall back to `aria-label`. A clickable non-button needs `role=button`,
  `tabindex=0` and an Enter/Space handler. Render all four states: loading, error,
  empty, data.
- **Tailwind modifier prefixes (`sm:`, `hover:`, `dark:`) do not cross the
  shadow-DOM boundary.** Use `@media` and pseudo-classes in the component's styles.

### ⬜ Two authoring forms exist — decorator-free is not universal

The plain-class form saves and renders on an older-plugin instance. The **current
Builder's own shipped template is the DECORATOR form** — `@customElement` plus
`decorators` from `@servicenow/aiux-components-core`, with `export default`, where
widget metadata lives in the component source rather than only in record columns.

🔑 In that form **`@customElement` is load-bearing.** Removing it means the tag
never registers, and the Builder reports *"the widget timed out during
registration. Check for syntax errors or missing dependencies"* — which reads as a
syntax fault and is neither.

⚠ **Any decorator returns HTTP 403 on save for a non-privileged author**, including
`@customElement` alone. A newer Builder also injects `@discoverable` /
`@chatCompatible` / `@interactiveViewCompatible` and will not let you delete them.

⬜ Whether a Builder save stores **raw or transpiled** decorator syntax is
unresolved, and it decides whether a Fluent-authored `component` can ever be
Builder-current: the BR parses with acorn, which rejects raw decorators without a
plugin, while the vendor widget `aiux-hello-world` is stored transpiled.
**Verify by** saving one decorator widget as a privileged author and reading
`component` back.

## CSS tokens

**Always supply a literal fallback:** `var(--spacing, 0.25rem)`.

🛑 **Three widely-copied names do not exist** (measured, with a control that fired
in the same call): `--now-spacing`, `--now-color--brand-primary`,
`--now-color--critical`. `--now-font-family` does exist.

🔑 **An undefined token with a literal fallback is invisible.**
`calc(var(--now-spacing, 4px) * 4)` computes 16px on every instance and in every
theme — it reads as token-driven and is hard-coded. Nothing errors, nothing logs.

| Family | Themes? |
|---|---|
| semantic `--now-color_surface--*`, `_text--*`, `_border--*` | **Yes**, but reported not to reach a widget shadow root |
| palette `--now-color--*` | 🛑 **No.** Light and dark values are byte-identical |
| `--color-*`, `--duration-*`, `--ease-*` | the AIUX Tailwind/DaisyUI layer, governed by that layer, not Horizon |

⬜ Whether the DaisyUI family resolves or themes inside a widget shadow root is
untested. **Verify by** setting one on a host element and reading the computed
value in both themes. `css_variable_explorer` **cannot see that layer at all** — an
empty result there means out of scope for the tool, not that the token is absent.

## Server script

An ES5 IIFE over `(data, options, input)`.

- **Populate `data.*`; never `return` a value** — a `return` is the usual reason
  server data never reaches the client.
- `options` carries the instance config derived from `input_schema`; `input` carries
  the client payload.
- **Default to `GlideRecordSecure`.** A widget is a UI surface, and one returning
  rows past ACLs is a security defect. Cost: a row the user cannot read is skipped
  silently, so an empty widget may mean *no access* rather than *no data*. Plain
  `GlideRecord` is a deliberate exception — justify it in a comment. ⬜ Neither
  variant has been runtime-tested inside a widget server script. **Verify by**
  running both against a record the current user cannot read.
- Guard table and field existence before querying — a filter on an **absent** field
  is silently discarded and matches every row.
- Validate sys_ids with `GlideStringUtil.isEligibleSysID`.

## Fluent `Record()` — what is not validated

Measured with `run_diagnostics`, controls firing:

- 🛑 **`table` is not type-checked.** `table: 12345` produced zero diagnostics while
  a deliberate syntax error in the same file reported correctly.
- 🛑 **`data` does not validate column names.** A nonsense key produces no
  diagnostic; the build, the install and the record all look fine while the field
  stays empty — indistinguishable from a bypassed compile.
- 🛑 **Every `data` value must be a literal** — see the skill's trap 1.

## Symptom table

| Symptom | Cause | Fix |
|---|---|---|
| Lists in the Builder, never renders | `component_compile_metadata` empty — the BR did not run | Author it, or make a write that changes `component` |
| A column holds `Symbol(...Shape)` | a computed value in `data` | Replace with a plain literal. The symbol name tells you the node kind |
| Recompile never happens on an SDK-built widget | BR `condition` requires an empty `sourcemap` | Author the outputs; do not expect a recompile |
| Edited a field, nothing recompiled | BR `filter_condition` needs `component` or `script` to change | Touch `component` |
| Save rejected, no obvious reason | `id` fails the custom-element rule, or a property is named `data` or `server` | Kebab-case with a hyphen; rename the property |
| A field in `data` never lands | column-name typo — Fluent does not validate `data` keys | Re-read the stored record, not the build output |
| Props arrive `undefined` from a parent | camelCase prop bound as an attribute | Bind as a property with `.propName=` |
| Server data never arrives | the script used `return` | Assign to `data.*` |
| A string ships untranslated | `i18n.getMessage` given an interpolated template literal | Plain literal plus placeholders |
| Timed out during registration | `@customElement` removed in the decorator form | Restore it — it is load-bearing |
| `hover:` / `sm:` classes do nothing | shadow-DOM boundary | `@media` and pseudo-classes in the component styles |
| Resolves its colours but never goes dark | a palette-family token, or a semantic token that does not reach the shadow root | See CSS tokens above |

## Checklist

- [ ] `id` kebab-case, at least one hyphen, starts with a letter
- [ ] No property named `data` or `server`
- [ ] Every user-facing string through `i18n.getMessage` with a plain literal
- [ ] Every CSS custom property carries a literal fallback; no `--now-spacing`
- [ ] `input_schema` authored in the JSON-Schema shape
- [ ] `component_compile_metadata` authored, `importBoundaries` **verified by substring**
- [ ] Server script is an IIFE, populates `data.*`, never returns, guards existence
- [ ] `servicenow` false, `category` and `purpose` deliberate, scope is the app
- [ ] `chat_compatible` true if it must render in Otto
- [ ] `best_for` and `description` written for the agent
- [ ] Every `data` value a plain literal — no call, no `+`, no variable
- [ ] **After install, read the record back.** A clean build proves nothing
