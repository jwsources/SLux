# Brief — exploration (`build_agent_core#sub_plan_and_explore`)

Read-only investigation. Returns findings to the parent; **writes nothing**.

Use for: finding where a behaviour lives, mapping a data model or a table's real
field shapes, establishing instance state, reading a platform contract out of
`node_modules`, auditing an app area before a change.

Several of these can run **in parallel** when their questions are independent.

---

## Assemble the payload

1. The **environment preamble** from `SKILL.md` §2, verbatim.
2. The context list from `SKILL.md` §3 — paths, sys_ids, what is already ruled out.
3. The brief below.
4. The question, stated as a question with a decidable answer.

```
YOU ARE INVESTIGATING. Do not write, edit, move or delete any file. Do not run
build or install. If the task seems to need a write, say so and stop — the
parent decides.

RETURN FINDINGS, NOT A NARRATIVE. The parent cannot see your tool calls. For
every claim: the evidence, and the file path or query that produced it.

LABEL EVERY CLAIM:
  VERIFIED   — you read it or ran it. Name the file and line, or the query.
  INFERRED   — it fits the evidence but was not directly observed. Say what
               would confirm it.
  UNVERIFIED — you could not establish it, and why not.
Do not blur these. An inference presented as a fact is the failure mode here.

A ZERO IS VOID UNTIL A CONTROL FIRES — and the control belongs in your report,
not just your reasoning. See the return format.

PREFER ONE WIDE READ OVER MANY NARROW ONES. Scripts can be rate limited, and a
broad read with controls answers more per call. But never read a whole bundle
or a sourcemap into context — substring-test it server-side and report only the
marker results.

FOR INSTANCE STATE: activate the `aiux-instance-ops` skill. It owns the
introspection recipes, the read-only discipline and the platform gotchas.

FOR PLATFORM BEHAVIOUR, SDK TRAPS AND BEST PRACTICE: activate `hint-lookup`.
The curated record outranks training recall and any file copy. Never expect
project specifics in a hint.

QUOTE THE LINE for any contract you report. A paraphrased signature is an
unverified one.

WHEN THE ANSWER IS "IT DEPENDS": say what it depends on and how to settle it.
Do not pick a branch on the parent's behalf.
```

---

## Return format

Ask for this shape — it is what the parent can act on without a second round:

```markdown
## Answer
{one or two sentences — the decidable answer}

## Evidence
| Claim | Label | Evidence |
|---|---|---|
| ... | VERIFIED | `path/to/file.js:42` — quoted line |
| ... | INFERRED | fits X and Y; confirmed by doing Z |
| ... | UNVERIFIED | could not read W because ... |

## Controls fired
{for every zero reported: the control pattern and its non-zero result}

## What this rules out
{disproven theories, so the parent does not revisit them}

## Open questions
{anything the parent must decide}
```

---

## Traps measured in this project

- **`fs_grep` skips `node_modules` and dot-directories** (`.build-agent`). Use
  `fs_read_file` / `fs_read_directory` there.
- **`sys_aix_widget` reads are role-filtered.** A `before query` rule appends a
  category exclusion for callers without `maint`, so page widgets are invisible
  and a query returns zero rows with no error. Read the **parent** table
  `sys_ux_widget` with `sys_class_name=sys_aix_widget`, or `sys_aix_page`.
- **A `sys_dictionary` query filtered by table name returns only LOCALLY
  DEFINED columns.** Inherited fields are absent, which once produced a
  confident and wrong "that field does not exist". Use `isValidField`, or walk
  the class chain via `sys_db_object.super_class`.
- **An empty field and an absent field look identical** when a script prints
  only non-empty values. Distinguish them explicitly.
- **A scoped read of another scope's table may auto-create a
  `sys_scope_privilege` row.** That is a write. Say so if it happens — a
  "read-only" probe that grants a privilege was not read-only.
