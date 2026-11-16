# Probes — Phase 3: Attribute growth

Loaded by the `diag-playbook` skill. **Read cost: ~20 KB.**
Read `references/probes-conventions.md` first — it holds the twelve conventions
and the two helpers every probe depends on.
Method: `references/procedure-phase3-growth.md`. Retention mechanics: `M-1` in
`references/mechanics.md`.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| Probe | Serves |
|---|---|
| 3 | `M-1`, `M-2`, `§B`, `§F` — read-only |
| 4 | `M-1`, `W1`–`W9` — **the one WRITE in this skill** |

---

## 3 — Attribute growth

Retention, dead config, escaping data, queue health. **Serves `M-1`, `M-2`,
`§B`, `§F`.**

```javascript
(function phase3() {
    function ms(dt) { return dt ? new GlideDateTime(dt).getNumericValue() : 0; }
    var now = new GlideDateTime().getNumericValue();
    function daysAgo(dt) { return dt ? Math.round((now - ms(dt)) / 86400000) : null; }
    function dDays(dt) { return dt ? ms(dt) / 86400000 : 0; }

    // ---- M-1 retention: read `type` first; sanity-bound `duration` ----
    var rot = {}, rotN = 0;
    var r = new GlideRecord('sys_table_rotation');
    r.query();
    while (r.next()) {
        rotN++;
        var nm = r.getValue('name'), ty = r.getValue('type');
        var dd = dDays(r.getValue('duration'));
        var rr = parseInt(r.getValue('rotations'), 10);
        var bad = (ty !== 'rotate')          ? 'type=' + ty + ' (partitioning, not retention)'
                : (r.getValue('initialized') !== '1') ? 'initialized=0 (inert)'
                : (isNaN(rr) || !rr || !dd)  ? 'INDETERMINATE'
                : (dd > 365)                 ? 'duration=' + Math.round(dd) + 'd MALFORMED'
                : null;
        rot[nm] = { d:dd, n:rr, ret: bad ? null : rr * dd, bad:bad };
    }
    var ANALYSIS_FLOOR = 10;             // §B needs a 10–14 day daily series to attribute volume
    gs.info('[p3] ===== M-1 RETENTION — ' + rotN + ' rotation rows =====');
    ['syslog','sysevent','syslog_transaction','sys_flow_log'].forEach(function (t) {
        var x = rot[t];
        gs.info('[p3] ' + t + ': ' + (!x ? 'NOT rotated'
            : x.bad ? '** ' + x.bad + ' **' : x.n + ' x ' + x.d + 'd = ' + x.ret + ' days')
            + (x && x.ret !== null && x.ret < ANALYSIS_FLOOR
               ? '  ** BELOW THE §B ANALYSIS WINDOW (' + ANALYSIS_FLOOR + 'd) — volume on this'
                 + ' table can no longer be attributed; a trailing 0 in the §B series is a PRUNED'
                 + ' SHARD, not a quiet day **'
               : ''));
    });

    // DEAD config has two grades and they are NOT equally interesting.
    // MISLEADING: flush age < rotation retention — the policy promises more aggressive
    //             cleanup than the table actually gets. This is the one that fools people.
    // CONSISTENT: flush age >= rotation retention — still inert (editing it does nothing)
    //             but it makes no false promise. Measured 3 of 4 hits on one instance.
    var misleading = [], consistent = [], flushN = 0, longest = {};
    var f = new GlideRecord('sys_auto_flush');
    f.addQuery('active', true);
    f.query();
    while (f.next()) {
        flushN++;
        var tn = f.getValue('tablename');
        var age = Math.round((parseInt(f.getValue('age'), 10) || 0) / 86400);
        if (longest[tn] === undefined || age > longest[tn]) longest[tn] = age;
        if (rot[tn] && !rot[tn].bad) {
            var line = tn + ' flush=' + age + 'd rotation=' + rot[tn].ret + 'd';
            if (age < rot[tn].ret) misleading.push(line + '  (promises ' + age
                + 'd, really ' + rot[tn].ret + 'd — ' + (rot[tn].ret / (age || 1)).toFixed(1) + 'x longer)');
            else consistent.push(line);
        }
        else if (rot[tn]) gs.info('[p3] NOT DEAD: ' + tn + ' rotation row is ' + rot[tn].bad
                                + ' => its ' + age + 'd flush policy IS the authority');
    }
    gs.info('[p3] flush policies=' + flushN + '  dead-on-rotated=' + (misleading.length + consistent.length)
          + ' (MISLEADING=' + misleading.length + ' CONSISTENT=' + consistent.length + ')');
    misleading.forEach(function (x) { gs.info('[p3] ** MISLEADING ** ' + x); });
    consistent.forEach(function (x) { gs.info('[p3] inert-but-consistent  ' + x); });

    gs.info('[p3] --- oldest row vs LONGEST policy ---');
    ['sys_flow_context','sys_audit','sys_email','sys_attachment','sys_update_xml'].forEach(function (t) {
        try {
            var g = new GlideRecord(t);
            if (!g.isValid() || !g.isValidField('sys_created_on')) { gs.info('[p3] ' + t + ': n/a'); return; }
            if (rot[t]) { gs.info('[p3] ' + t + ': ROTATED — skipping unbounded orderBy'); return; }
            g.orderBy('sys_created_on'); g.setLimit(1); g.query();
            var o = g.next() ? g.getValue('sys_created_on') : null;
            var od = daysAgo(o), pol = longest[t];
            gs.info('[p3] ' + t + ': oldest=' + (o || 'n/a') + (od !== null ? ' (' + od + 'd)' : '')
                + '  longest policy=' + (pol === undefined ? 'NONE' : pol + 'd') + ' => '
                + (pol === undefined ? 'NO POLICY — unbounded'
                   : od > pol * 1.5 ? '** ESCAPING **' : 'ok'));
        } catch (e) { gs.info('[p3] ' + t + ': ' + e); }
    });

    // ---- §B volume series ----
    // A trailing 0 on a ROTATED table is a pruned shard, not a quiet day. Label every
    // bucket older than measured retention so the series cannot be misread as "volume
    // started N days ago" — measured: a 7-day series on a 3-day-retention log printed
    // -6d 0 and -5d 150,067, which reads as a ramp-up and is purely the shard boundary.
    var sysRet = (rot['syslog'] && rot['syslog'].ret) || null;
    gs.info('[p3] ===== §B syslog daily series' + (sysRet ? ' (retention=' + sysRet + 'd)' : '') + ' =====');
    for (var d = 0; d < 7; d++) {
        var hi = new GlideDateTime(); hi.addSeconds(-d * 86400);
        var lo = new GlideDateTime(hi.getValue()); lo.addSeconds(-86400);
        var ga = new GlideAggregate('syslog');
        ga.addAggregate('COUNT');
        ga.addQuery('sys_created_on', '>=', lo.getValue());
        ga.addQuery('sys_created_on', '<',  hi.getValue());
        ga.query();
        var beyond = sysRet !== null && d >= sysRet;
        gs.info('[p3] -' + d + 'd ' + lo.getValue().substr(0, 10) + '  '
              + (ga.next() ? ga.getAggregate('COUNT') : '-1')
              + (beyond ? '   << BEYOND RETENTION — shard pruned, NOT a volume signal' : ''));
    }
    gs.info('[p3] flat=steady | declining=burst aging out | rising=compounding defect');
    gs.info('[p3] NOT comparable to a series from another day — the live shard set moves');
    if (sysRet !== null && sysRet < 10)
        gs.error('[p3] ** retention ' + sysRet + 'd < 10d: only ' + sysRet
               + ' of these buckets are real. §B attribution on syslog is DEGRADED. **');

    // ---- §B error attribution ----
    // THREE things must be measured together or the verdict is wrong:
    //   1. CONCENTRATION, not pattern count. 11 patterns sounds diffuse; if 99% of rows
    //      are one pattern it is a single fault. Weight by share of the top pattern.
    //   2. BURST vs STEADY. A capped loop over one window cannot tell them apart.
    //      Measured: a 3-min capped sample read 500/min for an error whose idle rate was
    //      2/min — the window had landed inside a 4-minute spike.
    //   3. WHO CAUSED IT. source='*** Script' is the background-script marker: those rows
    //      are your own probes echoing. Measured: 3,544 of 3,704 rows traced to two of
    //      this suite's own runs, correlated by timestamp against the script-request log.
    function norm(m) {
        return (m || '').replace(/[0-9a-f]{32}/gi, '<id>')
                        .replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().substr(0, 95);
    }
    gs.info('[p3] ===== §B ERROR ATTRIBUTION =====');
    var ERRCAP = 1500;
    var W = new GlideDateTime(); W.addSeconds(-180);
    var pat = {}, en = 0, scriptEcho = 0;
    var e = new GlideRecord('syslog');
    e.addQuery('sys_created_on', '>=', W.getValue());
    e.addQuery('level', '2');
    e.setLimit(ERRCAP); e.query();
    while (e.next()) {
        en++;
        if ((e.getValue('source') || '').indexOf('*** Script') === 0) scriptEcho++;
        var k = norm(e.getValue('message'));
        pat[k] = (pat[k] || 0) + 1;
    }
    var pk = Object.keys(pat).sort(function (a, b) { return pat[b] - pat[a]; });
    var topShare = en ? Math.round(pat[pk[0]] * 100 / en) : 0;
    gs.info('[p3] 3min sample: ' + en + ' rows, ' + pk.length + ' patterns'
          + (en >= ERRCAP ? '  **CAP HIT — proportions are a block, not a census**' : ''));
    gs.info('[p3] top pattern share=' + topShare + '%  own-probe echo=' + scriptEcho
          + ' rows (' + Math.round(scriptEcho * 100 / (en || 1)) + '%)');
    gs.info('[p3] verdict => ' + (topShare >= 60
        ? 'CONCENTRATED (' + topShare + '% one pattern) => a single real fault, chase it'
        : pk.length <= 3 ? 'FEW patterns => real fault, chase it'
        : 'DIFFUSE => usually unconfigured features, R7 applies'));
    pk.slice(0, 8).forEach(function (k) {
        gs.info('[p3] ' + pat[k] + 'x (' + Math.round(pat[k] * 100 / (en || 1)) + '%)  ' + k);
    });

    // RATE CHECK on the top pattern — bounded COUNTs, immune to the cap.
    // Divergence across windows means BURST; agreement means STEADY.
    // 🛑 NEVER filter zeros out of the comparison. A zero in the SHORT window with a
    // large count in a LONGER one is the strongest possible burst signal — measured:
    // 1min=0 5min=0 15min=551 60min=551 is a single spike, yet dropping the zeros
    // compared only 36.7 and 9.2 and printed "STEADY".
    if (pk.length) {
        var probe = pk[0].replace(/<id>/g, '').replace(/#/g, '').trim().substr(0, 40);
        gs.info('[p3] --- rate of top pattern: "' + probe.substr(0, 38) + '" ---');
        var counts = [];
        [1, 5, 15, 60].forEach(function (mins) {
            var lo3 = new GlideDateTime(); lo3.addSeconds(-mins * 60);
            var ra = new GlideAggregate('syslog');
            ra.addAggregate('COUNT');
            ra.addQuery('sys_created_on', '>=', lo3.getValue());
            ra.addQuery('message', 'CONTAINS', probe);
            ra.query();
            var rc = ra.next() ? parseInt(ra.getAggregate('COUNT'), 10) : 0;
            counts.push({ mins: mins, total: rc, perMin: rc / mins });
            gs.info('[p3] last ' + mins + 'min: ' + rc + ' = ' + (rc / mins).toFixed(1) + '/min');
        });
        // Two independent burst tells, both zero-aware:
        //   (a) a longer window holds (almost) all the rows => the event is old, not ongoing
        //   (b) per-minute rates diverge sharply across windows
        var newest = counts[0], oldest = counts[counts.length - 1];
        var staleBurst = oldest.total > 0 && newest.total * 10 < oldest.total;
        var pm = counts.map(function (c) { return c.perMin; });
        var spread = Math.max.apply(null, pm) / Math.max(Math.min.apply(null, pm), 0.0001);
        gs.info('[p3] => ' + (staleBurst
            ? '** STALE BURST — ' + oldest.total + ' rows in ' + oldest.mins + 'min but only '
              + newest.total + ' in the last ' + newest.mins + 'min. It has STOPPED.'
              + ' Check whether YOUR OWN probes caused it. **'
            : spread > 5
            ? '** BURST (' + Math.round(spread) + 'x spread) — the short-window rate is NOT'
              + ' the steady rate **'
            : 'STEADY — windows agree, safe to extrapolate'));
    }

    // ---- §F draining or stuck ----
    gs.info('[p3] ===== §F sysevent =====');
    var st = {}, all = 0;
    var sg = new GlideAggregate('sysevent');
    sg.addAggregate('COUNT'); sg.groupBy('state'); sg.query();
    while (sg.next()) {
        var s = (sg.getValue('state') || '(empty)').toLowerCase();
        var c2 = parseInt(sg.getAggregate('COUNT'), 10) || 0;
        st[s] = (st[s] || 0) + c2; all += c2;
    }
    gs.info('[p3] total=' + all);
    Object.keys(st).sort(function (a, b) { return st[b] - st[a]; }).forEach(function (k) {
        gs.info('[p3] ' + st[k] + ' ' + Math.round(st[k] * 100 / (all || 1)) + '%  ' + k);
    });
    var pend = (st['ready'] || 0) + (st['processing'] || 0);
    gs.info('[p3] pending=' + pend + ' (' + (pend * 100 / (all || 1)).toFixed(2) + '%) => '
          + (pend * 100 / (all || 1) < 1 ? 'consumer keeping up' : 'investigate consumer'));

    // RATE HISTORY — per-bucket GlideAggregate COUNT (convention 9).
    // The previous GlideRecord+setLimit(30000) version silently truncated the OLDEST
    // buckets and inverted the verdict: it read the newest bucket as 6,038 when the
    // real figure was 31,955 (5.3x under) and still printed a shape conclusion.
    // An aggregate per bucket cannot truncate, so there is no cap to self-report.
    var B = 30, HRS = 3, vals = [];
    for (var i = 0; i < HRS * 60 / B; i++) {
        var bhi = new GlideDateTime(); bhi.addSeconds(-i * B * 60);
        var blo = new GlideDateTime(bhi.getValue()); blo.addSeconds(-B * 60);
        var bagg = new GlideAggregate('sysevent');
        bagg.addAggregate('COUNT');
        bagg.addQuery('sys_created_on', '>=', blo.getValue());
        bagg.addQuery('sys_created_on', '<',  bhi.getValue());
        bagg.query();
        var cv = bagg.next() ? parseInt(bagg.getAggregate('COUNT'), 10) : -1;
        vals.push(cv);
        gs.info('[p3] -' + (i*B) + 'to-' + ((i+1)*B) + 'min: ' + cv + ' (' + Math.round(cv/B) + '/min)');
    }
    var vNew = vals[0], vOld = vals[vals.length-1];
    gs.info('[p3] shape => ' + (vNew < vOld * 0.7 ? 'DECLINING — drains itself'
        : vNew > vOld * 1.3 ? 'CLIMBING — live producer'
        : 'FLAT — correlate against real workload before judging'));

    // OLDEST PENDING ITEM — §F's other discriminator. A count alone is ambiguous.
    // NEVER use orderBy+setLimit(1) here: sysevent is ROTATED, so the sort applies
    // within each shard branch of the UNION and returns one shard's minimum, not the
    // table's. Measured: that pattern reported a 10-day-old row on a queue whose
    // oldest pending item was under an hour. Use a bounded COUNT ladder instead —
    // each bucket is an independent indexed aggregate that cannot be fooled by sharding.
    gs.info('[p3] --- age brackets for state=ready (bounded COUNTs, not orderBy) ---');
    var brackets = [['1h', 3600], ['6h', 21600], ['24h', 86400], ['7d', 604800]];
    var oldestBracket = 'under 1h';
    brackets.forEach(function (b) {
        var cut = new GlideDateTime(); cut.addSeconds(-b[1]);
        var ba2 = new GlideAggregate('sysevent');
        ba2.addAggregate('COUNT');
        ba2.addQuery('state', 'ready');
        ba2.addQuery('sys_created_on', '<', cut.getValue());
        ba2.query();
        var cnt = ba2.next() ? parseInt(ba2.getAggregate('COUNT'), 10) : -1;
        gs.info('[p3] state=ready older than ' + b[0] + ': ' + cnt);
        if (cnt > 0) oldestBracket = 'older than ' + b[0];
    });
    gs.info('[p3] oldest pending bracket: ' + oldestBracket
          + (oldestBracket === 'under 1h'
             ? '  => consumer keeping up'
             : '  ** CONSUMER NOT KEEPING UP — identify it via §E **'));
})();
```

