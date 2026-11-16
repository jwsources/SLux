# Procedure — Phase 2: FIND THE LARGE CONSUMERS (`§C`, `§C2`, `§D`, `§E`)

Loaded by the `diag-playbook` skill. **Read cost: ~41 KB** — the largest module; load the specific
`§` your router row names when mid-incident.
Runnable: probes 2, 2b, 2c and 5 in `references/probes-phase2.md`. Conventions
that govern every probe: `references/probes-conventions.md`.

Anchor prefix `§` carries one meaning in this skill: procedure sections.
Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

**Phase 2 order:** `§D` (measure) → `§C` (extrapolate what `§D` cannot see) →
`§C2` (flows) → `§E` (runaway and stuck).

> 🚦 **GATE** — subtract transient work before calling any total steady state,
> and remember "transient" is a claim requiring evidence (`R2a` in
> `references/operating-rules.md`).

🛑 **Three totals, two of which must never be added.**

| Pair | Rule |
|---|---|
| `§D` vs `§C` | `§D` is **authoritative** for frequent jobs; `§C` covers rare ones `§D` cannot see. Do not present both as the instance total |
| `§C` vs `§C2` | **NEVER ADD** — the flow engine's handler job *is* the flow execution. Summing inflates by roughly the whole flow figure |

---

## §C. Scheduler load: cost-weighted, in the user's timezone

**Six steps:** **(1)** histogram all `sysauto` subclasses · **(2)** cost-weight
it — *mandatory, no duration floor* · **(3)** collisions, heavy jobs only ·
**(4)** confirm contention exists before staggering · **(5)** map to the user's
working hours · **(6)** apply, then verify via `next_action`.
Then continue to **`§C2`** — flows are invisible here.

⚠ **`sysauto` is NOT the whole trigger surface.** Flows and Flow Actions schedule
and poll independently of the scheduled-job tables, and a flow on a short trigger
interval can outrank every `sysauto` job on the instance. After completing `§C`,
audit flow execution separately: group `sys_flow_context` by `flow` over a
**bounded window** to get the creation RATE — the state totals alone are
dominated by historical completions and tell you nothing about current load.

🛑 **`sys_flow_context.flow` does not always reference a flow.** It can point at
`sys_hub_action_type_definition` — a Flow **Action**. Resolving names against the
flow table alone leaves your worst offenders as bare sys_ids; always try the
action-definition table too, or you will dismiss the top error producers as
unidentifiable.

> `EXAMPLE:` a thorough `sysauto` audit declared the scheduled-job surface
> handled. A separate flow audit then found a single flow firing **every 5
> seconds** — the largest single consumer on the instance, and invisible to every
> `sysauto` query. Its three largest error producers were Flow **Actions**
> (webhook trigger checks for integrations with no live connection), which
> resolved to nothing against the flow definition table.
> **Measured figures live in `§C2` — do not restate them here.**

### Step 1 — histogram every active `sysauto` subclass by `run_time` hour

Heavy jobs live in `sysauto_pa`, `sysauto_par`, `sn_*_sysauto_script`,
`sysauto_internal_timer` — **not only `sysauto_script`**.

### Step 2 — cost-weight it *(mandatory)*

Join each job to `sys_trigger.processing_duration` and sum milliseconds per hour.
**Rank by seconds of work, never by job count.**

🛑 **`processing_duration` is ONE SAMPLE — the last completed run.** It is real
execution time (`T7` in `references/tooling-and-judgement.md`), not a proxy, but
it is a single observation per job. Where run-to-run variance is high, the
extrapolation `observed_frequency × processing_duration` is badly wrong, and
**nothing in the method reveals that it is wrong.**

🛑 **CAPACITY-SANITY-CHECK THE RESULT — the extrapolation can exceed physical
time.** When `processing_duration > observed_cadence`, the passes cannot have
been serial, so `runs_per_day × duration` double-counts without bound. **One job
name cannot consume more than 24 h/day per concurrent claim.** Cap any row that
exceeds that, **label it `SERIAL-CAPPED`**, and fall back to `§D` for its real
cost. Check the instance total the same way against `online_nodes × 24 h` and
flag any total above it.

> `EXAMPLE:` `§C` extrapolated **284.32 h/day** for a single job (272 runs/day ×
> 3,765,539 ms, observed cadence 317.9 s against a configured 30 s) inside a
> **302.83 h/day** instance total — on a two-node instance, i.e. 48 h/day of wall
> clock. `§D` measured the same job at **25.31 h/day** (6 passes, avg 63 min),
> which is ~1.05 concurrent: one worker slot held continuously. The extrapolation
> was over by **11×** and nothing in `§C` flagged it. The uncapped total made the
> instance look six times busier than it is.

