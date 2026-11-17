import { Record } from '@servicenow/sdk/core'

Record({
    $id: Now.ID['ab5cb56687e8db50d22bc8ce8bbb3565'],
    table: 'sn_build_agent_instruction',
    data: {
        active: 'true',
        applies_to: 'application',
        body: `FIRST ACTION IN EVERY SESSION: read AGENTS.md at the repo root, then TOOLNOTES.md when one of
AGENTS.md's trigger-table rows applies. NEITHER IS INJECTED INTO CONTEXT, and the IDE omits the
file tree to save tokens — so nothing announces they exist. These rule records are the only
automatic channel, which is why this rule has to carry the pointer.

AGENTS.md OUTRANKS the skill packs and training recall on anything about THIS repo, THIS IDE and
THIS instance: what build and install require, which pack instructions are void because there is
no terminal, and the measured platform traps.

MEASURED COST OF NOT READING IT. Non-negotiable #1 requires deleting dist AND dist-metadata
before reporting a change ready. Half that instruction was dropped for days; the documented
consequence is a stale install, which then cost nine rounds and five wrong theories — while
non-negotiable #4 already described that exact investigation, its tell (the page title stays the
element name) and its remedy (reload once; the second load is hydrated).

DO NOT paraphrase it from memory in a later turn, and do not assume a file is absent because it
is not in context. Re-read it when a session resumes or compacts.`,
        description:
            'AGENTS.md is NOT auto-injected and the file tree is omitted — nothing announces it exists. Read it before acting.',
        name: 'READ AGENTS.md FIRST',
        type: 'rule',
    },
})