**Reading it:** a flat rate is not automatically a defect — if the subsystem's
real work progresses, it is a poller by design.

---

## 4 — Reduce retention *(WRITE)*

Set `TARGET` to your policy. **Serves `M-1`; governed by `W1`–`W9` in
`references/write-safety.md`.**

Never cut below your `§B` analysis window (10–14 days). `duration` sets a hard
floor — 7-day shards cannot go below 7 days. **A parent-class change cascades to
every child class**, so enumerate the subtree first (`M-1`).

```javascript
(function retentionTo(TARGET_DAYS) {
    var DRY_RUN = true;
    var TARGET  = TARGET_DAYS || 14;
    var CEILING = 30;

    var T = 'sys_table_rotation';
    var probe = new GlideRecord(T);
    if (!probe.isValid()) { gs.error('[ret] not accessible'); return; }
    var bad = false;
    ['name','rotations','duration','type','initialized'].forEach(function (f) {
        if (!probe.isValidField(f)) { gs.error('[ret] MISSING ' + f); bad = true; }
    });
    if (bad) return;                              // note: sys_policy does NOT exist on this table

    function days(dt) { return dt ? new GlideDateTime(dt).getNumericValue() / 86400000 : 0; }

    var plan = [], floors = [], skipped = [], excluded = [], total = 0;
    var g = new GlideRecord(T);
    g.query();
    while (g.next()) {
        total++;
        var nm = g.getValue('name');
        if (g.getValue('type') !== 'rotate')   { excluded.push(nm + ' type=' + g.getValue('type')); continue; }
        if (g.getValue('initialized') !== '1') { excluded.push(nm + ' initialized=0'); continue; }
        var cur = parseInt(g.getValue('rotations'), 10), dd = days(g.getValue('duration'));
        if (isNaN(cur) || !cur || !dd)         { excluded.push(nm + ' INDETERMINATE'); continue; }
        if (dd > 365)                          { excluded.push(nm + ' duration=' + Math.round(dd) + 'd MALFORMED'); continue; }
        var ret = cur * dd;
        if (ret <= TARGET)                     { skipped.push(nm + ' ' + ret + 'd'); continue; }
        var want = Math.max(1, Math.floor(TARGET / dd));
        if (want >= cur)                       { skipped.push(nm + ' ' + ret + 'd unreducible'); continue; }
        var row = { id:g.getUniqueValue(), nm:nm, cur:cur, want:want, dd:dd, ret:ret, newRet:want*dd };
        plan.push(row);
        if (row.newRet > TARGET) floors.push(row);
    }

    gs.info('[ret] scanned=' + total + ' plan=' + plan.length
          + ' already-ok=' + skipped.length + ' excluded=' + excluded.length);
    excluded.forEach(function (x) { gs.info('[ret]   EXCLUDED ' + x); });
    plan.sort(function (a, b) { return b.ret - a.ret; });
    plan.forEach(function (p) {
        gs.info('[ret] ' + p.ret + 'd -> ' + p.newRet + 'd | rotations ' + p.cur + ' -> ' + p.want
              + ' (shard=' + p.dd + 'd)' + (p.newRet > TARGET ? ' [GEOMETRY FLOOR]' : '') + ' | ' + p.nm);
    });
    if (floors.length) gs.info('[ret] ' + floors.length + ' cannot reach ' + TARGET + 'd');

    if (!plan.length)          { gs.error('[ret] ABORT nothing to change'); return; }
    if (plan.length > CEILING) { gs.error('[ret] ABORT ' + plan.length + ' > ceiling ' + CEILING); return; }
    if (DRY_RUN) { gs.info('[ret] DRY_RUN — set DRY_RUN=false to apply.'); return; }

    var ok = 0, blocked = 0, drift = 0;
    plan.forEach(function (p) {
        var r = new GlideRecord(T);
        if (!r.get(p.id)) { gs.error('[ret] vanished ' + p.nm); return; }
        if (r.getValue('name') !== p.nm || r.getValue('type') !== 'rotate'
            || r.getValue('initialized') !== '1'
            || parseInt(r.getValue('rotations'), 10) !== p.cur) {
            drift++; gs.error('[ret] STATE DRIFT, skipped: ' + p.nm); return;
        }
        r.setValue('rotations', p.want);
        if (!r.update()) { blocked++; gs.error('[ret] BLOCKED ' + p.nm); return; }
        var c = new GlideRecord(T);
        if (c.get(p.id) && parseInt(c.getValue('rotations'), 10) === p.want) {
            ok++; gs.info('[ret] OK ' + p.nm + ': ' + p.ret + 'd -> ' + p.newRet + 'd');
        } else gs.error('[ret] NOT PERSISTED ' + p.nm);
    });
    gs.info('[ret] changed=' + ok + ' blocked=' + blocked + ' drift=' + drift);
    gs.info('[ret] disk reclamation LAGS until surplus shards prune; write-rate UNCHANGED.');
})(14);
```

⚠ The closing log line is `W9`: **write-rate reduction ≠ size reduction** —
state both separately.
