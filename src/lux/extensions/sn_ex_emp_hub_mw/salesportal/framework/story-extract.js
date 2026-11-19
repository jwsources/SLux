// STORY EXTRACTION -- a pure function, no component dependencies, no DOM.
//
// The Otto story arrives as an HTML field: read-only, AI-generated, refreshed
// on every work note, and around 4.5KB on the subject record. Its structure is
// regular: a wrapper, a header block, a small identifying table row, then a
// run of section panels each shaped as an uppercase label div followed by a
// prose div, and finally a footer div reading "Generated <timestamp>".
//
// WHY EXTRACT RATHER THAN INJECT.
// That HTML carries inline hex colours throughout (#1b2128, #0080a3, #eef6f9,
// #6c737a, #f4f5f6, #e2e2e2). Injecting it raw would put six colours outside
// the --rv-* palette into the page, defeat theming entirely, and put text
// contrast beyond our control. So the labelled prose is pulled out and handed
// to our own themed components, and the raw HTML is used only as a last-resort
// fallback -- sanitised, and with its style attributes stripped.
//
// EXTRACTING PROSE FOR DISPLAY IS LEGITIMATE. What ACCEPTANCE forbids is
// deriving FACTS or STATES from narrative text. This function returns prose
// labelled by its own section heading and nothing else: no counts, no states,
// no record identities. Callers must not parse the returned text for data --
// every fact and state on the page comes from a record field.
//
// NO DOM PARSING. DOMParser does not exist in the SSR isolate, so this is
// string work throughout. That also makes it trivially testable: it is a
// string in, an object out, with no environment at all.

// Leaf-div matcher: a div whose content contains no further div opening tag.
// The section panels nest exactly one level (panel > label + prose), so
// matching only leaf divs yields a flat, ordered list of the label and prose
// elements without having to balance tags.
const LEAF_DIV = /<div\b([^>]*)>((?:(?!<div\b)[\s\S])*?)<\/div>/gi;

// Named entities worth handling, plus numeric forms. Kept small and explicit
// rather than pulling in a dependency for a known, narrow input.
const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  bull: '\u2022',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201d',
  ldquo: '\u201c'
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const key = name.toLowerCase();
      return Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : match;
    });
}

// Tags to text. <br> and </p> become newlines because the prose div is marked
// white-space: pre-line in the source, so its line structure is meaningful.
//
// EXPORTED because the activity view needs the same conversion for journal
// bodies, which are also HTML carrying inline colours. One implementation
// rather than two: a second copy would drift on entity handling and on the
// newline rules, and the two views would disagree about the same note.
export function toPlainText(html) {
  const withBreaks = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\u2022 ');
  const stripped = withBreaks.replace(/<[^>]*>/g, '');
  return decodeEntities(stripped)
    .replace(/\u00a0/g, ' ')
    // Collapse runs of blank lines but keep single newlines.
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// A label div is identified by its STYLE first and its text shape second.
// The source marks labels with text-transform:uppercase and font-weight:700.
// The text test is a fallback for a payload whose inline styles change, since
// the field is AI-generated and its formatting is not a contract.
function looksLikeLabel(attrs, text) {
  if (!text) return false;
  const style = String(attrs || '').toLowerCase();
  const styled =
    style.includes('text-transform:uppercase') ||
    style.includes('text-transform: uppercase');
  if (styled) return true;

  // Short, no sentence-ending punctuation, and identical to its own
  // upper-casing: that is a heading, not prose.
  if (text.length > 60) return false;
  if (/[.!?]$/.test(text)) return false;
  return text === text.toUpperCase() && /[A-Z]/.test(text);
}

// Section labels that are chrome rather than content.
function isChromeLabel(label) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('generated')) return true;
  if (normalized === 'case story') return true;
  return false;
}

const GENERATED_AT = /generated\s+([0-9]{1,2}-[0-9]{1,2}-[0-9]{2,4}[^<]*)/i;