✅ **Prefer `syslog_transaction` wherever it is readable** (`§D` — and check scope
before declaring it unavailable). Aggregate `response_time` grouped by `url` for
rows whose `url` starts with `JOB:`, over a bounded window, accumulating in
JavaScript. That is a **measured** total across many samples instead of an
extrapolation from one. Always report **`avg` AND `max` per job** — where those
diverge sharply, the single-sample method was guessing.

⚠ The two methods are complementary, not interchangeable. A bounded window only
sees jobs that **ran inside it**, so daily and weekly jobs are undercounted or
absent entirely. Use `syslog_transaction` for **frequent** jobs (where
single-sample error is worst) and `processing_duration` for **rare** ones.

> `EXAMPLE:` single-sample cost-weighting reported **18.14 h/day** across 1,153
> jobs. The same instance measured over a 6-hour `syslog_transaction` window came
> to **87.14 h/day** — understated **4.8×**. The cause sat in one row: a job with
> **4 transactions averaging 105 minutes**, max **3.7 hours**, contributing 28.15
> h/day by itself. Its `processing_duration` was one sample of that distribution.
>
> ⚠ **A measured window includes in-flight one-off work — but "transient" is a
> CLAIM REQUIRING EVIDENCE, never a default assumption.** Before discounting a
> large job as temporary, verify that the thing it operates on is actually
> changing: read the **target record's `sys_updated_on`**. One query settles it.
>
> `EXAMPLE — my own error:` 38 h/day was attributed to "an application install
> still running" and subtracted from the baseline on that assumption. It was not
> transient. No install was in progress, and the target application record's
> `sys_updated_on` had not moved in **46 hours** — the job was a self-sustaining
> loop and the single largest defect on the instance. Discounting it concealed
> the main finding for a full measurement cycle.

🛑 **NEVER apply a duration floor to a cost analysis.** A filter like
`processing_duration >= 60000` does not merely under-sample high-frequency
jobs — it **excludes them entirely**, and they are frequently the largest
consumers on the instance. Rank by **observed frequency × duration**:

```
observed_cadence = trigger_age / run_count      // NOT the configured period
runs_per_day     = 86400 / observed_cadence
daily_cost_ms    = runs_per_day * processing_duration
```

Use the **observed** cadence, never the configured one — jobs routinely run at a
different rate than they are configured for, in both directions. Then produce
**two** rankings: by `daily_cost` (where the work is) and by `runs_per_day`
(scheduler churn, which costs claim/release cycles and a `sys_trigger` write per
run regardless of script duration).

> `EXAMPLE:` a cost analysis floored at 60 s identified ~20 h/day of
> *recoverable* load and declared the heavy jobs handled. Re-run with no floor
> over the same instance (measured **earlier in the same triage** than the
> example above, before an unrelated deactivation pass — hence the different job
> count, and note *recoverable* ≠ *total*): **1,226** recurring jobs, **501**
> configured sub-minute, and the single largest consumer was a **metadata-search
> ingestion queue at 6.01 h/day** (1,965 runs/day × 11 s) — invisible to the
> floored analysis. Below it, five security-integration pollers at 60 s each
> totalled ~1.9 h/day. Separately, the churn ranking surfaced ~500,000
> dispatches/day across sub-10 ms jobs, including one at 40,283 runs/day with a
> **0 ms** measured pass — which explained `sys_mod_count` values in the hundreds
> of thousands on `sys_trigger`.
>
> ⚠ **Watch for jobs running FASTER than configured**, not just slower: observed
> 2.7 s against a configured 15 s, and observed 170 s against a configured 900 s,
> both with duplicate copies of the job. Over-period gets all the attention;
> under-period is equally a defect and nothing in a ratio-based check will find it.

⚠ **Do the summing in JavaScript, not with `addAggregate('SUM', ...)`.**
`GlideAggregate`'s numeric aggregates are proven wrong for `MIN`/`MAX`/`AVG`
(`T6` in `references/tooling-and-judgement.md`) and **`SUM` is untested — treat
it as suspect**. This step is the load-bearing measurement of the whole section,
so do not rest it on an unverified aggregate: iterate the rows and accumulate, or
cross-check any `SUM` against a hand-accumulated total before acting on it. A
wrong total here sends you to the wrong hour with full confidence.

> `EXAMPLE:` one hour held 378 jobs totalling **466 s**; another held 13 jobs
> totalling **2,322 s**, 99% of it a single job. A count-based histogram sends
> you to the wrong hour entirely.

### Step 3 — collisions, heavy jobs only

Use a **>300 s** threshold; a 60 s threshold produces hundreds of meaningless
pairs from clustered trivial jobs. Also check **sequential** collisions: a
consumer that spikes *after* a producer finishes (e.g. index processing following
a sync).

⚠ **When RELOCATING a job, collision-check against the INCUMBENT schedule — not
just against the other jobs you are moving.** Staggering a batch internally and
declaring it clear is a false result. For every job in the target window compute
`start + last_run_duration` and look for overlap. DB-intensive incumbents
(schema/statistics/index maintenance) are the worst to land a heavy job on top of.

