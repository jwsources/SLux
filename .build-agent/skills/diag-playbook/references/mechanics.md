# Platform mechanics `M-1`–`M-7`

Loaded by the `diag-playbook` skill. **Read cost: ~32 KB** — the second-largest module.
Load the specific `M-*` your router row names rather than the whole file when
you are mid-incident.

Anchor prefix `M` carries one meaning in this skill: platform mechanics.
Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| Anchor | Answers |
|---|---|
| `M-1` | Retention: rotation vs flush, and why they don't stack |
| `M-2` | Class hierarchies are subsets; never sum parent + child; bound rotated-table queries |
| `M-3` | Scheduled-job timing: three interpretations of `run_time` |
| `M-4` | Metrics that exist **only** on `stats.do` |
| `M-5` | Stale node identity; orphan rows; which record types hold a lock |
| `M-6` | Queues with **no backing table** — and what to do when a restart isn't available |
| `M-7` | Outbound integration latency — recorded in `sys_outbound_http_log` and nowhere else |

---

## M-1. Retention: rotation and flush are different and DO NOT stack

| Mechanism | Tables it governs | How it deletes | Retention formula |
|---|---|---|---|
| `sys_table_rotation` + `sys_table_rotation_schedule` | rotated tables — typically `syslog`, `sysevent`, `syslog_transaction`, `sys_history_line` (verify per instance) | drops/reuses whole shard tables (`syslog0000`…) | **`rotations` × `duration`** |
| `sys_auto_flush` (Table Cleanup) + `Table Cleaner` job | non-rotated tables — e.g. `sys_audit`, `sys_attachment`, `sys_flow_context` | row-by-row `DELETE` by age | **`age`** (seconds) |

> **A `sys_auto_flush` policy on a rotated table is dead configuration.**
> Editing it changes nothing. This is common and highly misleading.

### Dead flush policy has TWO grades, and they are not equally interesting

Classify, do not merely count. *(reproduced — measured on one instance, 3 of 4
hits were merely consistent)*

| Grade | Condition | Why it matters |
|---|---|---|
| **MISLEADING** | flush `age` **<** rotation retention | the policy promises **more aggressive** cleanup than the table actually gets. This is the one that fools people |
| **CONSISTENT** | flush `age` **≥** rotation retention | still inert — editing it does nothing — but it makes **no false promise** |

> `EXAMPLE:` an instance with **1,171** active flush policies had **4** genuinely
> pointing at rotated tables. The most misleading: a **14-day** flush policy on
> the system log, whose real retention was **56 days** (8 rotations × 7 days) —
> 4× what the configuration appeared to promise. Anyone "fixing retention" by
> editing that policy changes nothing at all.
>
> ⚠ **A fifth case was a FALSE POSITIVE, and it is the instructive one.** The
> table had a rotation record with **null `rotations`**, first reported as
> "indeterminate retention". Reading `type` showed **`shard`** — horizontal
> partitioning, no time dimension — so its **365-day flush policy was live and
> authoritative all along.** Calling it dead config would have labelled a
> correctly-managed table as unmanaged. **Always read `type` before classifying.**

### Dead config is not the only retention failure — check for INADEQUATE coverage

A table can carry policies that are active, valid and correctly targeted, yet
still not cover the rows that actually accumulate: a policy with `conditions`
set only matches a subset. **Always compare the table's oldest row against every
applicable policy age.** If the oldest row is far older than all of them, some
population is escaping every policy — and a dead-config scan reports that table
as clean.

> `EXAMPLE:` a flow-context table held 384,375 rows under **four** active flush
> policies (2 d, 2 d, 14 d, 42 d) — none dead, none misconfigured. Its oldest row
> was **194 days** old, because ~1,000 rows stuck in a non-terminal state matched
> no policy's condition. Separately, a sibling table had **no policy and no
> rotation at all** — unbounded, and invisible to a scan that only looks for
> conflicts.

### 🛑 NEVER reduce retention below your own analysis window

`§B` in `references/procedure-phase3-growth.md` needs a **10–14 day daily
series** to tell a decaying burst from a steady producer. Cut a log table below
that and you permanently lose the ability to attribute its own volume — you
trade a diagnosable instance for disk you may not even need.

