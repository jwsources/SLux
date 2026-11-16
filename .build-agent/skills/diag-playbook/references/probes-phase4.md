# Probes — Phase 4: Narrow diagnoses

Loaded by the `diag-playbook` skill. **Read cost: ~26 KB.**
Read `references/probes-conventions.md` first — it holds the twelve conventions
and the two helpers every probe depends on.
Method: `references/procedure-phase4-narrow.md`.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| Probe | Serves |
|---|---|
| 6a | `§G` — G1 staging vs G2 coalesce duplication |
| 6b | `§H` — ACL / per-row read cost |
| 6c | `§I` — housekeeping |
| 7 | `§E`, `§I` — remaining sweep |

---

## 6a — Sync-target bloat

G1 (staging never purged) vs G2 (coalesce duplication). **Serves `§G`.**

Four distinct outcomes, each with a different fix:

| Outcome | Meaning | Fix |
|---|---|---|
| **G1** | staging rows ≫ target | purge staging |
| **G2-dup** | duplication spread across many populated keys | coalesce key design |
| **key-not-populated** | key empty on most rows ⇒ coalesce can't match, every run **inserts** | source field mapping |
| **bucket-dominated** | one key value holds >50% | inspect; usually not duplication |

```javascript
(function probeG() {
    var MIN_ROWS = 1000, MAX_REPORT = 25, DUP_THRESHOLD = 1.5;
    var UNKEYED_SHARE = 0.5, BUCKET_SHARE = 0.5;

    function chk(t, f) {
        var g = new GlideRecord(t);
        if (!g.isValid()) { gs.error('[g] NOT ACCESSIBLE: ' + t); return false; }
        var m = f.filter(function (x) { return !g.isValidField(x); });
        if (m.length) { gs.error('[g] ' + t + ' MISSING: ' + m.join(',')); return false; }
        return true;
    }
    if (!chk('sys_transform_map', ['name','source_table','target_table','run_business_rules','active'])
     || !chk('sys_transform_entry', ['map','coalesce','target_field'])) return;

    function count(t) {                            // distinguishes empty from UNREADABLE
        try {
            var g = new GlideRecord(t);
            if (!g.isValid()) return { v:null, why:'invalid table' };
            var a = new GlideAggregate(t);
            a.addAggregate('COUNT'); a.query();
            return { v: a.next() ? parseInt(a.getAggregate('COUNT'), 10) : 0, why:null };
        } catch (e) { return { v:null, why:'DENIED' }; }
    }

    // group by the FULL composite key; split keyed vs all-empty rows
    function keyStats(tgt, keys) {
        try {
            var a = new GlideAggregate(tgt);
            a.addAggregate('COUNT');
            keys.forEach(function (k) { a.groupBy(k); });
            a.query();
            var unkeyed = 0, keyedRows = 0, distinctKeyed = 0, worstKeyed = 0, groups = 0;
            while (a.next()) {
                groups++;
                var c = parseInt(a.getAggregate('COUNT'), 10) || 0;
                var anyVal = false;
                for (var i = 0; i < keys.length; i++) {
                    if ((a.getValue(keys[i]) || '') !== '') { anyVal = true; break; }
                }
                if (!anyVal) { unkeyed += c; continue; }
                keyedRows += c; distinctKeyed++;
                if (c > worstKeyed) worstKeyed = c;
            }
            return { groups:groups, unkeyed:unkeyed, keyedRows:keyedRows,
                     distinctKeyed:distinctKeyed, worstKeyed:worstKeyed };
        } catch (e) { return null; }
    }

    var g1 = [], dup = [], nokey = [], bucket = [], voids = [], clean = 0, scanned = 0;
    var m = new GlideRecord('sys_transform_map');
    m.addQuery('active', true);
    m.query();
    while (m.next()) {
        scanned++;
        var nm = m.getValue('name'), src = m.getValue('source_table'), tgt = m.getValue('target_table');
        if (!src || !tgt) continue;
        var s = count(src), t = count(tgt);
        if (s.v === null || t.v === null) {
            voids.push(nm + ' | src=' + src + (s.why ? ' [' + s.why + ']' : '')
                          + ' tgt=' + tgt + (t.why ? ' [' + t.why + ']' : ''));
            continue;
        }
        if (s.v > MIN_ROWS && s.v > t.v * 5) {     // G1 requires staging > 0
            g1.push({ nm:nm, s:s.v, t:t.v, rbr:m.getValue('run_business_rules') });
            continue;
        }
        if (t.v < MIN_ROWS) { clean++; continue; }

        var keys = [];
        var e = new GlideRecord('sys_transform_entry');
        e.addQuery('map', m.getUniqueValue());
        e.addQuery('coalesce', true);
        e.query();
        while (e.next()) keys.push(e.getValue('target_field'));
        if (!keys.length) { clean++; continue; }

        var k = keyStats(tgt, keys);
        if (!k || !k.groups) { clean++; continue; }

        var risky = keys.filter(function (x) {
            return /version|revision|state|updated|timestamp|sequence|hash/i.test(x || '');
        });
        var base = { nm:nm, tgt:tgt, t:t.v, keys:keys, risky:risky,
                     rbr:m.getValue('run_business_rules'),
                     unkeyed:k.unkeyed, keyedRows:k.keyedRows,
                     d:k.distinctKeyed, worst:k.worstKeyed };

        if (k.unkeyed / t.v > UNKEYED_SHARE) { nokey.push(base); continue; }
        if (!k.distinctKeyed) { clean++; continue; }
        var dRatio = k.keyedRows / k.distinctKeyed;
        if (dRatio < DUP_THRESHOLD) { clean++; continue; }
        base.dup = dRatio;
        if (k.worstKeyed / k.keyedRows > BUCKET_SHARE) { bucket.push(base); continue; }
        dup.push(base);
    }

    gs.info('[g] scanned=' + scanned + ' G1=' + g1.length + ' G2-dup=' + dup.length
          + ' key-not-populated=' + nokey.length + ' bucket-dominated=' + bucket.length
          + ' unreadable(VOID)=' + voids.length + ' clean=' + clean);

    gs.info('[g] ===== G1 — staging never purged =====');
    if (!g1.length) gs.info('[g] none.');
    g1.slice(0, MAX_REPORT).forEach(function (x) {
        gs.info('[g] staging=' + x.s + ' target=' + x.t + ' ('
              + (x.s / Math.max(x.t, 1)).toFixed(1) + 'x) rbr=' + x.rbr + ' | ' + x.nm);
    });

    gs.info('[g] ===== G2 DUPLICATION — spread across many keys =====');
    if (!dup.length) gs.info('[g] none.');
    dup.sort(function (a, b) { return b.dup - a.dup; });
    dup.slice(0, MAX_REPORT).forEach(function (x) {
        gs.info('[g] ' + x.dup.toFixed(2) + 'x | keyed=' + x.keyedRows + ' distinct=' + x.d
              + ' worst=' + x.worst + ' (' + Math.round(x.worst * 100 / x.keyedRows) + '%)'
              + ' rbr=' + x.rbr + ' | ' + x.nm);
        gs.info('[g]    key=[' + x.keys.join(',') + ']'
              + (x.risky.length ? '  ** MUTABLE/VERSIONED: ' + x.risky.join(',') + ' **' : ''));
    });

    gs.info('[g] ===== KEY NOT POPULATED — coalesce cannot match, every run INSERTS =====');
    if (!nokey.length) gs.info('[g] none.');
    nokey.sort(function (a, b) { return b.unkeyed - a.unkeyed; });
    nokey.slice(0, MAX_REPORT).forEach(function (x) {
        gs.info('[g] ' + x.unkeyed + '/' + x.t + ' rows (' + Math.round(x.unkeyed * 100 / x.t)
              + '%) have NO key | ' + x.nm + ' | tgt=' + x.tgt + ' key=[' + x.keys.join(',') + ']');
    });

    gs.info('[g] ===== BUCKET-DOMINATED — inspect before trusting =====');
    if (!bucket.length) gs.info('[g] none.');
    bucket.forEach(function (x) {
        gs.info('[g] ' + x.dup.toFixed(2) + 'x but worst=' + x.worst + '/' + x.keyedRows
              + ' (' + Math.round(x.worst * 100 / x.keyedRows) + '%) distinct=' + x.d
              + ' | ' + x.nm + ' key=[' + x.keys.join(',') + ']');
    });

    gs.info('[g] unreadable(VOID)=' + voids.length + ' (RCA / invalid table)');

    // cost check — applies to every flagged category
    var flagged = dup.concat(nokey).concat(bucket);
    gs.info('[g] ===== BR-vs-SQL cost (6h) =====');
    if (!flagged.length) gs.info('[g] skipped');
    else if (chk('syslog_transaction', ['table','business_rule_time','sql_time','sys_created_on'])) {
        var from = new GlideDateTime(); from.addSeconds(-6 * 3600);
        var want = {};
        flagged.slice(0, 12).forEach(function (x) { want[x.tgt] = { br:0, sq:0, n:0 }; });
        var q = new GlideRecord('syslog_transaction');
        q.addQuery('sys_created_on', '>=', from.getValue());
        q.setLimit(40000); q.query();
        while (q.next()) {
            var tb = q.getValue('table');
            if (!want[tb]) continue;
            want[tb].n++;
            want[tb].br += parseInt(q.getValue('business_rule_time'), 10) || 0;
            want[tb].sq += parseInt(q.getValue('sql_time'), 10) || 0;
        }
        Object.keys(want).forEach(function (kk) {
            var o = want[kk];
            if (!o.n) { gs.info('[g] ' + kk + ': no transactions — cost UNCONFIRMED, no action'); return; }
            gs.info('[g] ' + kk + ': x' + o.n + ' br=' + o.br + 'ms sql=' + o.sq + 'ms => '
                  + (o.br > o.sq * 2 ? '** BR-DOMINATED — cost CONFIRMED **' : 'not BR-dominated'));
        });
    }
})();
```

