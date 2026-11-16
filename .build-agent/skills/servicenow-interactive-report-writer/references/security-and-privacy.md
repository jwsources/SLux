## 11. Security, privacy, and robustness

- Treat research text, source titles, URLs, and dataset values as untrusted input.
- Escape HTML text and attribute values during generation. Validate link schemes; permit expected HTTPS/HTTP or explicitly authorized document schemes only. Reject `javascript:` and other executable link schemes.
- For runtime updates, prefer `textContent`, `createElement`, and attributes with validated values. Never concatenate untrusted strings into HTML or scripts.
- If embedding data as JSON, serialize correctly and escape sequences that could terminate a script element. Never interpolate source text into JavaScript code.
- Do not embed secrets, credentials, hidden internal instructions, or content beyond the user's permissions.
- No analytics, telemetry, tracking pixels, network submission, or third-party embeds by default.
- Do not create a control that says “download PDF” when it only opens the print dialog. Label that action “Print / save as PDF” or “Print full report.”
- Do not add an export or clipboard button unless it works in the actual delivery environment and has a failure state.
- If browser sandbox restrictions prevent an interaction, disclose that limitation rather than claiming it was tested or fully operational.

*Made with ServiceNow EmployeeWorks*
