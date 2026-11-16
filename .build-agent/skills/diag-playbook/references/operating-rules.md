# Operating rules `R1`–`R9`

Loaded by the `diag-playbook` skill. **Read cost: ~8 KB.**
**These apply throughout a triage, not at one step.** Anchor prefix `R` carries
one meaning in this skill: operating rules. Write and verification rules are
`W1`–`W9` in `references/write-safety.md`.

Normative. Blocks marked `EXAMPLE` are illustrations from real runs — evidence
that the method works, never values to reuse.

---

## The five that bite most often

Read these before touching anything. Each one has cost a real triage a wrong
conclusion or an unintended write.

| Rule | Ignore it and… |
|---|---|
| 🥇 **`R3` — validate the query against the table's ACTUAL fields BEFORE running it** | you query a field that does not exist, or one whose *content shape* differs from your assumption, and act on a result that means nothing |
| **`R2a`** — never tune from measurements taken *during* the incident | you relocate jobs to fix contention-inflated numbers, then measure no improvement |
| **`R3`** — a filter on an absent field matches **every row**; `!=` misses empties; **a condition inside a script is not parse-checked** | a silent mass-write, or a "fix" that inverts the logic it was guarding |
| **`R9`** / `T2a` in `references/tooling-and-judgement.md` — a tool reporting success *or* emptiness is not evidence; a zero is VOID until a control fires | you report a finding that does not exist, or miss one that does |
| **`W4`–`W5`** in `references/write-safety.md` — size a name-pattern action before offering it; **never `^OR` in a write filter** | you change an order of magnitude more records than you reviewed |

---

## R1. Read-only first

Every diagnostic step is a read-only probe. No write until a cause is
*measured*.

## R2. Measure, don't infer

Static signals mislead: regex over scripts, configured intervals, job counts,
table row totals. Always join a suspicion to a measured cost (duration, query
count, rows/day). **A pattern without a cost is not a finding.**

## R2a. Never tune from measurements taken during the incident

Duration fields — and any cost-weighted ranking built on them — are inflated by
whatever contention was present when the job last ran. **Re-measure after
recovery before changing any schedule.**

> `EXAMPLE:` the same daily jobs re-measured after an unrelated scheduler
> deadlock cleared: durations fell 40-95% (one from 344 s to 16 s), and a
> collision window totalling 55.8 min re-measured at 24.7 min. The restaggering
> recommendation derived from the first set would have relocated vendor jobs to
> fix a number rather than a problem. Post-recovery the honest answer was closer
> to `R7`: no action.

## R3. Validate every field at runtime

`GlideRecord.getValue()` returns **`null`** for a non-existent field **with no
error** — and it returns `null` for an **existing-but-empty** field too, so
**the value cannot tell you which you have**. **`isValidField()` is the only
discriminator**, and the distinction matters: an absent field is a naming bug
that will never resolve itself, an empty one is a legitimate data state.

⚠ **Worse than a bad read: a *filter* on an absent field is silently DISCARDED
and matches every row.** Measured: `addQuery('<absent_field>',
'<impossible_value>')` returned all 15,190 rows of a 15,190-row table
*(reproduced; first-hand)*. The platform logs `Invalid query detected ...
[Unknown field ...]` to the system log, but your script sees only a suspiciously
large result set. **Never filter on a field you have not confirmed exists.**

> **Always print an explicit OK / MISSING table for every table+field a probe
> touches, before aggregating anything.**

```javascript
function fldOk(t,f){try{var g=new GlideRecord(t);return g.isValid()&&g.isValidField(f);}catch(e){return false;}}
[['sys_auto_flush','age'],['sys_trigger','next_action']].forEach(function(c){
  gs.print((fldOk(c[0],c[1])?'OK      ':'MISSING ')+c[0]+'.'+c[1]);
});
```

⚠ **`!=` does not match rows where the field is EMPTY.** A guard that derives a
complement by subtraction — `total - excluded` — therefore mis-sums whenever any
row has an empty value, and can fire a **false ABORT** that looks like a broken
script. Derive the complement arithmetically from one query, or assert per row
inside the loop. **A per-row assertion is strictly stronger than any filter:** if
the filter ever silently fails, the assertion skips instead of writing.

🛑 **A condition embedded in a SCRIPT is not validated by the write.** Editing an
encoded query, filter or relative-date fragment inside a script field succeeds
regardless of whether the new condition is valid — no parse check, no error, and
the before/after string comparison (`R4`) passes perfectly. **A verified edit is
not a verified behaviour.**

**Execute the new condition and assert it returns what you expect BEFORE writing
it.** If a throttle depends on a query matching, prove that query matches.

⚠ **Relative-date units are not interchangeable.** `@day@ago@7` matched **zero**
rows on an instance where `@hour@ago@168` — the identical interval — matched
correctly *(observed once)*. A non-matching throttle query **inverts** the logic
it guards: `if (!gr.next())` becomes permanently true, so the guarded block runs
every time.

> `EXAMPLE — my own error:` a throttle was widened from `@minute@ago@2` to
> `@day@ago@7` and reported as a **5,040× reduction** purely because the string
> landed in the field. `@day@ago@7` matched nothing, so the throttle was
> **removed, not widened**. Caught only by measuring behaviour afterwards — the
> target property's `sys_mod_count` advanced between two queries a minute apart.
> The corrected fix used `@hour@ago@168` and asserted a non-zero match before
> writing.

## R4. Reversibility

One field, one record, guarded by an identity check that aborts on mismatch.
Print before **and** after in the same script. Capture the rollback context.
Classify SUCCESS only when the after-state is verified.

```javascript
var j=new GlideRecord('sysauto_script');
if(!j.get(SYS_ID)) { gs.print('ABORT: not found'); }
else if(j.getValue('name')!==EXPECTED_NAME) { gs.print('ABORT: name mismatch'); }
else { /* print before → change → re-read → print after → classify */ }
```

## R5. Never edit vendor code

For store/plugin/scoped apps the only safe levers are **`active`**, **schedule
cadence/time**, and **system properties**. Editing vendor scripts, ACLs,
transform maps or dictionary entries is upgrade-unsafe and often a security
regression.

Check `upgrade_safe` on every record you change. If `0`, an app upgrade can
silently revert your fix — record it and re-check after upgrades.

## R6. Escalate genuine vendor defects

Mitigating the instance and reporting the bug are **not alternatives**. Do both.

## R7. Occam's razor / do no harm

If it measures fine, the correct action is **no action** — state that with the
evidence, as carefully as you would a fix. Expect a large share of
investigations to end this way. Reporting discipline: `J2` in
`references/tooling-and-judgement.md`.

## R8. Properties go through the property path

Use the `update-system-property` skill (`run_script`), never a Fluent
`Property()` build. `Property()` only declares existence/default in an app's own
scope and **silently no-ops** on private or cross-package records — the build
reports success while the value is unchanged.

⚠ **Some property values are refused by design.** A platform hardening list
rejects unsafe values regardless of role — **including `maint`** — logging
`Not allowing set of unsafe property value: <name>=<value>`. That is a design
decision, not an obstacle to engineer around. If a documented remediation
requires setting one, that remediation is closed and the issue is a support
case. Check this **before** building a fix around a property change.

## R9. Trust artefacts, not tool responses

A tool reporting success, or reporting emptiness, is not evidence. See
`T1`–`T7` and `T2a` in `references/tooling-and-judgement.md`. Verify the
artefact.
