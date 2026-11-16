# Brief — plan and work items (`build_agent_core#sub_implementation`)

For breaking a large piece of work into tracked units on the instance, rather than
in a message. Writes to three tables.

| Table | Holds |
| --- | --- |
| `sn_build_agent_plan` | the plan. `parent_plan` self-references, so plans nest |
| `sn_build_agent_work_item` | one unit. `plan` is **mandatory**. Extends `task` |
| `sn_build_agent_work_item_dependency` | `item` **depends_on** `item`. Both mandatory |

🔑 **These tables are the Brazil autonomous-engineer surface, deployed and
dormant.** Measured: zero business rules on all three, and inserting a plan with
work items spawned no job and no activity row. So records written now are inert —
and when the engine activates it reads the same tables, which is why authoring
here beats authoring in a file.

---

## Assemble the payload

1. The preamble from `SKILL.md` §2.
2. The context list from `SKILL.md` §3.
3. The brief below.
4. The work to decompose, and what "done" means for the whole plan.

```
DECOMPOSE INTO WORK ITEMS ON THE INSTANCE. Use run_script; these are platform
tables, not app source, so they are data rather than metadata and nothing is
built or installed to create them.

NOTHING VALIDATES THESE TABLES. There are no business rules, no cycle guard and
no state machine. Every invariant below is YOURS to hold.

CREATE THE PLAN FIRST, and do NOT set `number` or `state`.
  - Both are marked read_only in the dictionary, but that is a FORM constraint
    only — setValue stores whatever you pass, silently. Measured: a supplied
    number of "ZZPROBE-SUPPLIED" was stored verbatim, overriding the number
    maintainer, and a supplied state of "in_progress" stuck.
  - Omit `number` and the maintainer assigns PLN0001101 and up. Supply one and
    you have a plan the engine cannot find by number.
  - Omit `state` and it defaults to standby, which is the correct entry state.
  - Set `short_description` and `description` (20,000 chars). `order` if the
    plan is one of several.

THEN THE WORK ITEMS, one insert each:
  - `plan` = the plan sys_id. MANDATORY.
  - OMIT `number` — the maintainer assigns WI0001101 and up. Measured: omitting
    it produced WI0001101 and set task_effective_number to match.
  - `short_description` — 160 chars, so it is a title, not a description.
  - `description` — 4,000 chars.
  - `acceptance_criteria` — 20,000 chars. THE FIELD THAT MATTERS. Write what
    must be TRUE and OBSERVABLE for the item to be done, not what to do. "The
    exceptions list renders the SCR number and clicking it opens the detail" is
    testable; "wire up the exceptions list" is not.
  - `executor_type` — `agent` or `human`. The split is modelled in the data, so
    use it: anything needing a decision, a credential, a password or an
    approval is `human`.
  - `state` = 1 (Draft) for everything you author.
  - `order` — ascending, and leave gaps (100, 200, 300) so an item can be
    inserted later without renumbering.

🛑 THE WORK ITEM state VOCABULARY IS NOT WHAT get_table_schema REPORTS.
That tool returns the choices INHERITED FROM task: -5,1,2,3,4,7,8,9,10. The
real list is in sys_choice, and it differs — 12 and 14 EXIST, while 4, 8 and 9
DO NOT. Read it, do not trust the schema:
    run_query table:sys_choice
      encodedQuery:name=sn_build_agent_work_item^element=state^ORDERBYsequence
Measured lifecycle, in sequence order:
    1 Draft -> -5 Waiting -> 10 Ready -> 2 In Progress -> 12 In Review
    -> 14 Needs Attention -> 3 Completed -> 7 Cancelled
A state outside that list reads back with a blank label and looks like data
corruption.

THEN THE DEPENDENCIES. One row per edge: `item` is the BLOCKED item,
`depends_on` is the BLOCKER.
  🛑 THERE IS NO CYCLE GUARD. Measured: a row where item == depends_on was
  ACCEPTED. So before inserting, assert in your own script that
  item != depends_on, and that adding the edge does not close a loop — walk
  depends_on transitively and refuse if you reach the starting item. An
  unexecutable graph is accepted silently and surfaces only when something
  tries to run it.
  Add an edge ONLY for a real ordering constraint. Two items touching the same
  file are not dependent; an item that cannot start until another's output
  exists is.

READ EVERY RECORD BACK on a fresh GlideRecord and report the ASSIGNED numbers.
A setter proves nothing. Report the plan sys_id and the work item numbers in
your return value — they are how the parent finds this work again.
```

---

## Return format

```markdown
## Plan
PLN… — <short description>   sys_id: <…>

## Work items
| Number | Executor | Depends on | Acceptance criteria |
|---|---|---|---|
| WI… | agent | — | … |
| WI… | human | WI… | … |

## Graph check
{the cycle assertion you ran, and its result}

## Not decomposed
{anything deliberately left out of the plan, and why}
```

---

## Sizing

One work item is **one verifiable outcome**. If its acceptance criteria need the
word "and" twice, it is two items.

⚠️ **An item nobody can verify is not an item.** If the acceptance criteria
cannot be checked by reading a page, running a query or diffing a snapshot, the
item is a wish — either sharpen it or make it `executor_type: human` with the
verification named as the criteria.

⚠️ **Do not decompose below the level of a single install cycle.** Build and
install are one unit and the user runs them, so an item that changes two lines
and needs its own install is more overhead than work.
