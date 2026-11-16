# Test Prompts for `hint-lookup`

One prompt per line starting with `-`.
Add an optional `<!-- comment -->` after any prompt to explain the reasoning.

## should_trigger

Prompts that SHOULD activate this skill.

- What do we know about GlideAggregate MIN and MAX
- Is there a hint about deleting a dictionary column
- Check the hint library before we write this business rule
- Look up what we measured about sys_aix_widget compile metadata
- find_hint is not available, how do I search the hints <!-- the MCP-absent case this skill exists for -->
- The hint tools are missing from my session
- Search our knowledge library for AI Search profile traps
- I need the hints on this instance but the app is not installed <!-- routes to references/remote-rest-client.md -->
- Get me hints from crmai over REST
- Before I write this ACL, is there a measured finding on it
- Why did my hint search return nothing <!-- the zero-is-void / hint_reader-missing case -->
- Is x_snc_hints_knowle_hint available here
- Pull the body of sn-validate-scripts-on-instance

## edge_cases

Prompts where the skill MIGHT trigger but behavior is ambiguous — note the expected outcome.

- Add a hint about this finding <!-- expected: do NOT trigger — publishing and correcting records is the HINTS skill, this one only reads -->
- The MCP server will not connect <!-- expected: trigger, but note MCP is irrelevant to both paths here; do not debug MCP to get hints -->
- Why is hint_triage returning 403 <!-- expected: trigger for context, but this is a skill role-gating question, not a lookup problem -->
- Search the instance for business rules on incident <!-- expected: do NOT trigger — that is keyword_search / run_query over platform metadata, not the hint library -->
- What does the ServiceNow documentation say about this <!-- expected: do NOT trigger alone — hints augment official docs, they do not replace explain_fluent_doc -->
- Give me every hint in the library <!-- expected: trigger, but narrow first — a whole-library body pull is the cost this skill exists to avoid -->

## should_not_trigger

Prompts that look related but belong to a different skill or no skill.

- Write a hint record for what we just measured <!-- HINTS skill — publishing, not lookup -->
- Correct the claim in sn-ai-agent-tooling <!-- HINTS skill §4 — targeted correction -->
- Audit the hint library for stale claims <!-- meta-hint-audit -->
- Create an AIUX widget <!-- aiux-widget -->
- The instance feels slow <!-- diag-playbook -->
- Run the ATF tests <!-- atf-run-test -->
- Set a system property <!-- update-system-property -->
- Build an AI agent that answers hint questions in Otto <!-- agent authoring, not lookup -->
