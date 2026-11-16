# Sending feedback — `submit_feedback`

The library improves only if consumers report back. One endpoint, same
credential and alias as the read path.

```
POST https://<host>/api/x_snc_hints_knowle/hints/submit_feedback
Content-Type: application/json
```

**Exercised end to end from a remote instance — and it exposed a defect, now
fixed in source.** Four reports returned HTTP 201 while **every field stored
NULL**: record-level `create` was granted but **field-level `write` was not**, so
`GlideRecordSecure` inserted the row and dropped all values silently. It was
invisible because the 201 echoed local variables rather than the stored row, and
because an admin test bypasses the ACL entirely via `adminOverrides`.

Three fixes shipped: a `field: '*'` write ACL, the 201 now echoes the **re-read
row** and returns 500 `fields_not_stored` if nothing landed, and `hint_exists`
is documented as two-state on the record (a BooleanColumn cannot hold empty).

⚠ **Those fixes need a build+install before this endpoint stores anything.**
Until then every report inserts an empty row.

## When to send one

| Situation | `kind` |
|---|---|
| The record answered it | `helpful` |
| A claim in it is incorrect | `wrong` |
| It was true once, no longer is | `stale` |
| Right record, missing the detail you needed | `incomplete` |
| **Nothing in the library fitted** | `gap` |
| A `boundary` sent you to the wrong record | `boundary_misroute` |

🔑 **`gap` is the most valuable report and the easiest to skip.** When a search
returns nothing usable, that is not a dead end — the query itself becomes the
specification for a hint somebody can write. Send it.

## The contract

| Field | Required | Notes |
|---|---|---|
| `kind` | **yes** | one of the six above. Anything else is rejected 400 with the valid list — a free-text value would store and then be invisible to every triage filter |
| `short_description` | **yes** | one line, ≤200 |
| `query` | **for `gap`** | the search text you used. A gap report without it cannot be actioned, so it is refused |
| `slug` | **for every kind except `gap`** | a gap report has no record to point at |
| `comment` | no | detail, markdown, ≤20000. A stack trace is fine |
| `caller` | no | self-declared source instance or agent. Not authenticated — `sys_created_by` carries the real identity |

`state`, `active` and `hint_exists` are **not** caller-settable; a reporter
cannot mark its own row actioned.

## Reading the response

**201** returns `{accepted, sys_id, kind, slug, hint_exists, note}`.

`hint_exists` in the **response** is three-state:

| Value | Meaning |
|---|---|
| `true` | your slug resolves to a live hint |
| `false` | **you sent a slug that does not resolve** — retired, or mistyped. Check it with `find_hint` |
| `null` | no slug supplied, i.e. a gap report. Expected, not a miss |

⚠ **On the RECORD it is only two-state.** `hint_exists` is a BooleanColumn and a
boolean cannot hold empty, so a gap report also stores `false`. The `null` above
is derived by the handler from whether a slug was stored. **Anyone triaging must
read `hint_exists` together with `slug`** — `false` with an empty slug means
"gap report", not "broken reference".

| Status | Meaning |
|---|---|
| **400** | a field rule above was broken; the body names which and why |
| **401** | credential — see the auth rules in `remote-rest-client.md`. Says nothing about your report |
| **403** `insert_refused` | the caller lacks `x_snc_hints_knowle.hint_feedback_writer`. Nothing was written |
| **403** `field_create_denied` | the caller may create a row but not populate it. **Nothing was written and there is no row to clean up** — the handler refuses before inserting. Do not retry until the owner grants field-level `create` |
| **500** `fields_not_stored` | a row inserted empty and the handler **deleted it**. Check `orphan_deleted` in the body: `true` means nothing was recorded and a retry is safe once the grant is fixed; `false` means an orphan remains at the returned `sys_id` — **do not retry**, tell the owner |
| **500** other | a server-side fault before or during the insert. Nothing was recorded; safe to retry |

