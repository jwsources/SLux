# Error and Validation — Cross-Cutting Pattern

Two independent display patterns for validation feedback. They share an upstream pipeline but diverge at the display layer. A third pattern (page-level notifications) is out of scope — see `@compositions/notification-spec.md`.

> **Accessibility wiring** (ARIA association, `aria-invalid`, `aria-describedby`, role mapping, validation timing, focus on first invalid field, the complete form validation cycle) is owned by the accessibility skill — see `@accessibility`. This file documents Horizon's visual mapping and design-system specifics only.

---

## Two Display Patterns

| Pattern                | Where                             | What It Shows                                                        | Rendered By                   |
| ---------------------- | --------------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| **Inline Validation**  | Beneath each form control         | Field-specific errors, warnings, info, suggestions                   | `renderFormFieldMessages()`   |
| **Form-Level Banners** | Above the field grid, top of form | Aggregated mandatory errors, cross-field errors, submission failures | `<aiux-record-form-messages>` |

### Decision guide

| If the message is about…                           | It belongs to…                  |
| -------------------------------------------------- | ------------------------------- |
| A specific field's value being wrong               | **Inline Validation**           |
| The form as a whole failing submission             | **Form-Level Banner**           |
| A system event, operation result, or status change | **Notification** (out of scope) |

The three message systems operate independently — there is no central orchestrator. A field validation failure shows an inline error only. It does NOT automatically create a form-level banner.

---

## Shared Validation Pipeline

Both patterns flow through four stages:

```
Constraint  →  ValidationResult  →  ControlMessage[]  →  Display Pattern
(required,     { valid, message }   { status, icon,      ├─ Inline (field-level)
 min, max,                           content }           └─ Banner (form-level)
 pattern)
```

All validators treat empty values as valid. Use the `required` attribute for mandatory fields — do not conflate absence with invalidity.

---

## Message Status Mapping

### Inline validation (field-level)

| `status`     | Alert Class                | Icon                   | ARIA Role       |
| ------------ | -------------------------- | ---------------------- | --------------- |
| `critical`   | `alert-soft alert-error`   | `hexagon-exclamation`  | `role="alert"`  |
| `warning`    | `alert-soft alert-warning` | `triangle-exclamation` | `role="alert"`  |
| `positive`   | `alert-soft alert-success` | `circle-check`         | `role="status"` |
| `info`       | `alert-soft alert-info`    | `circle-info`          | `role="status"` |
| `suggestion` | `alert-soft`               | `ai-sparkle`           | `role="status"` |

### Form-level banners

| Type              | Alert Class     | Icon                   | Priority                |
| ----------------- | --------------- | ---------------------- | ----------------------- |
| `MANDATORY_ERROR` | `alert-error`   | `circle-exclamation`   | Highest (sorted to top) |
| `FIELD_ERROR`     | `alert-error`   | `circle-exclamation`   | High                    |
| `ERROR`           | `alert-error`   | `circle-exclamation`   | High                    |
| `WARNING`         | `alert-warning` | `triangle-exclamation` | Medium                  |
| `INFO`            | `alert-info`    | `circle-info`          | Low                     |
| `SUCCESS`         | `alert-success` | `circle-check`         | Low                     |
| `SUGGESTION`      | `alert-success` | `ai-sparkle-fill`      | Low                     |

---

## Accessibility wiring

ARIA association (`aria-invalid`, `aria-describedby`, `aria-required`), role mapping (`alert` vs `status`), focus on first invalid field, and the complete form validation cycle are documented in `@accessibility`.

---

## DaisyUI Error Classes

| Control Type | Error Class      |
| ------------ | ---------------- |
| Input        | `input-error`    |
| Textarea     | `textarea-error` |
| Select       | `select-error`   |
| Checkbox     | `checkbox-error` |
| Toggle       | `toggle-error`   |

The required indicator switches from `text-text-primary` to `text-error` when invalid.

---

## Validation Timing

Triggers, debouncing, and the `isTouched` guard are documented in `@accessibility` › Validation timing.

## Localization

All user-facing validation messages must use `@lit/localize`:

```typescript
msg('This field is required');
msg(str`Value must be at least ${min}`);
```

Never hardcode English strings in validation messages.

---

## Known Exceptions

- **Dual rendering:** `form/fields/index.ts::renderField()` renders both System A (DaisyUI alerts) and System B (plain text) messages. New code must use System A only.
- **Checkbox bypass:** Checkbox does not use `FormFieldLayoutMixin` — it manually builds messages and only handles `error` type.
- **Icon name drift:** `renderFormFieldMessages()` uses short names (`close`), `transformMessages()` uses `-outline` suffix, form-level messages use mixed conventions.