⚠ **Establish which incumbents CANNOT be moved, before choosing a window.** A
`sys_trigger` row with `document = null` and `trigger_class = DEFAULT` has **no
`sysauto` definition record** — there is nothing to edit, and rescheduling it is
a support request. Unreschedulable incumbents are fixed obstacles that constrain
where everything else can go, so map them first. Confirm by querying `sysauto`
for the name: absent (with a firing control) ⇒ platform-internal.

> `EXAMPLE:` three jobs were relocated to a weekend window, staggered carefully
> against each other — and the 85-minute one was placed straight on top of two
> incumbent table-maintenance jobs (6.6 min and 5.3 min, both over the 300 s
> threshold). Neither incumbent had a `sysauto` record, so neither could be
> moved; the relocated job had to be pulled 75 minutes earlier instead. The
> internal stagger was correct and the result was still wrong.

### Step 4 — confirm contention exists before staggering anything

Scripted: `sys_trigger` where `claimed_by IS NOT NULL` (concurrent job count).
`stats.do`: scheduler queue length, mean queue age, non-idle worker count.

> If queue length is 0 and most workers are idle, jobs are **not** competing for
> worker slots — staggering is *preventative*, not corrective. Say so plainly.
> But one snapshot under-reports: a later sample may catch every worker claimed.

### Step 5 — map to the user's working hours

Ask when they actually use the instance. Convert `run_time` → their local clock
using the offset established in `M-3` (`references/mechanics.md`). Report the
share of batch cost landing inside that window.

> `EXAMPLE:` on an instance whose user worked 09:00–21:00 local, **77% of all
> weighted batch cost** fell inside those hours, with the single largest cluster
> firing exactly at start-of-day — while the quietest hour on the clock carried
> 4 seconds of work.

### Step 6 — apply, then verify the computed schedule

Verify via `next_action` (`M-3`) — never from the field you set. The write goes
through `W1`–`W9` in `references/write-safety.md`.

**Anti-patterns:** flat-spreading everything; relocating hundreds of sub-second
jobs; raising a job's frequency to clear a backlog (multiplies load); assuming
nights or weekends are quiet without checking.

---

## §C2. Flow runtime *(extension of `§C` — run it immediately after)*

🛑 **NEVER ADD the `§C` total to the `§C2` total — they overlap.** The flow
engine's own job transaction (`JOB: Flow Engine Event Handler`, visible in `§C`
and `§D`) **is** the execution that `§C2` measures as flow `run_time`. The same
work appears on both surfaces, so summing them inflates the instance total by
roughly the entire flow figure.

**Confirm the overlap empirically before reporting either number:** compare the
handler job's `max` response_time against the longest single flow `run_time`
**over the same window**.

🛑 **The window must be identical for both sides or the check is inconclusive BY
CONSTRUCTION.** Taking the handler max from a 6 h window and the flow max from a
60 min one compares two different populations — measured delta **2,851 ms**
arising purely from window skew. If no handler transaction falls inside the flow
window, the check is **VOID** — widen the window, do not report "no match".
A match to within a few milliseconds means one execution seen twice.

> `EXAMPLE — my own error:` a handler job showed `max = 973,226 ms` while a
> single flow context showed `run_time = 973,178 ms` — **48 ms apart**,
> unambiguously the same work. Jobs measured 83.46 h/day, flows 17.75 h/day, and
> the "combined 101.22 h/day" that was reported was meaningless.

**Report them as: the job total (already inclusive of flow execution), with the
flow breakdown as ATTRIBUTION of the handler's share** — never as two addends.

🛑 **`§C` and `§E` are STRUCTURALLY BLIND to flows.** There is no `sysauto` record
for a flow and no `sys_trigger` row for its execution, so every scheduled-job
measurement — frequency, duration, cost-weighting, stuck tests — returns a
number that **excludes all flow runtime**. `§D` sees it only as one anonymous
`JOB: Flow Engine Event Handler` line with no per-flow attribution. A `§C` total
presented as "the instance's scheduler load" is therefore incomplete by an
unknown and potentially larger amount.

> `EXAMPLE:` a `§C` pass reported **18.14 h/day** across 1,153 recurring jobs and
> treated the scheduled-job surface as handled. `§C2` on the same instance then
> found a single flow firing **every 5 seconds** — 700 contexts/hour, **6.31
> h/day** by itself — inside a total of **11.61 h/day** of flow runtime, none of
> it visible to any `§C` query. Flows did **not** outweigh the job surface (a
> correctly measured `§C` came to 87.14 h/day — see `§C` step 2), but 11.61 h/day
> sitting in a structural blind spot is not a rounding error.

### Step 1 — state mix and error share

Group `sys_flow_context` by `state`, **lower-casing before counting** (`§I`:
state matching is case-insensitive, so `WAITING`/`waiting` double-count). Report
the error share as a percentage.

