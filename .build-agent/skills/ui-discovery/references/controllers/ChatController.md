# @servicenow/aiux-controller-chat

## Import

```js
import {ChatController} from '@servicenow/aiux-controllers';
```


`ChatController` composes the chat experience for `NavLayout` — managing chat mode (OMNI, default, and AIEX-hidden), lazy-loading the AIEX library, session lifecycle, event handling, navigation override, and LBF prop configuration. The package also exports the `CHAT_MODES` / `AIEX_MODES` constants.

This package is re-exported by the `@servicenow/aiux-controllers` umbrella (`controllers/`), which mirrors aiux-kit's `@servicenow/aiux-controllers` contract so widget source ports across runtimes without import changes. Consumers should import from the umbrella, not this package directly.

Renamed from `@servicenow/aiux-controllers` at 1.2.52 — that name now belongs to the umbrella. `CHANGELOG.md` entries at 1.2.52 and below were published under the old name.

## Installation

```js
import {ChatController, CHAT_MODES} from '@servicenow/aiux-controllers';
```

## Usage

Instantiate the controller with its host element (a Lit `ReactiveControllerHost`):

```js
class MyNavLayout extends LitElement {
  #chat = new ChatController(this);
}
```

## API

### `new ChatController(host)`

Registers itself as a `ReactiveController` on `host` (calls `host.addController(this)`) and starts uninitialized — the host renders `#chat.renderChat()` where it wants the chat surface to appear, and `hostConnected()` drives initialization automatically. Public properties that affect behavior should be set right after construction, before the host's first render.

### Properties (configure before first render)

| Property                    | Type      | Default | Description                                                          |
| ---------------------------- | --------- | ------- | ---------------------------------------------------------------------- |
| `chatMode`                   | `string`  | `OMNI`  | One of `CHAT_MODES` — read-write, but prefer `switchMode()` to change it after mount so side effects (URL hash, LBF props) stay in sync |
| `isFullscreen`                | `boolean` | `false` | Whether the chat surface renders full-page                             |
| `showHistoryButton`           | `boolean` | `false` | Show the conversation-history button in the chat header                |
| `showPromotedTopics`          | `boolean` | `false` | Show promoted topic suggestions                                        |
| `showConversationTitle`       | `boolean` | `true`  | Show the active conversation's title in the header                     |
| `showInteractiveViewButton`   | `boolean` | `false` | Show the button that opens the interactive view panel                  |
| `showViewToggleButton`        | `boolean` | `false` | Show the fullscreen/dock view-toggle button                            |
| `enablePinnable`              | `boolean` | `true`  | Allow widgets surfaced in chat to be pinned to the page                |
| `pauseAIELContextOnHomePage`  | `boolean` | `true`  | Pause AIEL context updates while the home page is active               |
| `branding`                    | `object`  | `{backButtonIcon: 'panel'}` | Chat window branding overrides                       |

### Methods

- `initialize()` — starts AIEX library loading and session setup. Called automatically from `hostConnected()`; only call directly for manual/legacy usage.
- `switchMode(newMode)` — transitions `chatMode` to one of `CHAT_MODES`, updating the URL hash and LBF props as a side effect.
- `switchLBFMode(mode)` — same as `switchMode`, but accepts LBF's lowercase mode names (`omni`/`primary`/`side`) and normalizes them first; kept for aiux-kit compatibility.
- `openChat(opts?)` — opens chat in `DEFAULT` mode. `opts.conversationId` resumes a specific conversation, `opts.fullScreen` overlays the page, `opts.sessionContext` forwards a search-result handoff payload, `opts.forceNewConversation` forces a new conversation.
- `closeChat()` — returns to `OMNI` mode.
- `navigateToChat(conversationId?)` — navigates to the dedicated `/chat` route.
- `requestSkillExecution({skill, ...})` — triggers Now Assist skill execution and opens chat.
- `renderChat()` — returns the Lit template for the chat surface (or `nothing` if it should be hidden); call this from the host's `render()`.
- `isReady()` — `true` once the AIEX library has loaded and the session is established.

### Constants

`CHAT_MODES` (`OMNI`, `DEFAULT`, `AIEX_HIDDEN`) and `AIEX_MODES` (`CHAT_AND_IV`, `POPOVER`, `CHAT`) are exported both as package-level constants (`import {CHAT_MODES} from '@servicenow/aiux-controllers'`) and as instance getters (`controller.CHAT_MODES`).
