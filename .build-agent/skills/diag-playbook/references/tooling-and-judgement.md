# Tooling reliability `T1`–`T7`, `T2a` · Judgement `J1`–`J6`

Loaded by the `diag-playbook` skill. **Read cost: ~15 KB.**
**Both halves apply throughout a triage, not at a single step.** Before
concluding anything, run `J4`.

Anchor prefixes: `T` = tooling reliability, `J` = judgement. Each carries one
meaning in this skill. Normative. Blocks marked `EXAMPLE` are illustrations from
real runs — their numbers are evidence that the method works, **never values to
reuse**.

---

# PART A — Tooling reliability

**Read the evidence label on each item.** These are field observations of
differing strength, and `J3` / `R2` apply to this section as much as to any
probe: an unexplained result is usually a broken probe, not a broken platform.
The rules below are cheap insurance and stand regardless of cause — but *"the
tool is unreliable"* and *"I gave the tool bad input"* demand different
responses, and only one of them improves the operator.

## T1. `fs_find_and_replace` may report success without persisting

*Evidence: observed once; cause uncertain (sync suspected).* Edits returned
*"Successfully replaced 1 occurrence"* yet were absent on a later read; file
timestamps showed `Created` **after** `Modified`, suggesting a sync re-created
the file and discarded them.

*Counter-data: a later session ran 9 replaces — all 9 persisted and verified.*

→ **Re-read or grep after every replace.** For multi-section edits, prefer a
single atomic `fs_write_file`.

## T2. A `fs_grep` "No matches" is not proof of absence

*Evidence: false negatives observed once (`^## ` against a file plainly
containing `## 0. …`); counter-data: 2/2 accurate in a later session.*

⚠ **The trap that matters more:** a "No matches" caused by a **wrong search
string** is indistinguishable from a tool false negative. A search string
rebuilt from memory instead of read from the file produces exactly this — and
invites blaming the tool for an operator error.

→ **Never use a negative to prove absence. Never reconstruct a search string
from recall — grep or read the line first.** A positive hit is still meaningful.

⬜ **DEMOTED 2026-10-14 — see `T2a`.** Both historical false negatives predate
the invocation check in `T2a` and may simply have been usage errors. Counter-data
keeps accumulating: grep has been accurate on every occasion it was invoked
correctly. **Verify by** satisfying `T2a`'s three preconditions **and** running a
firing control before recording any new grep false negative; until that is done,
do not upgrade this item's evidence label.

## T2a. `fs_grep` preconditions — a zero result is VOID until a control fires

**To search ONE file, pass it as `glob` and leave `path` unset.** `path` is a
**directory**; a file path there returns **zero matches silently** — no error, no
warning, indistinguishable from a genuine absence.

✅ *Verified 2026-10-14: identical pattern, same file, minutes apart — **0 hits**
via `path=<file>`, **2 hits** via `glob=<file>`.*

**Before interpreting any zero result, confirm all three:**

| # | Precondition | Can it cause a false zero? |
|---|---|---|
| 1 | File targeted via `glob`, not `path` | **Yes — silently** |
| 2 | Case: patterns are case-sensitive unless `-i` | **Yes** |
| 3 | Regex metacharacters escaped or intended (`"` `.` `$` `\|` `(` `)`) | **Yes** |

⚠ **`head_limit` CANNOT cause a false zero** — it truncates. It makes results
*incomplete while appearing complete*: a different failure with a different
symptom. Never diagnose it from a zero result, and never cite it as the reason
for one.

**Then: every zero result requires a CONTROL that fires.** Re-run with a pattern
**known** to exist in the target, using **identical invocation parameters — only
the pattern may differ.**

| Control result | The original zero means |
|---|---|
| Control **fires** | **Real.** The string is absent. |
| Control **also zero** | **VOID — no information at all.** The invocation is wrong. Fix it per 1–3, or fall back to `fs_read_file`. |

⚠ **A control that does not share the invocation shape is not a control.** Run it
with a different `path`/`glob` and it will *pass* while your real query still
fails — converting a usage error into a phantom tool defect, and sending you to
`T2` to record a false negative that never happened.

> `EXAMPLE:` a verification grep over a just-edited file returned zero for all
> ten expected markers. A control pattern known to pre-exist in that same file
> *also* returned zero ⇒ **VOID**, so the file was read directly instead: all ten
> edits were present. The cause was `path=<file>` instead of `glob=<file>`.
> Re-run correctly, the same pattern found all ten at once.
>
> **`J4` note:** the first conclusion was "grep is unreliable, upgrade `T2`'s
> evidence label to *reproduced*". Wrong — and it would have permanently
> mislabelled a usage error as a platform defect. `T2` had already predicted this
> exact confusion.

## T3. `web_fetch` with a `prompt` corrupts content in TWO ways

*Evidence: both reproduced, on different folders, weeks apart.*