- **Error share under a few percent** ⇒ flows are not broken; do not chase it.
- **High error share** ⇒ root-cause **before** any change.

⚠ Totals here are dominated by historical completions and say nothing about
current load. Use Step 2 for that.

### Step 2 — creation RATE, not totals

Group by `flow` over a **bounded window** (60 min works) to get contexts started
per hour. This is what surfaces a short-interval flow; it is invisible in the
state totals.

🛑 **`sys_flow_context.flow` does not always reference a flow.** It can point at
`sys_hub_action_type_definition` — a Flow **Action**. Resolve names against
**both** tables or your worst offenders stay bare sys_ids and get dismissed as
unidentifiable.

### Step 3 — per-flow COST

**Use `sys_flow_context.run_time`** — actual execution time in milliseconds.
Validate it with `isValidField('run_time')` first; it is the correct measure and
it is easy to miss, because the field is not obviously named and the context form
does not surface it prominently.

**Accumulate per flow in JavaScript, never with `SUM`.** Produce two rankings:
**total `run_time` per flow** (where the load is) and **average `run_time`**
among flows with ≥3 contexts (what is individually slow).

🛑 **Do NOT use `sys_updated_on - sys_created_on` as a substitute.** That is
elapsed wall time: it includes queue wait, engine overhead and any Wait/timer
step, and it **overstates real cost by roughly 2× on short flows**. Use it only
if `run_time` is genuinely absent, and label the result an upper bound.

> `EXAMPLE — my own error:` a flow audit reported **31.29 h/day** of flow runtime
> using the elapsed proxy, concluding flows outweighed the entire 18.14 h/day
> scheduled-job surface. The same contexts carried `run_time` values averaging
> ~4.5 s against ~10 s elapsed — so the real figure was closer to half, and the
> headline conclusion was overstated. **Check for a real duration field before
> deriving one.**

⚠ Still exclude **non-terminal** contexts from cost totals, and report the
non-terminal share: a context still open has no meaningful duration under either
measure.

### Step 3b — how was the flow triggered?

**Read `calling_source` and `source_table` before assuming a schedule exists.**
A flow's cadence may not be configurable where you expect:

| `calling_source` / `source_table` | Trigger | Where the cadence lives |
|---|---|---|
| `sys_script` | A **business rule** calls it | The business rule's condition — there is **no schedule to change** |
| Scheduled trigger | Flow trigger record | The trigger's schedule |
| Record create/update | Table trigger | Firing rate = the table's write rate |

🛑 **A flow named "daily …" may not run daily, and may not be schedulable at
all.** `source_record` identical across every context points at a single caller —
resolve it before proposing any cadence change.

> `EXAMPLE:` a flow named `daily … Last Login` ran every 2-3 minutes. It had no
> schedule: `calling_source = SCRIPT`, `source_table = sys_script`, one constant
> `source_record`. "Make it weekly" was not an available action — the throttle, if
> any, was in the calling business rule.

⚠ Before deactivating such a flow, read `J6` in
`references/tooling-and-judgement.md` — this exact flow shape has been a
keep-alive whose removal would have destroyed the environment.

### Step 4 — act, in this order

1. **Integration pollers for products with no live connection.** Flow Actions
   named `… Webhook Trigger Check`, `Pull … Spans`, `Retrieve … based on polling
   schedule` erroring on a fixed cadence are the cheapest wins — confirm the
   errors are **current, not historical** (a bounded-window count, per `§B` in
   `references/procedure-phase3-growth.md`) before acting.
2. **Flows whose name contradicts their cadence** — a flow called `daily …`
   running many times per hour is a configuration defect (`§C` step 2's
   observed-vs-configured rule applies to flows too).
3. **Obvious build artifacts** — `Copy of …`, `… 2`, `Load … to Not Upgrade …`.
4. **The largest consumer LAST**, and only after identifying what triggers it. A
   platform-internal flow on a short interval that completes successfully every
   time is not a defect, and deactivating it may break the feature it serves.

⚠ **Deactivating a scheduled job does NOT stop the equivalent flow.** The two
surfaces are independent: killing an integration's `sysauto` jobs while leaving
its polling flows active achieves roughly nothing and leaves an inconsistent
configuration. Audit both for every integration you retire.

### Step 5 — retention

Non-terminal contexts frequently escape every flush policy (see `M-1`'s
inadequate-coverage warning in `references/mechanics.md`). Check the oldest
`waiting` context against the policy ages, and group waiting contexts by flow — a
cluster on one flow is a stuck-flow finding; contexts whose `flow` resolves to
**nothing** are orphans (`M-5`).

---

## §D. Transaction & query cost

🛑 **A `ScopeAccessNotGrantedException` is a per-CONTEXT result, not a property
of the table.** If `syslog` / `syslog_transaction` reads are refused, **retry
from a different scope** — a scoped background script, or `global` — before
concluding this module is unavailable. This is the read-side twin of `W6` in
`references/write-safety.md` ("scope matters both ways").

