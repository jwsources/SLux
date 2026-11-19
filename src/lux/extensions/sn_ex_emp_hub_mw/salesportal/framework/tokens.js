import {css} from 'lit';

// RECORD INTELLIGENCE VIEW -- THE ONE AND ONLY DECLARATION SITE FOR COLOUR.
//
// Every --rv-* property below READS A THEME TOKEN FIRST and falls back to the
// ui_design/tokens.json value only when the theme supplies none. Every other
// file in the framework reads these properties and contains no raw hex. That
// one-way dependency is the reference-integrity mechanism: there is nothing to
// keep in sync, because there is only one declaration.
//
// WHY THE THEME WINS OVER tokens.json.
// The experience this page overlays has its own theme, and that theme also
// colours the host navigation. Hardcoding tokens.json's cream palette produced
// a page that did not match the portal around it. tokens.json's own closing
// note asks for exactly this: "Map to the instance's Next Experience design
// tokens where equivalents exist." Equivalents do exist -- they are the
// variables the nav itself reads -- so the design values are fallbacks for a
// themeless context, not the primary source.
//
// WHERE THE THEME TOKENS COME FROM, verified in
// node_modules/@servicenow/aiux/components/core/src/styles/tailwind.css:
//     at-theme static { --color-nav-layout: var(--nav-layout-bg); ... }
// The word static is the load-bearing part. That file's own comment says
// it "forces every token below to always emit to :root, even if unused by any
// scanned utility/component today", because Tailwind v4 otherwise tree-shakes
// a token with no textual match in scanned source. So --nav-layout-bg and its
// siblings are guaranteed present as CSS CUSTOM PROPERTIES.
//
// THE TRAP THAT DICTATES THE FORM OF THIS FILE: that guarantee covers the
// PROPERTIES, not the utility classes. A class such as bg-nav-layout is in no
// source-inline safelist, and this app's source is not in tailwind.css's
// source scan paths, so such a class is tree-shaken in silence and the element
// renders unstyled. Theme colour must therefore be consumed through var() in
// hand-written CSS, which is what every rule here does. Safelisted classes
// that DO survive -- bg-surface-primary, bg-base-300, border-base-300,
// text-text-tertiary, aiux-badge-* -- are safe to use directly in markup.
//
// WHY A CHAINED FALLBACK ON EACH PROPERTY.
// Two token families appear in that safelist: --color-base-* from DaisyUI, and
// --color-surface-* / --color-text-* from the aiux-theme plugin. The plugin
// defining the second family was not read in this session, so rather than
// assert one naming scheme each property tries the DaisyUI name, then the
// plugin name, then the design literal. A var() fallback chain resolves at
// computed-value time: an absent first choice costs nothing, and an absent
// second still yields the design value.
//
// WHY EVERY COMPONENT INCLUDES rvTokens RATHER THAN INHERITING IT.
// A page cannot style another component's shadow root. Custom properties do
// inherit across a shadow boundary, but only down a composed tree -- so a
// component that is moved, slotted elsewhere, or rendered inside another
// component's shadow root would silently lose the palette. Declaring on :host
// in each component makes each one self-sufficient wherever it is placed.
//
// WHAT STAYS A LITERAL, AND WHY EACH SURVIVES.
// Three things in tokens.json have no theme equivalent and are design
// structure rather than brand colour:
//   - the 18px grid gap: the safelisted gap-* scale has no 18px step;
//   - the 30px title and 34px stat sizes: the safelisted text-* scale stops at
//     3xl and neither value is on it;
//   - the 44px touch target: a WCAG 2.5.5 floor, not a theme choice.
// Radii read the theme's own --radius-box / --radius-field, because a themed
// surface with a foreign corner radius reads as a foreign component.

// Tone vocabulary from COMPONENTS.md. Exported so a component can validate a
// prop instead of interpolating an unknown tone into a selector that silently
// matches nothing.
export const TONES = ['info', 'warning', 'critical', 'success', 'neutral'];

export const DEFAULT_TONE = 'neutral';

// Returns a tone that is guaranteed to have a matching [data-tone] rule in
// rvPrimitives below. An unrecognised tone falls back to neutral rather than
// rendering an unstyled chip.
export function safeTone(tone) {
  return TONES.includes(tone) ? tone : DEFAULT_TONE;
}

// ui_design/tokens.json -> breakpoints and grid. Exported as numbers because
// var() does not work inside a media query condition, so every media query in
// this framework hardcodes these same two values. When one changes here, grep
// the framework for the literal.
export const BREAKPOINT_DOCK_WRAPS = 1100;
export const BREAKPOINT_SINGLE_COLUMN = 720;
export const GRID_COLUMNS = 12;
export const DOCK_MIN = 300;
export const DOCK_MAX = 380;

