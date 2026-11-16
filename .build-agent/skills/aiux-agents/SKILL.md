---
name: aiux-agents
version: 1
description: >
  Brief a sub-agent correctly for AIUX work in the ServiceNow Web IDE. Use before
  every `agent` delegation — it carries the environment preamble a sub-agent cannot
  discover for itself, routes the task to one of the three real delegation targets,
  and points at the skills the sub-agent must load rather than restating them.
---

# AIUX Agents — sub-agent briefing

A sub-agent **cannot see this conversation**. It starts with only the `prompt` and
`context` it is handed, and it cannot discover the environment it is running in.
Everything it needs must be in the payload.

This skill supplies that payload. It is a set of **briefs**, not role definitions:
each one routes to a real delegation target, names the skills to load, and links
rather than copies — so `aiux-build`, `ui-discovery` and the rest stay the single
source of truth for their own content.

---

## 1. The three real targets

`agent`'s `type` is a **fixed enum**. There are three, and no file can add a fourth.

| Target | For | Brief to load |
| --- | --- | --- |
| `build_agent_core#sub_plan_and_explore` | Read-only: find where something lives, map a data model, investigate instance state. Returns findings. **Writes nothing.** | `references/exploration-brief.md` |
| `build_agent_core#sub_implementation` | Writes files, builds a page or component, fixes a defect | `references/implementation-brief.md`, plus `references/vision-spec-brief.md` when the input is a screenshot |
| `atf-triage` | A failed ATF test needs root-causing | none — it is purpose-built |

### When NOT to delegate

Delegation costs a full context rebuild. Do it for work that is **large and
self-contained**. Do not do it for:

- a targeted fix in a file already read in this session
- anything needing back-and-forth with the user mid-task
- work where the parent already holds the context the sub-agent would have to rediscover

⚠️ **A sub-agent cannot delegate.** Nesting is one level deep, so a brief must
never instruct one to spawn another.

---

## 2. The preamble — the rules, because nothing else carries them

🔑 **A sub-agent receives NO instance rules.** Its context is assembled at
invocation from the `prompt` and `context` you pass, and nothing else. The nine
rules that govern the parent — runtime contracts, the backtick gate, reference
integrity, two-strike, verification discipline — reach it **only if they are in
the payload.**

It *can* read `AGENTS.md` and `TOOLNOTES.md` once told they exist, and those
cover the project and instance specifics: build and install discipline, the
no-terminal translation, grep zeros, the stale-SSR reload, the DaisyUI safelist,
the extension model. So the preamble carries the **six rules with no other
channel** and points at the files for the rest.

Copy this into `context`:

```
Read AGENTS.md at the repo root FIRST, then TOOLNOTES.md on any trigger in
AGENTS.md's final table. Neither is injected and the file tree is omitted, so
nothing announces they exist. They outrank the skill packs and training recall
on this repo, this IDE and this instance.
⚠️ AGENTS.md is STALE on one point: it says on-instance hints are unavailable.
The `hint-lookup` SKILL works — it reaches the library over REST.

NEVER ASSERT A RUNTIME CONTRACT FROM MEMORY. Before calling any API not read in
THIS session — signature, event detail, property name, config object, import
specifier — READ THE SOURCE AND QUOTE THE LINE. node_modules is readable with
fs_read_file; fs_grep SKIPS it, so a zero there is meaningless. A package README
specifier may be wrong for this app: check how a sibling file imports before
trusting it. An umbrella package rarely re-exports everything it appears to.
Also check which side of a boundary speaks IDs and which speaks DISPLAY LABELS
before wiring them. If the source cannot be read, say the contract is UNVERIFIED
and do not write the call.

NO BACKTICK IN A COMMENT INSIDE A css/html/svg TAGGED TEMPLATE. It closes the
template; the rest parses as valid JavaScript, so diagnostics AND the build pass
while the component renders blank. Same for a dollar-brace. Write names bare.
GATE every touched template file before handing back:
  A) mostly-JS files:  fs_grep -n glob:<file> pattern:^\s*(/\*|\*|//).*`
  B) mostly-CSS files: A IS BLIND — it needs a line to START with a marker, and
     CSS block-comment continuation lines are plain indented text. Census
     instead: fs_grep -n glob:<file> output_mode:content pattern:`
     Every hit must be a template opening, a closing, or JSDoc ABOVE a
     template. Judge by POSITION. Anything unaccounted for IS the bug.

REFERENCE INTEGRITY RUNS BOTH WAYS. After removing an import or renaming a
symbol, grep the whole app for survivors — in a .js file run_diagnostics cannot
see an orphan, and a defensive fallback turns it into an empty result, so a
feature stops appearing instead of failing. After adding a class or a data-*
attribute, confirm the other end exists, in the stylesheet that actually loads
for THAT component. When a value is declared in two files, make one read the
other; a "keep these in sync" comment is not a mechanism.

TWO STRIKES AND YOU REFACTOR. If the same category of bug appears twice after a
fix, stop patching. Read all the related files, identify the shared root cause,
and return a refactor proposal rather than a third patch.

ACTIVATE hint-lookup before building anything that touches platform behaviour,
architecture or SDK traps. The curated record is authoritative over training
recall. Never expect project specifics in a hint.

A CLEAN BUILD IS NOT EVIDENCE. run_diagnostics and a build prove the code
PARSES. Verify on the RENDERED page and diff the accessibility snapshot — on a
refactor that should change nothing, ANY difference is a regression. Verify on
the surface MOST LIKELY TO HIDE THE DEFECT: a page whose default happens to be
correct looks perfect through many rounds of a bug that breaks every other page.
Report what is VERIFIED and by what evidence, then what is UNVERIFIED and why.

REPORT OUTCOMES, NOT NARRATION. The parent sees your diffs, not your reasoning.
No recaps, no tables of checks that all passed, no closing offers.
```