> `EXAMPLE:` an entire triage was conducted declaring `§D` "permanently
> unavailable" after repeated `ScopeAccessNotGrantedException` on
> `syslog_transaction`. Run from a different scope, the same table was
> **readable with every field present**. Several modules' worth of conclusions —
> including "`§H` is unanswerable" — were built around a gap that did not exist.
> **Cost of the error: the one module that measures query cost went unused for a
> whole session.**

`syslog_transaction` fields: `response_time`, `sql_time`, `sql_count`,
`business_rule_time`, `type`, `table`, `url`. For scheduled jobs
**`url = "JOB: <name>"`** — the fastest way to name a culprit.

1. Summarise by `type` — **but NOT with `AVG`/`MAX` aggregates.**
   `GlideAggregate`'s `MIN`/`MAX`/`AVG` return wrong values (they collapse onto
   the `MIN`) — see `T6` in `references/tooling-and-judgement.md`. Get extremes
   with `orderByDesc('response_time')` + `setLimit(1)`, and derive an average
   from a `groupBy` distribution.
2. Order by `sql_count` desc — a single run issuing 10⁵–10⁶ queries is the N+1
   signal. **`orderBy` is trustworthy**; this is the reliable way to find the
   worst offender.
3. **Compare `business_rule_time` against `sql_time`.** If BR time dominates,
   the cost is per-row business-rule execution, not queries → see `§G` in
   `references/procedure-phase4-narrow.md`. Compare them **per row** on the
   worst offenders found in step 2, not via aggregated averages.

   ⚠ **Plan for a THIRD outcome: neither.** If `sql_time` and
   `business_rule_time` together account for only a small fraction of
   `response_time`, the cost is in-script computation, an external call, or
   waiting — and **no amount of index, query or ACL work will help it.** Do not
   force the result into the SQL-vs-BR dichotomy; say "neither" and look at what
   the script actually does. **When that happens, step 3b is mandatory, not
   optional** — it is the only thing that names the remaining cost.

> `EXAMPLE:` seven of one instance's heaviest jobs measured **0-8% SQL and 0%
> business-rule time**, at response times of 187-585 s — so 92-100% of the cost
> was neither. The *same* probe found other jobs at **99-100% business-rule
> time** (search-index ingestion). Both extremes coexisted, and any aggregate
> average across them would have described neither population.

### Step 3b — decompose the FULL cost, not just SQL vs BR

🛑 **`syslog_transaction` carries ~58 fields. Using only `response_time`,
`sql_time` and `business_rule_time` leaves most of the cost unattributed.**
Validate availability per release — **an absent field reads VOID, never zero** —
then account for all of these:

| Field | Reveals | Lever |
|---|---|---|
| **`cpu_time`**, `potential_cpu_time`, `cpu_usage` | in-script compute | the "neither SQL nor BR" answer |
| **`acl_time`** | **measured** ACL cost | `§H`'s per-row cost, directly |
| **`semaphore_wait_time`** | time queued for a semaphore pool | pool `maximum_concurrency` |
| **`session_wait_time`** | same-session request serialisation | concurrency from one client |
| `total_wait_time` | all waiting | separates *waiting* from *working* |
| **`business_rule_count`** | how many BRs ran | one slow rule vs hundreds of cheap ones |
| `clotho_time` / `clotho_count` | time-series (MetricBase) cost | invisible to SQL metrics |
| `zero_copy_sql_time` / `_count` | a separate SQL path | **not** inside `sql_time` |
| `transaction_pattern` | groups like transactions | repeat offenders vs one-offs |
| `render_size`, `output_length` | payload size | heavy forms / list views |
| `network_time`, `client_script_time`, `ui_policy_time`, `browser_time` | client-side split | "server is fine but it feels slow" |

**Compute `UNACCOUNTED = response_time − Σ(components)` per transaction type.**
A large residual is in-script compute, an external call, or GC. Where the
residual lands:

| Residual lands on | Meaning | Lever |
|---|---|---|
| `cpu` | in-script compute | the script itself |
| `acl` | per-row ACL evaluation | `§H` — but read `§H` steps 1–2 first |
| `semaphore_wait` | queued for a pool slot | `sys_semaphore.maximum_concurrency` (step 3c) |
| `session_wait` | same-session serialisation | client concurrency |
| still UNACCOUNTED, low `cpu` | external call or GC | `M-7` in `references/mechanics.md`, probe 2c |

⚠ **The components are NOT a strict budget — they can overlap.** One instance
produced **UNACCOUNTED = −10%** on a transaction type, meaning wall-clock
measures double-count across at least one pair. A negative residual is **real
and means double-counting, not an error.** Treat the decomposition as
**indicative attribution**, never as an exact sum.

