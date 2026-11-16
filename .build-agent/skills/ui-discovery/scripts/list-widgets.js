/**
 * list-widgets.js — the instance widget CATALOG: rank candidates for reuse.
 *
 * RUN IT WITH `run_script` (scope: your app). ES5 server-side payload, not a Node CLI.
 *
 * Ports, like-for-like:
 *   sync-widget-catalog.js        QUERY, INDEX_FIELDS, resolveScopes, computeDigest
 *   lib/widget-api-summary.js     summarizeWidget + hasServerScript + importSpecifier
 *   lib/instance-source.js        queryTable -> GlideRecord (pagination native)
 *
 * NOT ported, and why:
 *   manifest write / watermark / id-set reconcile  the manifest IS the live query here
 *   --check freshness verdict vocabulary           the digest is printed every run
 *   checkDeployTarget / sameInstance               needs a now-sdk alias; one instance here
 *   classifyInstanceError                          we see real errors
 *
 * For a selected widget's API, use probe-widget-source.js — this catalog deliberately
 * does NOT select `component` or `sourcemap` (one sourcemap measured at 302,765 chars).
 */

// ---------------------------------------------------------------- configure
var FILTER_SCOPE = '';   // '' = all scopes; else a scope prefix e.g. 'x_snc_html_guides'
var NAME_LIKE = '';      // '' = all; else a substring matched on name/description/best_for
var LIMIT = 0;           // 0 = no cap

/**
 * THE DISCOVERY QUERY — ported verbatim, and every clause is load-bearing.
 *
 * type=aix_widget MUST be a POSITIVE match. Page and layout records live in this same
 * table with an EMPTY type column, so a negative filter (type!=...) matches NOTHING and
 * silently drags plumbing records into your candidate list.
 *
 * category: keep platform + custom, exclude internal + system.
 *   internal — the author does not want it reused: @discoverable(false), or the decorator
 *              omitted (which reads as false). Also hardcoded on plumbing records — page
 *              widgets and an app's lifecycle module.
 *   system   — platform-created only; the SDK's enum cannot emit it.
 * Do NOT narrow to category=platform: it is self-declared and unenforced, and in practice
 * every discoverable widget is `custom`.
 */
var QUERY = 'type=aix_widget^category!=internal^category!=system^ORDERBYname';

// INDEX fields only — enough to RANK. component/sourcemap excluded by design.
var INDEX_FIELDS = ['sys_id', 'id', 'name', 'description', 'best_for', 'category', 'type',
                    'chat_compatible', 'input_schema', 'roles', 'sys_scope', 'sys_updated_on',
                    'script', 'component_compile_metadata', 'dependent_widget_ids'];

function trim(s) { return (s || '').replace(/^\s+|\s+$/g, ''); }

/** A non-zero `script` proves nothing: the SDK writes a STUB IIFE with an empty body. */
function hasServerScript(script) {
    if (!script) return false;
    var m = script.match(/\(\s*function\s*\([^)]*\)\s*\{([\s\S]*)\}\s*\)\s*\(/);
    if (!m) return trim(script).length > 0;
    return trim(m[1]).length > 0;
}

// ---------------------------------------------------------------- controls
var probe = new GlideRecord('sys_aix_widget');

// CONTROL 0 - the TABLE. An unknown table name is NOT caught at compile time.
gs.info('[control] isValid(sys_aix_widget) = ' + probe.isValid() + '  (MUST be true)');

// getValue() returns null for a MISSING field AND for an existing-but-EMPTY one, so it
// can never distinguish them. isValidField is the only discriminator.
var missing = [];
for (var f = 0; f < INDEX_FIELDS.length; f++) {
    if (!probe.isValidField(INDEX_FIELDS[f])) missing.push(INDEX_FIELDS[f]);
}
gs.info('[control] index fields missing: ' + (missing.length ? missing.join(',') : 'none'));
gs.info('[control] isValidField bogus_field_xx = ' + probe.isValidField('bogus_field_xx') + '  (MUST be false)');
gs.info('[control] gs.hasRole(maint) = ' + gs.hasRole('maint') +
        '  (false => category=internal rows are hidden from EVERY query below)');

// Unfiltered total, to detect a DISCARDED predicate (a filter on a non-existent field is
// dropped, not rejected: the query then returns every row).
var allRows = new GlideRecord('sys_aix_widget');
allRows.query();
var visibleTotal = allRows.getRowCount();

// THE control that proves why type=aix_widget must be positive: rows with an EMPTY type.
var emptyType = new GlideRecord('sys_aix_widget');
emptyType.addNullQuery('type');
emptyType.query();
gs.info('[control] rows in table=' + visibleTotal + ', of which type IS EMPTY=' + emptyType.getRowCount() +
        '  (those are page/layout records - a negative type filter would NOT exclude them)');

var parent = new GlideRecord('sys_ux_widget');
parent.addQuery('sys_class_name', 'sys_aix_widget');
parent.query();
gs.info('[control] parent sys_ux_widget same class=' + parent.getRowCount() +
        '  (gap vs ' + visibleTotal + ' is what the maint role filter hides)');

