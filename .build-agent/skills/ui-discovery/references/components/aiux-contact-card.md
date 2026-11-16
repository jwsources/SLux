# @servicenow/aiux-contact-card

## Import

```js
import '@servicenow/aiux-contact-card';
```


Contact card component that displays a user's avatar, name, titles, badges, and contact fields.

Aligned with the 2026 redesign (AINPX-Contact-card-2026): a colored contact name, a 32px avatar,
one status-badge group with up to three items, and a 3-column body grid for label/value fields.
See [Badge Colors](#badge-colors) below for the
current badge rendering, and [Empty state](#empty-state) for the no-contact-selected view.

## Usage

```html
<aiux-contact-card
  heading-name="Julie Lewis"
  avatar-src="/avatar.png"
  .badges=${[
    {label: 'Escalated', color: 'critical'},
    {label: 'VIP', color: 'positive'}
  ]}
  .subHeadingTitles=${[{label: 'Network Admin', clickable: true}]}
  .content=${[
    {label: 'Email', value: 'julie@example.com', clickable: true},
    {label: 'Phone', value: '+1 555-1234'}
  ]}
></aiux-contact-card>
```

## Properties

| Property           | Type                | Attribute         | Default           | Description                                                                   |
| ------------------ | ------------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------- |
| `headingName`      | `String`            | `heading-name`    | `''`              | Display name of the contact. Required — card renders nothing if empty.        |
| `avatarSrc`        | `String`            | `avatar-src`      | `''`              | URL of the avatar image. Falls back to initials when empty.                   |
| `headingLevel`     | `Number`            | `heading-level`   | `3`               | HTML heading element level (`1`–`6`) for the contact name.                    |
| `headingVariant`   | `String`            | `heading-variant` | `'header-tertiary'` | Visual text style for the heading. See [Heading Variants](#heading-variants). |
| `badges`           | `ContactBadge[]`    | —                 | `[]`              | Up to three badges displayed beside the contact metadata or beneath it in reflow. |
| `subHeadingTitles` | `SubHeadingTitle[]` | —                 | `[]`              | Titles shown below the name. Supports multiple entries.                       |
| `content`          | `ContactField[]`    | —                 | `[]`              | Label/value field pairs shown in the card body.                               |
| `hideBorder`       | `Boolean`           | `hide-border`     | `false`           | Removes the border and padding around the card.                               |
| `empty`            | `Boolean`           | `empty`           | `false`           | When true, renders `<aiux-empty-state-content>` instead of contact content and ignores `headingName`. See [Empty state](#empty-state). |
| `emptyStateTitle`  | `String`            | `empty-state-title` | `''`            | Heading shown in the empty state. Defaults to a localized "No contact selected" when left unset. |
| `emptyStateMsg`    | `String`            | `empty-state-msg` | `''`              | Optional body text shown below the empty-state heading. Empty hides the body text. |
| `ariaLabel`        | `String \| null`    | `aria-label`      | `null`            | Accessible label for screen readers. Defaults to `headingName`.               |
| `role`             | `String \| null`    | `role`            | `'group'`         | ARIA role reflected onto the host element. Defaults to `'group'` for a11y parity with `sn-contact-card`. |

## Config Properties

Set via the platform Config Editor (`configSchema`), not as HTML attributes.

| Property                | Type      | Label            | Default     | Description                                        |
| ------------------------ | --------- | ---------------- | ----------- | --------------------------------------------------- |
| `configHeadingVariant`   | `String`  | Heading Variant  | `undefined` | Overrides `headingVariant`. See [Heading Variants](#heading-variants) for the available values. |
| `configHideBorder`       | `Boolean` | Hide Border      | `undefined` | Overrides `hideBorder`: hides the border around the card. |

## Dependencies

`@servicenow/aiux-components-empty-state-content` is a peer dependency, used to render the
[empty state](#empty-state) (`empty` set to true).

## Asset Dependencies

The empty state illustration requires the following platform icon asset to be available in
the deployment:

- `/aiux/assets/core/icons/window-question--theme.svg`

## Empty state

Set `empty` to render the no-contact-selected view instead of contact content. `headingName` is
ignored while `empty` is set. `emptyStateTitle` defaults to a localized "No contact selected";
`emptyStateMsg` is optional body text shown below the heading and is hidden when left empty.

```html
<aiux-contact-card empty></aiux-contact-card>

<aiux-contact-card
  empty
  empty-state-msg="Select a contact from the list to see their details here."
></aiux-contact-card>
```

## Events

All events bubble and are composed.

- `aiux-contact-card:item-clicked` - Fired when a clickable title or content field is activated (click or keyboard). Detail: `{ type: 'title' | 'field', item: SubHeadingTitle | ContactField }`

```javascript
card.addEventListener('aiux-contact-card:item-clicked', e => {
  const {type, item} = e.detail;
  // type: 'title' | 'field'
  // item: { label, value?, clickable, id? }
});
```

## Types

### `ContactBadge`

```typescript
interface ContactBadge {
  label: string;
  color?: BadgeColor; // see Badge Colors below
}
```

### `SubHeadingTitle`

```typescript
interface SubHeadingTitle {
  label: string;
  clickable?: boolean; // renders as a link, fires aiux-contact-card:item-clicked
  id?: string; // passed through in the item-clicked event detail
}
```

### `ContactField`

```typescript
interface ContactField {
  label: string;
  value: string;
  clickable?: boolean; // renders value as a link, fires aiux-contact-card:item-clicked
  id?: string; // passed through in the item-clicked event detail
}
```

## Heading Variants

| Variant            | Style                               |
| ------------------ | ----------------------------------- |
| `header-primary`   | `text-2xl font-bold`                |
| `header-secondary` | `text-xl font-bold`                 |
| `header-tertiary`  | `text-lg font-normal` (default)     |
| `title-primary`    | `text-base font-semibold`           |
| `title-secondary`  | `text-sm font-semibold`             |
| `title-tertiary`   | `text-xs font-medium`               |

## Badge Colors

`critical` · `high` · `warning` · `moderate` · `positive` · `info` · `low` · `magenta` · `pink` · `orange` · `yellow` · `brown` · `green` · `green-yellow` · `blue` · `gray` · `teal` · `purple`

All badge colors render as `aiux-badge-soft` (2026 redesign). There is no outline, dash, or ghost
variant anymore; the color list above only changes the badge's color, not its style.

## SSR

This component is SSR-compatible. It has no browser API calls, no timers, and `render()` is a pure function of component state. The Babel-transpiled build is at `vN/index.js`.

The empty state pulls in the `aiux-empty-state-content` peer, which transitively imports
`@servicenow/aiux-components-core`. SSR safety there relies on the host (karuna) deduping
external-core peers onto the single core copy every component in this repo already imports, the
same as any other external-core sibling dependency.