⚠ **`transaction_pattern` is often `0` for background work** — on one instance
9,597 of 9,656 scheduler rows shared pattern `0`. It is only useful for
interactive traffic; there, the signal is **low count with high average**, not
the largest total.

⚠ `db_pool` / `db_category` may be unpopulated — report VOID rather than infer.

> `EXAMPLE — what the full decomposition found that SQL-vs-BR could not:`
> scheduler work resolved to **sql 18% / br 25% / cpu 49%**, closing to 93% —
> CPU was the single largest component and had been invisible. `rest` resolved to
> **semaphore_wait 13% + session_wait 10% = 23% pure waiting**, with 30%
> unaccounted (external LLM calls). Worst single values named three things no
> earlier module had: **47 s of `acl_time` in one scheduled job** (`§H` had
> concluded "no ACL cost" by only examining interactive traffic on hot tables),
> **15 s of semaphore wait on one API endpoint**, and **14,042 business rules in
> a single transaction**.

### Step 3c — if `semaphore_wait_time` is material, read the POOL

**`sys_semaphore` holds `maximum_concurrency` plus a `path` /
`path_match_operator` that decides which requests land in which pool.** A small
pool with a broad regex is a throughput ceiling that no query tuning can lift.

**Read the `path` regex carefully — routing is rarely what you assume.** Check
which pool your slow endpoint actually matches before changing anything, and
compare against `Default` for a safe upper band.

> `EXAMPLE:` an agent API waited **12-15 s** per call. `API_INT` had
> `maximum_concurrency = 4` while `Default` had **16**, and the `API_INT` regex
> matched *any* `/api/` path that was neither `now` nor `sn_communities` — so all
> custom-scope API traffic shared **4 slots**, while `/api/now/graphql` fell
> through to the 16-slot pool. `stats.do` had already logged
> `API_INT max waiter rejections: 2`, which had been dismissed as noise.
> **Verify a pool change by re-measuring `semaphore_wait_time`, not by reading
> the field back** — pools may only re-initialise at node restart.

### Step 3d — CANCELLED transactions: the blind spot in every timing module

🛑 **A transaction killed by a quota rule consumes almost no time, and may not
appear in `syslog_transaction` at all.** Every module in this skill ranks by
*time consumed* — so a request that was terminated before it finished is
**structurally invisible** to `§C`, `§D` and `§C2` alike. A user reporting "it
just stops" will show up nowhere in the cost data.

**The evidence is log TEXT, not timing data:**

```
syslog  where  message STARTSWITH 'Cancelling'      // bound the window first (M-2)
```

⚠ **Do NOT search `%cancel%`.** On one instance that returned **411 rows across
283 patterns in 21 seconds**, almost all of it application text from features
with "cancel" in the name (`cancelReservationsNotCheckedIn`, ML solution
states). `STARTSWITH 'Cancelling'` is the platform's own prefix.

**Two kill types, and they point at different fixes:**

| Message | Meaning | Fix |
|---|---|---|
| `Cancelling transaction #N <url> (maximum execution time exceeded)` | it **was running** and overran | the code, or the quota ceiling |
| `Cancelling **unclaimed (waiting)** transaction #N <url>` | it **never started** — died queued for a semaphore slot | the **pool**, not the code |

🛑 **A short `max_duration` is often CORRECT — do not reflexively raise it.**
Check `sysrule_quota.max_duration` against what the endpoint is *for*. A
presence or heartbeat call that takes 10 s is worthless whether it completes or
not; killing it is right. **Fix the queue, not the quota.**

> `EXAMPLE:` `/api/now/ui/presence` was being cancelled live — 8 occurrences in
> 12 h, newest an hour old. Its pool held **8** slots and its quota killed at
> **10 s**, while measured `semaphore_wait_time` spiked to **7,768-9,597 ms** —
> requests queued almost to the kill threshold, then died **unclaimed**. The
> decisive detail: the most recent cancellation fell inside a window whose
> measured `sem_max` was **2 ms**, because the killed transaction **was never
> written to `syslog_transaction`**. The one request that failed was the one
> absent from the data, and `§D` reported the endpoint as healthy. The real cause
> was neither pool nor quota but **volume**: `glide.ui.presence.interval = 60`
> against **10,636 sessions**, on an instance with 2-3 actual users.

4. Distinguish a **bounded periodic batch** (a necessity decision, not a defect)
   from a **continuous loop** or a **per-run cost that grows over time** (real
   defects).

⚠ Two caveats that reverse conclusions:

- **Contention fields** (`semaphore_wait_time`, `session_wait_time`, `acl_time`)
  are often unpopulated. All-zero is **not** proof of no contention — use `M-4`
  in `references/mechanics.md`.