export const rvTokens = css`
  :host {
    /* SURFACES.
       --theme-background is THE HOST SHELL'S PAGE SURFACE, set on body by its
       layout.js. Quoted from the mw-integration-layout widget source:
           .aiux-loading-overlay { background: var(--theme-background, #edece9); }
       and immediately above it, that file's own comment records that
       --color-base-200 "doesn't match the shell's --theme-background". So
       base-200 is the wrong variable for a page surface, by the host's own
       account, and --nav-layout-bg is not set by this host at all. Reading
       --theme-background is what makes a custom page match the host's own
       pages and the navigation beside them.
       The fallback is transparent rather than a colour: when the token is
       absent, inheriting whatever the host paints is the correct degradation.
       A literal would pin one portal's branding into the app.
       Card and tile surfaces follow the theme's own ramp, so a card here
       matches a card anywhere else in the experience. */
    --rv-surface-page: var(--theme-background, transparent);
    --rv-surface-card: var(
      --color-base-100,
      var(--color-surface-primary, #ffffff)
    );
    --rv-surface-tile: var(
      --color-base-200,
      var(--color-surface-secondary, #f4f3ef)
    );
    --rv-surface-control: var(--color-base-300, #dad8d2);
    --rv-surface-hairline: var(
      --nav-divider-color,
      var(--color-base-300, #e5e3dd)
    );

    /* INK. */
    --rv-ink-primary: var(
      --color-base-content,
      var(--color-text-primary, #1b1b19)
    );
    --rv-ink-secondary: var(
      --color-base-content-secondary,
      var(--color-text-secondary, #3f3e3a)
    );
    --rv-ink-muted: var(
      --color-base-content-tertiary,
      var(--color-text-tertiary, #5b5a55)
    );

    /* ACTION. Primary actions follow the theme's primary so the page's buttons
       match the portal's. */
    --rv-action-primary: var(--color-primary, #0e2b3d);
    --rv-action-primary-text: var(--color-primary-content, #ffffff);
    --rv-action-link: var(--color-primary, #1f5f8b);
    --rv-action-link-hover: var(--color-primary, #123f5e);

    /* OTTO ACCENT. Deliberately NOT themed: the Otto green is a product
       identity colour, the same in every theme, and the design uses it only on
       the assistant's own surfaces. */
    --rv-otto-accent: #62d84e;
    --rv-otto-on-accent: #10260b;

    /* TONE. Tone chips in markup use the safelisted aiux-badge-* variants,
       which are theme-driven. These properties remain for the few places that
       need a tone colour inside hand-written CSS, and they read the theme's
       semantic colours with the design pair as fallback. */
    --rv-tone-info-bg: var(--color-info-content, #dcebff);
    --rv-tone-info-text: var(--color-info, #0b3f8f);
    --rv-tone-warning-bg: var(--color-warning-content, #ffe9b8);
    --rv-tone-warning-text: var(--color-warning, #6b4300);
    --rv-tone-critical-bg: var(--color-error-content, #f9d9d9);
    --rv-tone-critical-text: var(--color-error, #8a1717);
    --rv-tone-success-bg: var(--color-success-content, #d9efdf);
    --rv-tone-success-text: var(--color-success, #145a2c);
    --rv-tone-neutral-bg: var(--color-base-200, #ecebe7);
    --rv-tone-neutral-text: var(--color-base-content, #3f3e3a);

    /* DATA MARKS. Chart/progress fills, not text on a surface. */
    --rv-data-positive: var(--color-success, #1e6b3a);
    --rv-data-attention: var(--color-warning, #f0b44c);

    /* RADIUS. The theme's own box and field radii, so a surface here has the
       same corner as a surface anywhere else in the experience. */
    --rv-radius-card: var(--radius-box, var(--radius-nav, 12px));
    --rv-radius-tile: var(--radius-box, var(--radius-nav-sm, 8px));
    --rv-radius-control: var(--radius-field, var(--radius-nav-sm, 8px));
    --rv-radius-pill: 999px;

    /* SPACING. SPEC section 2 fixes the grid gap at 18, so that is what it is
       -- it was reduced to 14 for density, which was a deviation from the page
       framework rather than a decision the spec allows. Card padding is not
       specified there, so the tighter padding stays. */
    --rv-grid-gap: 18px;
    --rv-card-padding: 16px 18px;

    /* OMNIBAR CLEARANCE -- space kept free at the bottom of the page so the
       host's chat omnibar does not sit on top of record data.
       7.5rem is the HOST'S OWN figure, not a guess. From the
       mw-integration-layout widget CSS:
           .content-area main[data-mode='OMNI'] .page-container {
             padding-block-end: 7.5rem;
           }
       alongside its comment "OMNI omnibar stays fixed at viewport bottom while
       page scrolls" on a rule that pins the chat wrapper with position: fixed.
       The host rule only fires when main carries data-mode='OMNI'; this page's
       content was being overlaid regardless, so the clearance is applied here
       too. Matching the host's value means that if both apply the result is
       consistent spacing rather than an arbitrary sum. */
    --rv-omnibar-clearance: 7.5rem;
    --rv-page-gutter: 0px;
    --rv-rail: 72px;

    /* GRID. */
    --rv-dock-min: 300px;
    --rv-dock-max: 380px;

    /* FONT. The theme owns the family; --font-sans is declared under
       at-theme static in tailwind.css and reads --theme-level-font-sans, the
       documented hook for a theme record to override the family. */
    --rv-font-ui: var(--font-sans, 'ServiceNow Sans', system-ui, sans-serif);
    --rv-font-mono: var(--font-mono, 'ServiceNow Sans Mono', monospace);
    --rv-size-title: 24px;
    --rv-size-section: 17px;
    --rv-size-body: 14px;
    --rv-size-label: 12px;
    --rv-size-caption: 11px;
    --rv-size-stat: 30px;
    --rv-weight-regular: 400;
    --rv-weight-medium: 500;
    --rv-weight-semibold: 600;

    /* touchTargetMin -- WCAG 2.5.5, a floor rather than a theme choice. */
    --rv-touch-target: 44px;
  }
`;

