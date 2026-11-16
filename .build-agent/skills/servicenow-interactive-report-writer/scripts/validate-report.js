/**
 * validate-report.js — the native port of validate_report.py.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛑 WHY THIS FILE EXISTS: THE PYTHON VALIDATOR CANNOT RUN IN THE WEB IDE.
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTS.md non-negotiable #2: there is no terminal in this IDE, for the agent
 * or the user. `python scripts/validate_report.py report.html` has no route, so
 * SKILL.md step 6 ("Run the bundled static validator when supported") resolves
 * to never-supported and the check silently stops happening.
 *
 * `references/quality-checks.md` already governs this case: "Validate using the
 * capabilities actually available… Never claim a check was performed when it
 * was not." This file is that capability.
 *
 * ─── HOW TO RUN IT ─────────────────────────────────────────────────────────
 * Paste into the `run_script` tool (scope: global). It is a FUNCTION, not a
 * CLI: there is no argv and no file system.
 *
 * 🔑 PASTE IT ABOVE THE CODE THAT DELIVERS THE REPORT, and pass the same
 * string you are about to attach. Validating a copy proves nothing about the
 * artifact; validating the variable being delivered proves something about it.
 *
 *     var html = buildReport();              // whatever produced it
 *     var v = validateReport(html);
 *     if (v.errors.length) { gs.info(v.text); return; }   // do not deliver
 *     // ... attach `html`, per the PDF Generation skill's pattern
 *
 * ⚠️ NO ATTACHMENT READER, DELIBERATELY. Pulling the HTML back out of
 * sys_attachment would need GlideSysAttachment, whose method contract I have
 * not read in source and will not assert from memory. If that branch is ever
 * wanted, verify the API by measurement first and add it then.
 *
 * ─── WHAT IT IS AND IS NOT ─────────────────────────────────────────────────
 * Static structural inspection of an HTML string. NOT a browser test, NOT a
 * JavaScript test, and NOT an accessibility audit. It cannot see layout,
 * contrast, focus order, keyboard behaviour, filter logic or console errors.
 *
 * 🔑 AND IN THIS IDE THOSE ARE NOT OUT OF REACH — they are simply not THIS
 * script's job. `atf-cloud-runner__browser_*` drives a real browser, so once a
 * report is reachable by URL the runtime half of quality-checks.md can actually
 * be performed. Reporting "browser behaviour not tested" when the tooling was
 * available would be the false-completion claim the skill forbids.
 *
 * ─── WHERE IT IS WEAKER THAN THE PYTHON ────────────────────────────────────
 * The Python builds a real DOM with html.parser. Rhino has no HTML parser, so
 * these checks are regex approximations and are marked (approx) in the output:
 *
 *   • Accessible labels — attributes are read from a matched tag's raw text,
 *     so an unusual quoting style can be missed.
 *   • Inline handlers — matches `on…=` anywhere, so it can fire on text inside
 *     a string literal. It is a WARNING for that reason, as in the Python.
 *   • Visible text — tags are stripped rather than parsed, so the
 *     attribution-is-last check is positional, not structural.
 *
 * An approximation that over-reports as a warning is acceptable. One that
 * under-reports an ERROR is not, which is why the error set stays close to the
 * Python's.
 */

/* eslint-disable no-var */

