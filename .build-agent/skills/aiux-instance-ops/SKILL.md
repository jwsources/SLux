---
name: aiux-instance-ops
description: >
  Investigate and verify ServiceNow instance state while building or debugging AIUX apps,
  widgets, pages and extension pages. Use this skill whenever a task depends on what the
  instance actually holds or does rather than what the code says: why an assistant (Now Assist
  Otto, Moveworks) does or does not appear, which assistant an experience runs, why an AIEL
  widget context or client_tools tool is not seen, why a REST call returns 401 or 403, which
  roles or ACLs gate an endpoint, what an experience property or deployment channel is set to,
  who changed a record, or whether data exists for a feature. Also use it before ANY write to
  the instance, to apply the confirm-then-read-back rule. Covers server-side background-script
  recipes, platform gotchas, how an experience chooses its assistant, the AIEL widget-context
  and client_tools contract, and how to read the installed @servicenow/aiux source to settle
  a question. Do not handle instance investigation or an instance write without consulting it.
metadata:
  author: jules.weijters
  version: '1.0.0'
  verified-against: '@servicenow/aiux 22.67.1, 2026-10 to 2026-11'
compatibility: >
  Works with any agent that can run a server-side background script on the instance and read
  the local repo (Build Agent run_script, Claude Code with a platform MCP, or equivalent).
license: MIT
---

# AIUX instance operations

## Goals

- Settle questions about instance state with facts, not guesses, in as few reads as possible.
- Never change the instance without the user's say-so for that specific change, and always read it back.
- Turn what was measured into a report that says what is known, what is inferred and what could not be checked.

## What a skill cannot do

A skill gives you knowledge and a procedure. It does not give you access. What you can read or write is decided by your own tools (a background script, a table API, the local repo). If you lack a tool for a step, say so and tell the user what to run or look at. Do not pretend a check was made.

## Workflow

1. **Say what you will read and why**, in one or two lines, before the first read. Name the tables or the code you intend to look at.
2. **Read before you reason.** Prefer one script that answers several questions to many tiny ones (scripts can be rate limited). Recipes: `references/introspection-recipes.md`.
3. **Verify by running the app's own code** when a server function decides the outcome (a script include method, an access-check API). Calling it is stronger than reading its source, and protected scripts cannot be read anyway.
4. **Read the platform source for client behaviour.** The installed `@servicenow/aiux` package is the source of truth for how routing, chat, AIEL and widget context behave: `references/reading-platform-source.md`.
5. **Writes: state, wait, write, read back.**
   - State exactly what will change (table, record id, field, old value, new value) and how to undo it.
   - Wait for the user's yes for THAT write. A yes for one change is not a yes for the next.
   - Make the smallest change that can work. Prefer deactivating over deleting.
   - Read the record back and report the stored value. A script that prints nothing may have done nothing.
6. **Report with three labels:** verified (you saw it), inferred (it fits the evidence), not checked (and why). Do not blur them.

## Rules

- **Read-only by default.** Investigation never writes.
- **Ids over names.** Resolve a name to a sys_id once, then use the id.
- **Never print, paste or store a token or password.** If one appears in output, say it appeared and do not repeat it.
- **Do not guess table or field names.** Look them up in the dictionary (`references/introspection-recipes.md`) or ask.
- **Measured facts carry a version and a date.** Platform behaviour changes between releases. Check the installed version before you cite a line number.
- **A failure is a finding.** Record what failed and the evidence. Do not hide it behind a workaround.

## Reference index

| Question | Open |
| --- | --- |
| How do I look this up on the instance? | `references/introspection-recipes.md` |
| Why did that script or query behave oddly? | `references/gotchas.md` |
| Which assistant does an experience run, and why is it missing or erroring? | `references/aiux-experience-and-assistant.md` |
| Why does the assistant not see my page, or not call my tool? | `references/aiel-widget-context-and-tools.md` |
| Where in the platform code is the answer? | `references/reading-platform-source.md` |
