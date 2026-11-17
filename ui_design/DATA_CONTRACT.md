# Data contract

## 1. Layout config (one record per table and optional condition)
Store in a scoped table (for example `x_record_view_config`). Resolve by table name and condition; fall back to a default config: PageHeader, OttoBrief, FactList, OttoDock (and Details only if no Otto payload).

```json
{
  "table": "<table name>",
  "condition": "<encoded query, optional>",
  "header": { "title": "<field>", "chips": ["<field or expression>"] },
  "grid": [
    { "id": "brief", "type": "OttoBrief", "span": 12, "source": "otto.brief" }
  ],
  "dock": { "type": "OttoDock", "source": "otto.findings" }
}
```
A full example is in `samples/config.cs0001623.json`. Sources starting `record.` come from data resources; sources starting `otto.` come from the Otto payload. `children` on a grid entry composes components (SplitProgress with TaskTable).

## 2. Data resources (`record.*`)
| Source | Returns | Notes |
|---|---|---|
| `record.party` | person and ownership facts | Contact, account, assignment group, assigned to |
| `record.chain` | ordered related-record nodes | Parent, self, work order, change request, regulatory report; each with number, table, state, link |
| `record.remediation` | device counts, target firmware, task rows | **Task and work order states are the real state field values** |
| `record.fields` | form layout sections and field values | Feeds RecordFields |
| `record.activity` | journal entries, paged | Work notes, customer comments, system updates; id, type, author, time, body |

## 3. Otto payload (`otto.*`)
One payload per record. The page renders whatever arrives and shows skeletons while loading. Full example: `samples/otto-payload.cs0001623.json`.
- `brief`: `{summary, alerts[], stats[]}`
- `cause`: `{from, to, description, facts[]}`
- `situation`: `{steps[]}`
- `findings[]`: `{id, title, detail, sources[], target, severity}`; no source or target means no finding
- `suggestions[]`: `{id, label, action, params}`
- `story[]`: `{stage, title, detail, tone, noteId, sources[]}`
- `activityEnrichment[]`: `{noteId, title, summary, topics[], key: boolean, structured?: [{label, value}]}` keyed to journal entries

## 4. Rules
- Otto enrichments never replace source data. The original journal body is always retrievable.
- Otto figures and record figures both come from real data. If they disagree, show the record value and surface the conflict as a finding.
- Task and work order states always come from the state field, never from narrative text.
- Suggestions never write data silently; always a confirm step.
- Without an Otto payload the page degrades as described in `SPEC.md` section 6.
