# Phase 2 — design translation (AUTHORITATIVE)

Ported from `design-translator.js` (630 lines, pack v2.6.0), read in full.

> 🛑 **THIS FILE OVERRIDES THE PHASE-2 TABLES IN `SKILL.md`. THE PROSE THERE IS WRONG.**
> Verified by reading both: the prose maps colours to **raw palette classes** (`bg-white`, `bg-gray-100`,
> `bg-red-50`, `text-gray-600`) while the implementation maps them to **DaisyUI semantic classes**
> (`bg-base-100`, `bg-base-300`, `bg-error/10`, `text-base-content/60`).
> **Palette classes do not theme.** A widget built from the prose tables renders correctly in light mode and
> is **pinned to light mode** in dark — the themed-vs-static trap.
> Use the tables below. The prose also wrongly `aiux-`-prefixes pattern and icon keys, describes a
> `var(--color-*)` fallback set that does not exist, and omits five whole mapping rules.

Not a `run_script` asset: this is a pure local transform over Figma JSON, with no instance data in it.

## Spacing — `pxToScale()`

`px: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]`
`scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32]`

**Nearest** px wins (not floor/ceil). Never emit an arbitrary value like `gap-[13px]`.

## Font size — nearest, default `text-sm`

`12 text-xs · 14 text-sm · 16 text-base · 18 text-lg · 20 text-xl · 24 text-2xl · 30 text-3xl`

## Font weight — nearest; **400 emits nothing**

`100 font-thin · 200/300 font-light · 400 '' · 500 font-medium · 600 font-semibold · 700 font-bold · 800 font-extrabold`

## Radius — `≥100` short-circuits to `rounded-full`, else nearest

`0 rounded-none · 2 rounded-sm · 4 rounded · 6 rounded-md · 8 rounded-lg · 12 rounded-xl · 16 rounded-2xl · 24 rounded-3xl · 9999 rounded-full`

Multiple radii (`palette.radii`) → map the **max**.

## Shadow — by blur radius, parsed from `/\d+px\s+\d+px\s+(\d+)px/`, default blur 8

`≤2 shadow-sm · ≤4 shadow · ≤8 shadow-md · ≤12 shadow-lg · ≤20 shadow-xl · >20 shadow-2xl`

## Background colour — SEMANTIC, not palette

| Hex | Class |
| --- | --- |
| `#ffffff` | `bg-base-100` |
| `#000000` | `bg-black` |
| `#f9fafb` | `bg-base-200` |
| `#f3f4f6` | `bg-base-300` |
| `#e5e7eb` | `bg-base-300` |
| `#d1d5db` | `bg-base-300` |
| `#fef2f2` | `bg-error/10` |
| `#fef3c7` | `bg-warning/10` |
| `#dcfce7` | `bg-success/10` |
| `#ecfeff` | `bg-info/10` |
| `#f5f3ff` | `bg-purple-100` |
| `#fffbeb` | `bg-warning/10` |

## Text colour — SEMANTIC with opacity modifiers

| Hex | Class |
| --- | --- |
| `#ffffff` | `text-white` |
| `#1f2937` | `text-base-content` |
| `#374151` | `text-base-content` |
| `#6b7280` | `text-base-content/60` |
| `#9ca3af` | `text-base-content/40` |
| `#d1d5db` | `text-base-content/30` |

## Fallback chain — and the one real CSS var

1. Tailwind semantic class from the tables above.
2. `CSS_VAR_MAP` — **exactly one entry exists**: `#1f2937` → `var(--color-base-content, #1f2937)`.
3. Raw hex into `cssProps`, flagged in notes. **Role matters:** a `label` role writes `color`; everything
   else writes `background-color`.

## Opacity — MISSING FROM THE PROSE

Snap `palette.opacity × 100` to the nearest of
`[0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]` → `opacity-N`. `≥0.99` emits nothing.

## Border — MISSING FROM THE PROSE

