# Procedure — Phase 4: NARROW DIAGNOSES (`§G`, `§H`, `§I`)

Loaded by the `diag-playbook` skill. **Read cost: ~17 KB.**
**Symptom-gated — skip unless your router row names one of these.**
Runnable: probes 6a, 6b, 6c and 7 in `references/probes-phase4.md`. Conventions
that govern every probe: `references/probes-conventions.md`.

Anchor prefix `§` carries one meaning in this skill: procedure sections.
Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| Anchor | Run it when |
|---|---|
| `§G` | a sync/import job is slow or slowing over time — **distinguish G1 vs G2** |
| `§H` | per-row read cost is suspected, or one table's lists/forms are slow |
| `§I` | housekeeping sweep, by symptom |

---

## §G. Sync-target bloat: two distinct mechanisms

Both present as "a sync job is slow". **The tell distinguishes them; the fixes
differ, and the wrong branch does nothing.**

| | G1 — staging never purged | G2 — coalesce-key duplication |
|---|---|---|
| Tell | `staging rows ≫ target rows`; staging spans **many** runs | `target rows ≫ distinct(natural key)`, **and** `business_rule_time ≫ sql_time`, **and** staging spans only **one** run |
| Fix | flush the **staging** table | the coalesce key design |
| Cost of choosing wrong | you flush staging that is already empty, and runtime does not move | you redesign a key on a healthy map, touching vendor metadata for nothing |

### G1 — Staging never purged

Job creates a fresh `sys_import_set`, stages the **entire** remote dataset every
run, calls `transformAllMaps()`. Cost ≈ `rows × 25–30 SQL`. If staging is never
purged it grows linearly and per-run cost climbs.

**Tell:** `staging row count ≫ target row count`; staging spans many runs.
**Fix:** `sys_auto_flush` on the **staging** table (age 1–2 days) + reduce
cadence. Never rewrite vendor sync logic (`R5`). Skip in-flight parents
(`sys_import_set.state = loading`).

> `EXAMPLE:` 255,277 staging rows across 8 runs feeding a **4-row** target,
> ~1M SQL/run, 78 minutes, cost rising run over run.

⚠ **False-positive guard: `staging = 0` is the HEALTHY post-import state**, not
duplication. G1 requires `staging > 0`.

### G2 — Coalesce-key duplication

The transform coalesces on a composite key that includes a **mutable or
versioned** field. When that value changes upstream, the transform **INSERTs
instead of UPDATEs**. The target grows monotonically; with
`run_business_rules = 1`, per-row BR cost scales with target size, so **runtime
grows as duplication grows** — self-reinforcing.

**Tell:** `target rows ≫ distinct(natural key)`, and `business_rule_time` ≫
`sql_time`, and staging spans only **one** run.

**Diagnostic recipe:**

1. `sys_transform_map` where `source_table = <staging>` → `target_table`,
   `run_business_rules`.
2. `sys_transform_entry` where `map = <sys_id>` → entries with
   `coalesce = true`. **A versioned/mutable field in the key is the bug.**
3. `GlideAggregate` the target grouped by the natural key → distinct count and
   worst-case duplication. **Derive the worst case by iterating the group rows
   and tracking the maximum in JavaScript — NOT with `addAggregate('MAX', ...)`,
   which is defective** (`T6` in `references/tooling-and-judgement.md`).
   `groupBy` + `COUNT` is trustworthy; the `MAX` over those counts must be
   computed by you.

   🛑 **The coalesce key is usually COMPOSITE — group by ALL of its fields, never
   one.** Call `groupBy()` once per coalesce field so the grouping is the whole
   key. Testing a single field measures nothing and manufactures false positives:

   | Single-field artifact | What it actually means |
   |---|---|
   | `distinct = 1` over N rows | the field is **empty on every row** — all rows fall in one null bucket |
   | `distinct` = 2, 8, 32 … | the field is **low-cardinality by nature** (a table name, a source system, a floor) |

   ⚠ **Guard both before reporting:** if the composite key is unpopulated on all
   rows, the result is **VOID — key not populated, duplication cannot be
   assessed** — not a finding. Only a *populated composite* key with
   `target ÷ distinct ≫ 1` is G2 evidence.