**Detect this state on arrival — it may already have happened.** Compare every
rotated log table's `rotations × duration` against the **10-day floor** *before*
reading any `§B` series, and label the series accordingly. The failure is silent
and looks exactly like a volume ramp-up. The detector is built into probe 3
(`references/probes-phase3.md`).

> `EXAMPLE:` an instance carried `syslog` at **3 rotations × 1 day = 3 days**.
> A 7-day `§B` series printed `-6d 0` and `-5d 150,067` against ~250–289K on the
> recent days — which reads as "logging started five days ago" and is nothing but
> the shard boundary. Only 3 of the 7 buckets were real data. **`§B` attribution
> on that table is permanently degraded**: a burst that decayed four days ago can
> no longer be distinguished from a steady producer, and no probe can recover it.
> The probe now labels every bucket beyond measured retention
> `BEYOND RETENTION — shard pruned, NOT a volume signal`.

### Size the saving before taking it

`sys_physical_table_stats` holds `table_size_in_gb`, `row_count` and
`reclaim_estimate_in_gb` per table. If it is **empty**, you have no measured cost
and therefore no basis for the change (`R2`) — check whether its gatherer has
ever run before concluding the table is simply unused.

**Reducing retention on a ROTATED table means changing `rotations`, not the
flush policy** — editing the `sys_auto_flush` row does nothing (dead config).
And `duration` sets a hard floor:

| Shard `duration` | Lowest reachable retention |
|---|---|
| 1 day | `rotations` 1–14 → 1–14 days, fully tunable |
| 7 days | **2 rotations = 14 days**; 1 = 7 days |
| 30 days | **1 rotation = 30 days — 14 days is UNREACHABLE** |

⚠ **Do not change `duration` to get below the floor.** It alters shard geometry
on a live table; treat the floor as the real minimum unless you have a verified
procedure.

✅ **Reducing `rotations` speeds up QUERIES, not just disk.** Every read of a
rotated table is a `UNION ALL` across each live shard, so the shard count is a
direct multiplier on query cost. **A date-bounded query only unions shards whose
range overlaps the window** — so with 7-day shards a one-day query touches at
most 2 regardless of configuration. What `rotations` caps is the **worst case**:
a full-retention or unbounded scan.

**Verify by counting `UNION ALL` clauses in the generated SQL** — that is ground
truth for how many shards are live, and it reveals mid-prune states that the
`rotations` field alone cannot.

> `EXAMPLE:` after cutting `syslog` from 8 rotations to 2, a one-day bounded
> count unioned **2** shards and ran a flat **100-124 ms**, against **180-2,030 ms**
> for the same shape before the change — roughly **10-19× faster** on the query
> pattern used by `§B`, `§D` and `§F`. Pruning was **partial** a few hours later:
> the `rotations` field read 2 but the SQL still unioned **7** shards
> (`syslog0000` had dropped, the rest had not), and row count was still 12.2 M
> against an expected steady state of ~5.6 M. **Config, shard count and row count
> converge on three different timelines — measure each separately.**

### 🛑 A rotation change on a HIERARCHY PARENT cascades to every child class

Child classes share the parent's shard geometry (`M-2`), so changing `rotations`
on a parent re-shards all descendants and changes **their** retention too. The
true scope of the change is the whole subtree, not the one row you edited.

**Before changing a parent's retention, enumerate its children**
(`sys_db_object` where `super_class` resolves to the parent) so the blast radius
is known rather than discovered. Expect a long single-row write: the
synchronisation business rule rebuilds every child shard inline.

> `EXAMPLE:` reducing `syslog` from 8 rotations to 2 re-sharded **~33 child
> classes** in one write — `df_log`, `import_log`, `discovery_log`, `wf_log`,
> `syslog_app_scope`, `pa_job_log_rows`, `syslog_email`, `sys_rollback_log` and
> more — and the `Table Rotation - Synchronize Update` business rule took
> **1 m 07 s** for that single record. A 25-row plan therefore altered retention
> on well over 50 physical tables. Cumulative `sys_choice_compiled` cache
> flushes added ~90 s across the run.

