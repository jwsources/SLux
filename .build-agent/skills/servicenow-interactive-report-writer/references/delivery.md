## 12. Required final footer

Every artifact must end with this exact visible text at the very bottom:

Made with ServiceNow EmployeeWorks

Use small, tasteful type and generous spacing. Keep accessible contrast: Infinite Blue on light surfaces, white on dark. Do not use opacity or low-contrast gray to make it subtle. Additional required legal text, if applicable, belongs before this final attribution.

HTML:

```html
<footer class="report-footer">
  <div class="container">Made with ServiceNow EmployeeWorks</div>
</footer>
```

For a Markdown skill file or Markdown fallback, use the phrase as the final italicized line. For a requested paginated export, ensure it appears on the final page. Do not place content after the final attribution.

## 14. Delivery and installation

After successfully creating the report, provide 1–2 concise sentences explaining what it covers and how to explore it, followed by the host platform's actual file attachment or artifact reference. Do not paste the full report into chat as well. If file creation fails, say so and provide a brief useful fallback rather than claiming the report is ready.

Install the entire `servicenow-interactive-report-writer/` folder, preserving the relative paths to bundled references, templates, assets, and scripts. Register or enable it using the host agent's supported mechanism. No separate skills are required. A folder alone does not automatically activate a skill on every platform.

### Smoke-test prompts

1. “Research this topic using relevant internal and web sources. Deliver a standard interactive HTML report.” Expect supported synthesis, native search, meaningful exploration, evidence expansion, and print.
2. “Use only the attached research notes. Do not search.” Expect correct source boundaries and no invented evidence.
3. “Find a claim inside collapsed evidence.” Expect the search index to include supporting text and a usable evidence-expansion control.
4. “Make the report work without JavaScript.” Expect all narrative and supporting content to remain available, not an empty application shell.
5. “Print while a category filter is active.” Expect the complete report in print and restoration of the filtered reading view afterward.
6. “Deliver it for fully offline use.” Expect no required remote runtime or font request and an honest font fallback note when necessary.
7. “Show a benefits calculator.” Expect sourced assumptions and an explicit scenario model—or an explanation that no defensible model is available, not invented numbers.

*Made with ServiceNow EmployeeWorks*