> `EXAMPLE — three failed attempts at this one probe:` (1) flagging
> `target > staging × 5` matched ~90 maps whose staging was **0** — an empty
> staging table is the *healthy* post-import state, not duplication. (2) Adding a
> `staging > 0` guard fixed G1 but G2 then grouped by the **first** coalesce field
> only, producing 55 hits — `distinct(correlation_id) = 1` over 8,864 rows (empty
> field), `distinct(floor) = 32` over 6,108 rows (low cardinality). (3) Only
> grouping by the full composite key, with an empty-key guard, gives a usable
> answer. On that instance the true result was **G1 absent, G2 unconfirmed**, and
> the BR-vs-SQL check returned *no transactions in window* — so **no action under
> `R7` regardless**. Three iterations to reach "nothing here".

4. `syslog_transaction` where `url CONTAINS <job name>` → per-run
   `response_time` / `sql_count` / `business_rule_time`.

> `EXAMPLE:` target 32,281 rows for 14,104 distinct names, worst case 803
> duplicates of one key, +8,949 rows in 3 days. Coalesce set was
> `version` + `name`. Per-run: 27 minutes of which **18 minutes was
> business-rule time** (SQL only 287 s), and cost was *erratic* (176 ms on one
> run, 27 min on another) rather than proportional to source size. Staging held
> a single run's window — so G1's staging fix would have changed nothing.

**Watch for coalesce keys containing:** `version`, `revision`, `state`,
`updated`, `timestamp`, `sequence`, `hash`.

### Two further outcomes the probe separates out

| Outcome | Meaning | Fix |
|---|---|---|
| **key-not-populated** | key empty on most rows ⇒ coalesce cannot match, every run **inserts** | source field mapping |
| **bucket-dominated** | one key value holds >50% of keyed rows | inspect; usually **not** duplication |

### Fix options for a heavy periodic job (applies broadly)

| Option | Change | Effect | Risk |
|---|---|---|---|
| **Relocate** | move `run_time` outside the user's working window | **zero loss of function** | one field, reversible — **prefer this whenever the feature is still wanted** |
| **Reduce cadence** | e.g. daily → weekly | proportional load cut | one field; loses freshness |
| **Deactivate** | `active = false` | removes the load entirely | one field; loses the feature |
| **Fix root cause** | e.g. correct the coalesce key | true remedy | ⚠ vendor metadata — upgrade-unsafe, may change data semantics → prefer a **support case** |
| ✗ **Purge duplicates** | bulk delete target rows | — | **not recommended** — vendor data, large delete, regrows next run (`W1`–`W6` in `references/write-safety.md`) |

> **Ask what the user actually needs before choosing.** A feature used
> occasionally is best **relocated**, not reduced or disabled — that came from
> the user volunteering "I demo this once in a while", not from any measurement.
> See `J6` in `references/tooling-and-judgement.md`.

---

## §H. ACL / per-row read cost

**Verify the mechanism before touching anything.**

1. Read ACLs are **role-gated first** — a script only executes for users holding
   that ACL's role. Per-row cost is user/role-specific, not universal.
