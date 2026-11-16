# Procedure — Phase 3: ATTRIBUTE GROWTH (`§B`, `§F`, retention attribution)

Loaded by the `diag-playbook` skill. **Read cost: ~12 KB.**
Runnable: probe 3 (read) and probe 4 (the guarded retention WRITE) in
`references/probes-phase3.md`. Conventions that govern every probe:
`references/probes-conventions.md`.

Anchor prefix `§` carries one meaning in this skill: procedure sections.
Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

**Run this phase only if a table is growing.** Order: retention attribution
(`M-1`, to establish whether the series is readable at all) → `§B` → `§F`.

---

## Step 0 — retention attribution, BEFORE reading any series

`M-1` in `references/mechanics.md` owns the retention mechanics: rotation vs
flush, the two grades of dead config, the `type=shard` false positive, the
inadequate-coverage case, the `duration` floor table, and the
hierarchy-parent cascade. **Do not restate it — read it there.**

What Phase 3 adds is the **ordering rule**:

🛑 **Compare every rotated log table's `rotations × duration` against the 10-day
`§B` analysis floor BEFORE reading its series.** Below the floor, `§B`
attribution on that table is **permanently degraded** and the series must be
labelled, not interpreted. The detector is built into probe 3; its output marks
every bucket older than measured retention
`BEYOND RETENTION — shard pruned, NOT a volume signal`.

**False-positive guard — a trailing zero on a rotated table.** A `0` or an
abrupt step in the oldest bucket of a series is the **shard boundary**, not a
quiet day and not a ramp-up. Call a volume onset only when the bucket is
**inside** measured retention.

**The attribution order for a growing table:**

1. Is it rotated? Read `type` (`M-1`). `rotate` ⇒ retention is
   `rotations × duration`; `shard` ⇒ the flush policy is the only authority.
2. Is retention ≥ 10 days? If not, say the series is degraded and stop reading
   shape from it.
3. Compare the oldest row against **every** applicable policy age — the
   inadequate-coverage check (`M-1`).
4. Only then run `§B`.

⚠ **Tension to plan for:** shortening retention destroys the history this
analysis needs. **Capture baseline trends *before* reducing retention.** The
reduction itself is a write — `W1`–`W9` in `references/write-safety.md`.

---

## §B. Volume attribution (logs, events, audit, any growing table)

**Compute a rate, not a total**, over a bounded indexed window.

⚠ **Sampling trap:** `GlideRecord` + `setLimit(n)` with **no `orderBy`** returns
a contiguous physical block, *not* a sample. It will confidently mis-attribute a
transient burst. **Never state a population share from such a sample** — group
with `GlideAggregate` instead.

```javascript
// CORRECT: aggregate over a contiguous window
var from=new GlideDateTime(); from.addSeconds(-300);
var g=new GlideAggregate('syslog');
g.addAggregate('COUNT'); g.addQuery('sys_created_on','>=',from.getValue());
g.groupBy('source');            // then repeat for 'level', 'sys_class_name'
g.query();
```

**Then trend it — never conclude from one window.** Pull a **10–14 day daily
series** before deciding anything.

```javascript
for(var d=0;d<12;d++){
  var hi=new GlideDateTime(); hi.addSeconds(-d*86400);
  var lo=new GlideDateTime(hi.getValue()); lo.addSeconds(-86400);
  // count rows between lo and hi, print per day
}
```

Distinguish three shapes:

- **Steady/flat** → a recurring producer; find and fix it.
- **Past spike, now low** → a burst that will age out. Often **no action**.
- **Rising** → a compounding defect (see `§F`, and `§G` in
  `references/procedure-phase4-narrow.md`).

⚠ A series is **not comparable to a series taken on another day** — the live
shard set moves.

### Attributing ERRORS — count distinct patterns, not rows

A high error *rate* says nothing about how many *faults* you have. Before chasing
anything, **normalise the message text and bucket it**: strip 32-char hex
sys_ids, replace digit runs, collapse whitespace, truncate — then count rows per
distinct pattern.