function validateReport(html) {
  var errors = [];
  var warnings = [];
  var source = String(html || '');

  // ---- ES5 helpers. Rhino, so no endsWith / includes / arrow functions. ----
  function endsWithStr(text, suffix) {
    if (suffix.length > text.length) return false;
    return text.lastIndexOf(suffix) === text.length - suffix.length;
  }

  function allMatches(re, text, group) {
    var found = [];
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      found.push(m[group]);
      // Guard against a zero-width match spinning forever.
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return found;
  }

  function countMatches(re, text) {
    return allMatches(re, text, 0).length;
  }

  // ---- Visible text, with script/style/comments removed ------------------
  var visible = source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');

  // ---- Document shape ----------------------------------------------------
  if (!/<!doctype\s+html/i.test(source)) errors.push('Missing HTML doctype.');
  if (!/<html[^>]*\slang\s*=\s*["'][^"']+["']/i.test(source)) {
    errors.push('Missing document language.');
  }
  if (!/<meta[^>]*\sname\s*=\s*["']viewport["']/i.test(source)) {
    errors.push('Missing viewport metadata.');
  }

  var h1Count = countMatches(/<h1[\s>]/gi, source);
  if (h1Count !== 1) {
    errors.push('Expected exactly one h1; found ' + h1Count + '.');
  }

  // ---- Identity and anchors ----------------------------------------------
  var ids = allMatches(/\sid\s*=\s*["']([^"']+)["']/gi, source, 1);
  var seen = {};
  var dupes = {};
  var i;
  for (i = 0; i < ids.length; i++) {
    if (seen[ids[i]]) dupes[ids[i]] = true;
    seen[ids[i]] = true;
  }
  var dupeList = Object.keys(dupes).sort();
  if (dupeList.length) errors.push('Duplicate IDs: ' + dupeList.join(', '));

  var hrefs = allMatches(/\shref\s*=\s*["']([^"']*)["']/gi, source, 1);
  for (i = 0; i < hrefs.length; i++) {
    var href = hrefs[i];
    if (href.charAt(0) === '#') {
      if (href.length > 1 && !seen[href.substring(1)]) {
        errors.push('Broken local anchor: ' + href);
      }
    } else if (!/^(https?|mailto|tel):/i.test(href)) {
      errors.push('Review nonstandard or relative link: ' + href);
    }
  }

  // ---- Self-containment ---------------------------------------------------
  // A src on <script> means the report needs a runtime it does not carry.
  if (/<script[^>]*\ssrc\s*=/i.test(source)) {
    errors.push('External JavaScript runtime is not self-contained.');
  }
  if (/<(iframe|embed|object)[\s>]/i.test(source)) {
    warnings.push('Review embeds for privacy and offline support.');
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(source)) {
    warnings.push('(approx) Prefer registered event listeners over inline handlers.');
  }
  if (source.indexOf('innerHTML') !== -1 ||
      source.indexOf('dangerouslySetInnerHTML') !== -1) {
    warnings.push('Review HTML injection sites; retrieved text must not be trusted markup.');
  }
  if (source.indexOf('https://www.servicenow.com/') !== -1) {
    warnings.push('Remote font resources may require network access; check strict-offline requirements.');
  }

  // ---- Accessible labels on form controls (approx) ------------------------
  var labelFor = {};
  var fors = allMatches(/<label[^>]*\sfor\s*=\s*["']([^"']+)["']/gi, source, 1);
  for (i = 0; i < fors.length; i++) labelFor[fors[i]] = true;

  var controlRe = /<(input|select|textarea)\b([^>]*)>/gi;
  var c;
  controlRe.lastIndex = 0;
  while ((c = controlRe.exec(source)) !== null) {
    var attrs = c[2] || '';
    if (/\stype\s*=\s*["']hidden["']/i.test(attrs)) continue;

    var idMatch = /\sid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    var ownId = idMatch ? idMatch[1] : null;
    var named =
      /\saria-label\s*=\s*["'][^"']+["']/i.test(attrs) ||
      /\saria-labelledby\s*=\s*["'][^"']+["']/i.test(attrs) ||
      (ownId && labelFor[ownId]);

    if (!named) {
      errors.push('(approx) Form control lacks a recognized accessible label: ' +
        (ownId || '(no ID)'));
    }
    if (c.index === controlRe.lastIndex) controlRe.lastIndex++;
  }

  // ---- Attribution. The skill's hardest output rule. ---------------------
  var ATTRIBUTION = 'Made with ServiceNow EmployeeWorks';

  var footers = [];
  var footerRe = /<footer[\s\S]*?<\/footer>/gi;
  var f;
  footerRe.lastIndex = 0;
  while ((f = footerRe.exec(source)) !== null) {
    footers.push(f[0]);
    if (f.index === footerRe.lastIndex) footerRe.lastIndex++;
  }

  if (!footers.length) {
    errors.push('No footer element; final attribution cannot be the last visible content.');
  } else {
    var lastFooter = footers[footers.length - 1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
    if (!endsWithStr(lastFooter, ATTRIBUTION)) {
      errors.push('Final footer attribution missing or incorrect.');
    }
  }
  if (!endsWithStr(visible, ATTRIBUTION)) {
    errors.push('(approx) Visible document content follows the required attribution.');
  }

  // ---- Unresolved authoring scaffold -------------------------------------
  var scaffold = [
    'REPORT_TITLE',
    'Replace with',
    'actual retrieved source-title link',
    'Report scope and verified date'
  ];
  for (i = 0; i < scaffold.length; i++) {
    if (visible.indexOf(scaffold[i]) !== -1) {
      errors.push('Unresolved authoring scaffold: ' + scaffold[i]);
    }
  }
  if (/\b(?:TODO|FIXME)\b/.test(visible) || /\{\{[^}]+\}\}/.test(visible)) {
    warnings.push('Possible unresolved placeholder in visible text.');
  }

  // ---- Brand floor, from SKILL.md's non-negotiable output rules ----------
  // Not in the Python. Cheap, statically decidable, and each one is an
  // explicit rule rather than a judgement about appearance.
  if (source.indexOf('#032D42') === -1) {
    warnings.push('Infinite Blue #032D42 not found; it must be the primary colour.');
  }
  if (/font-family/i.test(source) && !/Arial/i.test(source)) {
    warnings.push('No Arial fallback alongside ServiceNow Sans.');
  }
  if (!/@media\s+print/i.test(source)) {
    warnings.push('No print styles; full-report print is a default utility action.');
  }
  if (!/<svg/i.test(source)) {
    warnings.push('No inline SVG; the supplied logo must be embedded, not linked.');
  }

  var text =
    '[validate-report] ' + errors.length + ' error(s), ' +
    warnings.length + ' warning(s).\n' +
    'Static inspection only. Browser behaviour NOT tested by this script —\n' +
    'use atf-cloud-runner__browser_* for the runtime half of quality-checks.md.\n';

  for (i = 0; i < errors.length; i++) text += 'ERROR:   ' + errors[i] + '\n';
  for (i = 0; i < warnings.length; i++) text += 'WARNING: ' + warnings[i] + '\n';

  return {errors: errors, warnings: warnings, text: text};
}

// ─── Example call. Replace the string with the report being delivered. ─────
// Emitted under one tagged line so it survives the session's verbose SQL
// logging, the same reason the PDF Generation skill tags its result.
var REPORT_HTML = '<!doctype html><html lang="en"></html>';
gs.info(validateReport(REPORT_HTML).text);

// Made with ServiceNow EmployeeWorks