---

## 6b — ACL / per-row read cost

**Serves `§H`.** The ACL count is not the decider — **query traffic is.** No
traffic means nothing to optimise, however large the count.

⚠ **This probe only sees INTERACTIVE traffic on the tables you list.** ACL cost
also accrues inside scheduled jobs, where it is invisible here — one instance
measured **47 s of `acl_time` in a single background job** while this probe
reported no ACL cost at all. Use probe 2b's `acl_time` component
(`references/probes-phase2.md`) for the background surface.

```javascript
(function probeH() {
    var HOT = ['incident','sn_customerservice_case','task','sys_user','cmdb_ci'];
    var a = new GlideRecord('sys_security_acl');
    if (!a.isValid() || !a.isValidField('operation') || !a.isValidField('script')) {
        gs.error('[h] sys_security_acl fields missing'); return;
    }
    HOT.forEach(function (tb) {
        var total = 0, roleGate = 0, rowScoped = 0, heavy = 0;
        var g = new GlideRecord('sys_security_acl');
        g.addQuery('name', 'STARTSWITH', tb);
        g.addQuery('operation', 'read');
        g.addQuery('active', true);
        g.query();
        while (g.next()) {
            total++;
            var sc = g.getValue('script') || '';
            if (!sc.trim()) { roleGate++; continue; }
            if (/new\s+GlideRecord|GlideAggregate|\.\s*query\s*\(/.test(sc)) heavy++;
            else if (/current\./.test(sc)) rowScoped++;
            else roleGate++;
        }
        if (total) gs.info('[h] ' + tb + ': read ACLs=' + total + ' role-gate=' + roleGate
                         + ' row-scoped=' + rowScoped + ' HEAVY=' + heavy);
    });
    gs.info('[h] row-scoped ACLs are BY DESIGN — role-only conversion is a data-exposure regression');

    var from = new GlideDateTime(); from.addSeconds(-6 * 3600);
    var byTbl = {}, seen = 0;
    var q = new GlideRecord('syslog_transaction');
    q.addQuery('sys_created_on', '>=', from.getValue());
    q.setLimit(40000); q.query();
    while (q.next()) {
        seen++;
        var tb = q.getValue('table');
        if (!tb) continue;
        var o = byTbl[tb] || (byTbl[tb] = { n:0, q:0 });
        o.n++; o.q += parseInt(q.getValue('sql_count'), 10) || 0;
    }
    gs.info('[h] transactions sampled=' + seen + (seen >= 40000 ? ' **TRUNCATED**' : ''));
    var hit = Object.keys(byTbl).filter(function (k) { return HOT.indexOf(k) > -1; });
    if (!hit.length) gs.info('[h] NO traffic on any hot table => nothing to optimise'
                           + ' (INTERACTIVE only — check probe 2b acl_time for jobs)');
    hit.forEach(function (k) { gs.info('[h] ' + k + ': x' + byTbl[k].n + ' q=' + byTbl[k].q); });

    // §H step 3 — a query-time fast path makes every per-row ACL branch dormant.
    // Check this BEFORE touching any ACL, or you will "optimise" dead code and
    // create a data-exposure regression for no gain.
    gs.info('[h] --- query-rule fast paths (step 3) ---');
    var qp = new GlideRecord('sys_properties');
    qp.addQuery('name', 'CONTAINS', 'use_query_rules');
    qp.query();
    var qn = 0;
    while (qp.next()) {
        qn++;
        gs.info('[h] ' + qp.getValue('name') + ' = ' + qp.getValue('value')
              + (qp.getValue('value') === 'true'
                 ? '  ** FAST PATH ON — per-row ACLs are dormant, recommend NO CHANGE **' : ''));
    }
    if (!qn) gs.info('[h] no *use_query_rules* properties on this instance');
})();
```

