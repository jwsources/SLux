# Header-config object — data shape

**Authored for the Web IDE; merged with pack v3.0.0.** This file originally replaced the vendor path
`docs/arch-header-config.md#data-shape`, which is a monorepo path and is **still not shipped in this
package**. Pack **v3.0.0 now inlines a `### Header-config data shape` section in
`migrate-header-config/SKILL.md`**, and that field list and its type/semantic notes have been **folded
into the table below** — marked `[pack v3.0.0]`. This file remains the authority, because the pack
section carries no evidence tiers, no precedence ordering, no account of what `null` means, and no
scope-creep guard.

Every field is **optional**. `getHeaderConfig(path)` returns either an object of these fields or `null`.

## Evidence tiers

| Tag | Means |
| --- | --- |
| ✅ **shipped** | Appears in a shipped reference under `aiux-build/references/`, cited per field |
| 🟡 **named** | Documented in pack prose — this skill's migration/review text and/or v3.0.0's own data-shape section — but not attested in shipped code |
| ⬜ **unverified** | Neither — verify on the instance before relying on it |

**How v3.0.0 changes a field's tier.** The pack's data-shape section is vendor documentation, not shipped
runtime code, so it confers the **🟡 named** tier, never ✅. Concretely: `transient` and `openInSidebar`
were ⬜ unverified (names in a comparison list with no type) and are now **🟡 named** — v3.0.0 gives each
a type and a stated purpose. `icon` is new at v3.0.0 and enters at **🟡 named**. Fields already ✅ shipped
stay ✅ and gain the pack's type notes as corroboration. Nothing is promoted to ✅ on the strength of pack
prose alone.

## Fields

| Field | Type | Tier | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ shipped | The toolbar title. Source: `setHeaderConfig` example in `aiux-build/references/app/navigation-patterns.md`. `[pack v3.0.0]` calls it an **alias for `pageTitle`**. |
| `pageTitle` | string | 🟡 named | `[pack v3.0.0]`: "breadcrumb title, **overrides the L2 nav label**" — that is the semantic the local copy was missing. Local note retained: only `title` is attested in shipped code, so when writing new code prefer `title`; treat the pair as aliases and do **not** set both to different values. |
| `l3` | `[{label, path, id?}]` | ✅ shipped | L3 header tabs. `label` is display text, `path` an app-relative route. Same shape as `l3Nav` entries on an L2 nav item. Source: `navigation-patterns.md`. `[pack v3.0.0]` adds the optional **`id`** on each entry (🟡 for `id` specifically). |
| `metadata` | `[{label, iconName, iconClass?, textClass?}]` | ✅ shipped | Status/metadata chips beside the title — `[pack v3.0.0]` places them "above the tabs". `iconName` is an `<aiux-icon>` name; `iconClass` a utility class (e.g. `text-success`). `[pack v3.0.0]` adds optional **`textClass`** (🟡 for `textClass` specifically). Source: `navigation-patterns.md`. |
| `actionsDropdown` | boolean | ✅ shipped | Collapses page actions into a dropdown; `[pack v3.0.0]`: "show the actions dropdown **on the right**". Source: `navigation-patterns.md`. |
| `header` | boolean | 🟡 named | Shows the toolbar. `[pack v3.0.0]`: "**defaults to `false`, true when `l3` has tabs**" — this confirms and sharpens this skill's *What NOT to report* rule (`header: false` on a page with no `l3` is expected, not a regression unless the page needs a toolbar). |
| `hideToolbar` | boolean | 🟡 named | Suppresses the toolbar **entirely**; `[pack v3.0.0]` example: a home page. Its exact precedence against `header` is still undocumented anywhere — do not infer one. |
| `transient` | boolean | 🟡 named *(was ⬜)* | `[pack v3.0.0]`: "**don't push onto the breadcrumb stack**", e.g. modal flows. Promoted from ⬜ because the pack now gives it a type and a purpose. |
| `openInSidebar` | boolean | 🟡 named *(was ⬜)* | `[pack v3.0.0]`: "**open the page in the detail side panel**". Promoted from ⬜ for the same reason. |
| `icon` | string | 🟡 named *(new at v3.0.0)* | `[pack v3.0.0]`: "icon override". No shipped example; the icon-name vocabulary is presumably `<aiux-icon>`'s, which is **not** stated — verify before use. |

## `null` is meaningful

Returning `null` is not "no config". It tells `aiux-nav-layout` that a **nav item** or a runtime
`setHeaderConfig()` call owns the toolbar for that route, and it **clears the previous route's config**.
Returning `undefined` or `{}` instead is not equivalent — a stale toolbar is the usual symptom.

## Precedence

1. **Per-page loader data** — a layout/page loader returning `{headerConfig: {...}}` as ordinary
   `loaderData` is scanned by nav-layout and **ranks above** the app-owned resolver.
2. **`navLayoutContext.headerConfig`** — what `getHeaderConfig(path)` produced for the current route.
3. **Nav item** — used when the resolver returned `null`.

Runtime `setHeaderConfig(this, {...})` from a nested layout is unchanged by the migration and writes the
same object shape — it is the best live reference for what the nav shell actually accepts.

## Related but separate

`setPageActions(this, [{id, label, handler}])` pushes action buttons, not header config. It is a sibling
API in `@servicenow/aiux-components-nav`, not a field of this object. See the same shipped reference.

## Verifying the gaps

The 🟡/⬜ rows are where a migration can silently lose behaviour. To close them without guessing:

- Read `aiux-build/references/app/navigation-patterns.md` — the `setHeaderConfig` / `setPageActions`
  section is the only shipped prose on this contract. (v3.0.0's data-shape section is documentation of
  the same contract, not a second source of truth.)
- If the app already has a `header-config.js`, read it: existing branches are attested usage.
- `inspect_component_dom` with `componentName: 'aiux-nav-layout'` for the rendered toolbar contract —
  roles, slots, accessible names — when a field's visual effect is in question.
- `keyword_search` / `semantic_search` the instance for header-config metadata.

⚠ **Do not add a field to a migrated resolver that the legacy branch did not set.** The migration's job is
behaviour parity; inventing a field because it appears in this table — including the fields v3.0.0 newly
documents — is scope creep with no test behind it.
