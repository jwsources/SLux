# Probe conventions — load this before running or writing ANY probe

Loaded by the `diag-playbook` skill. **Read cost: ~6 KB.**
**This module applies throughout, not at one step.** Every script in
`references/probes-phase1.md` … `probes-phase4.md` follows these. Keep them if
you write a new one.

Run in a background script, scope **`global`** unless noted. Read the matching
procedure section first — **probes produce numbers, not conclusions.**

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

---

## The twelve conventions

| # | Convention | Why |
|---|---|---|
| 1 | Validate table + every field before use; abort on missing | a filter on an absent field matches **every row** (`R3`) |
| 2 | Time-bound a rotated table first; never `orderBy` it unbounded | the query becomes a UNION across all shards (`M-2`) |
| 3 | `COUNT` + `groupBy` only — accumulate `SUM`/`MAX`/`AVG` in JS | the numeric aggregates are unreliable (`T6`) |
| 4 | Never `^OR` in a filter, especially a write filter | it breaks out of the preceding AND group (`W5`) |
| 5 | `fieldISNOTEMPTY`, not `!= ''` | `!=` does not match empty (`R3`) |
| 6 | Self-report truncation when a cap is hit | a truncated total is a floor, not a total |
| 7 | Validate the **field** too, not just the table, before it reaches a query | an absent field in an encoded query throws and logs a stack trace |
| 8 | Writes: dry-run → print plan → count ceiling → per-row re-assert → verify after-state | `W1`–`W9` |
| 9 | **Bucket a rate with per-bucket `GlideAggregate` COUNT — never a capped row loop** | a `setLimit` row loop truncates the **oldest** buckets and can invert the shape verdict. Measured: newest bucket read **6,038** capped vs **31,955** aggregated — 5.3× under, and "CLIMBING" was reported from the wrong evidence |
| 10 | **Capacity-sanity-check every extrapolation** | `runs_per_day × duration` double-counts whenever `duration > observed_cadence`. Measured: **284.32 h/day** extrapolated for a job whose measured cost was **25.31 h/day**. One job name cannot exceed 24 h/day per concurrent claim |
| 11 | **NEVER attribute a population from a `setLimit(n)` sample without `orderBy`** — group with `GlideAggregate` instead | the rows come back as one contiguous physical block, so whatever is bursting at that offset looks like the whole table. Bit **three times in one session**: "86% of log volume is source X" (actually ~0%), "≥500/min" (actually 2/min), "97,152/day" (actually 9,216/day). If you must sample, label it a sample and never state a share |
| 12 | **Exclude `source = '*** Script'` when attributing log volume, and never `gs.info` a message you are also counting** | background-script output is itself written to `syslog`. A probe that prints the message it is measuring inflates the next probe's count — measured: half of a 3,704-row "finding" was the suite's own echo |

---

## Field-safe count

Returns `{v, why}` — never throws, never fabricates a number. Takes a list of
`[field, value]` conditions so precision is not lost for field-safety.

🛑 **`isValidField` CANNOT validate a dot-walk.** `isValidField('task.active')`
returns **false** even though the query works perfectly — a dot-walked path is not
a dictionary field on the base table. Validating it naively turns a working query
into a **false VOID**, which is the mirror image of the false-zero problem: you
discard a real result instead of trusting a fake one. **Validate only the first
segment of a dotted path.**

```javascript
function sc(table, conds) {                   // conds = [['active',true],['task.active',false]]
    var g = new GlideRecord(table);
    if (!g.isValid()) return { v:null, why:'table absent' };
    var bad = (conds || []).filter(function (c) {
        var base = ('' + c[0]).split('.')[0];  // dot-walk: validate the reference field only
        return !g.isValidField(base);
    });
    if (bad.length) return { v:null, why:'no field "' + bad[0][0] + '"' };
    try {
        var a = new GlideAggregate(table);
        a.addAggregate('COUNT');
        (conds || []).forEach(function (c) { a.addQuery(c[0], c[1]); });
        a.query();
        return { v: a.next() ? parseInt(a.getAggregate('COUNT'), 10) : 0, why:null };
    } catch (e) { return { v:null, why:'DENIED' }; }
}
```

⚠ **A dot-walk past the first segment is unvalidatable — sanity-check the RESULT
instead.** A dot-walked subset can never exceed its own unwalked parent count; if
it does, the walk is not behaving and the number is not evidence.

## Field-check helper

```javascript
function chk(table, fields) {
    var g = new GlideRecord(table);
    if (!g.isValid()) { gs.error('[chk] NOT ACCESSIBLE: ' + table); return false; }
    var miss = fields.filter(function (f) { return !g.isValidField(f); });
    if (miss.length) { gs.error('[chk] ' + table + ' MISSING: ' + miss.join(',')); return false; }
    return true;
}
```

---

## Probe index — which file, which section

| Probe | Serves | File |
|---|---|---|
| 1 — Orient | `§A`, `M-4`, appendix | `references/probes-phase1.md` |
| 2 — Large consumers | `§D`, `§C`, `§C2`, `§E` | `references/probes-phase2.md` |
| 2b — Full cost decomposition | `§D` step 3b | `references/probes-phase2.md` |
| 2c — Outbound integration latency | `M-7` | `references/probes-phase2.md` |
| 5 — Stuck vs merely slow | `§E` | `references/probes-phase2.md` |
| 3 — Attribute growth | `M-1`, `M-2`, `§B`, `§F` | `references/probes-phase3.md` |
| 4 — Reduce retention **(WRITE)** | `M-1`, `W1`–`W9` | `references/probes-phase3.md` |
| 6a — Sync-target bloat | `§G` | `references/probes-phase4.md` |
| 6b — ACL / per-row read cost | `§H` | `references/probes-phase4.md` |
| 6c — Housekeeping | `§I` | `references/probes-phase4.md` |
| 7 — Remaining sweep | `§E`, `§I` | `references/probes-phase4.md` |

Procedure modules: `references/procedure-phase1-orient.md` …
`procedure-phase4-narrow.md`.
