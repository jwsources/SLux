---
name: hint-lookup
description: Use whenever you need the curated ServiceNow hint library — measured platform behaviour, SDK traps, silent-failure modes not in public documentation. Triggers before writing a server-side script, a Fluent definition, an ACL or an AI Search configuration, and whenever a platform assumption is about to be acted on. Also use when the find_hint / hint_retrieval / hint_triage MCP tools are absent from the session, when a hint lookup returns nothing, or when hints are needed from an instance where the Hints Knowledge Base app is not installed.
---

# hint-lookup

Reaches the hint library with **no MCP tools required**. Two paths; pick by
whether the library is on this instance.

```
Is x_snc_hints_knowle_hint a table on THIS instance?
  YES -> LOCAL path (below). No credentials, no network.
  NO  -> REMOTE path -> references/remote-rest-client.md
         first time on this instance? -> references/setup-credential.md
```

Decide it, do not assume it:

```javascript
gs.info(new GlideRecord('x_snc_hints_knowle_hint').isValid());
```

## When to use

- Before acting on any assumption about ServiceNow platform behaviour
- Before writing a server-side script, a Fluent definition, an ACL or an AI Search config
- The `find_hint` / `hint_retrieval` / `hint_triage` tools are missing from the session
- A hint lookup returned nothing and you need to know whether that is real
- You are on an instance without the Hints Knowledge Base app installed

## Instructions — LOCAL path

**Two steps, cheap first. Never pull more than one body.**

### Step 1 — list candidates (summaries only)

`summary` is the answer surface and frequently answers outright. A whole-library
listing of summaries costs roughly 1/16th of pulling every body.

```javascript
var gr = new GlideRecord('x_snc_hints_knowle_hint');
gr.addQuery('active', true);
// NARROW when the topic is known - a full listing is not free:
// gr.addEncodedQuery('category=fluent-sdk');
// gr.addEncodedQuery('tagsLIKEwidget^ORsummaryLIKEwidget');
gr.orderBy('slug');
gr.query();
while (gr.next()) {
    gs.info(gr.getValue('slug') + ' [' + gr.getValue('verification_status') + '] '
          + gr.getValue('summary'));
}
```

🛑 **Do not use `run_query` to list.** It has no field-selection parameter and
returns every column including `body` — a "listing" with it floods your context.

Categories: re-read the choice list rather than trusting any copy —
`sys_choice` where `name=x_snc_hints_knowle_hint^element=category`. A
category-scoped query returns nothing for a value the list omits, and an empty
result reads as *no such knowledge exists*, which is the opposite of the truth.

### Step 2 — fetch ONE body by slug

`run_query` is correct here. Bodies run 5,000–45,000 characters, so fetch one
only when a summary is genuinely insufficient.

```
run_query  table: x_snc_hints_knowle_hint  encodedQuery: slug=<slug>
```

### Better ranking, when the app is installed

The app ships its own hybrid engine — semantic plus literal identifier matching,
which is what a plain `LIKE` cannot do:

```javascript
var r = new x_snc_hints_knowle.HintRetrieval().search('<question or identifier>', 5);
r.results.forEach(function (h) {
    gs.info(h.rank + '. ' + h.slug + '  sim=' + h.similarity + '  src=' + h.match_source
          + '  [' + h.verification_status + ']  ' + h.body_chars + ' chars');
});
```

Returns `{query, limit, count, similarity_metric, document_match_threshold, results[]}`;
each row carries `rank, slug, title, summary, load_when, boundary, category,
verification_status, verified_date, body_chars, match_source, similarity,
tokens_matched`. **No bodies, ever.** `new …HintRetrieval().get(slug)` returns one
record *with* its body, or `{found:false, key:'<slug>'}` on a miss.

## Reading a result — the three rules that decide correctness

1. **A returned row is a candidate, not an endorsement.** An off-topic query
   still returns a full page of confident-looking rows. Judge on `summary` and
   `load_when`, which states the concrete trigger conditions for that record.
2. **Judge `similarity` by SPREAD, never by an absolute value.** On-topic sits
   only ~0.05–0.08 above an off-topic control, and both bands drift down as the
   library grows. One row clearly ahead = a match; a flat spread = the query was
   too vague. Never hardcode a threshold from a remembered score.
3. **Honour `verification_status`:**

| Status | How to act |
|---|---|
| `verified` | actionable as written |
| `partially-verified` | usable; honour the inline ⬜ markers in the body before acting |
| `unverified` | treat claims as hypotheses, verify what you rely on |
| `contradicted` | 🛑 do NOT act on it — fix or escalate |

**Honour `boundary`.** It names what the record does *not* cover and which slug
does. A boundary that excludes your question is the most useful thing in the row:
follow it rather than answering from the wrong record.

**An empty result is a claim requiring a control.** Run a query you know matches
alongside the real one. A zero with no firing control is VOID, not evidence that
the knowledge is absent.

## Next Steps

- Remote instance, or the local check returned `false` →
  **`references/remote-rest-client.md`**. First time on that instance, run
  **`references/setup-credential.md`** once to create the credential and alias.
- **Found a gap, a wrong claim or a stale one? Report it** →
  **`references/send-feedback.md`**. `POST /submit_feedback` takes six kinds, and
  `gap` — nothing in the library fitted — is the most valuable because the query
  becomes the specification for a hint somebody can write. Works from both paths.
- The record is authoritative. It outranks training-data recall and any file copy.
  If a hint contradicts what you believe about the platform, the hint wins — say
  so rather than quietly reconciling them.
- A hint augments but never replaces `explain_fluent_doc` and official-doc
  validation.