---

## 6c — Housekeeping

**Serves `§I`.** `size_bytes` needs `parseFloat` (`parseInt("2.1E9")` returns 2).
Flow and audit states must be lower-cased before counting. A 24-hour audit total
cannot distinguish a steady producer from a burst — the live-rate comparison does.

```javascript
(function probeI() {
    var ACAP = 60000, att = {}, an = 0;
    var at = new GlideRecord('sys_attachment');
    if (at.isValid() && at.isValidField('size_bytes')) {
        at.setLimit(ACAP); at.query();
        while (at.next()) {
            an++;
            var tn = at.getValue('table_name') || '(none)';
            var o = att[tn] || (att[tn] = { n:0, b:0 });
            o.n++; o.b += parseFloat(at.getValue('size_bytes')) || 0;
        }
        var tot = 0; Object.keys(att).forEach(function (k) { tot += att[k].b; });
        gs.info('[i] attachments=' + an + (an >= ACAP ? ' **TRUNCATED**' : '')
              + ' total=' + (tot / 1073741824).toFixed(2) + ' GB across '
              + Object.keys(att).length + ' tables');
        Object.keys(att).sort(function (a, b) { return att[b].b - att[a].b; })
            .slice(0, 8).forEach(function (k) {
                gs.info('[i] ' + (att[k].b / 1048576).toFixed(1) + ' MB x' + att[k].n + '  ' + k);
            });
        gs.info('[i] product/app content (manuals, ML artifacts) is NOT waste');
    }

    var af = new GlideDateTime(); af.addSeconds(-86400);
    var aud = new GlideAggregate('sys_audit');
    aud.addAggregate('COUNT');
    aud.addQuery('sys_created_on', '>=', af.getValue());
    aud.groupBy('tablename'); aud.query();
    var rows = [];
    while (aud.next()) rows.push({ t:aud.getValue('tablename'),
                                   c:parseInt(aud.getAggregate('COUNT'), 10) || 0 });
    rows.sort(function (a, b) { return b.c - a.c; });
    gs.info('[i] --- audit rows/24h (top 5) ---');
    rows.slice(0, 5).forEach(function (r) { gs.info('[i] ' + r.c + '  ' + r.t); });
    if (rows.length) {
        var top = rows[0].t;
        var w = new GlideDateTime(); w.addSeconds(-1800);
        var live = new GlideAggregate('sys_audit');
        live.addAggregate('COUNT');
        live.addQuery('sys_created_on', '>=', w.getValue());
        live.addQuery('tablename', top);
        live.query();
        var n30 = live.next() ? parseInt(live.getAggregate('COUNT'), 10) : 0;
        gs.info('[i] ' + top + ': 24h=' + rows[0].c + ' last30min=' + n30
              + ' implied/day=' + (n30 * 48));
        gs.info('[i] => ' + (rows[0].c > n30 * 48 * 3
            ? '** BURST — the daily total is NOT the current rate. Did YOU cause it? **'
            : 'rates agree — steady producer'));
        // The mechanism must EXIST before a fix is proposed: one instance drafted a
        // "disable auditing" fix for a table whose dictionary already had audit=0.
        var dct = new GlideRecord('sys_dictionary');
        dct.addQuery('name', top);
        dct.addNullQuery('element');
        dct.query();
        if (dct.next()) gs.info('[i] ' + top + ' dictionary audit=' + dct.getValue('audit')
              + (dct.getValue('audit') !== '1'
                 ? '  ** table-level auditing already OFF — nothing to disable **' : ''));
    }

    var fs = {}, ft = 0;
    var fg = new GlideAggregate('sys_flow_context');
    fg.addAggregate('COUNT'); fg.groupBy('state'); fg.query();
    while (fg.next()) {
        var c = parseInt(fg.getAggregate('COUNT'), 10) || 0;
        var k = (fg.getValue('state') || '(empty)').toLowerCase();
        fs[k] = (fs[k] || 0) + c; ft += c;
    }
    gs.info('[i] --- flow contexts=' + ft + ' ---');
    Object.keys(fs).sort(function (a, b) { return fs[b] - fs[a]; }).forEach(function (k) {
        gs.info('[i] ' + fs[k] + ' ' + Math.round(fs[k] * 100 / (ft || 1)) + '%  ' + k);
    });

    ['incident','sn_customerservice_case','task','sys_user','cmdb_ci'].forEach(function (tb) {
        var tc = 0, sync = 0, noCond = 0;
        var b = new GlideRecord('sys_script');
        b.addQuery('collection', tb); b.addQuery('active', true); b.query();
        while (b.next()) {
            tc++;
            var wn = b.getValue('when') || '';
            if (wn === 'before' || wn === 'after') sync++;
            if (!(b.getValue('condition') || '').trim()
                && !(b.getValue('filter_condition') || '').trim()) noCond++;
        }
        if (tc) gs.info('[i] BR ' + tb + ': active=' + tc + ' sync=' + sync + ' no-condition=' + noCond);
    });

    var ix = new GlideRecord('sys_index');       // sys_index has NO `name` column
    if (ix.isValid()) gs.info('[i] sys_index: name=' + ix.isValidField('name')
        + ' logical_table_name=' + ix.isValidField('logical_table_name')
        + ' index_col_name=' + ix.isValidField('index_col_name'));
})();
```

