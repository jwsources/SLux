# Probes — Phase 2: Large consumers

Loaded by the `diag-playbook` skill. **Read cost: ~19 KB.**
Read `references/probes-conventions.md` first — it holds the twelve conventions
and the two helpers every probe depends on.
Method: `references/procedure-phase2-consumers.md`.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| Probe | Serves |
|---|---|
| 2 | `§D`, `§C`, `§C2`, `§E` — one shared window so the overlap check is valid |
| 2b | `§D` step 3b — **mandatory** whenever probe 2 reports `sql%` and `br%` both near zero |
| 2c | `M-7` — outbound integration latency |
| 5 | `§E` — stuck vs merely slow |

---

## 2 — Find the large consumers

What actually consumes the instance, and whether cost is SQL, business rules, or
neither. **Serves `§D`, `§C`, `§C2`, `§E`.**

All four sections share one window so the overlap check is valid. **`§D` is
authoritative over `§C`** — `processing_duration` is a single sample. **Never add
the `§C` and `§C2` totals**; the handler job *is* the flow execution.

```javascript
(function phase2() {
    var HOURS = 6, CAP = 60000, FLOW_MIN = 60;
    function ms(dt) { return dt ? new GlideDateTime(dt).getNumericValue() : 0; }
    function pct(x) { return Math.round(x); }
    var now = new GlideDateTime().getNumericValue();

    function chk(t, f) {
        var g = new GlideRecord(t);
        if (!g.isValid()) { gs.error('[p2] NOT ACCESSIBLE: ' + t); return false; }
        var m = f.filter(function (x) { return !g.isValidField(x); });
        if (m.length) { gs.error('[p2] ' + t + ' MISSING: ' + m.join(',')); return false; }
        return true;
    }
    if (!(chk('syslog_transaction', ['response_time','sql_time','business_rule_time','sql_count','url','sys_created_on'])
        & chk('sys_trigger', ['name','repeat','processing_duration','run_count','sys_created_on','claimed_by'])
        & chk('sys_flow_context', ['flow','state','run_time','sys_created_on']))) {
        gs.error('[p2] ABORT'); return;
    }

    // ---- §D MEASURED (authoritative) ----
    var from = new GlideDateTime(); from.addSeconds(-HOURS * 3600);
    // The overlap check must compare the handler's max against the longest flow run_time
    // over the SAME window. Taking handler max from 6h and flow max from 60min makes the
    // check inconclusive BY CONSTRUCTION — measured delta 2,851ms purely from window skew.
    var fwStart = new GlideDateTime(); fwStart.addSeconds(-FLOW_MIN * 60);
    var fwMs = fwStart.getNumericValue();
    var jobs = {}, n = 0, rtTot = 0, handlerMax = 0, handlerMaxFW = 0;
    var g = new GlideRecord('syslog_transaction');
    g.addQuery('sys_created_on', '>=', from.getValue());
    g.addQuery('url', 'STARTSWITH', 'JOB:');
    g.setLimit(CAP); g.query();
    while (g.next()) {
        n++;
        var rt = parseInt(g.getValue('response_time'), 10) || 0;
        rtTot += rt;
        var u = g.getValue('url') || '(none)';
        var o = jobs[u] || (jobs[u] = { n:0, rt:0, sq:0, br:0, max:0, q:0 });
        o.n++; o.rt += rt;
        o.sq += parseInt(g.getValue('sql_time'), 10) || 0;
        o.br += parseInt(g.getValue('business_rule_time'), 10) || 0;
        o.q  += parseInt(g.getValue('sql_count'), 10) || 0;
        if (rt > o.max) o.max = rt;
        if (u.indexOf('Flow Engine Event Handler') > -1) {
            if (rt > handlerMax) handlerMax = rt;
            if (ms(g.getValue('sys_created_on')) >= fwMs && rt > handlerMaxFW) handlerMaxFW = rt;
        }
    }
    gs.info('[p2] ===== §D MEASURED (' + HOURS + 'h) =====');
    gs.info('[p2] transactions=' + n + (n >= CAP ? '  **TRUNCATED — floor only**' : ''));
    gs.info('[p2] MEASURED TOTAL: ' + (rtTot / 3600000 * (24 / HOURS)).toFixed(2) + ' h/day');
    var dk = Object.keys(jobs).sort(function (a, b) { return jobs[b].rt - jobs[a].rt; });
    gs.info('[p2] distinct jobs=' + dk.length);
    dk.slice(0, 15).forEach(function (k) {
        var o = jobs[k];
        gs.info('[p2] ' + (o.rt / 3600000 * (24 / HOURS)).toFixed(2) + ' h/d x' + o.n
              + ' avg=' + Math.round(o.rt / o.n) + 'ms max=' + o.max + 'ms'
              + ' sql=' + pct(o.sq * 100 / (o.rt || 1)) + '%'
              + ' br='  + pct(o.br * 100 / (o.rt || 1)) + '%'
              + ' | ' + k.replace(/^JOB:\s*/, '').substr(0, 42));
    });
    gs.info('[p2] --- top 5 by QUERY COUNT (N+1 signal) ---');
    dk.slice().sort(function (a, b) { return jobs[b].q - jobs[a].q; }).slice(0, 5).forEach(function (k) {
        gs.info('[p2] q=' + jobs[k].q + ' x' + jobs[k].n + ' | ' + k.replace(/^JOB:\s*/, '').substr(0, 42));
    });

    // ---- §C EXTRAPOLATED, no duration floor ----
    var rows = [], dupes = {};
    var t = new GlideRecord('sys_trigger');
    t.addEncodedQuery('repeatISNOTEMPTY^run_count>50');
    t.query();
    while (t.next()) {
        var runs = parseInt(t.getValue('run_count'), 10) || 0;
        var dur  = parseInt(t.getValue('processing_duration'), 10) || 0;
        var cr   = ms(t.getValue('sys_created_on'));
        if (!runs || !cr) continue;
        var cad = ((now - cr) / 1000) / runs;
        if (cad <= 0) continue;
        var nm = t.getValue('name');
        dupes[nm] = (dupes[nm] || 0) + 1;
        // SERIAL CAP (convention 10). When a pass lasts longer than the observed gap
        // between passes, runs_per_day x duration double-counts: the passes cannot have
        // been serial. One job name cannot exceed 24 h/day per concurrent claim, so cap
        // there and LABEL it — an uncapped row produced 284 h/day for a job measured at 25.
        var raw = (86400 / cad) * dur;
        var serial = raw > 86400000;
        rows.push({ n:nm, dur:dur, cad:cad, perDay:86400/cad,
                    cost: serial ? 86400000 : raw, raw:raw, serial:serial,
                    cfg:ms(t.getValue('repeat'))/1000 });
    }
    var cTot = 0, cSerial = 0;
    rows.forEach(function (r) { cTot += r.cost; if (r.serial) cSerial++; });
    var nodes = 0;
    var cl = new GlideRecord('sys_cluster_state');
    if (cl.isValid()) { cl.addQuery('status', 'online'); cl.query(); nodes = cl.getRowCount(); }
    gs.info('[p2] ===== §C EXTRAPOLATED (no floor) =====');
    gs.info('[p2] jobs=' + rows.length + '  TOTAL: ' + (cTot / 3600000).toFixed(2) + ' h/day'
          + '  serial-capped rows=' + cSerial);
    gs.info('[p2] ^ §D is authoritative for frequent jobs; §C covers rare ones §D cannot see');
    if (nodes) gs.info('[p2] online nodes=' + nodes + ' => a SINGLE job above 24 h/day is impossible;'
          + ' totals far above ' + (nodes * 24) + ' h/day of wall clock need a concurrency explanation');
    rows.sort(function (a, b) { return b.cost - a.cost; });
    rows.slice(0, 10).forEach(function (r) {
        gs.info('[p2] ' + (r.cost / 3600000).toFixed(2) + ' h/d | ' + Math.round(r.perDay) + '/day x '
              + r.dur + 'ms | obs ' + r.cad.toFixed(1) + 's (cfg ' + r.cfg + 's) | ' + r.n.substr(0, 42)
              + (r.serial ? '  ** SERIAL-CAPPED: raw ' + (r.raw / 3600000).toFixed(0)
                            + ' h/d is impossible (dur > cadence) — use §D **' : ''));
    });
    rows.sort(function (a, b) { return b.perDay - a.perDay; });
    gs.info('[p2] --- top 6 by RUNS/DAY ---');
    rows.slice(0, 6).forEach(function (r) {
        gs.info('[p2] ' + Math.round(r.perDay) + '/day ' + r.dur + 'ms '
              + (r.cost/3600000).toFixed(2) + ' h/d | ' + r.n.substr(0, 42));
    });
    gs.info('[p2] duplicate names=' + Object.keys(dupes).filter(function (k) { return dupes[k] > 1; }).length
          + ' (queue consumers are often intentional parallelism)');
    var fast = rows.filter(function (r) { return r.cfg > 0 && r.cad < r.cfg * 0.6; });
    gs.info('[p2] running FASTER than configured: ' + fast.length);
    fast.sort(function (a, b) { return (a.cad/a.cfg) - (b.cad/b.cfg); });
    fast.slice(0, 5).forEach(function (r) {
        gs.info('[p2] obs ' + r.cad.toFixed(1) + 's vs cfg ' + r.cfg + 's ('
              + (r.cfg/r.cad).toFixed(1) + 'x) | ' + r.n.substr(0, 42));
    });

    // ---- §C2 FLOW RUNTIME: real run_time, terminal states only ----
    var ff = new GlideDateTime(); ff.addSeconds(-FLOW_MIN * 60);
    var fl = {}, fn = 0, term = 0, frt = 0, flowMax = 0, noRt = 0, st = {};
    var f = new GlideRecord('sys_flow_context');
    f.addQuery('sys_created_on', '>=', ff.getValue());
    f.setLimit(5000); f.query();
    while (f.next()) {
        fn++;
        var s = (f.getValue('state') || '').toLowerCase();
        st[s] = (st[s] || 0) + 1;
        if (s !== 'complete' && s !== 'error' && s !== 'cancelled') continue;
        term++;
        var rt2 = parseInt(f.getValue('run_time'), 10);
        if (isNaN(rt2)) { noRt++; rt2 = 0; }
        frt += rt2;
        if (rt2 > flowMax) flowMax = rt2;
        var k2 = f.getValue('flow') || '(empty)';
        var o2 = fl[k2] || (fl[k2] = { n:0, rt:0, err:0 });
        o2.n++; o2.rt += rt2;
        if (s === 'error') o2.err++;
    }
    function resolve(id) {                      // may be a flow OR a Flow Action
        if (!id) return '(empty)';
        var out = id;
        ['sys_hub_flow','sys_hub_action_type_definition'].forEach(function (tb) {
            var d = new GlideRecord(tb);
            if (d.isValid() && d.get(id)) out = d.getValue('name')
                + (d.getValue('active') === '1' ? '' : ' [INACTIVE]');
        });
        return out;
    }
    gs.info('[p2] ===== §C2 FLOW RUNTIME (' + FLOW_MIN + 'min) =====');
    gs.info('[p2] contexts=' + fn + ' terminal=' + term + ' non-terminal=' + (fn - term)
          + ' (' + Math.round((fn - term) * 100 / (fn || 1)) + '%)  run_time absent on ' + noRt);
    gs.info('[p2] FLOW TOTAL: ' + (frt / 3600000 * 24).toFixed(2) + ' h/day');
    Object.keys(st).sort(function (a, b) { return st[b] - st[a]; })
        .forEach(function (k) { gs.info('[p2] state ' + k + ': ' + st[k]); });
    Object.keys(fl).sort(function (a, b) { return fl[b].rt - fl[a].rt; })
        .slice(0, 10).forEach(function (k) {
            var o2 = fl[k];
            gs.info('[p2] ' + (o2.rt / 3600000 * 24).toFixed(2) + ' h/d x' + o2.n
                  + ' avg=' + Math.round(o2.rt / o2.n) + 'ms'
                  + (o2.err ? ' ERR=' + o2.err : '') + ' | ' + resolve(k));
        });

    gs.info('[p2] ===== OVERLAP CHECK =====');
    gs.info('[p2] handler max (same ' + FLOW_MIN + 'min window)=' + handlerMaxFW
          + 'ms  longest flow run_time=' + flowMax + 'ms  delta='
          + Math.abs(handlerMaxFW - flowMax) + 'ms => '
          + (!handlerMaxFW ? 'VOID — no handler transaction inside the flow window; widen FLOW_MIN'
             : Math.abs(handlerMaxFW - flowMax) < 2000
             ? 'SAME EXECUTION TWICE — DO NOT ADD TOTALS'
             : 'no match this window (inconclusive, not disproof)'));
    gs.info('[p2] (handler max over the full ' + HOURS + 'h window=' + handlerMax
          + 'ms — NOT comparable to a 60min flow max; shown for reference only)');

    // ---- §E claimed workers ----
    gs.info('[p2] ===== §E CLAIMED =====');
    var c = new GlideRecord('sys_trigger');
    c.addEncodedQuery('claimed_byISNOTEMPTY');
    c.query();
    var cc = 0;
    while (c.next()) {
        cc++;
        var d2 = parseInt(c.getValue('processing_duration'), 10) || 0;
        var p3 = ms(c.getValue('repeat')) / 1000;
        // CLAIM AGE is the pinned-worker discriminator, NOT processing_duration.
        // processing_duration is the last COMPLETED pass; a worker wedged right now
        // may show a small duration and a claim held for hours.
        var age = Math.round((now - ms(c.getValue('sys_updated_on'))) / 60000);
        gs.info('[p2] ' + c.getUniqueValue()
              + ' claim_age=' + age + 'min  last_pass=' + d2 + 'ms'
              + (p3 > 0 ? ' (cfg ' + p3 + 's = ' + (d2/1000/p3).toFixed(1) + 'x)' : '')
              + ' runs=' + c.getValue('run_count') + ' | ' + (c.getValue('name') || '').substr(0, 38)
              + (age > 60 ? '  ** CLAIM HELD >1h — candidate pinned worker **' : ''));
    }
    gs.info('[p2] claimed rows=' + cc);
})();
```

