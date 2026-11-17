import {css, html, nothing} from 'lit';
// Deep import, never the aiux-services barrel. The isolate bundler
// externalizes components-core and components-record and stubs aiux-client,
// but the services barrel matches none of those buckets, so it resolves
// through the meta-package exports and is bundled INLINE. Its re-exported
// service modules reach core/observability, whose logger.js uses a Node
// subpath import that rollup's node-resolve rejects as "outside package",
// which fails the whole page's isolate bundle. services/src/i18n.js has zero
// imports and reads globalThis.__WIDGET_MESSAGES__ when window is undefined,
// so it is SSR-isolate-safe on its own. Do not "tidy" this to the barrel.
import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

// Shared label/value rendering for every record element on this page, plus the
// structural CSS that styles it. Both live here so a class name can never
// exist in a component without the stylesheet that loads for that component.
//
// FIELD CONTRACT, read from the installed package rather than assumed
// (components/record/src/provider/apis/FormAPI.ts):
//
//   get fields(): Record<string, GlideFormField>   <- USE THIS
//   getField(fieldName): GlideFormField | null     <- raw, NOT used here
//
// The fields getter is the one that applies personalization:
//     visible: isHidden ? false : field.visible,
// while getField() returns this.layout.fields[name] untouched. Reading
// getField() would therefore render fields the user personalized away.
// Values come off the same object: getValue() is field.value and
// getDisplayValue() is field.displayValue, so reading the field directly is
// identical and avoids a second lookup. There is no getLabel() on FormAPI --
// the label is a property of the field object.
//
// STYLING. Colours and type scale come from safelisted Tailwind and DaisyUI
// classes in the markup; the CSS below is structural only. Per AGENTS.md this
// project uses Tailwind + DaisyUI and no --now-* CSS tokens, and per
// TOOLNOTES.md an unsafelisted utility is tree-shaken in silence, so only
// classes verified present in tailwind.css are used.

export function normalizeFieldNames(value) {
  if (Array.isArray(value)) {
    return value.map(name => String(name).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
  }
  return [];
}

function toText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.filter(entry => entry != null && entry !== '').join(', ');
  }
  return String(value);
}

// Resolves a requested field list against the live form. A name absent from
// the current form view, hidden by a UI policy, or personalized away comes
// back in the missing list rather than being dropped silently, so a typo or a
// change stays visible instead of collapsing the block to nothing.
export function resolveFieldList(formApi, fieldNames) {
  const available = formApi?.fields || {};
  const resolved = [];
  const missing = [];

  for (const name of fieldNames) {
    const field = available[name];
    // Strict false on purpose: an undefined visible must not hide the field.
    if (!field || field.visible === false) {
      missing.push(name);
      continue;
    }
    resolved.push({
      name,
      // label is the one property here not confirmed against the
      // GlideFormField source this session, so it falls back to the field
      // name rather than rendering an empty term.
      label: field.label || name,
      text: toText(field.displayValue) || toText(field.value)
    });
  }

  return {resolved, missing};
}

export function renderFieldList({
  fields,
  badgeFieldNames = [],
  layout = 'inline'
}) {
  if (!fields.length) return nothing;

  const renderValue = field => {
    if (!field.text) {
      return html`<span aria-hidden="true">&#8212;</span
        ><span class="sr-only">${i18n.getMessage('Empty')}</span>`;
    }
    if (badgeFieldNames.includes(field.name)) {
      return html`<span class="aiux-badge aiux-badge-sm aiux-badge-soft"
        >${field.text}</span
      >`;
    }
    return field.text;
  };

  return html`
    <dl class="slux-fields" data-layout=${layout}>
      ${fields.map(
        field => html`
          <div class="slux-field">
            <dt class="slux-field-label text-xs text-text-tertiary">
              ${field.label}
            </dt>
            <dd class="slux-field-value text-sm font-medium">
              ${renderValue(field)}
            </dd>
          </div>
        `
      )}
    </dl>
  `;
}

export const fieldListStyles = css`
  .slux-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.75rem 1.5rem;
    margin: 0;
  }

  .slux-fields[data-layout='stacked'] {
    grid-template-columns: 1fr;
  }

  .slux-field {
    min-width: 0;
  }

  .slux-field-label {
    margin: 0 0 0.125rem;
  }

  .slux-field-value {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* Windows High Contrast Mode. The badge is a non-interactive container, so
     it takes the system canvas colours with a visible border. Its text is
     always rendered, so the badge never carries meaning by colour alone. */
  @media (forced-colors: active) {
    .slux-field-value .aiux-badge {
      background-color: Canvas;
      color: CanvasText;
      border: 1px solid CanvasText;
    }
  }
`;
