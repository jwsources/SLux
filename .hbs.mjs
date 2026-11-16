/**
 * Computed handlebars placeholders for this template.
 *
 * now-sdk loads this hook after extracting the template and before rendering any of its
 * files, so the helpers registered here resolve `` tokens in every other
 * file. The hook itself is removed rather than scaffolded into the project.
 *
 * Must stay self-contained: it runs before the scaffolded project's dependencies are
 * installed, so imports cannot be resolved.
 *
 * The generated projectId is not validated here — the build doctor owns that contract
 * (lowercase letters and digits with single `_` or `-` separators, at least 4
 * characters) and reports on it.
 */

// Joins the parts into an identifier restricted to [a-z0-9_] — nothing else.
//
// Every run of characters outside a-z0-9 collapses to a single underscore, so dashes,
// whitespace, dots, slashes and existing underscores all normalize the same way. Keep it
// that way: a projectId that mixes dashes and underscores is hard to read and hard to
// repeat from memory, and this value is a stable record-identity key. In particular, do
// not add `-` to the character class — that is what allows the mixing.
//
// Leading and trailing underscores are trimmed last, so a missing half of the input
// cannot leave a dangling separator ('x_snc_acme_', or a lone '_' when both halves are
// empty). An input with nothing usable yields '', which the build doctor rejects.
const sanitizeProjectId = (...parts) =>
  parts
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export default function (hbs, {data}) {
  hbs.registerHelper('basename', () => data.packageName);
  hbs.registerHelper('projectId', () =>
    sanitizeProjectId(data.scope, data.packageName)
  );
}
