# Which assistant does an AIUX experience run?

Measured against `@servicenow/aiux` 22.67.1 and one instance, 2026-10-30 to 2026-11-01. Re-verify on your version and instance; the mechanism is stable in shape, the values are not.

## The short version
An AIUX experience (an app shell addressed by a URL suffix, such as `/aiux/<suffix>`) decides its chat assistant in two places that must agree:
1. **The experience property `chatType`** (table `sys_aix_experience_properties`, name `chatType`, one row per experience). Observed values: `nextwave` (Now Assist, the "Otto" assistant) and `moveworks`. This decides which chat the experience runs.
2. **A deployment channel row** (table `sys_now_assist_deployment_channel`) that binds a surface (`document_table` + `document_id`, for example a `sys_aix_experience` record) and an `experience` type to a `now_assist_deployment`. This picks WHICH Now Assist deployment, and therefore which context profile and assistant behaviour, a Now Assist surface uses.

Having the deployment row without `chatType = nextwave` does nothing useful, and can cause errors (see below). Having `chatType = nextwave` without a deployment row for the experience gives a Now Assist chat with no deployment bound.

## How the client resolves it
- The framework resolves deployment details on the server (`prefetchDeploymentDetails`) or, for client-rendered apps, in the browser, by calling `GET /api/now/aiux_service/chat_check_access` with either `?deployment_sys_id=<channel row id>` or `?experience_url_suffix=<suffix>`. A path-segment form (`/chat_check_access/{sys_id}`) is deprecated. An "OBO" variant exists under `/api/now/aiux_obo_service/`.
- The response carries `active`, `document_id`, `document_table` and `now_assist_deployment`. The client stores them in `deploymentDetailsContext` (read-only to consumers) and puts the ids in the page context as `nowAssistDeploymentId`, `deploymentDocumentId`, `deploymentDocumentTable`.
- `window.NOW.nextwaveUri` is a getter for `window.APP_CONFIG.backendUrl`, and `APP_CONFIG` is filled in by the platform's `aiel.js`. If `backendUrl` is empty, the Now Assist client fails with "backendUrl not configured" and names both `APP_CONFIG.backendUrl` and `NOW.nextwaveUri`.
- Server-side logic for the access check may live in a protected script include (for example `AIXCheckChatAPI`). You can still call its methods in a background script to see what it returns for an experience.

## Per-experience facts to look up, not assume
- Each host app declares its chat type in its own `aiux.json` under `experienceProperties.chatType`, and the instance row can differ from the file. Read the instance row to know what is live.
- The host layout may mount a specific assistant sidebar regardless of the property (for example a layout that renders a Moveworks sidebar). Read the host `pages/layout.js` before assuming the property is the whole story.

## Differences between assistants (measured)
| Capability | Moveworks | Now Assist (nextwave) |
| --- | --- | --- |
| Reads AIEL `customWidgetContext` (page context) | No | Yes |
| Calls page `client_tools` | No (nothing to test until a page declares them) | Yes, once declared. Verify per page |
| `aiux:open-chat` options after init | Dropped | Not re-tested |
| Reaches Now Assist agents and skills | No | Yes, through the deployment's context profile |

State which assistant any finding applies to. A finding about one assistant is not a fact about the other.

## Diagnose
| Symptom | Check |
| --- | --- |
| Chat is the wrong assistant | `chatType` row for the experience (read, then read back after any change), then the host layout. |
| "backendUrl not configured" | Which experience and which `chatType` at the time. The error means the Now Assist client started with no backend URL. Check whether `chatType` and the deployment row disagree, whether another experience (known to work) shows the same error, and what `APP_CONFIG` holds in the browser console. |
| `sessionSuccess` is false | Whose OAuth token is it (decode the `sub`, look the sys_id up)? Impersonation causes a mismatch. Test with a real login. |
| A value you set changed back | `sys_mod_count` versus your writes; someone or something else wrote it. Auditing may be off. |
| Assistant ignores the page | `references/aiel-widget-context-and-tools.md`, and confirm the assistant is Now Assist. |

## Changing it
`chatType` and deployment rows are shared config for everyone on that experience. Before any change: say who is affected, record old and new values, get the user's yes, change, read back, and tell them to hard-reload. To undo, write the old value back. If the property belongs to another team's app, say so.
