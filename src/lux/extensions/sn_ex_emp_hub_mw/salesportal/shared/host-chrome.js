import {isServer} from 'lit';

// THE HOST'S "FOREIGN PAGE" CHROME, neutralised in one place.
//
// The experience wraps any non-landing page in its own white box with a back
// button. Measured in the mw-integration-layout widget source, the whole
// treatment hangs off one attribute:
//     .aiux-main[data-home-page='false'] {
//       & > .uex-page-header { background-color: var(--color-background-primary, #FFF); ... }
//       & .page-outer       { background-color: ...; }
//       & .page-container   { background-color: ...; }
//     }
// There is no page-config flag to opt out, and we cannot become the landing
// page.
//
// WHY A SHARED MODULE rather than a method on each page: two pages need it now
// (the case page and the generic record page). The body class and the style id
// are declared ONCE here, so the selector and the class that activates it
// cannot drift apart -- a copy in each page is two declarations of the same
// contract.
//
// The override is document-level because those three elements are ANCESTORS of
// the page, in the host layout's light DOM. A shadow root cannot style its own
// ancestors.

const STYLE_ID = 'x-snc-slux-rv-chrome';
const BODY_CLASS = 'x-snc-slux-rv-seamless';

/**
 * Call from firstUpdated, client-side only. Idempotent.
 */
export function applySeamlessChrome() {
  if (isServer || typeof document === 'undefined') return;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // --theme-background is the token the host shell sets on body; the same
    // source notes that --color-base-200 does NOT match it, so base-200 is the
    // wrong variable here. transparent as the fallback lets the host's own
    // paint show through rather than substituting a literal colour.
    style.textContent = [
      '.' + BODY_CLASS + " .aiux-main[data-home-page='false'] > .uex-page-header,",
      '.' + BODY_CLASS + " .aiux-main[data-home-page='false'] .page-outer,",
      '.' + BODY_CLASS + " .aiux-main[data-home-page='false'] .page-container {",
      '  background-color: var(--theme-background, transparent);',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  document.body.classList.add(BODY_CLASS);
}

/**
 * Call from disconnectedCallback. Leaves the style element in place -- it is
 * inert without the class, and removing it would thrash the head on every
 * in-app navigation.
 */
export function releaseSeamlessChrome() {
  if (isServer || typeof document === 'undefined') return;
  document.body.classList.remove(BODY_CLASS);
}