**Reading it:** subtract transient work before calling any total steady state.
`sql%` and `br%` both near zero means cost is neither queries nor business rules
— no index or ACL work will help. **When that happens, probe 2b is mandatory, not
optional** — it is the only thing that names the remaining cost.

---

## 2b — Full cost decomposition *(`§D` step 3b)*

**Run this whenever probe 2 reports a job with `sql%` and `br%` both near zero.**
`response_time − sql − business_rule` leaves most of the cost unattributed, and
`§D` step 3b's whole point is that the residual has a name: CPU, ACL, semaphore
wait, session wait, MetricBase, or an external call (→ probe 2c).

Validate every component field first — availability varies by release, and an
absent field must read **VOID**, never zero. The components **can overlap**, so a
negative UNACCOUNTED is real and means double-counting, not an error.

```javascript
(function decompose(TARGET_URLS, HOURS) {
    var COMP = ['sql_time','business_rule_time','cpu_time','acl_time','semaphore_wait_time',
                'session_wait_time','total_wait_time','clotho_time','zero_copy_sql_time',
                'network_time','client_script_time'];
    var probe = new GlideRecord('syslog_transaction');
    if (!probe.isValid()) { gs.error('[dec] syslog_transaction NOT ACCESSIBLE — retry from another scope'); return; }

    var avail = [], missing = [];
    COMP.concat(['business_rule_count','sql_count']).forEach(function (f) {
        (probe.isValidField(f) ? avail : missing).push(f);
    });
    gs.info('[dec] PRESENT: ' + avail.join(','));
    gs.info('[dec] ABSENT (VOID, not zero): ' + (missing.join(',') || 'none'));
    var use = COMP.filter(function (f) { return avail.indexOf(f) > -1; });

    var from = new GlideDateTime(); from.addSeconds(-(HOURS || 6) * 3600);
    (TARGET_URLS || []).forEach(function (url) {
        var q = new GlideRecord('syslog_transaction');
        q.addQuery('sys_created_on', '>=', from.getValue());
        q.addQuery('url', url);                        // exact match, not STARTSWITH
        q.setLimit(2000); q.query();
        var n = 0, rt = 0, acc = {}, brc = 0;
        use.forEach(function (f) { acc[f] = 0; });
        while (q.next()) {
            n++;
            rt += parseInt(q.getValue('response_time'), 10) || 0;
            use.forEach(function (f) { acc[f] += parseInt(q.getValue(f), 10) || 0; });
            brc += parseInt(q.getValue('business_rule_count'), 10) || 0;
        }
        if (!n) { gs.info('[dec] ' + url + ': NO transactions in window — VOID, not healthy'); return; }
        var sum = 0, parts = [];
        use.forEach(function (f) {
            if (!acc[f]) return;
            sum += acc[f];
            parts.push(f.replace(/_time$/, '') + '=' + Math.round(acc[f] * 100 / rt) + '%');
        });
        gs.info('[dec] --- ' + url + ' x' + n + ' total=' + Math.round(rt / 1000) + 's ---');
        gs.info('[dec]    ' + (parts.join(' ') || '(all components zero)'));
        gs.info('[dec]    UNACCOUNTED=' + Math.round((rt - sum) * 100 / rt) + '%  br_count=' + brc);
        gs.info('[dec]    ^ high UNACCOUNTED + low cpu => external call, go to probe 2c');
    });
})(['JOB: <name from probe 2>'], 6);
```