> `EXAMPLE:` a demo instance held **56 days** of system log (8 × 7 d) with an
> 11.6M-row table, while its `sys_auto_flush` row claimed 14 days and did
> nothing. `sys_physical_table_stats` was **empty** — its On Demand gatherer was
> 45 days past due — so the disk cost was unmeasurable. The owner's instinct
> ("2 days is plenty") was below both the `§B` window and the 7-day shard floor;
> the defensible target was **`rotations` 8 → 2 = 14 days**, a 4× cut that lands
> exactly on the analysis window.

### How to determine which applies

1. Does a `sys_table_rotation` record exist for the table? → **check `type`
   before concluding anything.**

   🛑 **A rotation record does NOT always mean rotation governs retention.**
   `sys_table_rotation.type` has (at least) two values and only one is a
   retention mechanism:

   | `type` | Meaning | `duration` / `rotations` | Governs retention? |
   |---|---|---|---|
   | `rotate` | **time-based** rotation | both populated | **Yes** — `rotations` × `duration` |
   | `shard` | **horizontal partitioning** by key (`shard_by`, `shards`) | both **empty/null** | **No — no time dimension at all** |

   ⚠ For a `type=shard` table the **flush policy is the real and only authority**
   — the opposite of the dead-config case. Misreading it as rotated makes a live
   policy look dead, and the table look unmanaged when it is fine.
   ⚠ `shards` can also be set on a `rotate` row (partitioned *within* each
   rotation), so **`shards` alone does not identify the type — read `type`.**
2. `duration` is stored as a datetime offset from epoch
   (`1970-01-08 00:00:00` = 7 days). Convert by diffing against the epoch.
   🛑 **SANITY-BOUND THE RESULT — `duration` is not always an offset.** Some rows
   hold an **absolute datetime** instead, which parses as *decades*. Reject any
   computed duration over ~365 days as **malformed, not long**, and skip the row.
   ⚠ **`initialized = 0` means the rotation was never activated.** Those rows are
   inert and their `duration`/`rotations` are not authoritative — exclude them
   from any retention calculation *and* from any write.

> `EXAMPLE:` on one instance two rotation rows carried
> `duration = 2026-10-13 15:47:01` — an absolute date — which parsed to
> **20,739 days (56.8 years)** and produced a nonsense retention of 124,437 days.
> Both had `initialized = 0`, `base_cleaned = null`, `sys_mod_count = 0`: created
> but never activated. A bulk retention script computed `rotations 6 → 1` for
> them and would have written it; only an unrelated count ceiling stopped the
> run. **Bound the parse and check `initialized` before trusting either field.**

3. **Prove it empirically:** if rows survive far past the flush `age` but stop
   dead at the rotation boundary, rotation is the real authority.

⚠ **This interaction is undocumented.** *(undocumented — official Table Cleanup
documentation does not mention rotated tables at all.)* Treat the rule as a
strong empirical finding and re-prove it per instance.

**`sys_auto_flush` fields (grounded in official docs):**

| Field | Doc label | Meaning |
|---|---|---|
| `tablename` | Tablename | target table |
| `matchfield` | Matchfield | Date/Time field monitored; **defaults `sys_created_on`** |
| `age` | **Age in seconds** | wait before delete — **units are SECONDS** |
| `active` | Active | on/off |
| `clean_peripheral` | Clean journals | also deletes `sys_journal_field` rows |
| `clean_audit` | Clean audit | also deletes `sys_audit` + `sys_audit_relation`; **`sys_audit_delete` is preserved** |
| `cascade_delete` | Cascade delete | also deletes records referring to them |
| `conditions` | Conditions | condition builder |

Newer instances wrap this in **Data Management Policies** / **Data Management
Console** (`sys_dm_policy`). Check for that before assuming the classic
`sys_auto_flush` list is the only entry point.

**Field-name traps** — plausible guesses that return `null` silently:
`age_in_seconds` (✗ → `age`), `datefield` (✗ → `matchfield`),
`match_condition` (✗ → `conditions`).

---

## M-2. Class hierarchies are subsets, not additions

Many platform tables are hierarchies. On `syslog`, children such as
`syslog_app_scope`, `wf_log`, `discovery_log`, `pa_job_log_rows` are **subsets**
of the parent. **Never sum parent + child.** A child appearing to have "no
cleanup policy" may be fully covered by the parent's rotation.

Counting a rotated table's child class directly can also fail outright with
`Logic Error: No Join Found for table: <shard>`. Count the parent, filter by
`sys_class_name`.