⚠️ **Add task-specific rules on top of this** only when the trap is in the exact
table or component being touched and is absent from `AGENTS.md`, `TOOLNOTES.md`
and the skills being loaded.

---

## 3. What the parent must supply

A sub-agent rediscovering context the parent already holds is the main waste in
delegation. Always pass, concretely:

- **Absolute file paths** already known to be relevant — not "the page", but
  `src/extensions/<host>/<route>/pages/my-store/page.js`
- **sys_ids and table names** already resolved, so it does not re-query
- **Contracts already read this session**, quoted — a signature the parent
  verified is a signature the sub-agent must not re-verify
- **What has already been ruled out**, and by what evidence. Without this a
  sub-agent repeats a disproven theory.
- **The definition of done**, and what the user will look at to judge it

---

## 4. Skill load order — the thing skills do not carry themselves

A skill states its own rules but not when it runs relative to others. Briefs must
be explicit, because a sub-agent has no habit to fall back on.

For any UI work: **`ui-discovery` first** — before drafting a plan, never after.
Then build. Then `accessibility`. Then `internationalization`. `aiux-build` owns
the detail of each; the brief only supplies the order.

---

## 5. Files

```text
aiux-agents/
  SKILL.md                            ← router + the preamble above
  references/
    exploration-brief.md              ← sub_plan_and_explore
    implementation-brief.md           ← sub_implementation
    vision-spec-brief.md              ← sub_implementation, screenshot input
    plan-brief.md                     ← sub_implementation, decompose onto the instance
```

### 🔑 Two readers, and only one of them has history

**`SKILL.md` is read by the PARENT** to choose a target and assemble a payload.
Routing notes, rationale and what-is-absent belong here.

**`references/*.md` are PASTED INTO the sub-agent's payload.** That reader has
no history: it has never seen this conversation, the files these briefs were
derived from, or any earlier version of anything.

So a brief must contain **only instructions that are actionable without
history**. Anything phrased *"the original said X, actually Y"*, *"this was
corrected from"*, or *"replaces"* is provenance — invisible value to the
sub-agent, and it crowds out the rules that do matter. Drop it.

⚠️ If a correction has operational force — *verify this before using it* —
rewrite it as the instruction itself, in the hard rules, and drop the history.

### Deliberately absent

- **No ops brief.** That work was entirely `claude mcp` CLI and shell. Nothing
  it did has an equivalent here.
- **No coder brief separate from `implementation-brief.md`.** `aiux-build`
  already owns mode routing and the principles; a second copy would compete
  with it.

### `planning` tool vs `plan-brief.md`

Both exist and they are not alternatives. The **`planning` tool** is
session-scoped with no store — right for tracking the steps of the work in
hand, and it disappears with the conversation. **`plan-brief.md`** writes to
`sn_build_agent_plan` and `sn_build_agent_work_item`, which persist, carry
numbers, model an agent-vs-human split, and are read by the autonomous engineer
when it activates. Use the tool for this conversation; use the brief when the
work outlives it.
