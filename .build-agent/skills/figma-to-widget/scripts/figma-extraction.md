# Phase 1 — Figma extraction (AUTHORITATIVE)

Ported from `figma-extractor.js` (348 lines, pack v2.6.0), read in full.

> 🛑 **THIS FILE OVERRIDES THE PHASE-1 TABLES IN `SKILL.md`, WHICH ARE LOSSY AND WRONG IN TWO PLACES.**
> The prose's own slash-notation example (`aiux-icon/chevron`) **fails the real regex**, and it claims the
> trigger/field/picker rules apply to "Any" node type when they are unreachable for containers.

**Acquisition is not portable to the Web IDE** — `fetchFigmaFrame()` needs an `X-Figma-Token` header, which
`web_fetch` cannot send. Get the node JSON from the user (shape: `scripts/fixtures/task-card.json`) or a
configured Figma MCP server, then apply the traversal below yourself.

## URL parsing — `parseFigmaUrl()`

- Host must contain `figma.com`.
- Path must match `/\/(?:file|design|proto)\/([a-zA-Z0-9_-]+)/` → `fileKey`. **`/proto/` is accepted** (the
  prose lists only file and design).
- `?node-id` is REQUIRED; URL-decode it, then **replace every `-` with `:`** → `frameId`.
  Missing it is a hard error: "right-click a frame → Copy link to selection".
- Endpoint: `/v1/files/<fileKey>/nodes?ids=<frameId>&geometry=paths`; 401/403 means the token was rejected.
- The frame is `body.nodes[frameId].document`; absent means the frame is not in that file.

## Role classification — `resolveRole()`, IN EVALUATION ORDER

Order matters: the first match wins, and later rules are unreachable for earlier types.

1. `TEXT` → **label**
2. `RECTANGLE` → **shape**
3. `VECTOR`, `ELLIPSE`, `POLYGON`, `STAR`, `LINE`, `BOOLEAN_OPERATION` → **glyph**
4. **Containers** — `FRAME`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `GROUP`
   (the prose omits `COMPONENT_SET` and `GROUP`):
   a. `INSTANCE` or `COMPONENT` **only** with a definitive icon name → **glyph**
      *(a `FRAME` named `Icon/foo` is NOT caught here)*
   b. `layoutMode === 'HORIZONTAL'` → **row**
   c. `layoutMode === 'VERTICAL'` → **column**
   d. `INSTANCE` or `COMPONENT` **only** passing `looksLikeIcon()` → **glyph**
   e. otherwise → **surface**
5. Name-based, **only for types that are none of the above** — so never for a container or a TEXT node:
   - `/\bbtn\b|button/` → **trigger**
   - `/input|textfield|textbox/` → **field** *(prose omits `textbox`)*
   - `/select|dropdown|combobox/` → **picker**
6. → **unknown**

🛑 **Step 5 is the prose's big error.** It presents these as applying to "Any" node type. They do not: a
`FRAME` or `INSTANCE` named `btn-primary` resolves to `row`/`column`/`surface` at step 4 and never reaches
step 5. Auto-layout button components therefore carry a layout role, not `trigger`.

### Definitive icon name — `isDefinitiveIconName()`

Name must contain `/`, **and the FIRST segment** must match `/^(icons?|glyph|sn-ai[ux]x?-icon)/`.
Matches: `Icon/…`, `Icons/…`, `glyph/…`, `sn-aix-icon/…`, `sn-aiux-icon/…`.
**Does NOT match: `aiux-icon/…`** — the prose cites it as an example anyway.
Checked BEFORE `layoutMode`, deliberately: icon components often use auto-layout for internal centring.

### Icon heuristic — `looksLikeIcon()`

- `/\bicon\b|^ic[-_]/` on the lowercased name *(the `^ic[-_]` prefix is undocumented in the prose)*, OR
- bounding box `width` and `height` both within **8–40** inclusive **and** `|w − h| ≤ 4`.

## Traversal — `walkLayer()`

- **Skip** `visible === false` and `type === 'SLICE'` — at entry and again when filtering children.
- **A `glyph` is a LEAF: do not recurse into it.** Its children are internal vector paths.
- `depth` starts at 0 and increments per level.
- Every key below is **omitted entirely when empty** — `dims`, `palette`, `flow`, `typo` only appear if they
  have at least one property. Do not assume they exist.

## Palette extraction

- `hasImageFill(fills)` → `imagePlaceholder: true` and **no colour is read at all** (it short-circuits).
- Else `gradientValue(fills)` → `gradient`; else `solidColor(fills)` → `bg`.
- `solidColor(strokes)` → `border`; `strokeWeight > 0` → `borderWidth`.
- `cornerRadius > 0` → `radius`. Else `rectangleCornerRadii` with any non-zero → **`radii: [tl,tr,br,bl]`**
  (plural — a separate field the prose's block shape omits).
- `opacity != null && < 0.99` → `opacity`, rounded to 2 decimals.
- `dropShadowValue(effects)` → `shadow`.

### Colour serialisation — `rgbaToString()`

`a < 0.99` → `rgba(r, g, b, a)` with alpha at 2 decimals; otherwise `#rrggbb` (each channel
`Math.round(c*255)`, hex, zero-padded to 2).

### Gradient — `gradientValue()`

Skips invisible paints and any with no `gradientStops`. Stops render as
`<color> <Math.round(position*100)>%`, comma-joined.
`GRADIENT_LINEAR` → `linear-gradient(<angle>deg, <stops>)` where angle =
`Math.round((atan2(dx, -dy) * 180 / PI + 360) % 360)` from the first two `gradientHandlePositions`,
**defaulting to 135** when fewer than two exist.
`GRADIENT_RADIAL` → `radial-gradient(circle, <stops>)`.

### Shadow — `dropShadowValue()`

Visible `DROP_SHADOW` effects only, **all of them, comma-joined**. Per shadow:
`<offset.x ?? 0>px <offset.y ?? 4>px <radius ?? 8>px <spread ?? 0>px <colour>`, colour defaulting to
black at alpha `0.1`.

## Flow extraction

`itemSpacing > 0` → `gap` · any of `paddingTop/Right/Bottom/Left` non-zero → `padding: [t,r,b,l]` ·
`layoutWrap === 'WRAP'` → `wrap: true` · `clipsContent` → `overflow: 'hidden'` ·
`layoutGrow === 1` → `grow: true`.

**`PACK` map — undocumented in the prose**, applied to `primaryAxisAlignItems` → `justify` and
`counterAxisAlignItems` → `align`, with `'start'` as the fallback for an unrecognised value:

`MIN → start · MAX → end · CENTER → center · SPACE_BETWEEN → between · STRETCH → stretch · BASELINE → baseline`

## Typography — `TEXT` nodes with a `style` only

`fontSize → size` · `fontWeight → weight` · `fontFamily → family` ·
**`lineHeight` is a RATIO**, `lineHeightPx / fontSize` to 2 decimals — not a px value ·
`letterSpacing → tracking` **only when `|letterSpacing| > 0.01`** ·
`textAlignHorizontal → align` (lowercased) ·
`textCase → transform` (lowercased) unless `ORIGINAL` ·
`textDecoration → decoration` (lowercased) unless `NONE` ·
`solidColor(fills) → color`.

`content` is set from `layer.characters` for `TEXT` nodes when not null.

## Block shape

```
{ id, name, type, role, depth, dims?, palette?, flow?, typo?, content? }
```

Then Phase 2: **`scripts/design-translation.md`** — also authoritative over the `SKILL.md` prose, whose
colour tables map to palette classes instead of DaisyUI semantic ones.