⚠ **Never `orderBy`, or filter an unindexed column, on a rotated table without a
TIME BOUND.** Any query against the parent becomes a UNION across every live
shard; adding a sort forces that whole union to be materialised and sorted
*before* the limit applies — so `setLimit(12)` saves nothing. **Add a bounded
`sys_created_on` range first:** it uses the index and restricts the query to one
or two shards instead of all of them.

> `EXAMPLE:` an unbounded `orderByDesc('sys_created_on')` + `setLimit(12)` with a
> `source` filter, against an 11.6M-row rotated log table, ran over a minute
> before being cancelled. The identical read bounded to a 15-minute window first
> returns immediately. An unbounded `COUNT(*)` on the same table took 7.4 s — use
> that as the yardstick: anything involving a sort will be worse, not comparable.

---

## M-3. Scheduled-job timing has at least three interpretations

`run_time` is **not** reliably in any single timezone:

1. **System default** (`glide.sys.default.tz` — often unset, then a JVM/other
   default applies).
2. **Per-job** `time_zone` field.
3. **`time_zone = floating`** — no fixed offset; `next_action` anchors to the
   previous run, not to `run_time`.

`run_dayofweek` is conventionally Monday=1 … Sunday=7, but `sys_choice` may hold
**zero rows** for it, and the computed day can additionally depend on whether
`run_start` is populated.

> **RULE: after ANY schedule change, re-read `sys_trigger.next_action` and
> confirm the actual computed date/time. It is the only authority.
> Never report a schedule from the field you set.**

⚠ **For some job classes `run_time` is decorative and predicts nothing.**
Analytics/PA-style collectors can all carry an identical `run_time` yet fire at a
different hour entirely, because their collection time is owned by their own
scheduler rather than that field. **Editing `run_time` on those jobs does not
move them.** Never infer one job class's offset from another's — derive it per
class, empirically.

> `EXAMPLE:` eight collectors all carried the same `run_time` value yet every one
> had a `next_action` an hour earlier than any floating-offset rule would give.
> A restaggering plan built on `run_time` would have changed nothing at all.

**Establishing the offset for an instance:**

```javascript
var now=new GlideDateTime();
gs.print('GMT     : '+now.getValue());              // yyyy-MM-dd HH:mm:ss
gs.print('display : '+now.getDisplayValue());        // MM/dd/yy HH:mm:ss  ← different format!
gs.print('session : '+gs.getSession().getTimeZoneName());
```

⚠ `getValue()` and `getDisplayValue()` use **different formats** — parsing the
hour at a fixed offset is a real bug source. Then derive the `run_time` offset
empirically: change one job's `run_time` and read back `next_action`.

---

## M-4. Some metrics are not scriptable at all

`java.lang.Runtime` is blocked (`Illegal attempt to access class`). The
following exist **only** on `stats.do`: servlet memory, semaphore pool queue
depth / rejections, OS load average, DB connection-pool utilisation,
response-time percentiles, scheduler queue length and worker state.

Fetch `https://<instance>/stats.do`. Caveats:

- Reports **one node**; a load balancer chooses which. On multi-node instances
  the work may be elsewhere — cross-check `sys_cluster_state` and
  `sys_trigger.claimed_by`.
- Some fields render only when non-zero (e.g. `Total rejections`).
- Its clock may differ from `gs.print` (often instance-local vs GMT). Align
  before correlating.
- It is a **snapshot** — poll repeatedly at intervals.
- 🛑 **RECORD the `node_id` with every reading.** The load balancer may hand you
  a different node between polls, and memory, semaphore counters and rejection
  totals are all **per node**. Trending them across readings from different
  nodes fabricates a trend. If the node id changed, the two readings are **not
  comparable** — say so rather than drawing a line between them.
- ✅ **The worker list is the fastest health signal on the page.** Every worker
  showing sub-second to few-second durations = healthy. **Any worker showing a
  multi-hour duration is a wedged job**, permanently costing you that slot. One
  glance replaces several scripted probes. Procedure:
  `references/procedure-phase1-orient.md`.
- ⚠ If it is readable **unauthenticated**, that is a security finding worth
  raising (it exposes node IDs, IPs, build tags, memory state).

---

## M-5. Stale node identity: rows referencing a node not in the cluster