- **On a quiet instance this measures the observer.** Your own diagnostic
  scripts can be the top `sql_count` entries. Check before blaming a job.
  ⚠ **Your remediation also feeds the queues you are measuring.** Metadata
  writes — properties, business rules, scheduled jobs — dispatch into
  search/index ingestion queues, and those queues can be among the **largest
  consumers on the instance**. A triage session that changes configuration
  inflates the very load it is assessing. Re-measure after a quiet period before
  attributing that load to a product defect.

---

## §E. Runaway and stuck jobs

**In this section:** live worker set → effective cadence → stuck test → then
**five defect patterns** — **(1)** epoch `run_start` · **(2)** unbounded rescan
hidden in a Script Include · **(3)** conditional job whose gate can never be
true · **(4)** duplicate active definitions · **(5)** starvation deadlock,
parents never resolve — **plus a discriminating test:** stuck claims vs merely
slow ones.

Live worker set: `sys_trigger` where `claimed_by IS NOT NULL`, with
`processing_duration`. **Prefer this to `v_running_scheduled_job`** — that view
can return fewer rows *and* cause side effects (table truncation plus a
drop-table job).

🛑 **Print the CLAIM AGE (`sys_updated_on`), not only `processing_duration`.**
`processing_duration` is the **last COMPLETED pass**, so a worker wedged right
now can show a small duration and a claim held for hours. Claim age is the
pinned-worker discriminator; duration is not.

**Effective cadence is the honest metric:**
`effective_gap = trigger_age / run_count`, compared with configured
`repeat`/`run_period`. Matching values = healthy by design.

**Stuck test:** `processing_duration` far exceeding the job's own period.

⚠ **An over-period RATIO is not a cost.** `processing_duration / period` tells
you a job cannot keep up with its own schedule; it says nothing about total load.
Multiply by the **observed** frequency (`run_count / trigger_age`), never the
configured one. A job may be configured every 6 s and in fact run monthly, or
configured hourly and therefore cost 24× whatever a single hour-bucket shows.

> `EXAMPLE — wrong in both directions, same session:` bucketing cost by each
> job's next-run hour under-counted hourly jobs by 24× and so hid the single
> largest consumer on the instance (20 min/hour = **8 h/day**). Separately, a job
> flagged at **14.3×** over period turned out to have run 52 times in 21 months —
> ~1.2 h of lifetime cost, i.e. noise. Ratio ranks the urgency of *that pass*;
> only frequency × duration ranks load.

> `EXAMPLE:` a job configured `repeat = 30 s` with a last run of **3,521,379 ms
> (58.7 min)** and `error_count = 0` — failing silently, not loudly.

### Defect pattern: epoch `run_start`

A `periodically` job with `run_start` at the epoch computes
`next_action = epoch + n×period` — forever in the past — so it re-fires
continuously, pinning a worker and emitting one log line per run.

⚠ **False-positive guard.** `run_start` in 1970/1974 is **usually normal** — it
is just a scheduler anchor. Only call it a runaway when **both**:

- `next_action` **itself** is at/near the epoch, **and**
- `run_count / trigger_age` ≫ `60 / period`.

`trigger_type 10` internal heartbeats legitimately show epoch `next_action` with
`document = null`. That is not a defect.

> `EXAMPLE — genuine:` 1,511,253 runs in 4.1 days = 255.7/min against a
> configured 0.5/min (**511×**), `next_action` at the epoch. Fix: set
> `run_start` (and `entered_run_start`) to now on the definition; the
> `automation synchronizer` business rule regenerates a correct future
> `next_action`. Verified 256/min → 0.5/min.
>
> `EXAMPLE — false positive:` 181,638 runs with a 1970s `run_start`, but
> effective cadence 3.3 s against a configured 3 s. No defect.

### Defect pattern: unbounded rescan hidden in a Script Include

A one-line job (`new x.Util().run()`) can hide an unfiltered
`GlideRecord.query()` that logs one line per row over a table the same job grows.
**A regex scan of job scripts cannot see this** — only measured cost reveals it.

> `EXAMPLE:` a 5-minute job whose util scanned every row of a table it kept
> appending to → millions of log rows/day. The rows were all in `error` state
> with `start_at == end_at` and zero processed, i.e. the feature had never
> worked. Fix: `active = false`; the trigger is removed automatically.

### Defect pattern: conditional job whose gate can never be true

A job with `conditional = 1` whose condition depends on a property, plugin or
record that **does not exist**. `gs.getProperty()` on a missing property returns
`null`, so `=== 'true'` is permanently false — yet **the trigger still fires on
its full schedule and still consumes its slot**. The feature is off; the cost is
not.

**Tell:** `conditional = 1` plus an absent dependency. Verify the dependency
exists (with a firing control) before assuming a conditional job is harmless.

⚠ **A suspiciously ROUND `processing_duration` is a timeout, not work.** A value
landing on exactly 20 min, 30 min or 1 h is a ceiling being hit, not a task
completing. Treat it as failing regardless of what the job claims to do.

