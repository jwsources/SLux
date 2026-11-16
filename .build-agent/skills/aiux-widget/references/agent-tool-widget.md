# Wiring a widget into an AI agent script tool

Loaded on demand by the `aiux-widget` skill. Follow the `building-ai-agents` skill
for everything about the agent itself; these are the widget-specific additions.

The Otto host, the payload-and-callback data contract and the Widget Builder REST
surface are owned by the hint record `aiux-widget-otto-panel`.

## 1. Get the widget sys_id

Ask for it if it was not provided — **never invent it.** The widget is a
`sys_aix_widget` record. Verify before wiring:

```javascript
var g = new GlideRecord('sys_aix_widget');
if (!g.get('<sys_id>')) { gs.info('NOT FOUND'); }
else {
    gs.info('type            = ' + g.getValue('type'));              // expect aix_widget
    gs.info('chat_compatible = ' + g.getValue('chat_compatible'));   // expect 1
    gs.info('ccm non-empty   = ' + ((g.getValue('component_compile_metadata') || '') !== ''));
    gs.info('input_schema    = ' + g.getValue('input_schema'));
}
```

- `type` must be `aix_widget`
- `chat_compatible` must be `1` — **warn if it is not**; the card will not render
- `component_compile_metadata` must be non-empty, or the widget never registers
- read `input_schema` — you need its property names for step 3

If the widget does not exist, create it first with the `aiux-widget` skill
(chat-compatible), then reference its sys_id.

⚠ If the lookup returns nothing, try the parent `sys_ux_widget` before concluding
the widget is absent: a `Widget Query` before-query business rule hides
`category=internal` rows from any caller without `maint`.

## 2. Wire the tool

On the script tool that shows the widget:

| Property | Value | Why |
|---|---|---|
| `widgets` | `['<sys_id>']` | array of `sys_aix_widget` sys_ids. **Not part of the standard flow** |
| `displayOutput` | `true` | the payload must reach the client |
| `outputTransformationStrategy` | `'none'` | otherwise the payload is reshaped and the keys stop matching |

## 3. The script's return contract

Return a **flat JSON object whose keys match the widget's `input_schema` property
names exactly** — those become the widget's props. Keys that do not match are
**dropped silently**.

- Persist any data **before** the return.
- Return **only** the widget props — nothing else.
- Match the declared types: an `array` property needs an array, not a
  comma-joined string.

🛑 A tool's own auto-generated `inputSchema` is **not** the widget's
`input_schema`. They are different schemas with similar names.

## 4. The version instructions

Tell the agent **not to restate the raw JSON** — a natural-language confirmation
only, and let the widget render. Without this the user sees the payload twice,
once as prose and once as a card.

## 5. Everything else still applies

All other `building-ai-agents` rules hold: `recordType: 'custom'`, agent and tool
messages, `securityAcl`, auth mode.

## Checklist

- [ ] sys_id obtained from the user or a query — never invented
- [ ] `type = aix_widget`, `chat_compatible = 1`, `component_compile_metadata` non-empty
- [ ] `widgets: ['<sys_id>']` on the script tool
- [ ] `displayOutput: true` and `outputTransformationStrategy: 'none'`
- [ ] Script returns a flat object, keys matching `input_schema` exactly
- [ ] Version instructions tell the agent not to restate the JSON
