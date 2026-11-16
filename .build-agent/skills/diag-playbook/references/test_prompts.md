# Test Prompts for `diag-playbook`

One prompt per line starting with `-`.
Add an optional `<!-- comment -->` after any prompt to explain the reasoning.

## should_trigger

Prompts that SHOULD activate this skill.

- The instance feels slow, can you work out why
- Users are complaining the instance is slow this week
- Do a general health check on this instance
- A scheduled job never finishes — it just hangs
- This job has been running for hours and nothing happens
- `syslog` is huge, where is all the volume coming from
- We're under disk pressure, can we retain less log data
- The system log is full of errors, not just volume
- `sysevent` is backing up and the count keeps climbing
- The `sys_trigger` table has hundreds of thousands of rows
- Our nightly import job gets slower every week
- List views on the case table take forever to load
- Form load on `incident` is slow for everyone
- Installs never start — the UI shows "In progress" forever
- An application install has been stuck at 0% since yesterday
- This job is firing way more often than it's configured to
- `sys_audit` is churning, is something rewriting the same values
- Pull `stats.do` and tell me whether the scheduler is healthy
- Audit every `sysauto` job and tell me what's actually expensive
- We changed a retention setting — did it work
- Is anything eating the scheduler worker pool
- Something is generating 8,000 log rows an hour, find it
- A job reports almost no SQL and no business rule time, so where is the time going
- Users say a page just stops loading halfway, nothing in the logs
- Suspected ACL cost on the case table — is per-row evaluation hurting us

## edge_cases

Prompts where the skill MIGHT trigger but behavior is ambiguous — note the expected outcome.

- Delete all the old rows from `syslog` <!-- expected: trigger, but route straight to W1–W9 in references/write-safety.md — a large foreground delete is the wrong instrument; prefer a flush policy, and M-1 says editing a flush policy on a rotated table does nothing at all -->
- Change `syslog` retention to 2 days <!-- expected: trigger and push back. M-1: never cut below the 10–14 day §B analysis window, and the shard `duration` sets a hard floor you may not be able to reach anyway -->
- Deactivate this job, it's clearly misconfigured <!-- expected: trigger, then J6 — ask whether anything OUTSIDE the instance depends on it. A keep-alive heartbeat is indistinguishable from a defect by measurement alone -->
- This flow is called "daily" but runs every 3 minutes, turn it off <!-- expected: trigger — §C2 step 3b: it may have no schedule at all (a business rule calls it), so "make it weekly" is not an available action -->
- Our scheduler load is 101 h/day across jobs and flows <!-- expected: trigger and correct the arithmetic — §C2 forbids adding §C and §C2; the handler job IS the flow execution -->
- `syslog_transaction` is not readable, so we can't measure query cost <!-- expected: trigger — §D: a ScopeAccessNotGrantedException is a per-CONTEXT result. Retry from another scope before declaring the module unavailable -->
- Convert these scripted ACLs to role checks to speed up the table <!-- expected: trigger and refuse the shortcut — §H steps 2–3: row-scoped ACLs are by design, and a query-time fast path may already make them dormant. Converting them is a data-exposure regression -->
- There are 138 duplicate scheduled job names, clean them up <!-- expected: trigger and size it first — §E: queue-consumer families are intentionally parallelised; `count > 1` alone produced 138 false positives on a real instance -->
- Why is this `sys_trigger` row frozen, it hasn't moved in 10 minutes <!-- expected: trigger — §E stuck test plus W8: a re-read interval shorter than the job's own `processing_duration` reports frozen every time -->
- Tune these job schedules, they're colliding <!-- expected: trigger, but R2a first — durations measured DURING an incident are contention-inflated; re-measure after recovery or you relocate vendor jobs to fix a number -->
- Count the rows in `syslog` so we know how bad it is <!-- expected: trigger a warning — §B: compute a RATE over a bounded window, then a 10–14 day series. A total is not actionable, and an unbounded count on a rotated table is expensive -->
- Disable `glide.ais.semantic.enabled` to stop the index queue noise <!-- expected: trigger and refuse — §F: never disable a platform-wide search capability to fix one noisy consumer. Fix the volume, not the capability -->

## should_not_trigger

Prompts that look related but belong to a different skill or no skill.

- This one query is slow, can you add an index <!-- a single slow query is query tuning, not instance triage. Only enter this skill if the question is which consumer costs the instance -->
- My Fluent build is failing with a TypeScript error <!-- build/diagnostics tooling, not instance performance -->
- Run the ATF tests for my app <!-- atf-run-test -->
- Set `glide.ui.presence.interval` to 300 <!-- update-system-property. R8 applies if a triage concludes a property must change, but the change itself is that skill's job -->
- Create an AIUX widget for the AI portal <!-- aiux-widget -->
- Write a business rule that validates incident state <!-- ordinary app development -->
- Why is my client script not firing on the form <!-- client-side debugging, not cost analysis -->
- Build a report of incidents by assignment group <!-- platform reporting -->
- Set up a flow to route approvals <!-- flow authoring; this skill only measures flow runtime -->
- Our users can't log in <!-- authentication, not performance -->