> `EXAMPLE:` an hourly job whose gating property did not exist on the instance
> consumed **20.0 min per run = 8 h/day** — the single largest recoverable load
> found in the whole triage. Its `processing_duration` read 1,200,100 ms: twenty
> minutes to four significant figures, i.e. a cap. By its own condition it could
> not have been doing anything.

### Defect pattern: duplicate active job definitions

The same job name active more than once. Each copy claims a worker and
multiplies the load, and every copy looks individually reasonable.

**Tell:** group active recurring jobs by `name`; flag any count > 1 — then
**establish whether the family is intentionally parallelised before calling it a
defect.** Queue-consumer families (`events process <queue>`, flow and event
handlers, import transformers) legitimately run one row per worker or per node,
and a numbered series (`… 1` through `… 8`) is usually by design. A duplicate is
only a finding when the job is **not** a parallelised consumer, or when the
copies *also* run faster than configured.

> `EXAMPLE:` a duplicate scan returned **138** duplicated names on one instance —
> six copies each of several queue consumers and flow handlers. Nearly all were
> intentional parallelism. Flagging `count > 1` alone would have produced 138
> false positives and buried the real signal.

### Defect pattern: starvation deadlock — parents never resolve

A self-rescheduling job family whose **parent** records sit in a non-terminal
state. The jobs re-arm faster than the parents can be processed, so no parent
ever gets a worker, so the jobs never stop. Self-sustaining, raises no error.

**Tell:** a constant *integer* ratio of pending `sys_trigger` rows per
unresolved parent. Measure it — a ratio landing on exactly 2.00 or 3.00 is a
loop structure, not a coincidence (typically one re-schedule job plus one
recovery/monitor job per parent).

**Per-unit cost is usually trivial.** Measure how long ONE parent takes once it
does get a worker, before concluding the work is heavy. Starvation and expensive
work are indistinguishable from the backlog alone.

**Fix order is load-bearing:** resolve the PARENTS first, then delete the
pending triggers. Reversed, the recovery job re-creates every trigger within its
monitor interval.

⚠ **Filter trap:** target the specific stuck state (`=waiting`), never the
negation of the terminal state (`!=complete`). The negation also matches
in-flight intermediate states, and forcing those terminal truncates live work.

> `EXAMPLE:` ~1,000 parents stuck in a `waiting` state after a bulk install
> campaign, each holding exactly 2 pending triggers (~1 s re-schedule, ~30 s
> recovery) — measured ratio 2.001. Demand ~1,000 executions/sec against a
> ~16-24 thread pool; >21,000 unrelated jobs queued behind it, never claimed,
> oldest ~7 h late. Once one parent obtained a worker it completed in
> **9 seconds** with valid output — so ~1,000 parents was ~2.3 h of serial work
> that could never be scheduled.
>
> **`J4` note:** the first conclusion was "these will never complete". Wrong —
> 9 s each. The defect was scheduling starvation, not the parent logic.

### Distinguishing stuck claims from merely slow ones

A `sys_trigger` row with `claimed_by` set and an old start stamp looks identical
whether the worker is wedged or the job is simply long-running. **One reading
cannot tell you.** The scheduler writes these rows outside the auditing path
(rows with `run_count 0` can carry a current `sys_updated_on`), so no single
field settles it.

**Discriminating test (read-only):** re-read the same sys_ids twice, ≥10 min
apart, comparing `run_count` and `claimed_by`. Runnable: probe 5 in
`references/probes-phase2.md`.

| Observation | Meaning |
|---|---|
| Row absent on re-read | Completed — one-shot/queued rows are deleted on completion |
| `run_count` advanced | Slow but alive → capacity problem (`§C`) |
| `run_count` frozen, `claimed_by` persists | Genuinely stuck → support case |

⚠ **The re-read interval must EXCEED the job's own last-run duration.** A job
whose passes take 30-80 minutes, re-read 10 minutes apart, reads as frozen every
time — `run_count` cannot advance inside a single pass. Take
`processing_duration` first, then set the interval longer than it. This is `W8`
in `references/write-safety.md` applied to the stuck test: a verification window
shorter than the thing being measured reports a projection, not a result.

> `EXAMPLE — my own error:` a job was declared "frozen across two readings" and
> written into a support case on the strength of a 10-minute interval. Its
> `processing_duration` was **82 minutes**. A later reading showed `run_count`
> had advanced and the pass time had fallen by two thirds — chronically slow, not
> stuck. The correct interval was never used, so the verdict was never earned.

> `EXAMPLE:` 16 claims aged 6.5-28.7 h, five with `run_count 0` (never executed
> once). Two readings reduced it to **2** genuinely frozen rows — the other 14
> released themselves, including all five "never run" jobs, once an unrelated
> loop stopped consuming the pool. One apparent zombie had simply taken 27 min
> on its latest pass. Reporting the first reading alone would have raised a
> 16-item support case for a 2-item problem.
