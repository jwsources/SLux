# Header-config object — data shape

**Authored for the Web IDE.** This file replaces the vendor path `docs/arch-header-config.md#data-shape`,
which is a monorepo path and is **not shipped in this package**. Nothing in the pack carries the shape, so
it is reconstructed here from shipped evidence, with each field tagged by how it is known.

Every field is **optional**. `getHeaderConfig(path)` returns either an object of these fields or `null`.

## Evidence tiers

| Tag | Means |
| --- | --- |
| ✅ **shipped** | Appears in a shipped reference under `aiux-build/references/`, cited per field |
| 🟡 **named** | Named in this skill's migration/review prose, but its type and semantics are not documented anywhere shipped |
| ⬜ **unverified** | Neither — verify on the instance before relying on it |

## Fields

| Field | Type | Tier | Notes |
| --- | --- | --- | --- |
| `title` | string | ✅ shipped | The toolbar title. Source: `setHeaderConfig` example in `aiux-build/references/app/navigation-patterns.md`. |
| `l3` | `[{label, path}]` | ✅ shipped | L3 header tabs. `label` is display text, `path` an app-relative route. Same shape as `l3Nav` entries on an L2 nav item. Source: as above. |
| `metadata` | `[{label, iconName, iconClass}]` | ✅ shipped | Status/metadata chips beside the title. `iconName` is an `<aiux-icon>` name; `iconClass` a utility class (e.g. `text-success`). Source: as above. |
| `actionsDropdown` | boolean | ✅ shipped | Collapses page actions into a dropdown. Source: as above. |
| `header` | boolean | 🟡 named | This skill's *What NOT to report* states it **defaults to `false` for pages with no `l3`** — not a regression unless the page needs a toolbar. |
| `hideToolbar` | boolean | 🟡 named | Suppresses the toolbar. Exact precedence against `header` is undocumented. |
| `pageTitle` | string | 🟡 named | Listed as `pageTitle`/`title` — two spellings for what appears to be one concept. Only `title` is attested in shipped code; prefer `title` and treat `pageTitle` as legacy until verified. |
| `transient` | ⬜ unknown | ⬜ unverified | Named only in the Category 4 comparison list. |
| `openInSidebar` | ⬜ unknown | ⬜ unverified | Named only in the Category 4 comparison list. |

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

The three 🟡/⬜ rows are where a migration can silently lose behaviour. To close them without guessing:

- Read `aiux-build/references/app/navigation-patterns.md` — the `setHeaderConfig` / `setPageActions`
  section is the only shipped prose on this contract.
- If the app already has a `header-config.js`, read it: existing branches are attested usage.
- `inspect_component_dom` with `componentName: 'aiux-nav-layout'` for the rendered toolbar contract —
  roles, slots, accessible names — when a field's visual effect is in question.
- `keyword_search` / `semantic_search` the instance for header-config metadata.

⚠ **Do not add a field to a migrated resolver that the legacy branch did not set.** The migration's job is
behaviour parity; inventing a field because it appears in this table is scope creep with no test behind it.
