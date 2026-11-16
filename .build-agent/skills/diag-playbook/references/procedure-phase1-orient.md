# Procedure — Phase 1: ORIENT (`§A`, `stats.do` worker list, appendix)

Loaded by the `diag-playbook` skill. **Read cost: ~6 KB.**
Runnable: probe 1 in `references/probes-phase1.md`. Conventions that govern every
probe: `references/probes-conventions.md`.

Anchor prefix `§` carries one meaning in this skill: procedure sections.
Normative. Blocks marked `EXAMPLE` are illustrations from real runs — their
numbers are evidence that the method works, **never values to reuse**.

**Phase 1 order:** per-instance facts (appendix, end of this file) → `§A` →
worker list.

> 🚦 **GATE** — a stalled scheduler (`§A`) or a pinned worker (worker list) must
> be fixed first. A stalled scheduler makes every downstream conclusion inert; a
> pinned worker silently removes capacity from every measurement that follows.

---

## §A. FIRST: is the scheduler dispatching at all? *(always run this)*

```javascript
var now=new GlideDateTime().getValue();
function c(cb){var a=new GlideAggregate('sys_trigger');a.addAggregate('COUNT');if(cb)cb(a);a.query();return a.next()?parseInt(a.getAggregate('COUNT'),10):-1;}
var past=c(function(a){a.addQuery('next_action','<',now);});
var future=c(function(a){a.addQuery('next_action','>=',now);});
var total=c(null);
gs.print('total='+total+'  past_due='+past+'  future='+future+'  => '+Math.round(past*100/total)+'% past-due');
```

**Interpretation:** a large majority past-due on a live instance means **job
dispatch has stopped**. Corroborate two independent ways:

1. The main `Table Cleaner` trigger's `next_action` — months stale means
   housekeeping is dead instance-wide.
   ⚠ **There is rarely only one cleaner.** Enumerate *every* trigger whose name
   contains "Table Cleaner" — instances carry several (category-based,
   per-feature, per-app), and the one named **exactly** `Table Cleaner` may be an
   inert leftover while newer ones do the real work. A months-stale
   `next_action` on that single row is therefore **not sufficient evidence** that
   housekeeping is dead. Always pair it with the data inference in #2.
2. **Infer the cleaner's last run from data alone:** for any table with an
   age-based flush policy,
   `oldest_row.sys_created_on + age ≈ last successful cleaner run`.

> **Why this is step one:** a stalled scheduler looks *identical* to "the
> problem fixed itself" — volume drops because jobs stopped, not because
> anything improved. A hibernated or suspended non-production instance looks the
> same. **Getting this backwards inverts every downstream conclusion and makes
> every fix inert.** If in doubt, ask the user whether the instance has been
> idle/hibernated.

> `EXAMPLE — stalled:` 3,613 of 3,857 triggers past-due; `Table Cleaner
> next_action` four months old, `run_count = 6`; `sys_audit` oldest row + 14-day
> policy pointed to a last run six days prior — matching a cliff in log volume
> exactly. Root cause was scheduler-wide, not job-specific.
>
> `EXAMPLE — healthy:` 2,320 triggers, 493 past-due (21%), `Table Cleaner`
> next run within hours, `run_count = 687`; data inference put the last run 0h
> ago. Note 21% past-due is normal — dormant one-shot and on-demand triggers
> legitimately sit in the past.

### False-positive guard: the past-due count does not converge to zero

On-demand and system-startup trigger types fire only when invoked or at node
start, so they sit in the past indefinitely *by design*; dormant one-shot rows
behave the same. **Apply a trigger-type exclusion when tracking a drain, or you
will wait for a number that cannot fall.** Establish the type codes on the
instance first, then exclude them:

`state=0^next_action<javascript:gs.minutesAgoStart(15)^trigger_typeIN<recurring types>`

> `EXAMPLE:` a startup-type trigger ~194 days past due and an on-demand one
> ~44 days, both permanent and both inert. Neither was a load source — the only
> cost was metric distortion while tracking a recovery. A third class, parked
> far-future triggers, inflates the table total without ever being due.

Startup-type triggers permanently past due are also one of the two observed
effects of stale node identity — see `M-5` in `references/mechanics.md`.

---

## The `stats.do` worker-list check

**The worker list is the fastest wedged-job signal in this skill.** Every worker
showing sub-second to few-second durations = healthy. **Any worker showing a
multi-hour duration is a pinned job**, permanently costing you that slot. One
glance replaces several scripted probes.

`stats.do` is **not scriptable** — fetch `https://<instance>/stats.do`
separately. The full mechanic, including every caveat that invalidates a reading,
is `M-4` in `references/mechanics.md`. The two that bite here:

- 🛑 **Record the `node_id` with the reading.** Memory, semaphore counters and
  rejection totals are **per node**; two readings from different nodes are not
  comparable.
- It is a **snapshot** — poll repeatedly.

A pinned worker found here feeds straight into `§E` in
`references/procedure-phase2-consumers.md` — including the stuck-vs-slow test,
which is the only thing that distinguishes a wedged worker from a long pass.

---

## APPENDIX — per-instance facts to establish at the start of any triage

Record these before diagnosing; they are **different on every instance**.

| Fact | How to get it |
|---|---|
| Release / build name | `stats.do` → "Build name", or `sys_properties.glide.war`. ⚠ NOT `gs.getProperty('glide.buildname')` — verified absent on an Australia instance |
| Instance host (for `stats.do`) | `sys_properties.instance_name` → `https://<value>.service-now.com` — it is **not** in the app source |
| Node count and names | `sys_cluster_state` |
| Session / system timezone | `gs.getSession().getTimeZoneName()`, `glide.sys.default.tz` |
| `run_time` → GMT offset | change one `run_time`, read back `next_action` |
| `run_dayofweek` mapping | set it, read back `next_action`, check the calendar day |
| Which tables are rotated | `sys_table_rotation` records + `duration` × `rotations` |
| Which tables are flushed | `sys_auto_flush` where `active = true` |
| Table Cleaner health | its `sys_trigger.next_action` + the data inference in `§A` |
| User's working hours & timezone | **ask them** |
| Features the user actually demos/uses | **ask them** |
| `stats.do` reachable / authenticated? | fetch it |
