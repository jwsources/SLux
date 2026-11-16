# Optional — preview the report on a ServiceNow instance

**Host-specific and optional.** Everything else in this skill is host-agnostic. This
file applies only when the agent is running against a ServiceNow instance and has a
server-script tool plus a page-diagnostics tool — the ServiceNow Build Agent in the
Web IDE is the measured case. Nothing here is required to author or deliver a report.

Use it for one purpose: the delivered HTML lives on the agent's filesystem, where no
browser can reach it, so none of the runtime checks in `quality-checks.md` can be
performed. Attaching the file to a record gives it a URL on the instance, and the URL
can be opened and exercised.

```
Report file authored, static checks pass
        |
        +-- Need runtime proof (search, filters, evidence, print)?
        |     NO  -> deliver the file, say runtime was not tested
        |     YES -> attach it (below), then open the URL with the
        |            page-diagnostics tool and operate the controls
```

🛑 **The attachment is a PREVIEW SURFACE, not the deliverable.** The user still
receives the actual file. An attachment is a copy that will drift the moment the file
is edited, so delete it when the check is done, or treat it as disposable.

---

## 1. The write call — verified signature

```javascript
var attId = new GlideSysAttachment()
              .write(targetGlideRecord, fileName, contentType, contentString);
```

Measured on the instance, by probing `typeof` on each name:

| Method | Present |
|---|---|
| `write`, `writeContentStream`, `getContentStream` | ✅ |
| `copy`, `deleteAttachment`, `getAttachments` | ✅ |
| `writeBase64`, `getContent`, `getContentBase64`, `rename` | ❌ **absent** |

🛑 **`getContent` does not exist.** Reading the HTML back to verify it requires
`getContentStream`, which is a stream rather than a string. Do not write a read-back
that calls `getContent` — assert on the content *before* writing instead (§3).

`contentType` must be `text/html`. Set it explicitly; it governs how the browser
treats the response.

**Attachment home.** Any record works. The application record is a sensible owner for
a report about that application — both `sys_app` and `sys_scope` resolve for an app
scope sys_id, verified by `get()`. The current user (`sys_user` +
`gs.getUserID()`) is the neutral alternative when the report is not about one record.

---

## 2. Getting 40 KB of HTML into a script body — the real difficulty

The transfer is the hard part, not the attachment. The HTML must become a string
literal inside the server script, and a mis-escape produces **an artifact that still
renders and still looks correct**. That is the failure to design against.

**Template literals and arrow functions both work** in the server-side engine —
verified by `eval()` probe with an ES5 control firing in the same call. So the HTML
can go inside backticks.

🔑 **CHOOSE BACKTICKS, AND COUNT THE ESCAPE SITES FIRST.** A report contains both
quote styles throughout, so a quote-delimited string needs ~110 hand escapes with no
way to check them. A backtick-delimited string needs only the sites below — and on a
real 41,193-character report that was **6**, which is countable.

Three sequences must be escaped inside a template literal:

