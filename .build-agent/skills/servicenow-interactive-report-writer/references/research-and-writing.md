# Research, report writing, and citations

## 2. Understand the assignment

Identify the intended reader, question or decision, scope, time period, source boundaries, desired depth, and requested output from the conversation.

Ask a concise clarification only when missing information would materially change the work. Otherwise make a reasonable assumption, state it briefly, and proceed. Do not ask the user to select colors, typography, or standard interactions already defined here.

### Depth

| Profile | Signal | Report prose |
|---|---|---|
| Brief | Quick, short, simple answer, or TL;DR | Usually 1–2 paragraphs inline; an HTML file only when requested |
| Standard | Default substantive research question | Approximately 500 words, concise opening, 2–4 analytical sections, short conclusion |
| Comprehensive | Detailed, thorough, deep dive, or comprehensive | 1,000+ words as needed, with scope, method, full analysis, material gaps, and conclusion |

Word counts exclude source links, controls, metadata, and code. Never pad. Scale the number of interactions to the content rather than the word count alone.

### Format handling

- When no format is specified for a substantial report, create interactive HTML.
- When HTML is explicitly requested, deliver an actual HTML file rather than an HTML code block alone.
- React is an implementation option only when the user's environment genuinely supports it; it is not a dependency of this skill.
- Honor explicit requests for another format when tools permit. Do not silently substitute HTML for Word, PDF, or PowerPoint. State a limitation if the requested format cannot be produced.
- Markdown can preserve structure and citations, but cannot reproduce the interactive or visual behavior of HTML.

## 3. Research and evidence workflow

Research only when needed. A style-only rewrite or a supplied, adequate evidence set does not require unnecessary searches.

Before the first search, briefly orient the user with 2–3 bullets covering the research goal, the smallest useful sub-questions, and the source types required. Keep progress narration short.

### Select appropriate sources

- Structured entity tools: identified people, reporting lines, or other authoritative structured records.
- Internal search: company policies, decisions, project documents, discussions, and organizational knowledge.
- Web search: public information, current developments, market context, standards, and regulations.
- Attachment inspection: relevant supplied documents, spreadsheets, screenshots, or other files.
- Computation: numerical checks, comparisons, transformations, or data analysis.

Do not claim a source was searched or a file inspected unless that actually happened. Use both internal and external sources only when both are relevant. Never send confidential information into a public search query.

Start with a focused broad search and evaluate the results. Refine only to close a material evidence gap, read a necessary primary source, resolve disagreement, or satisfy an explicitly exhaustive scope. Follow the host's search limits. Stop when the core question is supported; do not keep searching to decorate the narrative.

### Evidence ledger

For each useful source, preserve:
- Exact title and retrieved URL or accessible document identifier.
- Publisher or owner and source type.
- Publication or update date, when available.
- Access date for time-sensitive facts.
- Specific facts supported and important qualifications.
- Whether it is a primary source, independent analysis, vendor claim, or commentary.

Prefer primary sources and authoritative internal records. Consider relevance, scope, dates, independence, and methodology—not just recency. Do not treat syndicated copies as independent corroboration.

### Evidence discipline

- Never invent facts, URLs, quotations, statistics, dates, customer examples, benchmarks, or source coverage.
- Every research-dependent factual claim needs a supporting citation at the point of use.
- Distinguish confirmed findings, analytical inferences, and recommendations when that affects interpretation.
- Preserve material uncertainty. Do not replace “not confirmed” with confident prose merely to sound polished.
- When sources disagree, explain the disagreement, relevant dates or scopes, and why one source is more applicable if that can be determined.
- State material gaps and what was checked. Do not infer absence from an unsuccessful search.
- Distinguish internal evidence from public evidence where provenance or confidentiality matters.
- For calculations, retain units, periods, input sources, and material assumptions. Label scenarios and estimates explicitly.

After each research round, briefly summarize the finding and remaining material gap, if any. Do not repeat the whole research plan.

## 4. Report structure and reasoning

Lead with the answer, not a generic description of the topic or the agent's process.

A useful analytical paragraph contains:
1. Finding: what the evidence supports.
2. Evidence: the relevant facts with citations.
3. Implication: why it matters to the reader.
4. Qualification or action: the important caveat or next step, if relevant.

### Default report architecture

1. Header: exact approved logo, report category, and relevant metadata.
2. Hero: specific title, scope, date where relevant, and an answer-first introduction.
3. Executive takeaway: the main conclusion and its most important qualification.
4. Report controls: search, appropriate filters, evidence controls, and print.
5. Analytical sections: 2–4 for a standard report, more for a comprehensive report.
6. Recommendations or conclusion: practical next steps supported by the evidence.
7. Final attribution footer.

Use topic-led headings, not generic labels repeated mechanically. Add methodology and evidence gaps when they materially affect confidence. Do not hide the main answer, material limitations, or recommendations inside tabs or collapsed panels.

Use prose for reasoning, bullets for discrete points, and tables for real comparisons. Avoid making every paragraph a card. Narrative flow matters more than dashboard density.

Recommendations should name an owner or date only if supplied by the evidence or user. Otherwise label ownership or timing as proposed. Avoid invented scores, false precision, unsupported rankings, and decorative metrics.

## 8. Citations in an interactive report

Every factual claim that depends on research must retain its citation regardless of filtering, sorting, or expansion state.

- In HTML, use descriptive source-title links near the supported sentence, not platform-specific citation tokens.
- Use only URLs retrieved by tools or supplied by the user. Never guess a source URL.
- A visible finding must have its principal supporting citation visible. Expandable panels may contain additional excerpts, dates, methodology, or qualifications, but not the only source for the claim.
- Preserve the source title, publisher, and date when useful. For supplied files without a shareable URL, name the file and relevant page or section rather than fabricating a link.
- Identify inference and cite its underlying evidence. Label recommendations as recommendations rather than sourced facts.
- Use dates in prose when freshness materially affects interpretation. Distinguish the publication date from the event date or reporting period.
- Do not add a separate bibliography or Sources section by default; citations belong beside claims and supporting detail belongs with its finding.
- External links should normally open in the same tab. If opening a new tab is necessary, indicate that behavior and use `rel="noopener noreferrer"`.
- Escape source text when generating HTML. Never inject raw document text into `innerHTML` or treat a source's HTML as trusted markup.

*Made with ServiceNow EmployeeWorks*
