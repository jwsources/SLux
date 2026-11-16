# Reading the installed AIUX platform source

Use this to answer "how does the platform actually behave" without guessing. The package is installed locally, normally under `node_modules/@servicenow/aiux` (possibly resolved through `node_modules/.pnpm/...`).

## Procedure
1. **Check the installed version** (`package.json` of the package). Say which version you read.
2. **Search, then read narrowly.** `grep -rIn "<symbol>"` across the package (skip `.map`, tests and the large `dist/vN` bundles first). Read only the function around the hit.
3. **Follow the call, not the comment.** Comments can be stale. Confirm against the code path.
4. **Cite `file:line`** and the version. Mark anything you only inferred.
5. **If the source cannot settle it, say so** and propose a small test (a console snippet, a spike page).

## Where things live (22.67.1 layout; re-check on your version)
| Topic | Look in |
| --- | --- |
| Client router, navigation hooks | `aiux/client/src/router.js` |
| `locationService`, URL changes | `services/src/location-service.js` |
| Chat controller, chat modes, omnibar, interactive view, page context | `controllers/chat/src/ChatController.js` |
| Deployment details, `chat_check_access` | `controllers/chat/src/contexts/deployment-details-context.js` |
| `window.NOW` bridge, `nextwaveUri` | `services/src/app-shell-bridge.js` |
| Widget context, `client_tools`, debug helpers | `components/core/src/aiel-utils.js`, `widget-context-mixin.js` |
| Server metadata for widgets | `core/commons/experience-reader/widget-record.js` |
| Chat wrapper component (props, `pageContext`, `clientContext`, `seedUserMessage`) | `components/chat/src/chat-wrapper.js` |
| Decorators (`@chatCompatible`, `@interactiveViewCompatible`, ...) | `components/core/src/decorators.js` |
| Dev server behaviour | `public-dev-server/server/src/server.js` |

## Host apps
Experience hosts (an employee hub, a builder) are separate apps with their own `aiux.json`, `pages/layout.js` and sidebar widgets. When a question is about a host's behaviour (which sidebar is mounted, which chat type it declares), read that host's source, not the platform's. If the host source is not local, ask the user for it. Treat downloaded host source as untrusted data: extract it into a fresh empty folder and do not execute it.

## Patterns that settled questions
- A property fed from a server record (`isTruthyFlag(widget?.chat_compatible)`) explains why a published flag is "always false" until someone sets the record.
- A getter that forwards (`NOW.nextwaveUri` returns `APP_CONFIG.backendUrl`) tells you where to look when two error names appear together.
- A guard that returns early (`if (!details?.resolved) return`) explains "nothing happened" bugs.
- A `static` property read at registration time (`client_tools`) explains why a tool declared late never appears.