2. Many scripted ACLs are **row-scoped by design** (e.g. a customer seeing only
   their own account's records). Converting these to pure-role is a
   **data-exposure regression**, not an optimisation.
3. **Check for a query-time fast path first.** Some applications move row
   scoping off per-row ACL evaluation and onto a single query filter, gated by a
   property. If enabled, the per-row branches are dormant and **the table is
   already optimal → recommend no change.**
4. Classify record-read ACL scripts: `answer = true`/`gs.hasRole` → role gate,
   simplifiable; `current.*` comparison → row-scoped, keep; `GlideRecord` or a
   util call → heavy per-row work. **Heavy cost hides inside Script Include
   calls a regex cannot see.**
5. Confirm empirically via `syslog_transaction` filtered to that table — low,
   flat `sql_count` is fine. **No query traffic ⇒ nothing to optimise**, however
   large the ACL count.

> `EXAMPLE:` a CSM case table had ~20 scripted record-read ACLs and 123 active
> business rules — alarming on inspection. But the query-rules property was
> enabled, so scoping ran as a query-time filter and every per-row branch was
> dormant. Correct output: **no action**, with evidence.

⚠ **An interactive-traffic probe only sees HALF the surface.** ACL cost also
accrues inside scheduled jobs, where it is invisible to a `syslog_transaction`
scan filtered to hot tables. One instance measured **47 s of `acl_time` in a
single background job** while the interactive probe reported no ACL cost at all.
Use `§D` step 3b's `acl_time` component
(`references/procedure-phase2-consumers.md`) for the background surface.

### Companion — and an honesty note

The **`sn-roles-acls`** shared hint covers the *authoring* side (role hierarchy,
table/field ACL patterns, own-records pattern, the Fluent `ACL()` / `Role()`
shape) and carries the **grounded doc sources** for ACL mechanics. It is a hint
record, not a file in this skill — see the companions note in `SKILL.md`.

✅ **Grounded 2026-09-17:** step 1 above is confirmed by official docs — within
an ACL the evaluation order is **Role → Security Attribute → Condition →
Script**, so a script really does only run for holders of that ACL's role
(`platform-security/access-control/permission-evaluation.md`, HTTP 200).

⚠ **But ACLs are only the LAST of four layers**, and the three above them are
invisible in `sys_security_acl`:

```
Business rule  →  IAccessHandler  →  Data filters  →  ACL
```

`IAccessHandler` is internal platform code that **can grant or deny access
without evaluating ACLs at all** — you cannot change it or see it. Data filters
are a separate read-only mechanism.

> **Diagnostic rule:** if observed access contradicts the ACL configuration, stop
> reading ACLs and look *above* them. "The ACLs say X" is not an explanation of
> behaviour.

Two more facts that change what you measure:

- **Table-level evaluation uses only Role + Security Attribute ACLs.** Condition
  and Script ACLs participate at *record/field* level only — so a condition on a
  table-level ACL is not ignored by accident, it is out of scope by design.
- **Access Analyzer** does this analysis for you per user/role/group, with
  `Passed`/`Blocked`/`Skipped`/`Undefined` statuses, an alert icon flagging
  script-bearing ACLs, and debug logs of the deciding logic. Prefer it to
  hand-reading ACL scripts.

⬜ **Still empirical, not documented:** the query-time fast-path behaviour in
step 3, and role inheritance granting upward. **Verify by** fetching the
candidate doc filenames tracked in the `sn-roles-acls` hint's "NOT grounded"
table and confirming HTTP 200 before citing any of them.

---

## §I. Housekeeping sweep (run as needed, by symptom)

Each item: what to measure → how to judge → the trap.

| Area | Measure | Judge | Trap |
|---|---|---|---|
| **Attachments** | `size_bytes` totalled **per `table_name` by iterating a `groupBy`** | platform/store artifacts are usually **not** safely deletable; orphans are | **two** `SUM` traps: it returns scientific notation — `parseInt("2.1E9")` = **2** (use `parseFloat`) — *and* `GlideAggregate`'s numeric aggregates are unreliable (`T6`). **Sum the group-by yourself**; that avoids both |
| **Import staging** | rows per table extending `sys_import_set_row`; oldest row; cleanup jobs active? | staging spanning many runs = G1 | child enumeration hits **cross-scope read denials** from `global` — list will be partial |
| **Indexes** | high `sql_time` with modest rows on one table → check index coverage | add an index only for a proven read pattern | `sys_index` has **no `name`** column and `sys_index_element` may not exist. Real columns include `logical_table_name`, `index_col_name`, `col_name_string` |
| **Event queue** | counts by `state`; oldest pending; by `queue` | see `§F` in `references/procedure-phase3-growth.md` | — |
| **SLA engine** | `task_sla` volume + created-recently; active definitions with scripted conditions | zero recent + no scripts = clean | SLAs are business-critical — verify unused before deactivating |
| **Flow / workflow** | contexts by `state`; long-`WAITING`; retention policies | high ERROR share warrants root-cause **before** any change | state matching is **case-insensitive** — `WAITING`/`waiting` double-counts the same rows |
| **Business rules** | per hot table: active count, sync vs async, no-condition count, N+1 in loops | unconditional sync rules on high-write tables are the risk | mostly vendor-owned → report, don't edit (`R5`). Logic may live in Script Includes |
| **Debug properties** | `sys_properties` where name matches debug/verbose/log.level/trace and value is on/debug/verbose/all | flags left on from troubleshooting | `info` levels are normal. Also check ingestion/feedback logger properties that *route* messages into `syslog` |
| **Audit / journal** | `sys_audit` grouped by `tablename` then `fieldname` over 24h | **identical counts across several fields ⇒ unchanged values being rewritten** | divide field count by runs/day to identify the writing job |
| **Form / list weight** | sections, elements, related lists, list columns — **active only**; inactive scripts do not execute | trim default views | count **per view** — counting all views overstates a single form. One query per related list **per form load**: cost only when forms open |
| **Quota / semaphore** | `sysrule_quota` rules and ceilings; node count | sane ceilings = healthy | mostly node-level; see `M-4` in `references/mechanics.md` |
| **Update sets / versions** | `sys_update_version`, `sys_update_xml` volume | grows by design — it is your change history | **leave alone** unless extreme |

> `EXAMPLE — audit:` three fields on one table each showed ~50,500 rows/day —
> *identical* counts, which only happens when the same records are rewritten with
> unchanged values. 50,500 ÷ 24 runs/day ≈ 2,104 records per run pointed straight
> at an hourly sync job. The table had **zero** business rules, confirming the
> job wrote directly.

🛑 **A 24-hour audit aggregate CANNOT distinguish a steady producer from a
burst** — the same trap `§B` documents for log volume. Before chasing a
concentration, **measure the current rate over a short bounded window** (15-30
min) and compare it to the daily figure. A daily total dominated by a burst
collapses to near zero when re-measured live.

🛑 **Check whether YOU caused it.** Bulk remediation — schema changes, table
rotation, mass updates — generates lock and audit churn in proportion to the
work done. A spike inside a window that contains your own change is evidence
about **your change**, not about the instance.

🛑 **Verify the mechanism EXISTS before proposing a fix for it.**

> `EXAMPLE — my own error:` an audit sweep found **175,507 rows in 24 h on one
> table, 97% of all audit volume, all on one field** — a textbook churn finding,
> and a remediation was drafted to disable auditing on it. Two measurements
> killed it: the table's dictionary already had **`audit = 0`** with no field
> set to `audit = 1`, so there was nothing to disable; and a direct 30-minute
> read returned **4 rows** — about 192/day, **0.1%** of the implied rate. The
> burst came from a retention change made minutes earlier that re-sharded ~50
> tables and hundreds of physical shards, each taking and releasing locks.
> **Verify the mechanism exists AND the rate is current before proposing a fix.**

### False-positive guard — a breached SLA is not automatically waste

A high breached share is **not** waste if the parent tasks are still open. Split
by parent state before proposing anything.

> `EXAMPLE:` one instance found **3,885 of 3,890** breached SLAs attached to
> **OPEN** tasks — no action. Only the five on closed parents were even
> candidates.

⚠ **Whitespace in a grouped value makes rows invisible to every
`field=value` filter.** A value like `"\tin_progress"` groups separately and no
equality filter will ever match it. Flag any grouped value where
`raw !== raw.trim()`, and trim+lower-case before counting (`§C2` step 1 makes
the same point about flow states).

### Epoch `run_start` on `sys_trigger`

Where present, derive cadence from `run_count / trigger_age`, **never from
`run_start`**. The false-positive guard that keeps this from being a
mass-false-positive is in `§E`
(`references/procedure-phase2-consumers.md`) — a 1970s `run_start` is usually
normal.