---

## 7 — Remaining sweep

Epoch `run_start`, indexes, SLA engine, form weight, quota/semaphore. **Serves
`§E`, `§I`.**

Uses the field-safe counter (`references/probes-conventions.md`) so an absent
field reports VOID instead of throwing. Also flags **whitespace in grouped
values** — a value like `"\tin_progress"` is invisible to any `field=value`
filter.

```javascript
(function remainingSweep() {
    function sc(table, conds) {
        var g = new GlideRecord(table);
        if (!g.isValid()) return { v:null, why:'table absent' };
        var bad = (conds || []).filter(function (c) { return !g.isValidField(c[0]); });
        if (bad.length) return { v:null, why:'no field "' + bad[0][0] + '"' };
        try {
            var a = new GlideAggregate(table);
            a.addAggregate('COUNT');
            (conds || []).forEach(function (c) { a.addQuery(c[0], c[1]); });
            a.query();
            return { v: a.next() ? parseInt(a.getAggregate('COUNT'), 10) : 0, why:null };
        } catch (e) { return { v:null, why:'DENIED' }; }
    }
    function show(label, r) {
        gs.info('[sw] ' + label + ': ' + (r.v === null ? 'VOID (' + r.why + ')' : r.v));
    }

    // ---- §E epoch run_start ----
    gs.info('[sw] ===== §E EPOCH run_start =====');
    var ep = new GlideRecord('sys_trigger');
    if (ep.isValid() && ep.isValidField('run_start')) {
        ep.addQuery('run_start', '<', '1980-01-01 00:00:00');
        ep.addQuery('run_count', '>', 1000);
        ep.query();
        var n = 0;
        while (ep.next()) {
            n++;
            if (n <= 15) gs.info('[sw] run_start=' + ep.getValue('run_start')
                  + ' runs=' + ep.getValue('run_count')
                  + ' repeat=' + ep.getValue('repeat') + ' | ' + ep.getValue('name'));
        }
        gs.info('[sw] epoch-run_start jobs (>1000 runs): ' + n
              + (n ? ' => derive cadence from run_count/age, NEVER from run_start' : ' => ABSENT'));
    }

    // ---- §I-d indexes ----
    gs.info('[sw] ===== §I-d INDEXES =====');
    var ix = new GlideRecord('sys_index');
    if (!ix.isValid()) gs.info('[sw] sys_index not accessible');
    else if (!ix.isValidField('logical_table_name')) gs.error('[sw] no logical_table_name');
    else {
        var byT = {}, ixn = 0;
        var g2 = new GlideRecord('sys_index');
        g2.setLimit(20000); g2.query();
        while (g2.next()) { ixn++; var tn = g2.getValue('logical_table_name') || '(none)';
                            byT[tn] = (byT[tn] || 0) + 1; }
        gs.info('[sw] index rows=' + ixn + (ixn >= 20000 ? ' **TRUNCATED**' : ''));
        Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; })
            .slice(0, 10).forEach(function (k) { gs.info('[sw] ' + byT[k] + ' indexes | ' + k); });
        gs.info('[sw] ^ many indexes hurt a high-WRITE table; on a read table they are fine');
    }

    // ---- §I SLA engine ----
    gs.info('[sw] ===== §I SLA ENGINE =====');
    var ts = new GlideRecord('task_sla');
    if (!ts.isValid() || !ts.isValidField('stage')) gs.info('[sw] task_sla/stage unavailable');
    else {
        var st = {}, tot = 0, ws = [];
        var sg = new GlideAggregate('task_sla');
        sg.addAggregate('COUNT'); sg.groupBy('stage'); sg.query();
        while (sg.next()) {
            var raw = sg.getValue('stage') || '';
            var c = parseInt(sg.getAggregate('COUNT'), 10) || 0;
            if (raw !== raw.trim()) ws.push(JSON.stringify(raw) + ' x' + c);
            var k = raw.trim().toLowerCase() || '(empty)';
            st[k] = (st[k] || 0) + c; tot += c;
        }
        gs.info('[sw] task_sla total=' + tot);
        Object.keys(st).sort(function (a, b) { return st[b] - st[a]; }).forEach(function (k) {
            gs.info('[sw] ' + st[k] + ' ' + Math.round(st[k] * 100 / (tot || 1)) + '%  ' + k);
        });
        if (ws.length) {
            gs.error('[sw] ** WHITESPACE IN STAGE: ' + ws.join(', ') + ' **');
            gs.error('[sw] ** those rows are INVISIBLE to any stage=<value> filter **');
        }
        show('active SLAs', sc('task_sla', [['active', true]]));
        var br = st['breached'] || 0;
        if (br) {
            gs.info('[sw] breached=' + br + ' (' + Math.round(br * 100 / (tot || 1))
                  + '%) — every active SLA is re-evaluated on each task update');
            // A high breached share is NOT waste if the parent tasks are still open.
            // Split by parent state before proposing anything: one instance found
            // 3,885 of 3,890 breached SLAs attached to OPEN tasks — no action.
            show('  breached on CLOSED parents (actionable)',
                 sc('task_sla', [['active', true], ['stage', 'breached'], ['task.active', false]]));
            show('  breached on OPEN parents (leave alone)',
                 sc('task_sla', [['active', true], ['stage', 'breached'], ['task.active', true]]));
        }
    }
    show('SLA definitions active', sc('contract_sla', [['active', true]]));

    // ---- §I form / list weight (ACTIVE only — inactive scripts do not execute) ----
    gs.info('[sw] ===== §I FORM/LIST WEIGHT =====');
    ['incident','sn_customerservice_case','sys_user'].forEach(function (tb) {
        var rl  = sc('sys_ui_related_list', [['name', tb]]);
        var pol = sc('sys_ui_policy',       [['table', tb], ['active', true]]);
        var cs  = sc('sys_script_client',   [['table', tb], ['active', true]]);
        gs.info('[sw] ' + tb + ': related_lists=' + (rl.v === null ? 'VOID' : rl.v)
              + ' active_ui_policies=' + (pol.v === null ? 'VOID' : pol.v)
              + ' active_client_scripts=' + (cs.v === null ? 'VOID' : cs.v));
    });
    gs.info('[sw] ^ one query per related list PER FORM LOAD — cost only when forms open');

    // ---- §I quota / semaphore ----
    gs.info('[sw] ===== §I QUOTA / SEMAPHORE =====');
    ['sysrule_quota','sys_semaphore','sys_quota_rule'].forEach(function (t) {
        var all = sc(t, null);
        if (all.v === null) { gs.info('[sw] ' + t + ': ' + all.why); return; }
        var act = sc(t, [['active', true]]);
        gs.info('[sw] ' + t + ': rows=' + all.v
              + ' active=' + (act.v === null ? 'n/a (' + act.why + ')' : act.v));
        var r = new GlideRecord(t);
        r.setLimit(12); r.query();
        while (r.next()) {
            var bits = [];
            if (r.isValidField('active'))         bits.push('active=' + r.getValue('active'));
            if (r.isValidField('max_concurrent')) bits.push('max=' + r.getValue('max_concurrent'));
            if (r.isValidField('maximum_concurrency')) bits.push('maxcon=' + r.getValue('maximum_concurrency'));
            if (r.isValidField('max_duration'))   bits.push('maxdur=' + r.getValue('max_duration') + 's');
            bits.push(r.isValidField('name') ? r.getValue('name') : r.getUniqueValue());
            gs.info('[sw]   ' + bits.join(' '));
        }
    });

    // ---- §D step 3d — CANCELLED transactions, invisible to every timing module ----
    gs.info('[sw] ===== CANCELLED TRANSACTIONS (24h) =====');
    gs.info('[sw] a killed transaction consumes no time => §C/§D/§C2 cannot see it');
    var cf = new GlideDateTime(); cf.addSeconds(-86400);
    var cn = 0, cpat = {};
    var cx = new GlideRecord('syslog');
    cx.addQuery('sys_created_on', '>=', cf.getValue());   // BOUND FIRST — rotated
    cx.addQuery('message', 'STARTSWITH', 'Cancelling');   // NOT %cancel% — that matches app text
    cx.setLimit(500); cx.query();
    while (cx.next()) {
        cn++;
        var cm = (cx.getValue('message') || '')
            .replace(/#\d+/g, '#N').replace(/[0-9a-f]{32}/gi, '<id>').substr(0, 90);
        cpat[cm] = (cpat[cm] || 0) + 1;
    }
    gs.info('[sw] cancellations=' + cn + ' across ' + Object.keys(cpat).length + ' patterns');
    Object.keys(cpat).sort(function (a, b) { return cpat[b] - cpat[a]; })
        .slice(0, 6).forEach(function (k) {
            gs.info('[sw] ' + cpat[k] + 'x  ' + k
                  + (k.indexOf('unclaimed') > -1 ? '   << died QUEUED — fix the POOL, not the code' : ''));
        });
})();
```

⚠ The cancelled-transaction block serves `§D` step 3d, not `§I` — it is bundled
here because it shares the sweep's single pass. Read `§D` step 3d in
`references/procedure-phase2-consumers.md` before acting on it; a short
`max_duration` is often correct.
