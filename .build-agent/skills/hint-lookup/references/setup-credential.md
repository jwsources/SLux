# Setup — credential and connection alias on a consuming instance

Run **once per consuming instance**, in Background Scripts, global scope.
Idempotent. Needs the `hints_api` password from the library host.

This creates the local records so the client reads an alias instead of carrying a
password in source. It does **not** create the service account — that already
exists on the host (see `setup-service-account.md`).

## Why the script is shaped this way

Four platform behaviours force the structure below. Each one fails silently or
describes itself wrongly, so the reason matters more than the instruction — an
author who knows only the rule will abandon it the moment it looks unnecessary.

**Every field before `insert()`, because validation runs on the in-flight record.**
`sys_connection` carries a before-insert rule that reads `connection_alias` and
calls `setAbortAction(true)` when it is nil, and another that reads
`connection_url` and runs `url.split('/')[2]` on it. Neither waits for the row to
exist, so the ordinary "insert a shell, then populate" idiom is rejected by
design. It fails as `ABORT - connection insert failed.: no thrown error` — no
field named, no rule named — so nothing in the failure points back at the
ordering that caused it.

**`type = 'connection'` is correct, and the error message argues otherwise.**
The abort prints *"alias must be of type Connection and Credential"*, which reads
like the name of a third value. It is the **label** of the value already being
set. `sys_alias.type` admits exactly two:

| value | label | rows |
|---|---|---|
| `connection` | **Connection and Credential** | 223 |
| `credential` | Credential | 21 |

An author who trusts the message will search for `connection_and_credential`,
fail to find it, and conclude the alias API is undocumented. The value was never
wrong; the diagnostic was.

**Look the connection up by `connection_alias`, because that is the uniqueness
key.** The rule enforces uniqueness across alias + `sys_domain` + `active` —
`name` is not part of it. A name-keyed lookup therefore misses an active
connection that already holds the alias, reports "none found", and drives an
insert that the same rule rejects for duplication. The symptom is a failure to
create something that already exists.

**Judge the result from the assertions, not the log.** Inserting an
`http_connection` triggers `Update MID Connection Cache`, which on an instance
with no MID server emits `java.lang.IllegalArgumentException: MID Server not
found with name: *` and roughly sixty Java frames. It is unrelated to the record
and harmless. A reader who treats log volume as evidence will debug a success.

Three values this script resolves at runtime rather than assuming, because they
vary by instance: `discovery_credentials.type` (observed `basic_auth`),
`http_connection.base_path` (observed present), and
`sys_alias.connection_type`. For scale when reading the hash assertion, a
17-character password stores as 110 characters.

## The script