/**
 * Pull the labelled sections out of an Otto story HTML field.
 *
 * @param {string} html  the raw field value
 * @param {object} [options]
 * @param {(dirty: string) => string} [options.sanitize]
 *        An HTML sanitiser, used ONLY for the fallback path. Pass
 *        sanitizeHtml from '@servicenow/aiux/aiux-utils/sanitizeHtml' (it is
 *        isomorphic: DOMPurify on the client, sanitize-html in the SSR
 *        isolate). When omitted, the fallback degrades to plain text rather
 *        than returning markup -- this function never returns unsanitised
 *        HTML, whatever the caller does.
 * @returns {{mode: 'sections'|'fallback'|'empty',
 *            sections: Array<{label: string, text: string}>,
 *            generatedAt: string|null,
 *            fallbackHtml: string,
 *            fallbackText: string}}
 *
 * TWO I18N CONSTRAINTS ON THE RESULT, both inherent to the source:
 *
 * 1. generatedAt IS AN OPAQUE SOURCE STRING, not a date. The field's footer
 *    carries a fixed dd-MM-yyyy HH:mm:ss rendering, so displaying it raw would
 *    show one hardcoded format in every locale. Do not render it as a
 *    timestamp. If the page needs to show when the story was generated, read a
 *    real datetime field from the record and format it with a locale-aware
 *    formatter; use this value only as a provenance hint or ignore it.
 *
 * 2. sections[].label AND .text ARE SOURCE-LANGUAGE PROSE generated by the
 *    model. They are content, not UI strings: they must NOT be passed through
 *    i18n.getMessage (which would look up a key that does not exist), and they
 *    are not translatable by this app. Any surrounding UI chrome -- a heading,
 *    a "generated by AI" notice -- is a UI string and must be localised
 *    normally.
 */
export function extractStorySections(html, options = {}) {
  const empty = {
    mode: 'empty',
    sections: [],
    generatedAt: null,
    fallbackHtml: '',
    fallbackText: ''
  };

  if (!html || typeof html !== 'string' || !html.trim()) return empty;

  // Collect leaf divs in document order, as {attrs, text}.
  const leaves = [];
  LEAF_DIV.lastIndex = 0;
  let match = LEAF_DIV.exec(html);
  while (match !== null) {
    leaves.push({attrs: match[1] || '', text: toPlainText(match[2] || '')});
    match = LEAF_DIV.exec(html);
  }

  const generatedMatch = GENERATED_AT.exec(html);
  const generatedAt = generatedMatch ? generatedMatch[1].trim() : null;

  // Pair each label with the next non-empty leaf as its prose.
  const sections = [];
  for (let i = 0; i < leaves.length; i += 1) {
    const leaf = leaves[i];
    if (!looksLikeLabel(leaf.attrs, leaf.text)) continue;
    if (isChromeLabel(leaf.text)) continue;

    // Find the next leaf that has text and is not itself a label.
    let prose = '';
    for (let j = i + 1; j < leaves.length; j += 1) {
      const candidate = leaves[j];
      if (!candidate.text) continue;
      if (looksLikeLabel(candidate.attrs, candidate.text)) break;
      prose = candidate.text;
      break;
    }

    if (prose) {
      sections.push({label: leaf.text.trim(), text: prose});
    }
  }

  if (sections.length) {
    return {
      mode: 'sections',
      sections,
      generatedAt,
      fallbackHtml: '',
      fallbackText: ''
    };
  }

  // FALLBACK. Extraction found nothing -- the field's shape changed, or it is
  // not the expected document at all. Rather than show nothing, show the
  // content, but never on the source's terms:
  //   - style attributes are stripped, so none of the inline hex colours
  //     reach the page and our own typography applies;
  //   - the result is then handed to the caller's sanitiser;
  //   - with no sanitiser, markup is dropped entirely and plain text is
  //     returned, because returning unsanitised HTML is not an option this
  //     function offers.
  const withoutStyles = html
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
    .replace(/\sstyle\s*=\s*'[^']*'/gi, '')
    .replace(/\sclass\s*=\s*"[^"]*"/gi, '')
    .replace(/\sclass\s*=\s*'[^']*'/gi, '');

  const fallbackText = toPlainText(html);
  const sanitize = typeof options.sanitize === 'function' ? options.sanitize : null;
  const fallbackHtml = sanitize ? String(sanitize(withoutStyles) || '') : '';

  if (!fallbackHtml && !fallbackText) return empty;

  return {
    mode: 'fallback',
    sections: [],
    generatedAt,
    fallbackHtml,
    fallbackText
  };
}

// Convenience predicate for the Otto adapter: did we get anything worth
// rendering at all?
export function hasStoryContent(result) {
  if (!result) return false;
  if (result.mode === 'sections') return result.sections.length > 0;
  if (result.mode === 'fallback') {
    return Boolean(result.fallbackHtml || result.fallbackText);
  }
  return false;
}
