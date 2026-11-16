`# Remote path — reaching the hint library over REST

For an instance where the Hints Knowledge Base app is **not** installed. Needs no
metadata on this instance: paste the script into `run_script` and go.

> **MCP is not required and is not involved.** The MCP server is a wrapper over
> these same two REST operations. If MCP will not connect, this path is unaffected.

## The endpoints — measured, not inferred

```
GET https://<host>/api/x_snc_hints_knowle/hints/find_hint?query=<text>&limit=<n>
GET https://<host>/api/x_snc_hints_knowle/hints/hint_retrieval?slug=<slug>
```

🛑 **No `/v1/` segment.** The service is `is_versioned=0` and its
`operation_uri` reads `/api/x_snc_hints_knowle/hints/find_hint` — verified from
`sys_ws_definition.base_uri` plus `sys_ws_operation.relative_path`, which is the
pair that actually serves. A version segment returns `400 Requested URI does not
represent any resource`, and that failure leaves **no** server-side trace — it is
rejected before dispatch, so there is nothing to debug at the far end.

🛑 **No `/api/api/`.** The path above is complete; do not prepend `/api/` again.

## 🛑 FIX AUTHENTICATION FIRST — 401 PRECEDES ROUTING

**MEASURED on these endpoints.** Five URLs called with deliberately invalid basic
auth — the two correct paths, a `/v1/` variant, a doubled `/api/` variant, and a
operation name that does not exist. **All five returned exactly `401`** with
`{"error":{"message":"User is not authenticated"}}`.

So while the caller is unauthenticated, **a wrong URL is indistinguishable from a
wrong credential.** Every routing mistake also reads 401.

| Consequence | |
|---|---|
| Debug order is fixed | Get a `200` on *any* operation before you touch the URL. Tuning a path against a 401 is chasing a symptom the path does not control |
| A 401 proves nothing about the URL | It does not confirm the endpoint exists, and it does not confirm it is absent |
| `400 Requested URI…` only appears **after** auth succeeds | So a 400 is useful — it means your credentials are fine and the path is wrong |

## Credentials — the account exists; two roles, and a 401 is not an empty library

**Use the dedicated service account `hints_api` on crmai.** It is created, active
and verified working — do not create a temp user per test.

| | |
|---|---|
| `user_name` | `hints_api` |
| `web_service_access_only` | **true** — it cannot log into the UI, so a leaked password cannot be used to sign in. The platform also sets `identity_type = Machine` automatically |
| Roles | `snc_internal`, `x_snc_hints_knowle.hint_reader` |
| Password | **not in this file, and not readable from the credential record** — see *Reading the credential* below. Set it once via `setup-credential.md`; after that the client resolves it through the connection alias |

⚠ `snc_internal` carries an inherited role — the account reads **three** roles,
the third being `snc_required_script_writer_permission`. Expected, not a
mis-grant.

Why these two:

| Role | Gate it clears |
|---|---|
| `snc_internal` | the scripted-REST default ACL — both operations carry `requires_snc_internal_role=1` |
| `x_snc_hints_knowle.hint_reader` | reading the hint records themselves |

🛑 **Missing `hint_reader` is the dangerous failure: the call SUCCEEDS and returns
ZERO records**, which reads as *no such knowledge exists* rather than as an access
problem. Treat a `200` with `count: 0` on a query you expect to match as an
authorisation suspect, not a knowledge gap.

`web_fetch` cannot be used — it forwards no credentials, so it gets 401.

## Verified response shapes

All four measured over HTTPS with the real credential.

| Call | Result |
|---|---|
| `find_hint?query=…&limit=3` | **200**. `{query, limit, count, similarity_metric, document_match_threshold, results[]}` wrapped in `result`. Rows carry `rank, slug, title, summary, load_when, boundary, category, verification_status, verified_date, body_chars, match_source, similarity, tokens_matched` — **and no `body`**, confirmed |
| `hint_retrieval?slug=<valid>` | **200**. Adds `found`, `tags`, `related_hints`, `scope_applicability`, `active` and **`body`** |
| `hint_retrieval?slug=<unknown>` | **404** with `{"result":{"error":"not_found","key":"…","message":"…never guess…"}}` — a statement about the library, not a fault |
| `/v1/` in the path, authenticated | **400** `Requested URI does not represent any resource` |

Observed similarity spread on a sharp query: **0.883 / 0.821 / 0.797**. That is
the whole usable range — which is why the rule is to judge the *spread*, never an
absolute threshold.

## Reading the credential — the platform decrypts, not your script

Once `setup-credential.md` has run, the password lives in a `basic_auth_credentials`
record and the client resolves it through the connection alias. **Measured**, using
the verified call shape from `sn_ext_conn.XCCOAuthUtils` line 18:

```javascript
var info = new sn_cc.ConnectionInfoProvider().getConnectionInfo(ALIAS_SYS_ID);
var user = info.getCredentialAttribute('user_name');   // 'hints_api'
var pass = info.getCredentialAttribute('password');    // real plaintext
```

| Call | Measured result |
|---|---|
| `getCredentialAttribute('user_name')` | the username — **this is the key**, plaintext |
| `getCredentialAttribute('password')` | the real plaintext password, **not** a mask |
| `getCredentialAttribute('username')` | `null` — wrong key, fails silently |
| `getCredentialAttribute('access_token')` | `null` for basic auth; this is the OAuth key |
| `getConnectionUrl()`, `getDataSource()` | `undefined` on an `http_connection` — do not rely on them; carry the URL in the client |
| `getExtendedAttributes()` | returns an object |

🛑 **Do not read the password off the credential record directly.**
`cred.getDisplayValue('password')` returns a **fixed ten-asterisk mask** — measured:
length 10, every character code 42, whatever the real password's length.
`getValue` returns ciphertext. A client built that way sends the literal string
`**********` and gets a **401 indistinguishable from a wrong password**, while every
assertion on the record still looks correct. `ConnectionInfoProvider` is the only
read path that decrypts.

`ALIAS_SYS_ID` is the `sys_alias` row created by `setup-credential.md`, which prints
it as `ALIAS SYS_ID FOR THE AGENT`. Look it up by name rather than hardcoding if the
script may run on more than one instance.

## The client script

Resolves the credential through the alias, so no password appears in source.

```javascript
/**
 * Hint library - remote client. Paste into run_script on any instance that has
 * the credential + connection alias from setup-credential.md.
 */
