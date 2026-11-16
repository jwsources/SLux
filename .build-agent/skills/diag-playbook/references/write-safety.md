# Write safety — rules for irreversible acts `W1`–`W9`

Loaded by the `diag-playbook` skill. **Read cost: ~6.5 KB.**

🛑 **Every chain that ends in a write continues into this file. No exceptions.**

Anchor prefix `W` carries one meaning in this skill: write and verification
rules. **These are the playbook's `§R-del` and `§R-verify` rules, renumbered:**
`§R-del 1–6` → `W1`–`W6`, `§R-verify 1–3` → `W7`–`W9`. The rename exists because
`R` already means *operating rule* (`references/operating-rules.md`) and one
prefix must carry one meaning.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

| | Rule | Was |
|---|---|---|
| `W1` | Large deletes do not belong in a foreground script | `§R-del` 1 |
| `W2` | Batch per parent record, time-budgeted, idempotent | `§R-del` 2 |
| `W3` | Guard rails: abort on 0, on ceiling, on "every row" | `§R-del` 3 |
| `W4` | **SIZE a name-pattern action before offering it** | `§R-del` 4 |
| `W5` | **NEVER use `^OR` in a write script's filter** | `§R-del` 5 |
| `W6` | Scope matters both ways | `§R-del` 6 |
| `W7` | After an interrupted write: verify first, never blind retry | `§R-verify` 1 |
| `W8` | **A verification window must exceed the old period's span** | `§R-verify` 2 |
| `W9` | After a retention change, disk reclamation LAGS | `§R-verify` 3 |

Before any write, also satisfy `R1` (read-only until a cause is measured), `R3`
(validate every field; a condition inside a script is not parse-checked), `R4`
(reversibility, identity guard, before/after print) and `R5` (never edit vendor
code) in `references/operating-rules.md`.

---

## Deletes

### W1. Large deletes do not belong in a foreground script

Prefer a declarative flush policy and let the Table Cleaner drain it. A 255K-row
`deleteMultiple` spanning a parent/child pair was interrupted repeatedly and
finally died on a session timeout.

🛑 **A delete is never just a delete — budget ~60 ms per row, not ~1 ms.** Each
`deleteRecord()` additionally resolves **reference cascade rules** from
`sys_dictionary` for every table referencing the target, checks for **flow
triggers on `sys_audit_delete`**, and **scans each referencing table by
sys_id** — which on a rotated table is a multi-shard `UNION` **per row**.
`setWorkflow(false)` suppresses business rules and **none** of this.

**Consequences for the script:**

- **Time-budget the run** (`MAX_SECONDS`) and report `remaining` so it can be
  re-run. Batch size does not change total time — per-row cost dominates.
- **Gate the count with a CEILING (`target > EXPECTED`), never equality.**
  Counts shrink between batches, so an equality gate aborts every run after the
  first.
- `deleteMultiple()` does not avoid the per-row bookkeeping; it only removes the
  chance to re-assert each row.

> `EXAMPLE:` deleting 4,030 `task_sla` rows took **~4 minutes** across two runs
> (3,000 then 1,030), 0 refused. Per row the log showed the `DELETE`, a
> `sys_dictionary` cascade lookup, a `sys_flow_record_trigger` check against
> `sys_audit_delete`, and a **7-shard UNION** over `sla_repair_log_entry` by
> `tsla_sys_id`. The delete itself was ~1 ms of that. Between runs one stage went
> 22 → 0, which an equality gate would have treated as an abort.

### W2. If a manual purge is genuinely required

**Batch per parent record**, with a time budget, idempotent and re-runnable.

### W3. Guard rails

Abort if the count is 0, exceeds a sanity ceiling, matches *every* row, or would
leave nothing behind. Skip in-flight parents.

### W4. SIZE a name-pattern action before offering it

Count the matches and print the full list **first**. A pattern derived from a
handful of named examples routinely matches an order of magnitude more records —
and the operator approves on the strength of the examples they were shown, not
the set that will actually change.

> `EXAMPLE:` a cost analysis named ~10 jobs; the regex derived from it matched
> **103** and deactivated **87**. A follow-up "restore" pattern intended for ~6
> records reactivated **~46**, including jobs deliberately disabled by someone
> else long before — prior state unrecoverable without digging through version
> history. Both scripts had dry-run modes. Neither had a count ceiling.

### W5. 🛑 NEVER use `^OR` in a write script's filter

In an encoded query `^OR` breaks out of the preceding AND group: `a=1^ORb=2`
means `(a=1) OR (b=2)`, so the qualifier you believed applied to both clauses is
silently dropped from the second. On a read that yields a wrong count; on a
**write** it modifies records you never identified. Use one encoded query per
intent, or assert the discriminating field **per row inside the loop** (`R3`).

### W6. Scope matters both ways

A scoped `run_script` may fail outright; for a global table, retry in `global`
(identity guards keep it safe). Conversely a table with `delete_access = 0`
**refuses deletes from `global`** and must be run in its **owning scope**.

The read-side twin of this rule is `§D`'s `ScopeAccessNotGrantedException` note
in `references/procedure-phase2-consumers.md`: a refusal is a property of the
context, not of the table.

---

## Verification windows

### W7. After an interrupted write with unknown outcome: verify first, never blind retry

Re-read `sys_mod_count` and field values to establish whether it landed.

### W8. A frequency change needs a verification window LONGER than the old period's span

Measuring a 24-hour window one hour after changing an hourly job still shows 23
hours of pre-change data. **Never report a projection as an achieved result.**

This rule also governs the `§E` stuck-vs-slow test
(`references/procedure-phase2-consumers.md`): a re-read interval shorter than
the job's own `processing_duration` reports a projection, not a result.

### W9. After a retention change, disk reclamation LAGS

…until the rotation engine prunes surplus shards. **Write-rate reduction ≠ size
reduction** — state both separately.

> 🚦 **GATE** — verify the **behaviour**, not the edit. A value landing in a
> field proves nothing about what it does (`R3`).

---

## The one guarded write in this skill

Probe 4 in `references/probes-phase3.md` reduces rotation retention. It is the
worked implementation of `W1`–`W9`: dry-run → print plan → count ceiling →
per-row re-assert → verify after-state. Read `M-1` in
`references/mechanics.md` first — the `duration` floor and the
hierarchy-parent cascade both constrain what the write can legitimately do.