🛑 **A 403 or a `fields_not_stored` 500 is not a rejection of your feedback.**
Both are access results. `insert()` returns falsy when the record ACL refuses,
and returns a **sys_id over an empty row** when the field grant is missing —
neither throws, so the handler checks both explicitly rather than reporting a
success that wrote nothing.

⚠ **Never retry a 500 that returns a `sys_id` with `orphan_deleted: false`.** The
row exists. Retrying duplicates the report and leaves a second unattributable
row for the maintainer.

## Remote — add to the client in `remote-rest-client.md`

Reuses `USER` / `PASS` already resolved from the connection alias there.

```javascript
function sendFeedback(payload) {
    var r = new sn_ws.RESTMessageV2();
    r.setHttpMethod('post');
    r.setEndpoint(BASE + '/submit_feedback');
    r.setBasicAuth(USER, PASS);
    r.setRequestHeader('Accept', 'application/json');
    r.setRequestHeader('Content-Type', 'application/json');
    r.setRequestBody(JSON.stringify(payload));
    r.setHttpTimeout(30000);

    var code, body;
    try {
        var resp = r.execute();
        code = parseInt(resp.getStatusCode(), 10);
        body = resp.getBody() || '';
    } catch (e) {
        gs.error('[hint] feedback transport failed: ' + e);
        return null;
    }

    var parsed = null;
    try { parsed = JSON.parse(body); } catch (pe) {}
    var d = (parsed && parsed.result) ? parsed.result : parsed;

    if (code === 201 && d && d.accepted) {
        gs.info('[hint] feedback recorded: ' + d.sys_id + ' kind=' + d.kind);
        // false means the slug did NOT resolve - null means a gap report
        if (d.hint_exists === false) {
            gs.warn('[hint] the slug you reported does not resolve to a live hint: '
                  + d.slug + ' - it may be retired or mistyped');
        }
        return d;
    }

    // 403 is ACCESS, not a verdict on the report. 400 names the field rule.
    gs.error('[hint] feedback NOT recorded, HTTP ' + code + ': '
           + (d ? (d.error + ' - ' + d.message) : body.substring(0, 200)));
    return null;
}

// a gap report - the query is the specification for the missing hint
sendFeedback({
    kind: 'gap',
    short_description: 'No hint on cross-scope GlideRecord silent empty reads',
    query: 'cross scope GlideRecord returns nothing silently',
    caller: '<this instance or agent>'
});
```

## Local — no HTTP needed

On the instance hosting the library, insert directly. `GlideRecordSecure` so the
create ACL governs, and the business rule derives `hint_exists` either way.

```javascript
var fb = new GlideRecordSecure('x_snc_hints_knowle_feedback');
fb.initialize();
fb.setValue('kind', 'wrong');
fb.setValue('short_description', 'importBoundaries start is not always 0');
fb.setValue('slug', 'aiux-widget-development-guide');
fb.setValue('comment', 'A leading licence header pushes the first import down.');
var id = fb.insert();
// insert() returns FALSY on an ACL refusal without throwing - check it
gs.info(id ? 'recorded ' + id : 'REFUSED - missing hint_feedback_writer');
```

## Triage, for the library maintainer

```javascript
var g = new GlideRecord('x_snc_hints_knowle_feedback');
g.addQuery('state', 'new');
g.addQuery('active', true);
g.orderByDesc('sys_created_on');
g.query();
while (g.next()) {
    gs.info(g.getValue('kind') + ' | ' + g.getValue('short_description')
          + ' | slug=' + (g.getValue('slug') || '(gap)')
          + ' hint_exists=' + (g.getValue('hint_exists') || '(empty)')
          + ' | ' + g.getValue('sys_created_by'));
}
```

Read `hint_exists` **with** `slug`: `false` means a slug was supplied and does
not resolve; empty means none was supplied. Highest-value rows first — `gap`
reports carry a `query` that is already the brief for a new hint.

Correcting a hint from feedback is the **HINTS** skill's §4 targeted-correction
path, not a rewrite. Set `state` and `resolution` when done; `active = false`
archives without deleting.
