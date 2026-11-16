# Probes — Phase 1: Orient

Loaded by the `diag-playbook` skill. **Read cost: ~2.5 KB.**
Read `references/probes-conventions.md` first — it holds the twelve conventions
and the two helpers every probe depends on.
Method: `references/procedure-phase1-orient.md`.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

---

## 1 — Orient

Is the scheduler dispatching, is housekeeping alive. **Serves `§A`, `M-4`, the
appendix.**

`stats.do` is not scriptable — fetch `https://<instance>/stats.do` separately and
**record the `node_id` with the reading** (per-node counters, `M-4` in
`references/mechanics.md`). The worker list is the fastest wedged-job signal: any
worker at multi-hour duration is pinned.

```javascript
(function orient() {
    var now = new GlideDateTime().getValue();
    function c(cb) {
        var a = new GlideAggregate('sys_trigger');
        a.addAggregate('COUNT'); if (cb) cb(a); a.query();
        return a.next() ? parseInt(a.getAggregate('COUNT'), 10) : -1;
    }
    var past = c(function (a) { a.addQuery('next_action', '<', now); });
    var total = c(null);
    gs.info('[o] triggers=' + total + ' past_due=' + past
          + ' (' + Math.round(past * 100 / (total || 1)) + '%)');
    gs.info('[o] ~20% past-due is NORMAL — on-demand/startup types sit in the past by design');

    var t = new GlideRecord('sys_trigger');
    t.addQuery('name', 'CONTAINS', 'able Cleaner');
    t.query();
    var n = 0;
    while (t.next()) {
        n++;
        gs.info('[o] cleaner: next=' + t.getValue('next_action')
              + ' runs=' + t.getValue('run_count')
              + ' type=' + t.getValue('trigger_type') + ' | ' + t.getValue('name'));
    }
    if (!n) gs.error('[o] NO cleaner trigger found');

    // corroborate from DATA, not config: oldest audit row ≈ policy age if cleanup ran
    var a2 = new GlideRecord('sys_audit');
    if (a2.isValid()) {
        a2.orderBy('sys_created_on'); a2.setLimit(1); a2.query();
        if (a2.next()) gs.info('[o] sys_audit oldest = ' + a2.getValue('sys_created_on'));
    }
})();
```

**Pass:** workers sub-second to a few seconds; at least one cleaner scheduled
forward; oldest `sys_audit` row ≈ its policy age.

⚠ **A single `Table Cleaner` row being stale is not sufficient evidence** that
housekeeping is dead — that is why this probe enumerates every `… able Cleaner`
trigger *and* corroborates from data. See `§A` step 1 in
`references/procedure-phase1-orient.md`.