Rows can carry a `node` / `system_id` naming a node that does not exist on this
instance. Nothing here can claim them, so they stay non-terminal indefinitely —
and the cause is invisible unless you check that field against the live cluster.

**Discriminator:** compare `node` / `system_id` against `sys_cluster_state`.
Any value outside that set is stale. This is also the **safest possible
remediation filter** — it cannot match a live row.

**Do not assume a clone.** A rename, re-provision, or node replacement produces
identical symptoms. Distinguish by timestamp: rows created *before* the identity
change were carried over, but a row created *after* it means a running service
still holds the old identity in cache and will keep writing it until restarted —
a materially worse defect, and one a clone cannot explain.

Two observed effects:

- **Progress workers / execution trackers stuck non-terminal**, with
  `start_time` and `completion_time` empty and the parent already terminal. A
  serialised queue (e.g. application install) blocks behind them indefinitely
  while the UI renders a stale progress bar as "In progress". ⚠ **The lock
  holder may be a SINGLE worker — clearing the queued items achieves nothing.**
  Find the row holding the lock, not the rows waiting on it.
- **Startup-type triggers permanently past due**, feeding the `§A` floor.

**Remediation:** mark terminal with an **error/cancelled** state, never success
— they never ran, and success would assert work completed that did not. **Read
the state choice list first** (`sys_choice`, `name=<table>^element=state`)
rather than guessing a value. Check `propagate_error_to_parent`; where `0`,
nothing cascades. Assert the node value **per row inside the loop**, not only in
the query filter (`R3`). The write itself goes through `W1`–`W9` in
`references/write-safety.md`.

### ⚠ The node discriminator finds only SOME orphans

A row on a node that **is** in the cluster can still be orphaned: its parent
operation may have been cancelled while the row was left non-terminal. "Node not
in `sys_cluster_state`" is a safe filter but a **structurally incomplete** one —
by construction it cannot find these.

**Discriminator for a live-node orphan — require all three:**

1. `start_time` is **empty** — it never began; **and**
2. the row sits in a waiting/pending state (e.g. `"Pending resource locks"`);
   **and**
3. the **parent operation it references is already terminal** — resolve the
   reference out of `detail_message` / `parent` and read that record's state.

Condition 3 is load-bearing: it is what separates an orphan from a legitimately
queued operation, and it makes the fix safe to run at any time.

### 🛑 Enumerate EVERY record type that can hold the lock before declaring a queue cleared

One logical operation is often represented in several places at once, and
clearing some leaves the others holding the lock:

| Layer | Example |
|---|---|
| Plan / definition | `sys_batch_install_plan` |
| Worker | `sys_progress_worker` |
| Tracker | `sys_execution_tracker` |
| **Tracker SUBTYPE** | same table, filtered by `type` (e.g. `sys.applifecycle.operation`) |

**Always check the `type` field.** A tracker table can carry operation subtypes
that a name-based or node-based filter silently misses.

🛑 **The SAME `sys_id` can exist in more than one table.** A progress worker and
an execution tracker for one operation may share an identical `sys_id`.
**Cancelling one does not clear the other** — and because the sys_id matches, a
later check looks like it is examining the record you already fixed.
**Re-query by sys_id in EVERY candidate table, not just the one you remember
touching.**

🛑 **"Non-terminal" is more than one state.** Enumerate the full state list
(`sys_choice`) and sweep **all** non-terminal values. A sweep written for
`state=0` (pending) silently ignores `state=1` (running) — and a *running*
operation on a dead node is exactly as orphaned, while also being the state most
likely to hold a UI-blocking lock.

**Two distinct orphan classes, needing different discriminators AND different
fixes:**

| | Never started | Started then abandoned |
|---|---|---|
| State | pending (`0`) | **running (`1`)** |
| `start_time` | empty | **populated** |
| `percent_complete` | 0 | often **high (e.g. 99%)** |
| Discriminator | `start_time` empty + parent terminal | **`percent_complete` frozen** + node dead **or** parent terminal |
| Mark as | **error** — it never ran | **depends — verify first** |

⚠ **For a started-then-abandoned row, check whether the WORK actually finished
before choosing a terminal state.** Read the target record: if the application,
record or object is present at the expected version, the work completed and the
tracker was merely abandoned ⇒ mark **complete**. If the target shows no
progress ⇒ mark **error**. Guard the write on that check, so the script aborts
rather than asserting a success that did not happen.