| Sequence | Escape as | Why it matters |
|---|---|---|
| backtick | `\` + backtick | Terminates the literal. Loud failure. |
| `${` | `\${` | Interpolates. Usually a loud failure. |
| `\` | `\\` | 🛑 **SILENT.** See below. |

🛑 **THE BACKSLASH IS THE DANGEROUS ONE.** Inside a template literal `\s` becomes a
bare `s`. A report's own search code almost always contains `.replace(/\s+/g, ' ')`,
which silently degrades to `/s+/g` — so the search box stops collapsing whitespace and
starts matching the letter *s*. The document renders, the control responds, nothing
errors, and the behaviour is wrong.

**Count them before transcribing.** One grep over the source file, three alternated
character classes:

```
fs_grep  glob:<report file>  output_mode:content  pattern:[`]|[\\]|[$][{]
```

Any zero is void until a control fires — a report with a search control certainly
contains a backslash, so a zero means the pattern is wrong, not the file is clean.

---

## 3. Assert integrity BEFORE the write

Because a bad escape renders fine, the check must happen on the string in memory while
there is still the option not to write it.

Assert one condition per escape site, plus the document's shape. Build the backtick
with `String.fromCharCode(96)` so the assertion itself needs no escaping:

```javascript
var BT = String.fromCharCode(96);
var checks = [
  ['doctype first',       html.indexOf('<!DOCTYPE html>') === 0],
  ['closes with html',    html.indexOf('</html>') > 0],
  ['attribution present', html.indexOf('Made with ServiceNow EmployeeWorks') !== -1],
  ['self-contained',      html.indexOf('<script src=') === -1],
  // one per backslash site - this is the silent one
  ['whitespace regex',    html.indexOf('/' + '\\s+/g') !== -1],
  // one per backtick / dollar-brace site
  ['literal opens',       html.indexOf(BT + '${shown}') !== -1],
  ['literal closes',      html.indexOf('${activeCategory}.' + BT) !== -1]
];
// ... count failures, and if any failed: print and DO NOT WRITE.
```

**A failed assertion means fix the script, not the attachment.** Writing anyway
produces a corrupted preview that will be mistaken for a corrupted report.

**After the write, read the row back on a fresh `GlideRecord`** — the setter proves
nothing — and compare sizes:

```
size_bytes = 41281   source = 41193 chars
```

⚠️ **Bytes EXCEEDING characters is correct, not a defect.** Em dashes, curly quotes and
other non-ASCII are multi-byte in UTF-8. A byte count *below* the character count means
truncation. Measured: 41,193 chars stored as 41,281 bytes, an 88-byte excess that
matches the file's typography.

---

## 4. Viewing it — what works and what does not

```
https://<instance>/sys_attachment.do?sys_id=<attachment sys_id>
```

**✅ The page-diagnostics tool renders it.** Measured twice — a small probe and the real
41 KB report. Both returned `success: true`, `errors: []`, and a page title equal to the
**document's own `<title>`**, which is the evidence it was parsed as HTML rather than
handled as a file. Console capture works, so JavaScript errors in the report surface
here.

🛑 **A Playwright-style browser tool could NOT navigate to it.** Four attempts, every
one `Failed to proxy to BOS`, and the browser session died each time. Two other URLs on
the same host — the instance login page and an application page — worked in the same
session, so the failure is **specific to this URL**, not the tool.

⚠ The most likely cause is a `Content-Disposition` response header marking the body as a
download: a fetch-based tool ignores disposition and parses the bytes, while a top-level
navigation has nothing to render. **This is inferred, not measured** — the header was
never read.

| Want to | Use |
|---|---|
| Confirm it renders, read its console, snapshot the DOM | page-diagnostics tool ✅ |
| Click, type, tab, operate controls | ⚠ unproven on this URL — see below |

So: **this route proves the report renders and is error-free. It does not prove the
controls work.** State that distinction rather than collapsing it. An untested
`<iframe src>` pointing at the attachment is a plausible way to reach a navigable
surface, since a subresource load is not a top-level navigation — unverified.

---

## 5. Clean up

An attachment is a copy of a file that will keep changing. Leaving it behind creates two
sources of truth for the same report.

- If the server-script tool records a **rollback context**, reverting it removes the
  attachment and is the cheapest route.
- Otherwise delete by sys_id:

```javascript
var gr = new GlideRecord('sys_attachment');
if (gr.get('<attachment sys_id>')) { gr.deleteRecord(); }
```

**Make the write idempotent** so a re-run does not leave several copies behind and the
URL stays unambiguous — query `sys_attachment` by `file_name` **and** `table_name`,
delete what matches, then write. Measured: before this method was used, the instance held
`text/csv` and `text/json` attachments and **no** `text/html` precedent, so a stale copy
is easy to miss by eye.

---

## 6. What to tell the user

Give them the URL, and be exact about what it demonstrates:

> Attached and rendering at `<url>` — loads with no console errors and the document's own
> title. Static structure checked. **The interactive controls were not operated**, so
> search, filtering, evidence expansion and print remain untested.

Never present "it rendered" as "it works". A report whose search control silently matches
the letter *s* renders perfectly.

*Made with ServiceNow EmployeeWorks*
