# ServiceNow interactive report writer

A standalone skill package for evidence-based, interactive ServiceNow-styled HTML reports. No other skills are required.

## Package contents

- `SKILL.md`: concise activation rules, workflow, required resource-loading map, and output contract.
- `references/brand.md`: self-contained ServiceNow voice, terminology, colors, typography, and layout.
- `references/research-and-writing.md`: depth, evidence collection, report structure, and citations.
- `references/interactions.md`: baseline and optional interactions, accessibility, state behavior, and React constraints.
- `references/html-build.md`: authoring and implementation guidance.
- `references/security-and-privacy.md`: safe embedding and privacy rules.
- `references/quality-checks.md`: evidence, brand, interaction, and delivery checklist.
- `references/delivery.md`: footer, delivery, and smoke tests.
- `templates/report.html`: reusable inline HTML/CSS/JavaScript authoring scaffold; not a finished report.
- `assets/logo-white.svg` and `assets/logo-dark.svg`: exact supplied vector logo variants; no external logo dependency.
- `scripts/validate_report.py`: standard-library static report validator.

## Interaction baseline

The template implements live in-report search, category filters, visible-result counts, reset, expandable evidence, and full-report printing. All core report content exists in HTML before JavaScript runs. Optional sorting, scenario models, charts, tabs, and React are documented, but must be implemented only when relevant and supported.

## Portability

Generated reports should be single-file HTML. They do not need the installed skill folder or an external JavaScript runtime. The template's hosted fonts require network access; strict-offline reports must remove remote font loading and use authorized embedded fonts or Arial.

## Quick test

Ask your agent:

“Using the supplied research notes, write a standard interactive HTML report with ServiceNow styling. Include useful exploration controls, expandable evidence, and full-report print. Cite only supplied or retrieved sources.”

Before delivery, run:

```text
python scripts/validate_report.py path/to/generated-report.html
```

The template intentionally contains authoring instructions and is expected to fail placeholder checks until adapted. Static validation is not browser execution, accessibility certification, or verification that source claims are correct.

*Made with ServiceNow EmployeeWorks*