> `EXAMPLE — four passes to clear one lock:` (1) 184 trackers on a dead node,
> (2) the batch-install progress worker, (3) three plan records invalidated,
> (4) two `state=0` applifecycle operations. The UI *still* showed "installing".
> The final blocker was a **`state=1`** applifecycle operation for the specific
> app being installed, `start_time` populated, 0%, on the dead node — **sharing
> its `sys_id` with the progress worker cancelled in pass 2**, so it had been
> reported as fixed 24 hours earlier. Separately, three `state=1` trackers frozen
> at **99%** were marked **complete** rather than error, because the applications
> were verified installed at the expected versions — the work had finished six
> hours after the trackers stopped updating.

⚠ **Cancelling the queued work cancels the operation itself.** Marking stale
plan/queue records terminal releases the lock but does **not** resume what was
pending — it abandons it. **Re-initiation is mandatory, not a follow-up**, and
the UI will keep rendering the dead tracker until the page is reloaded. Say this
to the user explicitly before clearing anything they are waiting on.

> `EXAMPLE:` ~185 install trackers stuck non-terminal naming a node absent from
> `sys_cluster_state`, all created within one minute, parent already terminal.
> Clearing all of them — and the stale plan records behind them — did **not**
> unblock installs. The actual lock holder was **one** progress worker in state
> `running` with the message "Pending resource locks", on that same dead node.
> Cancelling that single row released the queue.
>
> **Rename, not clone:** that worker was created **~76 minutes after** the new
> cluster nodes registered and ~56 minutes after fresh identity certificates
> were issued. A clone cannot create rows after the clone point — a live service
> was still writing the pre-change node identity from cache.

---

## M-6. Some queues have NO backing table — verify before planning remediation

Not every ServiceNow queue is a table. Platform subsystems can hold work in JVM
memory (e.g. `com.glide.update_operation.*` application-operation queues), with
only transient latch identifiers surfacing in `sys_trigger.job_context`. Those
identifiers are **not records** — they resolve to nothing in any table.

**Verify a backing table exists before designing any fix.** Query
`sys_db_object` for the candidate name **with a control pattern in the same
query** (`T2a` discipline in `references/tooling-and-judgement.md`): a zero with
no control firing is VOID; a zero with a control firing means the table genuinely
does not exist.

**If there is no table, record-level remediation is impossible:**

- You cannot inspect the queue contents.
- You cannot clear it by deleting rows — there are no rows.
- Filters, guards, ceilings and dry-runs have nothing to operate on.
- The levers reduce to: **stop whatever is enqueueing**, or **restart the node**.

🛑 **Deleting the orchestrator trigger is NOT equivalent to clearing the queue.**
A Run Once orchestrator that is genuinely working — passes complete, even if
slowly — will simply be re-created by the still-populated queue, and killing it
mid-pass can leave partially-applied work. That is a different situation from a
wedged trigger with `run_count 0` **and** `processing_duration 0`, which is safe
to remove. **Check whether passes complete before reaching for deletion.**

⚠ **When a restart is unavailable** (hosted/managed instance, no operator
access), the only remaining lever is the **producer**. Identify what enqueues the
work — pending records in the originating table, an auto-upgrade process, a
scheduled job, a business rule — and stop that. The queue drains once nothing
refills it.

🛑 **BEFORE concluding a restart is required: check for a non-terminal record
holding the lock the queue is waiting on.** A flat-rate poller (`§F` in
`references/procedure-phase3-growth.md`) consuming large capacity may simply be
re-checking a lock that will never release. That is **not** an unreachable
in-memory problem — the lock holder is a record, and clearing it is a normal
guarded write.

**The tell:** the queue's own state or the blocked operation's `message` names a
lock (e.g. `"Pending resource locks"`). Enumerate every candidate lock-holding
record type (`M-5`) and check for non-terminal rows **on live nodes as well as
dead ones**. Exhaust that before escalating to infrastructure — a restart is the
remedy for an unreachable queue, not for a reachable record someone has not
found yet.

### 🛑 `sys_store_app.install_date` being EMPTY is NOT a reliable install-pending marker