// ---------------------------------------------------------------- catalog
var gr = new GlideRecord('sys_aix_widget');
gr.addEncodedQuery(QUERY);
if (FILTER_SCOPE) gr.addQuery('sys_scope.scope', FILTER_SCOPE);
if (NAME_LIKE) {
    var q = gr.addQuery('name', 'CONTAINS', NAME_LIKE);
    q.addOrCondition('description', 'CONTAINS', NAME_LIKE);
    q.addOrCondition('best_for', 'CONTAINS', NAME_LIKE);
}
if (LIMIT > 0) gr.setLimit(LIMIT);
gr.query();

var matched = gr.getRowCount();
gs.info('[catalog] QUERY matched ' + matched + ' of ' + visibleTotal + ' visible rows' +
        (matched === visibleTotal ? '   <-- EQUAL to total: predicate may have been DISCARDED, treat as VOID' : ''));

// Scope join is REQUIRED, not an optimisation: the prefix truncates at 18 chars and
// cannot be derived from the app name. An unresolved scope means the widget is SKIPPED.
var rows = [], maxUpdated = '', digestCount = 0, skipped = 0, dupes = 0;
var seen = {};
while (gr.next()) {
    digestCount++;
    var updated = gr.getValue('sys_updated_on') || '';
    if (updated > maxUpdated) maxUpdated = updated;

    var scopeId = gr.getValue('sys_scope');
    var scopePrefix;
    if (!scopeId || scopeId === 'global') {
        scopePrefix = 'global';
    } else {
        var sc = new GlideRecord('sys_scope');
        scopePrefix = sc.get(scopeId) ? sc.getValue('scope') : '';
    }
    if (!scopePrefix) {
        gs.info('   ! unresolved sys_scope ' + scopeId + ' for ' + gr.getValue('id') + ' - SKIPPED');
        skipped++;
        continue;
    }

    // Key on scope.tag, NEVER on tag alone: `id` COLLIDES ACROSS SCOPES. Two rows
    // sharing a tag in different scopes are different widgets; de-duping on the tag
    // would silently discard one of them.
    var key = scopePrefix + '.' + gr.getValue('id');
    if (seen[key]) { gs.info('   ! duplicate ' + key + ' - SKIPPED'); dupes++; continue; }
    seen[key] = true;

    var description = gr.getValue('description') || '';
    var bestFor = gr.getValue('best_for') || '';
    // A row with neither cannot be ranked on merit - flag it rather than quietly
    // ranking it on its tag name.
    if (!description && !bestFor) gs.info('   ~ ' + key + ': no description or best_for - UNRANKABLE row');

    rows.push({
        key: key,
        scope: scopePrefix,
        tag: gr.getValue('id'),
        name: gr.getValue('name') || gr.getValue('id'),
        description: description,
        bestFor: bestFor,
        category: gr.getValue('category'),
        hasServerScript: hasServerScript(gr.getValue('script')),
        chatCompatible: gr.getValue('chat_compatible') === 'true' || gr.getValue('chat_compatible') === '1',
        roles: gr.getValue('roles') || '',
        dependsOn: gr.getValue('dependent_widget_ids') || '',
        updated: updated,
        importSpecifier: '@servicenow/glide-widgets/' + scopePrefix + '/' + gr.getValue('id')
    });
}

gs.info('[catalog] ' + rows.length + ' candidate(s)' +
        (skipped ? ', ' + skipped + ' skipped on unresolved scope' : '') +
        (dupes ? ', ' + dupes + ' duplicate key(s) skipped' : ''));
for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    gs.info('=== ' + r.key + '   [' + r.category + ']' +
            (r.hasServerScript ? '  +server' : '') +
            (r.chatCompatible ? '  +chat' : '') +
            (r.roles ? '  roles=' + r.roles : ''));
    gs.info('    name    : ' + r.name);
    if (r.description) gs.info('    desc    : ' + r.description);
    if (r.bestFor) gs.info('    bestFor : ' + r.bestFor);
    if (r.dependsOn) gs.info('    depends : ' + r.dependsOn);
    gs.info('    updated : ' + r.updated);
    // The IMPORT STATEMENT, not just the specifier - a side-effect import, then the tag.
    gs.info("    IMPORT  : import '" + r.importSpecifier + "';   then use <" + r.tag + "> in a template");
}

/*
 * DIGEST — the whole freshness contract, in one line.
 *   count      catches adds and deletes
 *   maxUpdated catches edits (an edit stamps the row "now", which can only raise the max)
 * Note it on first run; re-run this asset later and compare. A change in EITHER number
 * means the widget set moved and anything you remember may be stale. It cannot say WHICH
 * widget changed - probe-widget-source.js answers that per widget.
 */
gs.info('[digest] count=' + digestCount + ' maxUpdated=' + maxUpdated);

/*
 * NEXT STEPS, and the rules that outrank convenience:
 *  - Rank ALL candidates together. `platform` is a tie-breaker over `custom`, never grounds
 *    for rejection. Similar tag names imply NOTHING about a relationship.
 *  - LOCAL WINS over its own deployed copy: if a local widget matches a row by tag AND that
 *    row's scope is this project's scope, use the local source and ignore the row.
 *  - Read the selected widget's AUTHORED SOURCE with probe-widget-source.js before writing a
 *    line of markup. This catalog carries no properties, events, slots or server contract.
 *  - ADD THE IMPORT shown above. An unimported custom element is SILENTLY INERT: no error,
 *    no warning, an empty tag.
 *  - On a capability gap: SAY SO AND STOP for a decision. Never ship the covered part as if
 *    complete, and never fork a deployed widget into the project to work around it.
 */
