/**
 * probe-widget-source.js — read a widget's AUTHORED SOURCE from the instance.
 *
 * RUN IT WITH `run_script` (scope: your app). This is an ES5 server-side payload,
 * not a Node CLI. Set TAG below, then paste the whole file into run_script.
 *
 * Ports, like-for-like:
 *   fetch-widget-source.js        the two queries + the freshness stamp
 *   lib/widget-api-summary.js     extractAuthoredSource / withServerScript /
 *                                 detectOrigin / hasServerScript / importSpecifier
 *   lib/instance-source.js        queryTable -> GlideRecord (pagination is native;
 *                                 sysparm_display_value=false -> getValue())
 *
 * NOT ported, and why: credential resolution (.env / aiux.json / SN_SDK_* / alias),
 * HTTP pagination, network error classification and the disk cache. All of it existed
 * only because the original ran as a separate OS process with no session. run_script
 * is already authenticated, and the query IS the cheap path.
 *
 * WHY THE SOURCE IS EXTRACTED SERVER-SIDE: `sourcemap` is ~10x the size of the source
 * it carries. Pulling the raw column into an agent's context floods it. This returns
 * only the authored files.
 */

// ---------------------------------------------------------------- configure
var TAG = '';        // sys_aix_widget.id  (REQUIRED, e.g. 'aiux-toast-notification-widget')
var SCOPE = '';      // optional sys_scope.scope, to disambiguate a tag reused across scopes
var MAX_CHARS = 0;   // 0 = print whole files; set e.g. 40000 to clip very large ones

// ---------------------------------------------------------------- helpers
function parseJsonSafe(value) {
    if (!value) return null;
    try { return JSON.parse(value); } catch (e) { return null; }
}

/** sdk-built widgets carry a sourcemap and/or a compile asset; instance-authored do not. */
function detectOrigin(sourcemapRaw, compileMetaRaw) {
    var meta = parseJsonSafe(compileMetaRaw) || {};
    return (sourcemapRaw && sourcemapRaw.length > 0) || meta.asset ? 'sdk-built' : 'instance-authored';
}

/**
 * Every widget has a `script` value: the SDK writes a STUB IIFE with an empty body
 * into widgets with no server script, so a non-zero length proves NOTHING.
 * The body has to be inspected. Unrecognised wrapper -> treat any content as real.
 */
function hasServerScript(script) {
    if (!script) return false;
    var m = script.match(/\(\s*function\s*\([^)]*\)\s*\{([\s\S]*)\}\s*\)\s*\(/);
    if (!m) return script.replace(/^\s+|\s+$/g, '').length > 0;
    return m[1].replace(/^\s+|\s+$/g, '').length > 0;
}

/**
 * The authored source, as written by its author.
 *   sdk-built        -> sourcemap.sourcesContent[i] where sources[i] is not a dependency
 *                       (`component` is minified and is NOT the author's code)
 *   instance-authored -> `component` IS the original
 * `from === 'component-minified'` is the DEGRADED case: say so, never present it as source.
 */
function extractAuthoredSource(sourcemapRaw, component, origin) {
    var sm = parseJsonSafe(sourcemapRaw);
    var files = [];
    if (sm && Array.isArray(sm.sources) && Array.isArray(sm.sourcesContent)) {
        for (var i = 0; i < sm.sources.length; i++) {
            // node_modules is a proxy for "not the author's code" - good, not exact.
            // ../shared/foo.js counts as own, which is intended.
            if (String(sm.sources[i]).indexOf('node_modules') > -1) continue;
            var content = sm.sourcesContent[i];
            if (typeof content === 'string' && content.length) {
                files.push({path: sm.sources[i], content: content});
            }
        }
        if (files.length) return {files: files, from: 'sourcemap'};
    }
    if (!component) return {files: [], from: 'none'};
    return {
        files: [{path: '(component field)', content: component}],
        from: origin === 'sdk-built' ? 'component-minified' : 'component'
    };
}

// ---------------------------------------------------------------- probe
var FIELDS = ['sys_id', 'sys_updated_on', 'id', 'name', 'category', 'component',
              'sourcemap', 'script', 'component_compile_metadata',
              'dependent_widget_ids', 'chat_compatible', 'roles', 'sys_scope'];

var gr = new GlideRecord('sys_aix_widget');

// CONTROL 0 - the TABLE itself. An unknown table name is NOT caught at compile time,
// and a scope may not be able to query it at all.
gs.info('[control] isValid(sys_aix_widget) = ' + gr.isValid() + '  (MUST be true)');

// CONTROL 1 - field existence. MUST print one invalid:false and one invalid:true.
// If both read alike the probe is VOID (isValidField is the ONLY discriminator
// between a missing field and an existing-but-empty one: getValue() returns null
// for BOTH, so it can never tell them apart).
var missing = [];
for (var f = 0; f < FIELDS.length; f++) {
    if (!gr.isValidField(FIELDS[f])) missing.push(FIELDS[f]);
}
gs.info('[control] fields missing from sys_aix_widget: ' + (missing.length ? missing.join(',') : 'none'));
gs.info('[control] isValidField bogus_field_xx = ' + gr.isValidField('bogus_field_xx') + '  (MUST be false)');