```javascript
function norm(m){return (m||'').replace(/[0-9a-f]{32}/gi,'<id>')
  .replace(/\d+/g,'#').replace(/\s+/g,' ').trim().substr(0,110);}
```

| Result | Meaning | Action |
|---|---|---|
| **Few patterns, high counts** | one or a handful of real faults | fixable — chase them |
| **Many distinct patterns, low counts each** | diffuse | usually **unconfigured features**, not a defect — `R7` applies |

🛑 **Three things must be measured together or the verdict is wrong.**

1. **CONCENTRATION, not pattern count.** 11 patterns sounds diffuse; if 99% of
   rows are one pattern it is a single fault. **Weight by the share of the top
   pattern.**
2. **BURST vs STEADY.** A capped loop over one window cannot tell them apart.
   Compare bounded `COUNT`s across several windows (1 / 5 / 15 / 60 min).
   🛑 **NEVER filter zeros out of that comparison.** A zero in the SHORT window
   with a large count in a LONGER one is the strongest possible burst signal.
   Measured: `1min=0 5min=0 15min=551 60min=551` is a single spike, yet dropping
   the zeros compared only 36.7 and 9.2 and printed "STEADY".
3. **WHO CAUSED IT.** `source = '*** Script'` is the background-script marker:
   those rows are your own probes echoing. **Exclude it when attributing volume,
   and never `gs.info` a message you are also counting.**

**Two independent burst tells, both zero-aware:**

| Tell | Reading |
|---|---|
| A longer window holds (almost) all the rows | **STALE BURST** — the event is old, not ongoing. Check whether your own probes caused it |
| Per-minute rates diverge sharply across windows | **BURST** — the short-window rate is NOT the steady rate |
| Windows agree | **STEADY** — safe to extrapolate |

⚠ **Bound the window first and keep the sample COMPLETE.** Size the window so the
row count stays under your cap, or the pattern proportions are a contiguous
block rather than a census. **Report the cap and whether it was hit.**

> `EXAMPLE:` an error source running at **~8,400/hour** looked like a single
> runaway fault. Bucketed over a 3-minute window it resolved into **15 distinct
> patterns**, the largest at 10 occurrences — missing ML solution definitions, an
> absent crypto module, a timed-out privacy scan, a malformed rate-limit rule.
> Diffuse, with one cause each: an instance carrying many installed-but-
> unconfigured applications. **Correct output: no action on the rate**, plus one
> genuine defect (the crypto module) extracted from the noise.

> `EXAMPLE:` three windows told three different stories on one instance — a
> 10-minute sample said 34 rows/min from source X; the 24-hour count said 4,186
> total; the 12-day series revealed ~100K/day, then a 560K single-day spike,
> then ~4–10K/day. **Only the multi-day series was actionable.**
>
> `EXAMPLE — my own error:` an unordered 500-row sample landed inside a
> one-minute burst and I reported "86% of log volume is source X". Proper
> aggregates showed that source at ~0% in other windows.

> `EXAMPLE — my own error, own-probe echo:` a 3,704-row error "finding" was
> traced row by row: **3,544 of 3,704** came from two of this suite's own runs,
> correlated by timestamp against the script-request log. About half of the
> headline number was the probe measuring itself.

> `EXAMPLE — my own error, unordered sample again:` the same offset-block trap
> bit **three times in one session** — "86% of log volume is source X" (actually
> ~0%), "≥500/min" (actually 2/min), "97,152/day" (actually 9,216/day).

---

## §F. Queue backlogs: draining or stuck?

A backlog **count** is ambiguous. **Measure the oldest pending item's timestamp
twice, hours apart.**

- Oldest **advances** → draining; transient burst; often no action.
- Oldest **unchanged** while the count holds or grows → **stuck consumer** →
  `§E` in `references/procedure-phase2-consumers.md`.