```javascript
/**
 * Credential + connection alias for the crmai hint library, with assertions
 * and a live end-to-end probe. Idempotent.
 * Run in Background Scripts, GLOBAL scope.
 */
(function () {

    var HOST     = 'https://crmai.service-now.com';
    var BASE     = '/api/x_snc_hints_knowle/hints';
    var USER     = 'hints_api';
    var PASSWORD = '!TEMP_PASSWORD_01';

    var CRED_NAME  = 'Hints API - crmai';
    var ALIAS_NAME = 'Hints API crmai';
    var CONN_NAME  = 'Hints API connection - crmai';

    var out = [];

    // The shipped value is a temporary password that must be rotated on the
    // host before it authenticates. Replace it here by hand; never paste a
    // working password into a chat, a commit, or a script-execution record.
    if (PASSWORD.indexOf('<<<') === 0) {
        gs.error('[hints-cred] ABORT - set PASSWORD to the real hints_api password first.');
        return;
    }

    // ---- 0. Field guards. An absent field is a SILENT no-op on write.
    var cg = new GlideRecord('http_connection');
    if (!cg.isValid()) { gs.error('[hints-cred] ABORT - http_connection not available.'); return; }
    var HAS_BASE_PATH = cg.isValidField('base_path');
    out.push('http_connection.base_path present = ' + HAS_BASE_PATH
        + (HAS_BASE_PATH ? '' : '  -> the client must carry the full path itself'));

    // ---- 1. Credential type. basic_auth_credentials sets sys_class_name, which
    // governs on its own; `type` is a discovery_credentials column. Resolve it,
    // and if the list carries no basic entry leave it unset rather than guessing.
    var credType = null, seen = [];
    var ch = new GlideRecord('sys_choice');
    ch.addEncodedQuery('name=discovery_credentials^element=type');
    ch.query();
    while (ch.next()) {
        var cv = ch.getValue('value');
        if (cv) {
            seen.push(cv);
            if (!credType && cv.toLowerCase().indexOf('basic') >= 0) { credType = cv; }
        }
    }
    out.push(credType
        ? 'credential type resolved: ' + credType
        : 'no basic type in choice list (saw: ' + seen.join(', ')
          + ') - leaving type unset, class governs');

    // ---- 2. Credential
    var cred = new GlideRecord('basic_auth_credentials');
    cred.addQuery('name', CRED_NAME);
    cred.setLimit(1);
    cred.query();
    var credId;
    if (cred.next()) {
        credId = cred.getUniqueValue();
        out.push('credential existed: ' + credId);
    } else {
        cred.initialize();
        cred.setValue('name', CRED_NAME);
        cred.setValue('user_name', USER);
        if (credType) { cred.setValue('type', credType); }
        cred.setValue('active', true);
        cred.setDisplayValue('password', PASSWORD);
        credId = cred.insert();
        if (!credId) { gs.error('[hints-cred] ABORT - credential insert failed.'); return; }
        out.push('credential created: ' + credId);
    }
    // Re-fetch and set unconditionally so a re-run also rotates the password.
    cred = new GlideRecord('basic_auth_credentials');
    cred.get(credId);
    cred.setValue('user_name', USER);
    if (credType) { cred.setValue('type', credType); }
    cred.setValue('active', true);
    // `password` is password2 (encrypted). setDisplayValue runs the encrypter;
    // setValue stores the literal and every auth attempt then fails against a
    // correct-looking record. Since 401 precedes routing on these endpoints,
    // that failure is indistinguishable from a wrong URL.
    cred.setDisplayValue('password', PASSWORD);
    cred.update();
    out.push('credential set: user_name=' + USER);

    // ---- 3. Connection alias
    var alias = new GlideRecord('sys_alias');
    alias.addQuery('name', ALIAS_NAME);
    alias.setLimit(1);
    alias.query();
    var aliasId;
    if (alias.next()) {
        aliasId = alias.getUniqueValue();
        out.push('alias existed: ' + aliasId + ' (type=' + alias.getValue('type') + ')');
    } else {
        // connection_type is a choice - resolve rather than hardcode, and report
        // what was available if the expected value is absent.
        var connType = null, aseen = [];
        var ach = new GlideRecord('sys_choice');
        ach.addEncodedQuery('name=sys_alias^element=connection_type');
        ach.query();
        while (ach.next()) {
            var av = ach.getValue('value');
            if (av) { aseen.push(av); if (av === 'http_connection') { connType = av; } }
        }
        out.push(connType
            ? 'alias connection_type resolved: ' + connType
            : 'http_connection NOT in sys_alias.connection_type choices (saw: '
              + aseen.join(', ') + ') - setting it anyway, verify the alias afterwards');

        alias.initialize();
        alias.setValue('name', ALIAS_NAME);
        // 'connection' is the value whose LABEL is "Connection and Credential".
        // There is no separate connection_and_credential value.
        alias.setValue('type', 'connection');
        alias.setValue('connection_type', connType || 'http_connection');
        alias.setValue('multiple_connections', false);
        aliasId = alias.insert();
        if (!aliasId) { gs.error('[hints-cred] ABORT - alias insert failed.'); return; }
        out.push('alias created: ' + aliasId);
    }

    // ---- 4. HTTP connection.
    // Look up by connection_alias, NOT by name: alias + domain + active is the
    // uniqueness key the before-insert rule enforces, so a half-finished earlier
    // run is only found this way.
    var conn = new GlideRecord('http_connection');
    conn.addQuery('connection_alias', aliasId);
    conn.setLimit(1);
    conn.query();

    var connId;
    if (conn.next()) {
        connId = conn.getUniqueValue();
        conn.setValue('name', CONN_NAME);
        conn.setValue('connection_url', HOST);
        if (HAS_BASE_PATH) { conn.setValue('base_path', BASE); }
        conn.setValue('credential', credId);
        conn.setValue('active', true);
        conn.update();
        out.push('connection existed, updated: ' + connId);
    } else {
        // EVERY field before insert. The before-insert rule aborts on a nil
        // connection_alias, and another rule does url.split('/')[2] on
        // connection_url. A staged insert cannot pass either.
        conn.initialize();
        conn.setValue('name', CONN_NAME);
        conn.setValue('connection_url', HOST);
        if (HAS_BASE_PATH) { conn.setValue('base_path', BASE); }
        conn.setValue('connection_alias', aliasId);
        conn.setValue('credential', credId);
        conn.setValue('active', true);
        connId = conn.insert();
        if (!connId) {
            gs.error('[hints-cred] ABORT - connection insert failed. The aborting rule '
                   + 'logs to background messages; the commonest causes are a nil '
                   + 'connection_alias, an empty connection_url, or another ACTIVE '
                   + 'connection already holding this alias.');
            return;
        }
        out.push('connection created: ' + connId);
    }

    // ---- 5. Assertions - re-read, do not trust the setters
    var vc = new GlideRecord('basic_auth_credentials');
    vc.get(credId);
    var stored = vc.getValue('password') || '';
    var hashedOk = (stored !== PASSWORD && stored.length > 50);

    var v = new GlideRecord('http_connection');
    v.get(connId);

    out.push('');
    out.push('--- ASSERTIONS ---');
    out.push('HASHED OK      = ' + hashedOk
        + '   (plaintext ' + PASSWORD.length + ' -> stored ' + stored.length + ')');
    out.push('cred user_name = ' + vc.getValue('user_name')
        + ', type=' + vc.getValue('type') + ', active=' + vc.getValue('active'));
    out.push('connection_url = ' + v.getValue('connection_url'));
    if (HAS_BASE_PATH) { out.push('base_path      = ' + v.getValue('base_path')); }
    out.push('alias          = ' + v.getDisplayValue('connection_alias')
        + ' (' + v.getValue('connection_alias') + ')');
    out.push('credential     = ' + v.getDisplayValue('credential'));
    out.push('active         = ' + v.getValue('active'));

    if (!hashedOk) {
        out.push('');
        out.push('STOP - password stored as plaintext. Every call will 401 regardless of');
        out.push('roles. Re-run this script; do not debug the client.');
        gs.info('[hints-cred]\n' + out.join('\n'));
        return;
    }

    // ---- 6. Live probe over HTTPS. Literal basic auth is acceptable for a
    // one-off probe and not acceptable in anything committed. "GlideAggregate"
    // is known to match, so a zero result is interpretable rather than ambiguous.
    var r = new sn_ws.RESTMessageV2();
    r.setHttpMethod('get');
    r.setEndpoint(HOST + BASE + '/find_hint?query=GlideAggregate&limit=2');
    r.setBasicAuth(USER, PASSWORD);
    r.setRequestHeader('Accept', 'application/json');
    r.setHttpTimeout(30000);

    out.push('');
    out.push('--- LIVE PROBE ---');
    try {
        var resp = r.execute();
        var code = parseInt(resp.getStatusCode(), 10);
        var body = resp.getBody() || '';
        out.push('HTTP ' + code);
        if (code === 200) {
            var parsed = JSON.parse(body);
            var d = (parsed && parsed.result) ? parsed.result : parsed;
            out.push('count=' + d.count + ' metric=' + d.similarity_metric
                + ' threshold=' + d.document_match_threshold);
            if (!d.count) {
                out.push('200 WITH ZERO ROWS -> hint_reader is not attached to hints_api');
                out.push('on the HOST. The library is NOT empty.');
            } else {
                var k;
                for (k = 0; k < d.results.length; k++) {
                    out.push('  ' + d.results[k].rank + '. ' + d.results[k].slug
                        + ' sim=' + d.results[k].similarity
                        + ' [' + d.results[k].verification_status + '] '
                        + d.results[k].body_chars + ' chars');
                }
            }
        } else if (code === 401) {
            out.push('401 - the credential does not authenticate on the HOST. The local');
            out.push('HASHED OK above only proves this instance stored it correctly, not');
            out.push('that it matches. Causes: hints_api does not exist on the host, the');
            out.push('password differs, or the account is inactive/locked. 401 precedes');
            out.push('routing, so this says NOTHING about the URL - do not touch the path.');
        } else if (code === 400) {
            out.push('400 - credential is fine, the path is wrong (no /v1/, no doubled /api/).');
        } else {
            out.push('body: ' + body.substring(0, 300));
        }
    } catch (e) {
        out.push('transport failure (network/DNS/TLS), not a library problem: ' + e);
    }

    out.push('');
    out.push('ALIAS SYS_ID FOR THE AGENT: ' + aliasId);
    out.push('CONNECTION SYS_ID: ' + connId);

    gs.info('[hints-cred]\n' + out.join('\n'));

})();
```