if (!TAG) {
    // No tag given: list candidates so the probe is still useful. Deliberately
    // not a catalog - that is list-widgets.js.
    gs.info('[probe] TAG is empty. First 15 visible widget ids:');
    var l = new GlideRecord('sys_aix_widget');
    l.orderBy('name');
    l.setLimit(15);
    l.query();
    while (l.next()) {
        gs.info('   ' + l.getValue('id') + '   [' + l.getValue('category') + ']   ' + l.getValue('name'));
    }
} else {
    gr.addQuery('id', TAG);
    if (SCOPE) gr.addQuery('sys_scope.scope', SCOPE);
    gr.query();

    var rows = gr.getRowCount();
    gs.info('[probe] id=' + TAG + (SCOPE ? ' scope=' + SCOPE : '') + ' -> rows=' + rows);

    // CONTROL 2 - a filter on a field that does NOT exist is DISCARDED, not rejected:
    // the query then returns EVERY row. Cross-check the total a second way.
    var all = new GlideRecord('sys_aix_widget');
    all.query();
    var visibleTotal = all.getRowCount();
    gs.info('[control] total widgets visible to me = ' + visibleTotal +
            '  (if rows==' + visibleTotal + ' the id predicate was DISCARDED - treat result as VOID)');

    // sys_aix_widget is role-filtered: a before-query business rule appends
    // category!=internal^ORcategoryISEMPTY for callers without 'maint'. Page widgets
    // are commonly category=internal, so "not found" may mean "not visible to me".
    gs.info('[control] gs.hasRole(maint) = ' + gs.hasRole('maint') +
            '  (false => internal widgets are hidden from every query above)');
    var parent = new GlideRecord('sys_ux_widget');
    parent.addQuery('sys_class_name', 'sys_aix_widget');
    parent.query();
    gs.info('[control] same class on parent sys_ux_widget = ' + parent.getRowCount() +
            '  (gap vs ' + visibleTotal + ' is what the role filter is hiding)');

    if (rows === 0) {
        gs.info('[probe] NOT FOUND. Either the tag is wrong, or it is hidden by the role filter above.');
        gs.info('[probe] Report it as "set aside unverified", never as "no widget matched".');
    }

    while (gr.next()) {
        var sourcemapRaw = gr.getValue('sourcemap') || '';
        var component = gr.getValue('component') || '';
        var script = gr.getValue('script') || '';
        var origin = detectOrigin(sourcemapRaw, gr.getValue('component_compile_metadata'));
        var authored = extractAuthoredSource(sourcemapRaw, component, origin);

        if (hasServerScript(script)) {
            authored.files.push({path: '(server script)', content: script});
        }

        // Scope prefix is NOT derivable from the app name - it truncates at 18 chars.
        // Read sys_scope.scope, with a direct lookup as the control on the dot-walk.
        var scopePrefix = '' + gr.sys_scope.scope;
        var sc = new GlideRecord('sys_scope');
        var scopeDirect = sc.get(gr.getValue('sys_scope')) ? sc.getValue('scope') : '(lookup failed)';
        gs.info('[control] scope dot-walk=' + scopePrefix + ' direct=' + scopeDirect + ' (MUST match)');

        gs.info('=====================================================================');
        gs.info('  ' + gr.getValue('id') + '   sys_id=' + gr.getValue('sys_id'));
        // Coalesce EVERY displayed value with || '-'. Concatenating a raw getValue()
        // that returned null prints the 4-character text "null", which reads like a
        // real value at a glance - that is how a wrong conclusion looks evidenced.
        gs.info('  name            : ' + (gr.getValue('name') || '-'));
        gs.info('  scope           : ' + (scopeDirect || '-'));
        gs.info('  category        : ' + (gr.getValue('category') || '-'));
        gs.info('  origin          : ' + origin);
        gs.info('  source from     : ' + authored.from +
                (authored.from === 'component-minified'
                    ? '   <-- DEGRADED: sourcesContent missing, this is MINIFIED code'
                    : ''));
        gs.info('  updated         : ' + (gr.getValue('sys_updated_on') || '-') + '   <-- the version stamp; re-read every time');
        gs.info('  server script   : ' + (hasServerScript(script) ? 'YES (real body)' : 'no (absent or stub IIFE)'));
        gs.info('  chat compatible : ' + (gr.getValue('chat_compatible') || '-'));
        gs.info('  roles           : ' + (gr.getValue('roles') || '-'));
        gs.info('  depends on      : ' + (gr.getValue('dependent_widget_ids') || '-'));
        gs.info('  IMPORT          : @servicenow/glide-widgets/' + scopeDirect + '/' + gr.getValue('id'));
        gs.info('                    (an unimported custom element is SILENTLY INERT)');
        gs.info('=====================================================================');

        for (var j = 0; j < authored.files.length; j++) {
            var body = authored.files[j].content;
            if (MAX_CHARS > 0 && body.length > MAX_CHARS) {
                body = body.substring(0, MAX_CHARS) + '\n/* ...clipped at ' + MAX_CHARS + ' of ' + authored.files[j].content.length + ' chars... */';
            }
            gs.info('--- ' + authored.files[j].path + '  (' + authored.files[j].content.length + ' chars)\n' + body);
        }
        if (!authored.files.length) {
            gs.info('[probe] no authored source on this record (from=none).');
        }
    }
}

/*
 * DO NOT derive an API table from the source you just read. The pack removed exactly
 * that: regex extraction reported unmarked helpers as public API and could not say how
 * anything behaved. Dead heuristics with known false positives are worse than none.
 * Read the source and quote what it actually does.
 *
 * The server script is the CONTRACT for this.server.get(input): which input keys it
 * reads and what it writes into data. A guessed action ({action:'approve'} against a
 * script that only reads input.limit) round-trips successfully while doing NOTHING.
 */