- any border → `border border-solid`
- `#e5e7eb` or `#d1d5db` → `border-base-300`; anything else → `cssProps['border-color']`
- `borderWidth > 1` → `border-N`, rounded and **capped at 8**

## Padding — `mapPadding()`

all four equal → `p-N` · `t===b && l===r` → `py-N px-M` · otherwise → `py-{avg(t,b)} px-{avg(l,r)}`
(no `pt-*`/`pr-*`/`pb-*`/`pl-*` is ever emitted)

## Layout and flow

`role:row` → `flex flex-row` · `role:column` → `flex flex-col` · `gap` → `gap-N` ·
`wrap` → `flex-wrap` · `grow` → `flex-1` · `justify !== 'start'` → `justify-X` ·
`align !== 'start'` → `items-X` · `overflow === 'hidden'` → `overflow-hidden` ·
`imagePlaceholder` → `bg-base-300` + note

## Typography extras — MISSING FROM THE PROSE

`align center/right` → `text-center` / `text-right` · `transform upper/lower` → `uppercase` / `lowercase` ·
`decoration underline/strikethrough` → `underline` / `line-through`

## Size hint — narrower than the prose implies

Emitted **only** when `w === h && w <= 48` → `w-N h-N` (square, small → an icon container).

## DaisyUI pattern detection — returns UNPREFIXED names

First regex wins, tested in this order. The returned value is the bare pattern name — **not** `aiux-btn`.

`\bbtn\b|button`→`btn` · `badge|tag|chip|pill`→`badge` · `card`→`card` · `avatar`→`avatar` ·
`toggle|switch`→`toggle` · `\binput\b|textfield|text-field`→`input` · `alert|toast|notification-bar`→`alert` ·
`modal|dialog|overlay`→`modal` · `\btab\b|\btabs\b`→`tabs` · `dropdown|select|combobox`→`dropdown` ·
`progress|loading-bar`→`progress` · `tooltip|popover`→`tooltip` · `checkbox`→`checkbox` · `radio`→`radio` ·
`menu|nav-item`→`menu` · `table|data-grid`→`table` · `breadcrumb`→`breadcrumbs` · `stat|kpi|metric`→`stat` ·
`collapse|accordion|expandable`→`collapse`

## Icon matching — `matchIcon()` algorithm