## Reading the result

Ignore the MID-server stack trace (trap 4). Read the assertions block.

| Outcome | Meaning |
|---|---|
| `ABORT - connection insert failed` | a field was empty at insert, or another **active** connection already holds the alias. Not a permissions problem |
| `HASHED OK = false` | stop. The password is plaintext locally; every call 401s regardless of roles. Re-run, do not debug the client |
| Probe **200**, `count > 0` | done. Hand the alias sys_id to whatever calls the API |
| Probe **200**, `count: 0` | `hint_reader` is not attached to `hints_api` **on the host**. The library is not empty |
| Probe **401** | the credential does not authenticate on the host — missing account, wrong password, or inactive/locked. `HASHED OK = true` does **not** exclude this: it only proves local storage. Says nothing about the URL |
| Probe **400** | credential is fine, the path is wrong |

The 401 case is the one that misleads. A correct local hash and a 401 together
mean the stored value is *well-formed but wrong* — go to the host and check the
account, not the path and not this script.

## After running it — open the credential in Build Agent

The script's assertions prove the **record** is well-formed. They cannot prove the
credential renders, decrypts or resolves its alias in the UI, and a credential
that looks perfect in a `GlideRecord` read can still fail to open. Confirm it on
the surface, not from the script output:

```
ui_diagnostics
  path:              /basic_auth_credentials.do?sys_id=<CREDENTIAL SYS_ID>
  tableName:         basic_auth_credentials
  applicationScope:  global
  applicationSysId:  global
  collectConsole:    true
  collectDOM:        true
```

