# Setup — create the `hints_api` service account

Run **once, on the instance that HOSTS the hint library** (the one with
`x_snc_hints_knowle_hint`). Every consuming instance then uses the same account.

Not needed if `hints_api` already exists — check first:

```javascript
var u = new GlideRecord('sys_user');
gs.info(u.get('user_name', 'hints_api') ? 'EXISTS ' + u.getUniqueValue() : 'ABSENT');
```

## What it creates

| | |
|---|---|
| `sys_user` | `hints_api`, `web_service_access_only = true` |
| Roles | `snc_internal` + `x_snc_hints_knowle.hint_reader` |
| Password | generated at runtime, printed once, **never written to source** |

`web_service_access_only` is the security control that matters: it blocks
interactive UI login, so a leaked password cannot be used to sign in. The
platform also flips `identity_type` to `Machine` on its own.

Both roles are read-only in effect — `hint_reader` grants read on the hint table
only, and `snc_internal` merely clears the scripted-REST default ACL. The blast
radius is the hint library's read surface.

⚠ A side effect to expect, not fix: `snc_internal` carries an inherited role, so
the finished account reads **three** roles — the third is
`snc_required_script_writer_permission`. Harmless here, but if your security
posture forbids it, that inheritance is the thing to examine rather than the
grant.

## The script

```javascript
/**
 * Create the hints_api service account. Run ONCE on the library host instance.
 * Idempotent: re-running resets the password and prints the new one.
 */
(function () {
    var out = [];
    var USERNAME = 'hints_api';
    var MARKER   = 'Hints Knowledge Base - remote read API service account';
    var ROLES    = ['snc_internal', 'x_snc_hints_knowle.hint_reader'];

    // ---- GUARD: the hint_reader role only exists where the app is installed.
    // Without this check the account is created with one role and every call
    // returns 200 with ZERO rows - which reads as an empty library.
    var probe = new GlideRecord('sys_user_role');
    if (!probe.get('name', 'x_snc_hints_knowle.hint_reader')) {
        gs.error('[setup] ABORT: role x_snc_hints_knowle.hint_reader not found. '
               + 'Run this on the instance that HOSTS the hint library, not on a consumer.');
        return;
    }

    // ---- generated here; not derived from anything guessable
    var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!@#';
    var PASS = '';
    for (var i = 0; i < 28; i++) {
        PASS += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    var gr = new GlideRecord('sys_user');
    var existed = gr.get('user_name', USERNAME);
    if (!existed) { gr.initialize(); gr.setValue('user_name', USERNAME); }

    gr.setValue('first_name', 'Hints');
    gr.setValue('last_name', 'API');
    gr.setValue('email', 'hints.api@example.invalid');
    gr.setValue('title', MARKER);
    gr.setValue('active', true);
    gr.setValue('locked_out', false);
    gr.setValue('password_needs_reset', false);
    gr.setValue('web_service_access_only', true);

    // 🛑 setDisplayValue, NOT setValue. setValue stores the plaintext verbatim and
    // authentication then fails forever with a generic "invalid" message, with
    // nothing anywhere hinting that the STORED VALUE is the problem.
    gr.setDisplayValue('user_password', PASS);

    var uid = existed ? (gr.update(), gr.getUniqueValue()) : gr.insert();
    out.push((existed ? 'REUSED  ' : 'CREATED ') + uid);

    ROLES.forEach(function (rn) {
        var role = new GlideRecord('sys_user_role');
        if (!role.get('name', rn)) { out.push('ROLE NOT FOUND: ' + rn); return; }
        var has = new GlideRecord('sys_user_has_role');
        has.addQuery('user', uid);
        has.addQuery('role', role.getUniqueValue());
        has.query();
        if (has.next()) { out.push('already has ' + rn); return; }
        var ins = new GlideRecord('sys_user_has_role');
        ins.initialize();
        ins.setValue('user', uid);
        ins.setValue('role', role.getUniqueValue());
        out.push((ins.insert() ? 'granted ' : 'FAILED  ') + rn);
    });

    // ---- CONTROLS. A success message is not evidence; re-read the row.
    var v = new GlideRecord('sys_user');
    v.get(uid);
    var stored = v.getValue('user_password') || '';

    out.push('--- ASSERTIONS ---');
    out.push('HASHED OK      = ' + (stored !== PASS && stored.length > 50)
           + '   (plaintext ' + PASS.length + ' -> stored ' + stored.length + ')');
    out.push('ws_only (no UI) = ' + v.getValue('web_service_access_only'));
    out.push('active          = ' + v.getValue('active'));

    var fin = new GlideRecord('sys_user_has_role');
    fin.addQuery('user', uid);
    fin.query();
    var got = [];
    while (fin.next()) got.push(fin.getDisplayValue('role'));
    got.sort();
    out.push('roles           = ' + got.join(', '));
    out.push('hint_reader held = ' + (got.join(',').indexOf('hint_reader') > -1));
    out.push('snc_internal held = ' + (got.indexOf('snc_internal') > -1));

    out.push('--- STORE THIS NOW. IT IS NOT RECOVERABLE. ---');
    out.push('user_name = ' + USERNAME);
    out.push('password  = ' + PASS);
    out.push('Put it in a credential record on each consuming instance; never in source.');

    gs.info(out.join('\n'));
})();
```

**`HASHED OK = false` means stop.** The password landed as plaintext and every
call will 401 regardless of roles. Re-run; do not debug the client.

## Then prove it before handing it out

Same instance is fine — the call goes out over HTTPS and back, so it exercises
the real path.

```javascript
var r = new sn_ws.RESTMessageV2();
r.setHttpMethod('get');
r.setEndpoint('https://<host>/api/x_snc_hints_knowle/hints/find_hint?query=GlideAggregate&limit=2');
r.setBasicAuth('hints_api', '<the password printed above>');
r.setRequestHeader('Accept', 'application/json');
var resp = r.execute();
gs.info('HTTP ' + resp.getStatusCode());
gs.info(resp.getBody());
```

| Result | Meaning |
|---|---|
| **200** with `count > 0` | done — hand the credential over |
| **200** with `count: 0` | `hint_reader` did not attach. Re-read the roles; do **not** conclude the library is empty |
| **401** | the hash failed, or the account is inactive / locked. Check `HASHED OK` first |
| **400** | credentials are fine, the URL is wrong — see the endpoint rules in this folder |

## Storing it on each consumer

Put the password in a `basic_auth_credentials` record with a `sys_connection` and
`sys_alias`, and have the client read the alias. `setBasicAuth` with a literal
password is acceptable for a one-off `run_script` probe and **not** acceptable in
a Script Include, a Business Rule or anything committed.

## Rotation and teardown

```javascript
// ROTATE - same script re-run, or just the password:
var g = new GlideRecord('sys_user');
if (g.get('user_name', 'hints_api')) {
    var p = 'paste-a-new-generated-value';
    g.setDisplayValue('user_password', p);   // setDisplayValue, always
    g.update();
    gs.info('rotated - update every consumer credential record');
}

// DISABLE - reversible, preferred over delete:
// g.setValue('active', false); g.update();
```

Deleting the account orphans a `cmn_notif_device` row created automatically on
insert. Deactivating is reversible and leaves the audit trail intact.
