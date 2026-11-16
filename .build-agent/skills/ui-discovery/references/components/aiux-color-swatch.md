# @servicenow/aiux-color-swatch

## Import

```js
import '@servicenow/aiux-color-swatch';
```


An editable color swatch component that displays a color preview and opens a popover color picker for selection.

## Installation

```bash
pnpm add @servicenow/aiux-color-swatch
```

## Usage

Basic usage:

```html
<aiux-color-swatch
  .mainColor=${{ hex: '#0077CC' }}
  label="Primary Color"
></aiux-color-swatch>
```

With accessibility color picker and border-on-low-contrast:

```html
<aiux-color-swatch
  .mainColor=${{ hex: '#FFFFFF', id: 'now-color--neutral-0' }}
  label="Background"
  .showBorderForLowContrast=${true}
  .showA11yColorPicker=${true}
  .a11yColorPickerConfig=${{ comparisonColor: '#000000', contrastTypeCheck: 'text' }}
></aiux-color-swatch>
```

## Properties

| Property                   | Attribute                  | Type                    | Default              | Description                                                                                       |
| -------------------------- | -------------------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `mainColor`                | —                          | `ColorValue`            | `{ hex: '#000000' }` | The currently selected color (hex + optional design-token id).                                    |
| `label`                    | `label`                    | `string`                | `''`                 | Accessible label for the swatch button.                                                           |
| `disabled`                 | `disabled`                 | `boolean`               | `false`              | Disables the swatch; prevents picker from opening.                                                |
| `disablePalette`           | `disablepalette`           | `boolean`               | `false`              | Hides the palette tab in the color picker. Prefer property binding.                               |
| `compEditPanelProp`        | `compeditpanelprop`        | `string`                | `''`                 | Set to `'BORDER_COLOR_PROP'` to render in border-color edit panel mode. Prefer property binding.  |
| `a11yColorPickerConfig`    | —                          | `A11yColorPickerConfig` | `{}`                 | Config for accessibility color picker (comparison color + contrast type).                         |
| `showA11yColorPicker`      | `showa11ycolorpicker`      | `boolean`               | `false`              | Shows the accessible color selector tab. Prefer property binding.                                 |
| `showBorderForLowContrast` | `showborderforlowcontrast` | `boolean`               | `false`              | Adds a border ring when the swatch color has low contrast against white. Prefer property binding. |
| `variantId`                | `variantid`                | `string`                | `''`                 | Identifies the theme variant this swatch belongs to. Prefer property binding.                     |
| `showA11yIndicator`        | `showa11yindicator`        | `boolean`               | `false`              | Enables contrast telemetry reporting on color save. Prefer property binding.                      |

## Events

All events bubble and are composed.

| Event                                      | Detail type                 | Description                                                  |
| ------------------------------------------ | --------------------------- | ------------------------------------------------------------ |
| `aiux-color-swatch:color-set`           | `ColorSwatchColorSetDetail` | Fired when the user saves a color selection.                 |
| `aiux-color-swatch:color-picker-closed` | `ColorPickerClosedDetail`   | Fired when the color picker popover closes (save or cancel). |

## Types

```typescript
interface ColorValue {
  id?: string; // Design-token id, e.g. 'now-color--neutral-0'
  hex: string; // Hex color string, e.g. '#0077CC'
}

interface A11yColorPickerConfig {
  comparisonColor?: string; // Hex color to check contrast against
  contrastTypeCheck?: string; // 'text' | 'graphic'
}

interface ColorSwatchColorSetDetail {
  colorKey: string; // CSS custom property key (e.g. '--now-color--neutral-0')
  value: string; // New hex value
  variantId: string; // Theme variant id
  isCustom: boolean; // True if user picked a non-token color
  hexValue: string; // Hex string of selected color
  hook: string; // Token id or hex for downstream consumers
  pickerOpenFromInteraction?: boolean; // Whether picker was opened by user interaction
}

interface ColorPickerClosedDetail {
  isA11yColorPicker: boolean; // Always true for this component
}
```

## Accessibility

- The swatch trigger renders as `role="button"` with a descriptive `aria-label` (includes label, token name, and hex value).
- Keyboard: `Enter` and `Space` toggle the color picker.
- Popover closes on outside click, restoring focus to the trigger.
- `showBorderForLowContrast` adds a visible border ring for colors with low contrast against white (`#FFFFFF`).
- `showA11yColorPicker` surfaces an accessible color selector tab with `contrastCheckType` and `comparisonColor`.

## Convert from Seismic

```bash
./convert.sh \
  /Users/jayesh.jadhav/Documents/AutomationProjectDevBranch/branding-manager/src/components/sn-edit-color-swatch \
  aix/components/color-swatch \
  --stories
```