Use the `CREDENTIAL SYS_ID` the script printed — never a remembered one.

Pass the record URL directly. A `/nav_to.do?uri=…` wrapper loads the full UI
frameset, which navigates the diagnostics panel away from itself and returns
`Panel not found after open` — a tool failure that collects no console and no DOM,
and so proves nothing either way.

| Look for | Meaning |
|---|---|
| Form renders, `User name` shows the service account | the record resolves and is readable in session |
| `Password` masked, not blank | the encrypted value is present and decryptable by the UI |
| Console errors mentioning `kmf`, `crypto` or `GlideEncrypter` | the key module did not restore; the probe will 401 no matter what the hash assertion said |
| A connection-related error on load | the alias is attached but mismatched — check `connection_type` against the connection's class |

Do the same for the connection record when the probe fails with anything other
than 401, substituting `path: /nav_to.do?uri=http_connection.do%3Fsys_id=<CONNECTION SYS_ID>`
and `tableName: http_connection`. A `400` with a healthy credential form points at
`connection_url` or `base_path`, both visible there.

## Teardown

```javascript
// Deactivate rather than delete - reversible, keeps the audit trail.
var c = new GlideRecord('http_connection');
if (c.get('<connection sys_id>')) { c.setValue('active', false); c.update(); }
```

Deactivating also releases the `connection_alias` uniqueness lock, so a later
re-run can insert a fresh connection against the same alias.
