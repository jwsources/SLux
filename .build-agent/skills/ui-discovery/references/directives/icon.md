# @servicenow/aiux-directive-icon

## Import

```js
import {icon} from '@servicenow/aiux-directive-icon';
```


A child-position Lit directive that renders an inline SVG `<use>` icon referencing the platform sprite sheet. It produces the same visual output as the `<aiux-icon>` custom element without the Shadow DOM overhead, supporting named sizes (`xs`–`xl`, plus `1x`/`2x`/`3x` aliases), `fill`/`outline` variants via the icon name suffix, and an optional accessible label.

## Installation

```js
import {icon} from '@servicenow/aiux-directive-icon';
```

## Usage

Apply it inline inside a Lit `html` template:

```js
html`${icon({name: 'user', size: 'lg'})}`;
html`${icon({name: 'home-outline', alt: 'Home'})}`;
```

When `alt` is provided the rendered SVG gets `role="img"` and `aria-label`; otherwise it is `aria-hidden="true"`.

## Options

`icon(options)` accepts:

| Option  | Type                     | Default | Description                                                                                     |
| ------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `name`  | `string`                 | —       | Icon name, optionally with a `-fill` or `-outline` suffix (e.g. `'user'`, `'home-outline'`). Underscores are normalized to dashes. |
| `size`  | `IconSize`               | `'md'`  | One of `xs` / `sm` / `md` / `lg` / `xl`, or the aliases `1x` (= `sm`), `2x` (= `lg`), `3x` (= `xl`) |
| `alt`   | `string`                 | —       | Accessible label. When provided the SVG gets `role="img"` and `aria-label`; otherwise `aria-hidden="true"` |
| `class` | `string`                 | —       | CSS classes applied to the `<svg>` element                                                        |

An unrecognized `size` falls back to `'md'`; a missing or unparseable `name` renders nothing.

## Exports

- `icon(options)` — the directive itself.
- `ICON_SIZES` — the size-name → `{pixelSize, key}` map used internally; useful if a caller needs to know the pixel dimensions a given size maps to.
- `parseIconName(name)` — splits an icon name into `{baseName, variant}`, defaulting to the `fill` variant when no suffix is present. Exposed for callers that need to inspect a name before passing it to `icon()`.