// Shared primitives every card needs. Co-located with the declarations above so
// that a class name can never appear in a component without the stylesheet that
// defines it also loading for that component -- the component includes both
// blocks or neither.
export const rvPrimitives = css`
  /* CARD SURFACE. Pairs with the aiux-card DaisyUI class for its box model.
     DaisyUI's component styles sit in a components cascade layer; these rules
     are unlayered, so they win on cascade layer regardless of specificity,
     which is what lets the card surface and radius be set from the theme
     tokens above rather than from DaisyUI's own defaults. */
  .rv-card {
    background: var(--rv-surface-card, #ffffff);
    border-radius: var(--rv-radius-card, 12px);
    padding: var(--rv-card-padding, 20px 22px);
    color: var(--rv-ink-primary, #1b1b19);
    font-family: var(--rv-font-ui, 'ServiceNow Sans', system-ui, sans-serif);
    font-size: var(--rv-size-body, 14px);
    /* A hairline rather than a shadow. The original design separated a white
       card from a cream page by contrast alone, but on a themed page the card
       and page surfaces can be close enough that an unbordered card has no
       visible edge -- so the border is what guarantees the boundary in any
       theme. shadow-* is absent from the safelist in any case. */
    border: 1px solid var(--rv-surface-hairline, #e5e3dd);
    box-shadow: none;
    min-width: 0;
  }

  /* TILE. The inner surface inside a card: stat tiles, from/to blocks,
     numbered step tiles. */
  .rv-tile {
    background: var(--rv-surface-tile, #f4f3ef);
    border-radius: var(--rv-radius-tile, 20px);
    padding: 14px 16px;
    min-width: 0;
  }

  /* HAIRLINE. The only divider in the design. Used between RecordFields
     sections and between rows. */
  .rv-hairline {
    border: none;
    border-top: 1px solid var(--rv-surface-hairline, #e5e3dd);
    margin: 0;
  }

  /* TONE CHIP. Both ends of the contract are here: the [data-tone] attribute a
     component writes, and the rule that colours it. A tone outside the five is
     impossible because components route props through safeTone().

     SPEC section 6: chips carry text, never colour alone. The chip renders its
     label as text, so the tone is emphasis only and removing all colour loses
     no information -- which is also what makes the forced-colors block below
     safe. */
  .rv-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--rv-radius-pill, 999px);
    padding: 3px 12px;
    font-family: var(--rv-font-ui, Inter, system-ui, sans-serif);
    font-size: var(--rv-size-label, 12px);
    font-weight: var(--rv-weight-medium, 500);
    line-height: 1.6;
    white-space: nowrap;
    background: var(--rv-tone-neutral-bg, #ecebe7);
    color: var(--rv-tone-neutral-text, #3f3e3a);
  }

  .rv-chip[data-tone='info'] {
    background: var(--rv-tone-info-bg, #dcebff);
    color: var(--rv-tone-info-text, #0b3f8f);
  }

  .rv-chip[data-tone='warning'] {
    background: var(--rv-tone-warning-bg, #ffe9b8);
    color: var(--rv-tone-warning-text, #6b4300);
  }

  .rv-chip[data-tone='critical'] {
    background: var(--rv-tone-critical-bg, #f9d9d9);
    color: var(--rv-tone-critical-text, #8a1717);
  }

  .rv-chip[data-tone='success'] {
    background: var(--rv-tone-success-bg, #d9efdf);
    color: var(--rv-tone-success-text, #145a2c);
  }

  .rv-chip[data-tone='neutral'] {
    background: var(--rv-tone-neutral-bg, #ecebe7);
    color: var(--rv-tone-neutral-text, #3f3e3a);
  }

  /* MONO FACE. tokens.json notes: record numbers, versions and codes use the
     mono face. */
  .rv-mono {
    font-family: var(--rv-font-mono, 'JetBrains Mono', monospace);
    font-variant-numeric: tabular-nums;
  }

  /* TYPE SCALE. font.size in tokens.json. 30px and 34px are not on Tailwind's
     safelisted text-* scale, so the whole scale is declared here rather than
     half in CSS and half in utility classes. */
  .rv-type-title {
    font-size: var(--rv-size-title, 30px);
    font-weight: var(--rv-weight-semibold, 600);
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--rv-ink-primary, #1b1b19);
    margin: 0;
  }

  .rv-type-section {
    font-size: var(--rv-size-section, 17px);
    font-weight: var(--rv-weight-semibold, 600);
    line-height: 1.35;
    color: var(--rv-ink-primary, #1b1b19);
    margin: 0;
  }

  .rv-type-body {
    font-size: var(--rv-size-body, 14px);
    font-weight: var(--rv-weight-regular, 400);
    line-height: 1.55;
    color: var(--rv-ink-secondary, #3f3e3a);
  }

  .rv-type-label {
    font-size: var(--rv-size-label, 12px);
    font-weight: var(--rv-weight-medium, 500);
    line-height: 1.4;
    color: var(--rv-ink-muted, #5b5a55);
  }

  .rv-type-caption {
    font-size: var(--rv-size-caption, 11px);
    font-weight: var(--rv-weight-regular, 400);
    line-height: 1.45;
    color: var(--rv-ink-muted, #5b5a55);
  }

  .rv-type-stat {
    font-size: var(--rv-size-stat, 34px);
    font-weight: var(--rv-weight-semibold, 600);
    line-height: 1.1;
    color: var(--rv-ink-primary, #1b1b19);
  }

  /* LINK. tokens.json has a link and a hover colour. The underline is kept
     because colour alone must not distinguish a link (WCAG 1.4.1). */
  .rv-link {
    color: var(--rv-action-link, #1f5f8b);
    text-decoration: underline;
    text-underline-offset: 2px;
    border-radius: 4px;
  }

  .rv-link:hover {
    color: var(--rv-action-link-hover, #123f5e);
  }

  /* FOCUS. WCAG 2.4.7 and 2.4.11. focus-visible only, per the accessibility
     skill: never suppress focus manually, and do not show a ring on mouse
     interaction with a button. */
  .rv-focusable:focus-visible {
    outline: 2px solid var(--rv-action-primary, #0e2b3d);
    outline-offset: 2px;
  }

  /* SKELETON. Paired with the DaisyUI aiux-skeleton class, which supplies the
     shimmer. This only pins the geometry, because a skeleton must occupy the
     final height of what it replaces (SPEC section 6). The reduced-motion stop
     is already applied by tailwind.css for :host([reduced-motion]); the media
     query here covers the OS-level preference as well. */
  .rv-skeleton {
    display: block;
    border-radius: var(--rv-radius-tile, 20px);
    background: var(--rv-surface-tile, #f4f3ef);
  }

  @media (prefers-reduced-motion: reduce) {
    .rv-skeleton,
    .aiux-skeleton {
      animation: none;
    }
  }

  /* WINDOWS HIGH CONTRAST MODE. Chips, tiles and cards are non-interactive
     containers, so per the forced-colors reference they take Canvas/CanvasText
     with a visible border and do NOT get forced-color-adjust: none. Their text
     is always rendered, so nothing is lost when the palette is replaced. */
  @media (forced-colors: active) {
    .rv-card,
    .rv-tile,
    .rv-chip {
      background: Canvas;
      color: CanvasText;
      border: 1px solid CanvasText;
    }

    .rv-hairline {
      border-top-color: CanvasText;
    }

    .rv-link {
      color: LinkText;
    }

    .rv-focusable:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
`;