⚠ **Do NOT get the oldest pending item with `orderBy` + `setLimit(1)` on a
rotated table.** The sort applies within each shard branch of the UNION and
returns one shard's minimum, not the table's. Measured: that pattern reported a
**10-day-old** row on a queue whose oldest pending item was **under an hour**.
Use a bounded `COUNT` ladder instead (1 h / 6 h / 24 h / 7 d) — each bucket is an
independent indexed aggregate that sharding cannot fool.

✅ **Better, and a SINGLE read: build a rate history from
`syslog_transaction`.** Where the consumer runs as a job, filter
`url STARTSWITH 'JOB: <name>'` over a bounded window and bucket by timestamp,
then read the shape — no second visit required.

🛑 **BUCKET WITH ONE `GlideAggregate` COUNT PER BUCKET — never a capped
`GlideRecord` row loop.** A row loop with `setLimit(n)` truncates the **oldest**
buckets (the rows arrive in physical order, not newest-first), so the earliest
buckets read artificially low and the shape verdict can invert. One aggregate
per interval cannot truncate and there is no cap to self-report.

> `EXAMPLE — the trap in this module's own probe:` a 3-hour / 30-minute history
> built from `GlideRecord` + `setLimit(30000)` returned **exactly 30,000 rows**
> and reported the newest bucket as **6,038**. Re-measured with one aggregate per
> bucket, that bucket held **31,955** — understated **5.3×**. The capped version
> still printed a confident "CLIMBING", from evidence that was partly absent.
> *(The direction happened to survive here; that was luck, not method.)*

| Shape | Meaning |
|---|---|
| **Declining** | Draining — wait, it self-resolves |
| **Flat** | Neither draining nor escalating — see below |
| **Climbing** | A live producer is feeding it; find and stop the producer |

🛑 **A FLAT rate is not automatically a defect.** Correlate it against real
workload before concluding anything: if the rate stays constant while the
subsystem's actual work *does* progress — a queue item completes, a target record
updates — then it is a **continuous poller by design**, not a backlog. A genuine
runaway shows a rate that tracks or outpaces its backlog. **Do not label a
subsystem broken on a flat rate alone.**

> `EXAMPLE:` an application-operation queue ran at **20-24/min across twelve
> consecutive 30-minute buckets** — provably not draining. In the same window an
> unrelated application installed **successfully** (execution trackers complete),
> proving the pipeline worked and the queue was not blocking it. Rate flat,
> workload progressing ⇒ poller, not backlog. The stalled applications were
> stalled for an entirely separate reason: their install plans had been cancelled
> and never re-initiated.

Also group the backlog by source table/queue to identify the producer.

> `EXAMPLE:` oldest pending event stayed frozen at one timestamp across hours
> while the count rose from 35,229 → 35,509 ⇒ stuck. The consumer turned out to
> be running back-to-back ~60-minute passes on a 30-second schedule.

### Cautionary tale — kill your own hypothesis

On that instance I first blamed a disabled ML-framework property for starving
embeddings. Targeted probing disproved it: the embedding model was active via a
different provider, and live query logs showed embeddings being generated. The
property's own description revealed it governed *model training*, not query
embeddings — vestigial. The real answer was simpler (Occam): **per-unit cost was
constant**; the job was simply doing ~10× the work because an upstream sync had
generated ~34,000 events.

> **Generalise:** when a cost jumps, first check whether **per-unit cost changed**
> or **unit count changed**. They imply completely different fixes. (`J4` in
> `references/tooling-and-judgement.md`.)

⚠ **Never disable a platform-wide search/index capability to fix one noisy
consumer.** A property like `glide.ais.semantic.enabled` is instance-wide across
every datasource — including those your own AI tooling relies on. Fix the
*volume*, not the capability.

### When the queue has no backing table

If the queue resolves to no table at all, record-level remediation is impossible
and the levers change completely — read `M-6` in `references/mechanics.md`
**before** proposing a restart. A flat-rate poller consuming large capacity is
very often re-checking a lock held by a reachable record.