- **Fabrication** — a requested listing mixed a real filename (HTTP 200, full
  content) with an invented one (404), indistinguishably.
- **Lossy extraction** — a listing returned ~21 filenames that were *real but
  stripped of their sub-product folder prefix*; every one 404'd at the flat path.
  A correct answer corrupted into an unusable one.

→ **Require HTTP 200 + real content before treating any path, field name or
quote as fact.** Existence tests ("say exactly 404") are safe — status is ground
truth.

⚠ **A 404 on a prompt-derived path means "unconfirmed", not "absent"** — the file
may exist one folder deeper.

### SAFE PROCEDURE — official ServiceNow product docs on GitHub

*(inlined from the `sn-product-docs-github` shared hint, 2026-10-15, so this
entry stands alone. ⚠ Provenance: relayed as an AI-generated summary, not a raw
read — treat the URL shapes as load-bearing and verify each with an HTTP 200
before relying on it. The hint's own rule applies to the hint.)*

| Need | Authority | Never use |
|---|---|---|
| Branch list | `api.github.com/repos/ServiceNow/ServiceNowDocs/branches` | `llms.txt` — stale; delta folders — not branches |
| File metadata + URL | `…/contents/<path>?ref=<branch>` → use the returned **`download_url`** | hand-constructed raw URLs |
| Instance release → branch | `stats.do` build name, or `sys_properties.glide.war` | guessing from folder names |

- **Re-derive the branch list every time** — branches are deleted over time.
  *As of 2026-09-24 the default was `brazil`, with `australia` split out; do not
  hard-code either.*
- 🛑 **In-page raw links carry a DUPLICATED branch segment and 404 as given.**
  Strip the duplicate segment to resolve them.
- **Large directory listings truncate** — narrow the path, or read `index.md`.
- **Navigation order:** in-page raw links (verified paths) → front-matter
  metadata for orientation. Folder routing is only partial; **the API is the
  authority.** Publication folders include `platform-administration`,
  `application-development`, `platform-security`.

**What the docs are good for:** field labels, a mechanism's *intended* purpose,
UI navigation, newer wrappers.
**What they are not:** instance-specific behaviour, or undocumented interactions
between mechanisms.

🛑 **When documentation and instance data conflict, the INSTANCE WINS** (`R2`).
Docs state intent; only the instance states fact.

> `EXAMPLE — verified workflow:` the table-cleaner `age` field's unit was
> confirmed as **seconds** by fetching `activate-table-cleanup.md` from
> `platform-administration` on the matching family branch, then cross-checking
> against instance data — **independently corroborating `M-1`**. In the same
> exercise the plausible-sounding `table-rotation.md` was a fabrication and
> 404'd.

## T4. `get_table_schema` explodes on any table with a `sys_class_name` column

*Evidence: reproduced once, first-hand.* It enumerates **every class in the
instance** — 137 K characters on `sys_auto_flush`, truncated, to confirm a single
field.

→ **Use `run_query` on `sys_dictionary` filtered to named elements**
(`name=<table>^elementIN<field>,<field>`) when you need specific columns.

## T5. The workspace filesystem may be unavailable until an application scope is set

*Evidence: reproduced.* Every `fs_*` call fails until then. If memory-bank rules
are in force and the files are unreachable at session start, **say so
immediately** rather than performing compliance into a void.

## T6. 🛑 `GlideAggregate`'s `MIN`/`MAX`/`AVG` return WRONG values

This one corrupts measurements, not just calls.

*Evidence: reproduced on TWO independent instances, different tables and
columns.* An integer column with a true range of **20–63** reported
`MIN=20 MAX=20 AVG=20`; `sys_mod_count` with a true range of **0–16947**
reported `MAX=0`. Wrong both with the aggregates combined **and** with `MAX` used
alone.

**Signature: `MAX` and `AVG` collapse onto the true `MIN`** — so `MIN` reads
plausibly while the range flattens to a point. **A collapsed range on a column
you expect to vary is the tell.**

⚠ **Invisible on a constant column** — where `MIN` genuinely equals `MAX`, every
method agrees, so *"I've used `MIN`/`MAX` here before and it was fine"* is not
evidence of anything.

✅ Trustworthy: `COUNT`, `groupBy` + `COUNT`, `orderBy`/`orderByDesc`.
🛑 Not trustworthy: `MIN`, `MAX`, `AVG`.
⬜ **`SUM` untested — assume suspect.** **Verify by** running one `SUM` against
a hand-accumulated total over the same filtered set and comparing; until that is
done, accumulate in JavaScript.

→ **Extremes from `orderBy`/`orderByDesc` + `setLimit(1)`; averages and totals
accumulated from a `groupBy` distribution in JavaScript.** Full detail: the
`sn-glideaggregate-minmax` hint record.

*Caught only because the aggregate contradicted an independent signal — which is
the general defence (`J4`): one method is an assertion, two agreeing methods are
a measurement.*

## T7. `sys_trigger.processing_duration` is the LAST COMPLETED RUN, not cumulative

*Evidence: proven by observing it DECREASE as `run_count` incremented — a
cumulative counter cannot fall.* For rows currently claimed it also **mutates
mid-flight**, so any `processing_duration >= X` window query returns a **lower
bound**, not a complete set. Re-run such windows when no heavy cohort is claimed,
and never treat one reading as the job's steady-state cost.

⚠ **Consequence for `§E`:** because it reports the last *completed* pass, it is
**not** the pinned-worker discriminator. Use **claim age** (`sys_updated_on`)
instead — `§E` in `references/procedure-phase2-consumers.md`.

---

**All seven are the same failure class as `R3`'s absent-field trap: a tool
reporting success — or reporting nothing — is not evidence. Verify the
artefact.** (`R9` in `references/operating-rules.md`.)

---

# PART B — Judgement

## J1. High-cost jobs are usually product code, not customer config

On feature-rich instances the heaviest scheduled jobs are overwhelmingly
vendor-shipped — AI/analytics/indexing families especially. **Start there**, and
remember `R5`: schedule and `active` are your levers, not their code.

Defect archetypes seen repeatedly across instances:

- epoch `run_start` shipped in a job definition;
- unbounded rescan of a table the job itself grows;
- full re-sync with no change detection;
- writes of unchanged values (idempotency failure) driving audit churn;
- coalesce keys including a versioned field.

Each warrants **both** an instance mitigation and a vendor support case (`R6`).

## J2. Report no-action with the same rigour as a fix

Expect many investigations to end in "measured, healthy, no change". That is a
successful outcome. **State the evidence.**

## J3. Absent evidence is data

Empty choice lists, zero aggregates, unpopulated fields, missing files, `SUM()`
returning an absurd value — **investigate these, don't narrate past them.** They
are usually a broken probe, not a real zero.

## J4. Kill your own hypothesis

State it, then try to disprove it. A coherent theory that fits the timing can
still be wrong. Ask whether **per-unit cost** or **unit count** changed.

## J5. Same name ≠ same defect

A job with an identical name on another instance may have a completely different
mechanism. Re-derive locally. `§G`'s G1 vs G2 is the worked proof
(`references/procedure-phase4-narrow.md`): the same job name on two instances had
inverted staging/target ratios and needed different fixes.

## J6. Ask about usage before choosing a fix

Measurement tells you what a job costs. Only the user can tell you whether they
need it, and when they work. Both change which fix is correct.

🛑 **Some jobs exist to satisfy an EXTERNAL dependency, and the cost of
disabling them is invisible on the instance.** A heartbeat that stops
infrastructure reclaiming the environment, a watchdog an external monitor polls,
a sync another system consumes — none of these look any different from a
misconfigured job. **No measurement can distinguish them**, and the failure mode
is not "suboptimal fix", it is **losing the environment**.

**Before deactivating anything, ask: does anything OUTSIDE this instance depend
on this running?** Treat jobs that write a timestamp, a property, or any
heartbeat-shaped record with particular suspicion — especially on non-production
instances, which are usually the ones subject to automated reclamation.

> `EXAMPLE — a near miss:` a flow named `daily … Instance Last Login` was running
> every 2-3 minutes: name says daily, measured cadence 18×/hour, ~1.4 h/day
> apparent cost. A textbook name-vs-cadence defect, and it was placed on a
> deactivation list. The operator then revealed their infrastructure **reclaims
> instances based on last-login age** — the flow was a keep-alive, and disabling
> it would eventually have destroyed the environment. Nothing observable on the
> instance distinguished it from a misconfiguration.
>
> The correct fix was not deactivation but **widening its throttle**: a single
> encoded-query fragment in the calling business rule (`@minute@ago@2` →
> `@day@ago@7`), a **5,040×** reduction that preserved the dependency. **Ask for
> the external threshold and size the change against it** — here a 30-day
> reclamation window made a 7-day throttle safe with 23 days of margin. Do not
> pick an interval that merely feels reasonable.
>
> ⚠ That same fix is also `R3`'s worked failure: the first attempt wrote
> `@day@ago@7`, which matched **zero** rows, so the throttle was removed rather
> than widened. Read `R3` in `references/operating-rules.md` before editing a
> condition inside a script.

---

## ⬜ A standing limit on this skill's claims

**Never swept for claims unverifiable in principle.** Statements about platform
*intent* ("by design", "intentionally parallelised") and undenominated frequency
claims ("usually", "routinely", "frequently") cannot be settled by any probe.
Treat them as heuristics, not facts. **Verify by** replacing any such phrase with
a measured denominator on the instance in front of you before you rest a decision
on it.