1. **Slash notation** — split on `/`, walk segments **right to left**; normalise (lowercase, `_`/`\`→`-`,
   strip non `[a-z0-9-]`); **skip empty and pure-number segments** (size suffixes like `/20`); try the whole
   segment, then each `-`-separated word of length ≥ 2.
2. Normalise the whole name, try the **kebab compound**.
3. Try each word (length ≥ 2).
4. No match → `null` → render `icon?` in the blueprint for a human/LLM decision.

### Keyword map — complete, keys UNPREFIXED

`arrow-right`·`forward`·`arrow`→`arrow-right` | `arrow-left`·`back`→`arrow-left` | `arrow-up`→`arrow-up` |
`arrow-down`→`arrow-down` | `close`·`x`·`dismiss`·`cancel`→`close` | `search`·`find`→`magnifying-glass` |
`settings`·`setting`·`config`·`cog`→`gear` | `user`·`profile`·`person`·**`avatar`**→`circle-user` |
`home`·`house`→`home` | `bell`·`notification`·**`alert`**→`bell` | `mail`·`email`·`message`→`envelope` |
`edit`·`pencil`·`write`→`pencil` | `delete`·`trash`·`remove`→`trash` | `add`·`plus`·`new`·`create`→`plus` |
`check`·`success`·`done`·`complete`→`circle-check` | `warning`·`warn`·`caution`→`triangle-exclamation` |
`info`·`information`→`circle-info` | `error`·`fail`→`circle-close` | `star`·`favorite`·`fav`·`rate`→`star` |
`heart`·`like`·`love`→`heart` | `lock`·`secure`·`locked`→`lock` | `unlock`·`unlocked`→`unlock` |
`calendar`·`date`·`schedule`→`calendar` | `clock`·`time`·`timer`→`clock` | `download`→`download` |
`upload`→`upload` | `filter`→`filter` | `sort`→`sort-ascending` | `menu`·`hamburger`·`nav`→`menu` |
`refresh`·`reload`→`arrow-clockwise` | `sync`→`sync` | `save`→`save` | `copy`·`clipboard`→`clipboard` |
`share`→`share` | **`link`**·`url`→**`link`** | `phone`·`call`→`phone` | `chat`·`discuss`→`chat` |
`comment`→`comment` | `document`·`doc`·`file`·`paper`→`document` |
`task`·`tasks`·`todo`·`todos`·`to-do`·`action-item`→`checklist` |
`work-item`·`assignment`·`assigned`·`request`→`user-clipboard` | `approve`·`approval`→`clipboard-check` |
`incident`→`triangle-exclamation` | `folder`→`folder` | `image`·`photo`·`picture`→`image` |
`play`·`start`→`play` | `pause`→`pause` | `stop`→`stop` |
`chevron-right|left|down|up`→ matching direction | `chevron`→`chevron-right` | `caret`→`caret-down` |
`expand`→`expand` | `eye`·`view`·`visible`·`show`→`eye` | `eye-off`·`hide`·`hidden`→`eye-slash` |
`bookmark`→`bookmark` | `pin`→`thumbtack` | `tag`·`label`→`tag` | `fire`·`hot`·`trending`→`fire` |
`lightning`·`flash`·`bolt`→`lightning` | `sparkle`·`ai`·`magic`→`ai-sparkle` | `robot`·`bot`→`bot` |
`globe`·`world`·`web`→`globe` | `map`·`location`→`map-pin` | `cart`·`shop`·`basket`→`shopping-cart` |
`money`·`dollar`·`payment`→`currency` | `key`→`key` | `shield`·`security`→`shield-check` | `bug`→`bug` |
`code`·`dev`→`code` | `terminal`→`console` | `database`·`db`·`data`→`database` | `cloud`→`cloud` |
`thumbs-up`·`thumb-up`→`thumbs-up` | `thumbs-down`·`thumb-down`→`thumbs-down` |
`chart`→`chart-bar-vertical` | `graph`→`chart-line` | `analytics`→`analytics-center` |
`dashboard`·`gauge`→`dashboard-dial` | `inbox`→`inbox` | `attach`·`attachment`→`paperclip` |
`external-link`→`arrow-up-right` | `external`·`open-new`·`expand-external`→`external-action` |
`more`·`dots`·`ellipsis`→`more-horizontal` | `drag`·`reorder`→`drag-dots` |
`help`·`question`→`circle-question` | `workflow`·`process`·`flow`→`workflow` | `change`·`changes`→`change` |
`overdue`→`clock` | `urgent`·`attention`→`triangle-exclamation` | `critical`→`circle-exclamation` |
`pending`·`progress`·`in-progress`→`ongoing` | `team`·`group`·`members`→`user-group` |
`agent`·`support`→`headset` | `catalog`→`catalog` | `knowledge`·`kb`→`book-open`

⬜ `SKILL.md` claims **263 entries**; the shipped map has roughly 200 keys. The count is cosmetic — the map
above is the whole object. **Verify by** re-reading `ICON_KEYWORDS` in `design-translator.js` if an exact
count ever matters.

## Output shape of `translateBlock()`

Original block plus: `tailwind` (joined, falsy filtered), `cssProps` (object or `null`), `iconMatch`
(only when `role === 'glyph'`), `daisyPattern`, `sizeHint`, `notes[]`.

## This project

`AGENTS.md`: Tailwind + DaisyUI, **no `--now-*` tokens** — which the semantic tables above already satisfy.
DaisyUI 5 renamed every theme variable (`--color-base-100`, `--radius-box`); the v4 names are dead. Hint:
`aiux-lookalike-daisyui-lit`.