| Residual lands on | Meaning | Lever |
|---|---|---|
| `cpu` | in-script compute | the script itself |
| `acl` | per-row ACL evaluation | `§H` — but read `§H` steps 1–2 first |
| `semaphore_wait` | queued for a pool slot | `sys_semaphore.maximum_concurrency` (`§D` 3c) |
| `session_wait` | same-session serialisation | client concurrency |
| still UNACCOUNTED | external call or GC | **probe 2c** |

---

## 2c — Outbound integration latency *(`M-7`)*

`sys_outbound_http_log.response_time` is the **only** record of how long an
outbound call took. Without it, external latency is indistinguishable from your
own compute. Bound the window — the table is usually rotated — and **rank by
total, never by call count.**

🛑 **`http_status` is absent on both instances checked, so outbound failure rate
is VOID rather than zero.** Treat its absence as the expected case (`M-7` in
`references/mechanics.md`).

```javascript
(function outbound(HOURS) {
    var T = 'sys_outbound_http_log';
    var ol = new GlideRecord(T);
    if (!ol.isValid()) { gs.info('[ob] ' + T + ' NOT accessible'); return; }
    var need = ['response_time','hostname','sys_created_on'];
    var miss = need.filter(function (f) { return !ol.isValidField(f); });
    if (miss.length) { gs.error('[ob] MISSING: ' + miss.join(',') + ' — ABORT'); return; }
    gs.info('[ob] http_status present=' + ol.isValidField('http_status')
          + '  (absent => failure rate is VOID, not zero)');

    var from = new GlideDateTime(); from.addSeconds(-(HOURS || 6) * 3600);
    var CAP = 20000, hosts = {}, n = 0;
    var g = new GlideRecord(T);
    g.addQuery('sys_created_on', '>=', from.getValue());
    g.setLimit(CAP); g.query();
    while (g.next()) {
        n++;
        var h = g.getValue('hostname') || '(none)';
        var v = parseInt(g.getValue('response_time'), 10) || 0;
        var o = hosts[h] || (hosts[h] = { n:0, t:0, max:0 });
        o.n++; o.t += v; if (v > o.max) o.max = v;
    }
    gs.info('[ob] calls=' + n + (n >= CAP ? '  **TRUNCATED — floor only**' : ''));
    Object.keys(hosts).sort(function (a, b) { return hosts[b].t - hosts[a].t; })
        .slice(0, 10).forEach(function (h) {
            var x = hosts[h];
            gs.info('[ob] tot=' + Math.round(x.t / 1000) + 's x' + x.n
                  + ' avg=' + Math.round(x.t / x.n) + 'ms max=' + x.max + 'ms | ' + h.substr(0, 48));
        });
    gs.info('[ob] a slow EXTERNAL endpoint is usually not fixable here: cache it, make it async,');
    gs.info('[ob] or remove the integration. Do not imply a ServiceNow config fix exists.');
})(6);
```

