# AIEL widget context and client tools

Measured against `@servicenow/aiux` 22.67.1. Source: `components/core/src/aiel-utils.js`, `widget-context-mixin.js`, `core/commons/experience-reader/widget-record.js`.

## What a page publishes to the assistant
A page (or widget) extends `withWidgetContext(AIUXElement)`. The assistant receives, per element, an entry in `customWidgetContext`:
- `description`, `best_for` from `static aiContext = { description, bestFor, enabledForInteractiveView }`;
- `actions` derived from `static client_tools` (name, description, arguments);
- `widgetData`, whatever the element passes to `this.setAiContext({...})`, which is the live, structured snapshot of the page;
- `tagName`, `origin: 'OnPage'`, and server metadata such as `widgetSysId`.
Merge order (later wins): server metadata, then static `aiContext`, then derived actions, then `widgetData`.

`setAiContext` debounces and waits for the AIEL layer to be ready. Do not gate your own code on `sessionSuccess`.

## Declaring tools
```js
static client_tools = {
  navigate: {
    description: 'When to call it, what it does, and what it refuses.',
    arguments: [{name: 'route', type: 'string', description: '...'}],
    definition: async function ({route} = {}) {
      // validate, act, return FACTS
    }
  }
};
```
Rules (from the platform contract):
- `definition` must be a regular function or method shorthand. An arrow cannot be rebound and `buildWidgetContext` warns when `definition.name === ''`.
- One args object. If object-typed arguments are not accepted by the argument schema, pass a JSON string and parse it. Check which.
- Return facts (`{success, route, ...}`), never just "ok". The assistant uses the return value to tell the user what happened.
- Tools are registered per element when it connects. After navigation the destination page must register its own. Verify the tools appear on the new page.

## Designing tools the assistant can use well
- **Validate in the tool, match in the model.** The assistant is good at fuzzy matching a request to an option. The app is good at strictness. Publish a catalogue of valid options with meaningful text (labels, questions, page `description` and `bestFor`), let the model pick, and make the tool refuse anything not in the catalogue.
- **No hard-coded phrase or alias lists.** They go stale, compete with the model and become a second source of truth. When a phrase fails to land, fix the text of the option or the page, not the code. Only after a retest still fails, add one short optional hint to that single entry and record why.
- **A refusal should teach.** Return `{success:false, reason, available:[...]}` with enough text to choose again without another round trip.
- **Ids alongside labels, always.** A tool validates an id against what the page published. A label with no id cannot be acted on, and an id with no label cannot be explained to the user.
- **Decisions need the user's yes.** Anything that commits, approves, assigns or notifies must be described in the tool's `description` as "only after the user said yes to THIS action". Proposals that merely wait for a human can be allowed freely.
- **Republish after changing state** (`setAiContext`), so the next answer sees the new state.

## Checking it in the browser
- `inspectAielContext()` and `aielDebug.*` (installed by `aiel-utils.js`).
- `__AIEX_GLOBALS__.getLatestState()` has `customWidgetContext` (keyed by element id), `pageContext`, `session`, `sessionSuccess`, `clientToolContext`.
- A tool is live when it appears under the page's `actions`.

## Interactive view (IV)
- `ChatController` has a mode `chat_and_interactive_view` and handles the events `SHOW_INTERACTIVE_VIEW` and `CLOSE_INTERACTIVE_VIEW` (the event carries `widgetData`; the type seen handled is `SearchResults`). Opening an IV hides the side panel.
- `enabledForInteractiveView` is fed from the widget record field `chat_compatible` (not `interactive_view_compatible`). `@interactiveViewCompatible` is a no-op at runtime. A page can override the published flag in `static aiContext`.
- Whether an assistant can render a custom component in the IV is not established by the source. Spike it, and note that `showInteractiveViewButton` (default false on `ChatController`) may need to be enabled by the host.

## Generating UI from an assistant
Prefer "the assistant composes, the app draws": the assistant sends a spec made of references (a series, a query, an encoding) and the app validates, resolves data and links itself, and renders with existing styling. Never accept markup, numbers or URLs from the assistant. Report anything dropped back in the tool result, so the assistant tells the user what is missing.