(function () {

    // ---- CONFIG - the only lines you edit -------------------------------
    var HOST       = 'https://crmai.service-now.com';
    var ALIAS_NAME = 'Hints API crmai';   // sys_alias.name
    // --------------------------------------------------------------------

    var BASE = HOST + '/api/x_snc_hints_knowle/hints';

    // ---- Resolve the credential. The platform decrypts; reading the
    // password field directly yields a ten-asterisk MASK and a silent 401.
    var USER, PASS;
    (function () {
        var a = new GlideRecord('sys_alias');
        a.addQuery('name', ALIAS_NAME);
        a.setLimit(1);
        a.query();
        if (!a.next()) {
            throw new Error('connection alias not found: ' + ALIAS_NAME
                + ' - run setup-credential.md first');
        }
        var info = new sn_cc.ConnectionInfoProvider().getConnectionInfo(a.getUniqueValue());
        if (!info) {
            throw new Error('getConnectionInfo returned null for alias ' + ALIAS_NAME
                + ' - check an ACTIVE sys_connection points at it');
        }
        USER = info.getCredentialAttribute('user_name');   // NOT 'username'
        PASS = info.getCredentialAttribute('password');
        if (!USER || !PASS) {
            throw new Error('alias resolved but credential attributes are empty');
        }
    })();

    function call(op, params) {
        var qs = [];
        for (var k in params) {
            if (params.hasOwnProperty(k) && params[k] !== null && params[k] !== '') {
                qs.push(k + '=' + encodeURIComponent(params[k]));
            }
        }
        var url = BASE + '/' + op + (qs.length ? '?' + qs.join('&') : '');

        var r = new sn_ws.RESTMessageV2();
        r.setHttpMethod('get');
        r.setEndpoint(url);
        r.setBasicAuth(USER, PASS);
        r.setRequestHeader('Accept', 'application/json');
        r.setHttpTimeout(30000);

        var code, body;
        try {
            var resp = r.execute();
            code = parseInt(resp.getStatusCode(), 10);
            body = resp.getBody();
        } catch (e) {
            // A THROW IS A TRANSPORT FAILURE, NOT AN EMPTY LIBRARY.
            return { ok: false, why: 'transport: ' + e, code: -1 };
        }

        // Status semantics - each means something different about the LIBRARY
        if (code === 401 || code === 403) {
            return { ok: false, code: code,
                     why: 'AUTH - the caller lacks snc_internal and/or '
                        + 'x_snc_hints_knowle.hint_reader. NOT a statement about the library.' };
        }
        if (code === 404) {
            return { ok: false, code: code, notFound: true,
                     why: 'the slug does not exist. This IS a statement about the library.' };
        }
        if (code >= 500) {
            return { ok: false, code: code,
                     why: 'RETRIEVAL FAILED server-side. NOT evidence the hint is absent. Body: '
                        + (body || '').substring(0, 300) };
        }
        if (code !== 200) {
            return { ok: false, code: code, why: 'unexpected status. Body: '
                        + (body || '').substring(0, 300) };
        }

        var parsed;
        try { parsed = JSON.parse(body); }
        catch (pe) {
            return { ok: false, code: code,
                     why: 'response was not JSON - check the URL has no /v1/ and no doubled /api/. '
                        + 'First 200 chars: ' + (body || '').substring(0, 200) };
        }
        // Scripted REST wraps a returned object in `result`
        return { ok: true, code: code, data: (parsed && parsed.result) ? parsed.result : parsed };
    }

    // ---- STEP 1: search. Summaries only, never a body. -----------------
    function findHint(query, limit) {
        var res = call('find_hint', { query: query, limit: limit || 5 });
        if (!res.ok) { gs.error('[hint] ' + res.code + ' ' + res.why); return null; }

        var d = res.data || {};
        var rows = d.results || [];
        gs.info('[hint] query=' + JSON.stringify(d.query) + ' count=' + d.count
              + ' metric=' + d.similarity_metric + ' threshold=' + d.document_match_threshold);
        if (!rows.length) {
            gs.warn('[hint] ZERO results. Before concluding the knowledge is absent: re-run with a '
                  + 'query you KNOW matches as a control, and confirm hint_reader is held - a '
                  + 'missing role returns 200 with zero rows.');
            return d;
        }
        rows.forEach(function (h) {
            gs.info('[hint] ' + h.rank + '. ' + h.slug
                  + '  sim=' + h.similarity + '  src=' + h.match_source
                  + '  [' + h.verification_status + ']  ' + h.body_chars + ' chars');
            gs.info('       ' + h.summary);
            if (h.load_when) gs.info('       LOAD WHEN: ' + h.load_when);
            if (h.boundary)  gs.info('       DOES NOT OWN: ' + h.boundary);
        });
        gs.info('[hint] judge by the SPREAD of sim, not an absolute value. One row clearly ahead '
              + '= a match; a flat spread = the query was too vague.');
        return d;
    }

    // ---- STEP 2: one body, only when a summary is insufficient ---------
    function getHint(slug) {
        var res = call('hint_retrieval', { slug: slug });
        if (!res.ok) {
            if (res.notFound) gs.warn('[hint] no such slug: ' + slug + ' (never guess one)');
            else gs.error('[hint] ' + res.code + ' ' + res.why);
            return null;
        }
        var h = res.data || {};
        if (h.found === false) { gs.warn('[hint] no such slug: ' + h.key); return null; }
        gs.info('[hint] ' + h.slug + ' [' + h.verification_status + '] '
              + h.body_chars + ' chars  category=' + h.category);
        gs.info(h.body);
        if (h.verification_status === 'contradicted') {
            gs.error('[hint] CONTRADICTED - do not act on this record. Fix or escalate.');
        }
        return h;
    }

    // ---- RUN -----------------------------------------------------------
    findHint('<your question or an exact identifier>', 5);
    // getHint('<slug from the result above>');

})();
```

## Using it

1. **Search first.** `summary` is the answer surface and frequently answers
   outright. A body averages ~12,700 characters against ~650 for a summary — a
   body fetched to repeat a summary is pure waste.
2. **Check `body_chars`** before calling `getHint`.
3. **Never invent a slug.** An unknown slug 404s; a plausible-looking wrong one
   returns a different record that may contradict what you need.
4. **Honour `verification_status` and `boundary`** — see SKILL.md.

## Promoting it to a Script Include

If the remote instance will use this repeatedly, move the two functions into a
Script Include so the agent calls one method instead of pasting the script:

- `accessibleFrom: 'public'` only if something outside its scope calls it
- Resolve the credential through `sn_cc.ConnectionInfoProvider` as the client above
  does. `setBasicAuth` with a literal password means a secret in source; reading the
  password field directly yields a mask and a silent 401
- Keep the status-code discrimination exactly as above. Collapsing 401, 404 and
  500 into "no result" is what turns an access failure into a false
  *no such knowledge exists*

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401` on **every** URL you try, including ones you know are right | expected — **401 precedes routing.** Fix the credential first; URL errors are invisible until you authenticate |
| `401` and the password came from `getDisplayValue('password')` | you sent the ten-asterisk mask. Resolve via `sn_cc.ConnectionInfoProvider` instead |
| `getConnectionInfo` returns null | no **active** `sys_connection` points at that alias, or the alias name is wrong |
| `getCredentialAttribute` returns null for the user | wrong key — it is `user_name`, not `username` |
| `401` / `403` after a `200` worked elsewhere | missing `snc_internal` or `hint_reader` — **not** an empty library |
| `400 Requested URI does not represent any resource` | credentials are fine, the **path** is wrong: a `/v1/` segment or a doubled `/api/`. No server-side trace exists for this |
| `200` with `count: 0` on a query that should match | suspect `hint_reader` before suspecting the library |
| Response is not JSON | wrong URL shape — you are hitting a page, not the API |
| `500` | retrieval failed server-side; **not** evidence the hint is absent |
| Transport throw | network, DNS or TLS — nothing to do with the library |
`