---

## 5 — Stuck vs merely slow

**Serves `§E`.** Run twice. **The re-read interval must exceed the job's own
`processing_duration`** — an 80-minute job re-read after 10 minutes reads as
frozen every time (`W8` in `references/write-safety.md`).

| Observation | Meaning |
|---|---|
| Row absent on re-read | completed; one-shot rows are deleted |
| `run_count` advanced | slow but alive → capacity question |
| `run_count` frozen, `claimed_by` persists | genuinely stuck |

```javascript
(function claimTest() {
    var IDS = [ /* paste sys_ids from probe 2's §E section */ ];

    var probe = new GlideRecord('sys_trigger');
    if (!probe.isValid()) { gs.error('[claim] not accessible'); return; }
    var bad = [];
    ['name','state','run_count','processing_duration','claimed_by'].forEach(function (f) {
        if (!probe.isValidField(f)) bad.push(f);
    });
    if (bad.length) { gs.error('[claim] MISSING: ' + bad.join(',')); return; }

    var found = 0, gone = 0;
    IDS.forEach(function (id) {
        var gr = new GlideRecord('sys_trigger');
        if (!gr.get(id)) { gone++; gs.info('[claim] GONE (completed) | ' + id); return; }
        found++;
        gs.info('[claim] runs=' + gr.getValue('run_count')
              + ' st=' + gr.getValue('state')
              + ' ' + gr.getValue('processing_duration') + 'ms'
              + ' | ' + (gr.getValue('claimed_by') || '-')
              + ' | ' + gr.getValue('name'));
    });
    gs.info('[claim] present=' + found + ' gone=' + gone);
    gs.info('[claim] Re-run after an interval LONGER than the largest duration above.');
})();
```
