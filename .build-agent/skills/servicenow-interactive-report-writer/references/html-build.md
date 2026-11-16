# HTML template and build guidance

Read this file with `templates/report.html` before creating a report.

The template contains inline CSS and JavaScript, exact logo paths, hosted font declarations, search, category filters, visible-evidence expansion, print-state restoration, keyboard focus styles, and responsive layout. It is a runnable authoring scaffold, not research or a completed report.

## Authoring steps

1. Copy the entire template into your new report file. Do not link the delivered report back to this installed skill folder.
2. Replace `REPORT_TITLE`, instructional prose, example categories, metadata, and example findings with real report content. Preserve control IDs and data attributes unless you also update the script.
3. Generate category options from actual analytical items. If fewer than two meaningful categories exist, remove the category field and adapt filtering code to treat category as `all`; never remove an element without updating its script references.
4. Keep `data-report-item` on each filterable item, `data-category` aligned with its filter value, and `data-evidence` on native evidence details. Keep the main takeaway, conclusion, and footer outside the filterable set.
5. Search covers each item's full text, including collapsed evidence. All query terms must match; search and category filters combine with AND logic. If results exist only inside a closed panel, the reader can expand visible evidence to inspect the match.
6. Keep the principal claim, citation, and material qualification visible. Expandable evidence contains additional detail, not the only source or warning.
7. Make section anchors stable and unique. If adding links into filterable cards, clear relevant filters before navigating; the supplied navigation points only to unfiltered parent sections.
8. Both exact logo variants are embedded. The dark print logo changes only the white fills to Infinite Blue; the original green logo mark remains unchanged. Its markup is hidden from duplicate assistive-technology announcement.
9. Do not promise that the browser print dialog creates an independently validated PDF. A separately requested PDF requires actual creation and inspection.
10. Keep scripts, styles, and content inside the final HTML. Remote hosted fonts are the only default network dependency. A strict offline build must remove font-face network declarations and use authorized embedded fonts or Arial.

## Progressive enhancement

The report is readable before JavaScript runs. Native evidence disclosures work without JavaScript. JS-only controls remain hidden until setup succeeds. If adding new controls, preserve this property. Test print behavior with JavaScript disabled as well as enabled; native closed-details printing can vary between browser engines.

## Safe changes

Use actual content and reader needs to choose optional interactions. The template is a baseline, not a requirement to force every report into identical cards. Keep accessible native HTML and a readable narrative. Do not overwrite source evidence when filtering or sorting. Never inject retrieved text using `innerHTML`.

## Static validator

Run `python scripts/validate_report.py path/to/report.html` if Python is available. It uses only the standard library and detects common structural, citation-link-scheme, placeholder, and self-containment problems. Passing it does not demonstrate that JavaScript, keyboard behavior, print, or contrast were tested in a browser.

*Made with ServiceNow EmployeeWorks*