UI-framework-delivered component packages (`last_installed_from = dist`, created
by the framework's own service account, names shaped `@vendor/component-name`)
legitimately carry an empty `install_date` while being fully functional —
`active = 1` with a populated `version`. Treating that field alone as "stuck"
produces false positives, and a **recent `sys_updated_on` on such a record is
routine framework delivery, not evidence of a live producer.**

**Discriminate on three fields together:** a genuinely stalled store app has
`install_date` empty **AND** `active = 0` **AND** `version = null`. Anything with
`active = 1` and a version is working regardless of `install_date`.

> `EXAMPLE — my own error:` 14 app records with empty `install_date` were read as
> pending installs, and the most recently updated one was presented as the
> producer of a runaway operation queue. Nine were framework-delivered UI
> components behaving normally; only **five** were genuinely stalled. The
> "producer" was the UI framework publishing a component bundle.

> `EXAMPLE:` an application-operation queue generated a trigger row **every
> second across both nodes**, consuming **38 h/day** — the largest single load on
> the instance. The orchestrator was not wedged: its passes completed, averaging
> 105 minutes. No `app_operation` or `update_operation` table existed (confirmed
> with a firing control), so there was nothing to clear and no script could reach
> it. The target application record's `sys_updated_on` had not moved in **46
> hours**, proving the work was having no effect at all.
>
> ✅ **Resolution — no restart required.** The queue was polling for the
> `"Pending resource locks"` state held by **two** orphaned
> `sys.applifecycle.operation` trackers on **live** nodes, each referencing a
> batch-install plan already marked `invalid` (see `M-5`). Marking those two
> terminal stopped the queue **entirely** — zero trigger rows afterwards,
> confirmed with a firing control. **38 h/day recovered by two guarded field
> updates.** The in-memory queue was never the problem; a reachable record was.

---

## M-7. Outbound integration latency is recorded in exactly ONE place

🛑 **`sys_outbound_http_log.response_time` is the only record of how long an
outbound call took.** It is not `sql_time`, not `business_rule_time`, not
`cpu_time` — so in `§D`'s decomposition it appears as **UNACCOUNTED**, which
looks identical to in-script compute or GC. Without this table you will
attribute external latency to your own code.

**Method:** bound the window first (the table is usually rotated, `M-2`), then
**group by `hostname`** and accumulate total / average / maximum in JavaScript
(`T6` in `references/tooling-and-judgement.md`). Rank by **total**, not call
count — a chatty intra-datacenter endpoint and a slow external one look alike by
volume and nothing alike by cost. Runnable: probe 2c in
`references/probes-phase2.md`.

### ⚠ Field availability varies by release — validate before relying on it

On one instance `hostname`, `url`, `method`, `response_time`, `source_table` and
`source_record` were present while **`http_status` was absent entirely**, making
failure rates unmeasurable from this table. Report that as **VOID**, not as
"no failures".

> `EXAMPLE — second instance, same gap:` `http_status` absent again, with
> `hostname`, `response_time` and `sys_created_on` all present. **Two of two
> instances checked cannot measure outbound failure rate from this table**
> *(reproduced ×2)* — treat its absence as the **expected case** and never report
> "no failures" from it.
>
> Same window, ranked by total: an adoption-telemetry host at **60 s across 28
> calls** (avg 2,147 ms, max 10,991 ms) led, while an intra-datacenter host took
> **12 calls at 2 ms each**. Ranking by call count would have pointed at a host
> contributing 0.04 % of the cost — `M-7`'s ranking trap, reproduced exactly.

🛑 **A slow external endpoint is usually NOT fixable on the instance.** The
levers are caching, making the call asynchronous, or removing the integration —
not tuning ServiceNow. Say so plainly rather than implying a config fix exists.

> `EXAMPLE:` `§D` measured **30% unaccounted** on `rest` transactions, with no
> component explaining it. `sys_outbound_http_log` over the same window showed
> **95 calls** whose cost was almost entirely external: an MCP server at
> **1,141 ms average** (max 1,476 ms), a threat-intel API at 395 ms, and an LLM
> gateway at 263 ms. Meanwhile an intra-datacenter host accounted for **72 of
> the 95 calls at 2 ms each** — the highest volume and the lowest cost.
> Ranking by call count would have pointed at exactly the wrong endpoint.
