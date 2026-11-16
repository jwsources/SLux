# @servicenow/aiux-components-nacm

## Import

```js
import '@servicenow/aiux-components-nacm';
```


Now Assist Content Management (NACM) components for AI-powered skill invocation, response rendering, record-watcher updates, and user interaction in the Now Assist experience. `<aiux-nacm>` fetches a skill configuration, renders a trigger button, and opens a recommendation dialog where AI-generated responses are displayed — consumers interact with it declaratively via properties and by listening to bubbled events.

## Usage

Register the package for its custom elements:

```js
import '@servicenow/aiux-components-nacm';
```

Lit lowercases property names to derive attribute names (no kebab-case), so the multi-word properties map to all-lowercase attributes in HTML:

```html
<aiux-nacm
  documentsysid="abc123"
  documenttablename="incident"
  wwnacomponentid="my-component"
  skillid="skill-001"
></aiux-nacm>
```

Complex props (objects/arrays like `payload`, `buttonProps`, `nacmConfig`) have no attribute and must be set via property binding (e.g. `.payload=${...}` in a Lit template).

## Components

### `<aiux-nacm>`

Top-level orchestrator component. Responsibilities:

1. Fetches skill configuration from `/api/sn_wwna/wwna/skill_config` (or accepts a pre-fetched `nacmConfig` prop)
2. Runs `nacmConfigReducer` to extract normalized state (button props, dialog props, channel name, etc.)
3. Determines if the component should render based on `minSelectedWordCount`
4. Subscribes to the record watcher AMB channel and forwards messages
5. Renders `<aiux-nacm-multi-skill-wrapper>` with merged props when conditions are met
6. Forwards events from the wrapper to the host with `aiux-nacm-*` prefix
7. Optionally renders a loading skeleton while config is being fetched (`renderDisabledSkeleton=true`)

## Properties

| Property                        | Attribute                | Type                        | Default       | Description                                                                                                                                                    |
| ------------------------------- | ------------------------ | --------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentSysId`                 | `documentsysid`          | `String`                    | `''`          | **Required.** Sys ID of the record the component is attached to. Used for skill-config lookup and AMB channel creation.                                        |
| `documentTableName`             | `documenttablename`      | `String`                    | `''`          | **Required.** Table name of the record (e.g. `'incident'`).                                                                                                    |
| `wwnaComponentId`               | `wwnacomponentid`        | `String`                    | `''`          | **Required.** Unique component identifier. Matches the `nacm_component_id` in the skill config's variable set to select the correct configuration (see [Skill Config Schema](#skill-config-schema)). A deprecated table-wide matching mode is also supported: a variable set whose `nacm_component_id` equals `documentTableName` and whose `configured_columns` includes `wwnaComponentId` also matches, for backward compatibility with older configs. |
| `skillId`                       | `skillid`                | `String`                    | `''`          | Skill sys ID passed to the config API. When empty the API resolves from other params.                                                                          |
| `skillConfigSysId`              | `skillconfigsysid`       | `String`                    | `''`          | Explicit skill-config sys ID. Skips the lookup-by-skill-id path.                                                                                               |
| `payload`                       | —                        | `WwnaPayload`               | `{}`          | Arbitrary payload forwarded to the invoked action. Also supports nested `excludeActions`, `reTriggerActions`, and `sectionsConfig` overrides.                  |
| `selectedText`                  | `selectedtext`           | `String`                    | `''`          | The text currently selected/highlighted by the user. Drives the `minSelectedWordCount` gate.                                                                   |
| `draftedText`                   | `draftedtext`            | `String`                    | `''`          | Draft text from the field (e.g. an in-progress note) passed to skill actions.                                                                                  |
| `buttonProps`                   | —                        | `ButtonProps`               | `{}`          | Customizes the trigger button (merged over skill-config and defaults). See [ButtonProps Detail](#buttonprops-detail) below.                                    |
| `openPromptConfig`              | —                        | `Object`                    | `{}`          | Key-value map forwarded to the open-prompt sub-component (e.g. placeholder text).                                                                              |
| `additionalConfig`              | —                        | `AdditionalConfig`          | `{}`          | Extensible config bag. Supports `preInvokeActionHandler` — an async function called before each action invocation to transform the payload.                    |
| `recommendationDialogProps`     | —                        | `RecommendationDialogProps` | `{}`          | Customizes the recommendation dialog (merged over skill-config and defaults). See [RecommendationDialogProps Detail](#recommendationdialogprops-detail) below. |
| `timeoutErrorMessage`           | `timeouterrormessage`    | `String`                    | `''`          | Custom error message shown on action timeout. Falls back to the default error message.                                                                         |
| `ambChannelName`                | `ambchannelname`         | `String`                    | `''`          | Custom AMB channel name. When empty, a channel is auto-generated — see [AMB Channel Name Construction](#amb-channel-name-construction) below.                  |
| `nacmConfig`                    | —                        | `Object`                    | `{}`          | Pre-fetched `RawSkillConfig` object. When provided, the component skips its own API call and uses this config directly.                                        |
| `caller`                        | `caller`                 | `CallerType`                | `'aiux'`      | Caller context: `'mobile'`, `'ui16'`, `'workspace'`, or `'aiux'`. Affects layout and AMB channel naming.                                                        |
| `additionalAnalyticsAttributes` | —                        | `Object`                    | `{}`          | Extra key-value pairs included in analytics events.                                                                                                            |
| `renderDisabledSkeleton`        | `renderdisabledskeleton` | `Boolean`                   | `false`       | When `true`, renders a disabled trigger while config is loading or unavailable. When `false`, the component renders nothing until config is ready.             |
| `feedbackProps`                 | —                        | `FeedbackProps`             | `{}`          | Configuration for positive/negative feedback (thumbs-up/down).                                                                                                 |

#### ButtonProps Detail

Merged as **defaults < skill-config < consumer-supplied** `buttonProps`.

> **Boolean props accept string `'true'`/`'false'` too.** Skill-config JSON
> (`variable_sets[n].props.button_props`/`recommendation_dialog_props`) is
> admin-authored and frequently encodes booleans as the strings `'true'`/
> `'false'` rather than JSON booleans. Every `boolean`-typed field below (in
> both this table and RecommendationDialogProps) is normalized through
> `toBool()` (`shared/utils/index.ts`) before use, so a string `'false'` is
> treated as `false` — not truthy. Pass real booleans from consumer-supplied
> props; only skill-config-sourced values are expected to arrive as strings.

| Key                        | Type                | Default                | Description                                                                            |
| -------------------------- | ------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| `icon`                     | `string`            | `'ai-sparkle-outline'` | Icon displayed in the trigger button.                                                  |
| `label`                    | `string`            | `''`                   | Visible text label on the trigger.                                                     |
| `variant`                  | `string`            | `'secondary-ai'`       | Button variant (e.g. `'primary'`, `'secondary-ai'`).                                   |
| `size`                     | `string`            | `'md'`                 | Button size (`'sm'`, `'md'`, `'lg'`).                                                  |
| `tooltipContent`           | `string`            | `''`                   | Tooltip text on hover.                                                                 |
| `hideButtonOnDialog`       | `boolean`           | `true`                 | Hides the trigger when the dialog opens.                                               |
| `fitToParent`              | `boolean \| string` | `false`                | Stretches the trigger to fill its parent container.                                    |
| `autoTriggerDefaultAction` | `boolean`           | `false`                | Automatically fires the default action on mount (no user click needed).                |
| `enableAIGradient`         | `boolean`           | `true`                 | Enables the AI gradient styling on the trigger.                                        |
| `minSelectedWordCount`     | `number`            | `0`                    | Minimum word count in `selectedText` for the component to render. `0` = always render. |
| `renderAsLink`             | `boolean`           | `false`                | Renders the trigger inline as a link instead of a button.                              |
| `hidePrimaryIcon`          | `boolean`           | `false`                | Hides the primary icon in the trigger.                                                 |

#### RecommendationDialogProps Detail

Merged as **defaults < skill-config < consumer-supplied** `recommendationDialogProps`.

| Key                             | Type                                                                   | Default                                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|---------------------------------|------------------------------------------------------------------------|----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `headerInitialLabel`            | `string`                                                               | `'Now Assist'`                               | Dialog header before action is invoked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `headerLoadingLabel`            | `string \| string[]`                                                   | `'Reviewing your request...'`                | Header shown while loading. An array rotates labels every 3 s.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `headerLoadedLabel`             | `string`                                                               | `'Now Assist'`                               | Header after response is received.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `headerLoadedIcon`              | `IconNameWithVariant`                                                  | `'sn-sparkmoji-logo'`                        | Custom icon displayed in the dialog header after the response loads. Applied to all variants (fixed, draggable, popover, inline). Before response loads, the loading spinner icon is always shown; the custom icon only renders once `responseRendered` is true. Accepts any valid icon name from `@servicenow/aiux-directive-icon`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `headerStatus`                  | `'info' \| 'background-secondary' \| 'neutral' \| 'error' \| 'accent'` | `'background-secondary'`                     | Background color for the dialog header bar. Applied to the **fixed and popover variants only** — no effect on draggable or inline. Each token resolves to its `var(--color-<token>)` custom property, so the header tracks light/dark theme changes. The heading text, the header icon (sparkle, loading spinner, and loaded-state icon), the info tooltip icon, and — in the fixed variant — the refresh/collapse/close buttons all automatically recolor to a contrast-safe foreground paired with the chosen token (e.g. `info` → `--color-info-content`), so nothing goes illegible against a custom background. Unset or unrecognized values fall back to the default `'background-secondary'` — `var(--color-background-secondary)` for the background (identical to the header's previous fixed `bg-base-200` class in both light and dark theme) paired with `var(--color-secondary-content)` for the text/icon (a dark neutral gray, very close to but not byte-identical to the header's previous hardcoded black text). |
| `footerLabel`                   | `string`                                                               | `'Check AI-generated content for accuracy.'` | Footer disclaimer text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `width`                         | `number`                                                               | `540`                                        | Dialog width in px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `height`                        | `number`                                                               | `240`                                        | Dialog height in px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `maxHeight`                     | `number`                                                               | —                                            | Maximum dialog height in px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `offsetLeft`                    | `number`                                                               | `40`                                         | Horizontal offset from the trigger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `offsetTop`                     | `number`                                                               | `60`                                         | Vertical offset from the trigger.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `isRefreshHidden`               | `boolean`                                                              | `false`                                      | Hides the refresh button entirely.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `isRefreshDisabled`             | `boolean`                                                              | `true`                                       | Disables the refresh button (visible but not clickable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `manageRefresh`                 | `boolean`                                                              | `false`                                      | When `true`, consumer manages refresh state externally (e.g. new data available).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `refreshSummaryHelperText`      | `string`                                                               | `'New data available.'`                      | Text shown next to the refresh prompt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `refreshSummaryButtonText`      | `string`                                                               | `'Refresh Summary'`                          | Label on the managed-refresh button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `enableMultipleDialogs`         | `boolean`                                                              | `false`                                      | Allows multiple recommendation dialogs to be open at the same time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `insertButtonLabel`             | `string`                                                               | `'Insert'`                                   | Label for the primary insert CTA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `primaryCTATooltip`             | `string`                                                               | `'Insert'`                                   | Tooltip for the primary CTA button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `hideInsertButton`              | `boolean`                                                              | `false`                                      | Hides the insert CTA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `isCopyButtonHidden`            | `boolean`                                                              | `false`                                      | Hides the copy-to-clipboard button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `closeButtonTooltip`            | `string`                                                               | `'Close'`                                    | Tooltip for the dialog close button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `isDialogHoisted`               | `boolean`                                                              | `true`                                       | Teleports the dialog to `<body>` to escape stacking contexts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ctaVariant`                    | `string`                                                               | `'primary-ai'`                               | Button variant for primary CTAs. `'primary-ai'` renders the accent/gradient style when `enableAIGradient` is `true`, and falls back to the plain `'primary'` style when it's `false`. Other supported values: `'primary'`, `'secondary'`, `'tertiary'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `secondaryCTAVariant`           | `string`                                                               | `'secondary'`                                | Button variant for secondary CTAs. Same supported values as `ctaVariant`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `additionalInfoTooltip`         | `string`                                                               | `'AI generates text...'`                     | Tooltip for the info icon in the dialog.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `refineCount`                   | `string`                                                               | `'-1'`                                       | Max number of refine actions displayed. `-1` = unlimited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `fixedVariantInitialLineCount`  | `number`                                                               | `15`                                         | Lines shown in the fixed variant before "Show more".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `fixedVariantShowMoreLineCount` | `number`                                                               | `5`                                          | Additional lines revealed per "Show more" click.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `hideFooter`                    | `boolean`                                                              | `false`                                      | Hides the `footerLabel` disclaimer text in the multi-section footer (draggable + fixed). The CTA row still renders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `headerActions`                 | `string`                                                               | `''`                                         | `+`-delimited token list controlling which header buttons render: `info`, `close`, `collapse`. Empty/unset reproduces today's per-variant defaults — fixed shows `info` + `collapse`; draggable shows `info` + `close`. In the fixed variant, `close` and `collapse` are independent (both render if both tokens are present). Has no effect on the `inline` variant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `enableResize`                  | `boolean`                                                              | `true`                                       | Whether the draggable and inline variants' floating dialog can be resized via its edge/corner handles. Maps directly to `<aiux-control-modeless-dialog>`'s `enableResize` property.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `enableDrag`                    | `boolean`                                                              | `true`                                       | Whether the draggable and inline variants' floating dialog can be dragged by its header. Maps directly to `<aiux-control-modeless-dialog>`'s `enableDrag` property.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ctaLabelsMapping`              | `Array<{sysId: string; label: string}>`                                | `[]`                                         | Overrides the label shown on rendered primary/secondary CTA buttons, matched by `sysId`. Falls back to the label from the `call_to_action`/`call_to_action_secondary` config when a CTA's sysId has no entry, or the entry's `label` is empty. Has no effect on refine actions or the trigger's preset/menu actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `showBorder`                    | `boolean`                                                              | `true`                                       | Whether the fixed variant's outer dialog wrapper renders its border (`border border-base-300`). Has no effect on the draggable, popover, or inline variants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### Events

All events bubble and are `composed` (cross Shadow DOM). Add listeners on the `<aiux-nacm>` element.

Forwarded directly from `<aiux-nacm>`:

| Event                                    | Constant                                  | Detail                          | Description                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiux-nacm-menu-action-clicked`          | `NACM_EVENT.MENU_ACTION_CLICKED`          | `{selectedItem, type}`          | A flyout/menu action (refine or CTA) was selected — forwarded from the wrapper.                                                                                                          |
| `aiux-nacm-feedback-submitted`           | `NACM_EVENT.FEEDBACK_SUBMITTED`           | `{feedback, logId}`             | Feedback submitted (thumbs up/down).                                                                                                                                                     |
| `aiux-nacm-component-rendered`           | `NACM_EVENT.COMPONENT_RENDERED`           | `{isNAcmEnabled, componentKey}` | Fired exactly **once** per component lifecycle, as soon as the skill config resolves. See [Detecting Whether the Trigger Will Render](#detecting-whether-the-trigger-will-render) below. |
| `aiux-nacm-recommendation-dialog-closed` | `NACM_EVENT.RECOMMENDATION_DIALOG_CLOSED` | —                               | Recommendation dialog closed.                                                                                                                                                            |
| `aiux-nacm-amb-message-received`         | `NACM_EVENT.AMB_MESSAGE_RECEIVED`         | `{data, sectionId?}`            | AMB message received at wrapper level (`sectionId` absent) or forwarded up from a single section's card (`sectionId` present). Every section's raw AMB traffic surfaces here.            |
| `aiux-nacm-rw-message-received`          | `NACM_EVENT.RW_MESSAGE_RECEIVED`          | `{data}`                        | Record watcher message received.                                                                                                                                                         |

Dispatched deeper in the component tree and bubble up (also listenable on `<aiux-nacm>`):

| Event                                         | Constant                                       | Detail                      | Description                                                                                                  |
| --------------------------------------------- | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `aiux-nacm-call-to-action-clicked`            | `NACM_EVENT.CALL_TO_ACTION_CLICKED`            | `{action, ctaType, response}`         | A primary or secondary CTA button is clicked (e.g. Insert, Copy). `ctaType` is `'primary'` or `'secondary'`. `response` is a single response object for a single-section skill, or an array of every rendered section's current response for a multi-section skill (a group CTA has no single owning section). |
| `aiux-nacm-flyout-item-clicked`               | `NACM_EVENT.FLYOUT_ITEM_CLICKED`               | `{selectedItem, type}`      | A flyout/menu action item is clicked.                                                                        |
| `aiux-nacm-flyout-refine-clicked`             | `NACM_EVENT.FLYOUT_REFINE_CLICKED`             | `{action}`                  | A refine action in the flyout is clicked.                                                                    |
| `aiux-nacm-flyout-cta-clicked`                | `NACM_EVENT.FLYOUT_CTA_CLICKED`                | `{action}`                  | A CTA inside a flyout card is clicked.                                                                       |
| `aiux-nacm-refresh-button-clicked`            | `NACM_EVENT.REFRESH_BUTTON_CLICKED_SECTION`    | `{sectionId}`               | Refresh is clicked on an individual section.                                                                 |
| `aiux-nacm-refresh-button-clicked-wwna`       | `NACM_EVENT.REFRESH_BUTTON_CLICKED`            | `{}`                        | The global refresh button is clicked.                                                                        |
| `aiux-nacm-regenerate-recommendation-clicked` | `NACM_EVENT.REGENERATE_RECOMMENDATION_CLICKED` | `{}`                        | The user regenerates a recommendation.                                                                       |
| `aiux-nacm-dialog-closed`                     | `NACM_EVENT.DIALOG_CLOSED`                     | `{}`                        | The inner dialog is closed (before the nacm-level forwarding).                                               |
| `aiux-nacm-ai-status-card-state-changed`      | `NACM_EVENT.AI_STATUS_CARD_STATE_CHANGED`      | `{state}`                   | The AI status card transitions (loading, success, error, etc.).                                              |
| `aiux-nacm-multi-skill-card-responded`        | `NACM_EVENT.MULTI_SKILL_CARD_RESPONDED`        | `{status, response}`        | A skill section's card completes (success/error).                                                            |
| `aiux-nacm-show-copy-failed`                  | `NACM_EVENT.SHOW_COPY_FAILED`                  | `{}`                        | A clipboard copy operation fails.                                                                            |
| `aiux-nacm-cta-clicked`                       | `NACM_EVENT.CTA_CLICKED`                       | `{action}`                  | Low-level CTA click (section-level).                                                                         |
| `aiux-nacm-refine-action-clicked`             | `NACM_EVENT.REFINE_ACTION_CLICKED`             | `{action}`                  | A refine action is triggered.                                                                                |
| `aiux-nacm-preset-action-selected`            | `NACM_EVENT.PRESET_ACTION_SELECTED`            | `{action, nacmComponentId}` | A preset action is selected from the trigger dropdown.                                                       |
| `aiux-nacm-close-other-dialogs`               | `NACM_EVENT.CLOSE_OTHER_DIALOGS`               | `{}`                        | Signals other open NACM dialogs to close (single-dialog mode).                                               |

#### Detecting Whether the Trigger Will Render

`aiux-nacm-component-rendered` fires exactly **once** per `<aiux-nacm>` lifecycle, as soon as the skill config resolves (whether from a `nacmConfig` prop or the internal fetch). It tells uptakers, independent of the current `selectedText`/word-count gate, whether the trigger is actually configured and will be usable for this document/component:

| `detail` field  | Type      | Description                                                                                                                                                                                                                                           |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isNAcmEnabled` | `boolean` | `true` when a matching, active skill config was found and the trigger — in any variant, including `autoTriggerDefaultAction` — will render. `false` when no matching config exists, the config is inactive, or the skill-config fetch failed/errored. |
| `componentKey`  | `string`  | Echoes `wwnaComponentId`, so consumers with multiple `<aiux-nacm>` instances on a page can tell them apart.                                                                                                                                           |

Notes:

- The event is **not** re-dispatched when `selectedText` changes — the word-count gate only affects the trigger's moment-to-moment visibility, not whether NACM is enabled for the document/component.
- `renderDisabledSkeleton` does not change `isNAcmEnabled` — a disabled skeleton can still be shown to the user while `isNAcmEnabled` is `false` (e.g. while config is loading, before the event has fired at all, or after a config error).

#### Slots

| Slot                       | Description                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger`                  | Consumer-supplied trigger element (see "Slotted Trigger" below); passed through to the wrapper. Only honored for the `'draggable'` and `'popover'` variants |
| `content-footer-slot-wwna` | Passed through to the wrapper's footer slot                                                                                                                 |

---

### `<aiux-nacm-multi-skill-wrapper>`

Organism component that manages the trigger button, rendering variants, AMB subscriptions, and section containers.

- **Four rendering variants**: `'fixed'` (inline card with expand/collapse), `'draggable'` (floating resizable dialog), `'popover'` (popover-anchored dialog), `'inline'` (always-visible open prompt, no trigger button). The `'draggable'` and `'popover'` variants additionally support an opt-in **slotted trigger** that lets the consumer supply their own trigger element instead of the built-in sparkle button.
- **AMB subscription** at the wrapper level for menu-level messages
- **Loading label carousel** in the dialog header during generation
- **Copy error alert** with auto-dismiss after 8 seconds
- **Refresh** re-invokes all sections
- **reTriggerActions** — when changed, matching sections are re-invoked
- **Group-level CTA invocation (multi-section only)**: for a skill with more than one section, clicking a `call_to_action`/`call_to_action_secondary` button in the shared footer (rendered by `renderMultiSectionFooter`, not scoped to any single section) invokes the skill action via `POST /api/sn_wwna/wwna/invoke_wwna_action` on the wrapper's own AMB channel, in addition to dispatching `aiux-nacm-call-to-action-clicked` with `detail.response` set to an array of every rendered section's current response. A skill with exactly one section renders its CTA row inside that section instead (see `<aiux-nacm-multi-skill-content-container>` below) — its clicks invoke on that section's own AMB channel and carry `detail.response` as a single response object, not this group-level path. Either path's invoke-action payload carries `trigger_source: 'WWNA: CTA'`, unless the clicked action already carries its own `trigger_source` (a chained "next action" step), which takes priority.

#### Key Config Processing

The wrapper locates the multi-skill variable set from `configObject.variable_sets` by matching `config_type === NACM_MULTI_SKILL_CONFIG_ID` and `props.nacm_component_id === nacmComponentId`. **Deprecated**: for backward compatibility, a variable set also matches when its `nacm_component_id` equals `documentTableName` and its `configured_columns` includes `nacmComponentId` — the same table-wide pattern documented under [Skill Config Schema](#skill-config-schema) for `<aiux-nacm>`. It deep-clones the config and stamps unique AMB channel names on each section (`ambChannelName-sectionSysId`).

---

### `<aiux-nacm-multi-skill-content-container>`

Molecule component that manages a single skill section:

- **AMB subscription lifecycle**: subscribes on mount, re-subscribes on `enforceRerenderTime` change
- **Skill invocation** via `POST /api/sn_wwna/wwna/invoke_wwna_action`
- **Response history** with pagination (prev/next)
- **Copy to clipboard** (HTML + plain text via `ClipboardItem`)
- **Thumbs up/down feedback** via `POST /api/now/v1/feedback`
- **Flyout menu** for refine actions and CTAs
- **Show more/less** truncation for fixed variant (measured via `ResizeObserver`)
- **Loading skeleton** with cycling messages
- **AI status card** rendering for status-type responses
- **Split-button CTA** rendering for single-section mode, with the wrapper's group CTAs merged ahead of this section's own `call_to_action`/`call_to_action_secondary` entries. Clicking invokes on this section's own AMB channel (not the wrapper's group-CTA path) and dispatches `aiux-nacm-call-to-action-clicked` with this section's current response in `detail.response`. Same as the wrapper's group-CTA path, the invoke payload's `trigger_source` is `'WWNA: CTA'` unless the clicked action already carries its own.
- **Follow-up actions**: links rendered below a response from `FollowupAction[]` (`label`, `eventName`, `eventPayload`, optional `icon`); clicking dispatches `eventName` with the merged `eventPayload`
- **Action toolbar collapses when empty**: the toolbar row (pagination, feedback, copy, refresh, flyout menu, sources button) and the expanded sources list each only render when they have something to show. When every one of those is disabled/absent — e.g. `isCopyButtonHidden`, no feedback `logId`, a single response, no refine actions, no citations — the whole toolbar container renders nothing, so it reserves no padding/spacing instead of leaving an empty gap.

---

## Examples

### Basic Usage

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
></aiux-nacm>
```

### Custom Trigger Button

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .buttonProps=${{
    label: 'Summarize',
    variant: 'primary',
    size: 'sm',
    tooltipContent: 'Summarize this incident',
    enableAIGradient: true
  }}
></aiux-nacm>
```

### Auto-Trigger on Mount

Immediately invokes the default action without waiting for user click.

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .buttonProps=${{
    autoTriggerDefaultAction: true,
    hideButtonOnDialog: true
  }}
></aiux-nacm>
```

### Custom Dialog Dimensions & Labels

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .recommendationDialogProps=${{
    headerInitialLabel: 'AI Summary',
    headerLoadingLabel: ['Analyzing...', 'Almost there...'],
    footerLabel: 'Verify accuracy before use.',
    width: 600,
    height: 350,
    insertButtonLabel: 'Apply',
    isRefreshHidden: false,
    isRefreshDisabled: false
  }}
></aiux-nacm>
```

### Custom Header Icon After Response Loads

Customizes the icon shown in the dialog header after the response finishes loading. The default sparkle icon (`sn-sparkmoji-logo`) is replaced with the specified icon name once the response is ready. This applies to all rendering variants (fixed, draggable, popover, inline).

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .recommendationDialogProps=${{
    headerLoadedIcon: 'check-outline'
  }}
></aiux-nacm>
```

### Custom Header Status

Colors the dialog header bar with a theme semantic token — `'info'`, `'background-secondary'`, `'neutral'`, `'error'`, or `'accent'`. Only the fixed and popover variants render a colored header; the heading text, header icon, info icon, and (fixed variant) the refresh/collapse/close buttons all repaint to a matching contrast-safe foreground automatically.

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .recommendationDialogProps=${{
    headerStatus: 'error'
  }}
></aiux-nacm>
```

### Overriding CTA Button Labels

Renders the config's `call_to_action`/`call_to_action_secondary` sysIds under consumer-supplied labels. Any sysId without an entry (or with an empty `label`) keeps its label from the skill config. Refine actions and the trigger's preset/menu actions are unaffected.

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .recommendationDialogProps=${{
    ctaLabelsMapping: [
      {sysId: '8f3a1c2e4b5d6a7f8e9c0d1a2b3c4d5e', label: 'Add to record'},
      {sysId: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d', label: 'Copy summary'}
    ]
  }}
></aiux-nacm>
```

### Passing Selected Text with Word-Count Gate

The component only renders when `selectedText` has at least 3 words.

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .selectedText=${this.highlightedText}
  .buttonProps=${{ minSelectedWordCount: 3 }}
></aiux-nacm>
```

### Pre-Fetched Config (Skip API Call)

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .nacmConfig="${this.cachedSkillConfig}"
></aiux-nacm>
```

### Disabled Skeleton While Loading

Keeps a disabled trigger button visible while the skill config is being fetched.

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  renderDisabledSkeleton
  .buttonProps=${{ label: 'Summarize' }}
></aiux-nacm>
```

### Listening to Events

```js
const nacm = document.querySelector('aiux-nacm');

nacm.addEventListener('aiux-nacm-call-to-action-clicked', e => {
  const {action, ctaType} = e.detail;
  console.log(`CTA "${ctaType}" clicked`, action);
});

nacm.addEventListener('aiux-nacm-feedback-submitted', e => {
  console.log('Feedback:', e.detail);
});

nacm.addEventListener('aiux-nacm-recommendation-dialog-closed', () => {
  console.log('Dialog dismissed');
});

nacm.addEventListener('aiux-nacm-menu-action-clicked', e => {
  console.log('Menu action:', e.detail.action);
});
```

### Detecting Whether the Trigger Will Render (Example)

See [Detecting Whether the Trigger Will Render](#detecting-whether-the-trigger-will-render) above for the full `detail` shape.

```js
const nacm = document.querySelector('aiux-nacm');

nacm.addEventListener('aiux-nacm-component-rendered', e => {
  const {isNAcmEnabled, componentKey} = e.detail;
  if (!isNAcmEnabled) {
    // Adjust surrounding UI — e.g. reclaim layout space reserved for the trigger.
    console.log(`NACM is not enabled for "${componentKey}"`);
  }
});
```

### Lit Template with Event Bindings

```ts
render() {
  return html`
    <aiux-nacm
      documentSysId=${this.recordId}
      documentTableName="incident"
      wwnaComponentId="summary_nacm"
      .selectedText=${this.selectedText}
      .payload=${{ context: this.contextData }}
      .buttonProps=${{
        label: 'Assist',
        variant: 'secondary-ai',
        enableAIGradient: true
      }}
      .recommendationDialogProps=${{
        headerInitialLabel: 'Now Assist',
        insertButtonLabel: 'Insert',
        isCopyButtonHidden: false
      }}
      .feedbackProps=${{
        positiveFeedback: { label: 'Helpful' },
        negativeFeedback: { label: 'Not helpful' }
      }}
      @aiux-nacm-call-to-action-clicked=${this._onCtaClicked}
      @aiux-nacm-feedback-submitted=${this._onFeedback}
      @aiux-nacm-recommendation-dialog-closed=${this._onDialogClosed}
      @aiux-nacm-menu-action-clicked=${this._onMenuAction}
    ></aiux-nacm>
  `;
}
```

### Pre-Invoke Action Handler

Transform the payload before every action invocation (e.g. inject extra fields).

```html
<aiux-nacm
  documentSysId="abc123def456"
  documentTableName="incident"
  wwnaComponentId="my_nacm_component"
  .additionalConfig=${{
    preInvokeActionHandler: async (payload) => {
      return {
        ...payload,
        custom_field: 'injected_value'
      };
    }
  }}
></aiux-nacm>
```

### Caller Variants

```html
<!-- AIUX (default) -->
<aiux-nacm caller="aiux" ...></aiux-nacm>

<!-- Workspace -->
<aiux-nacm caller="workspace" ...></aiux-nacm>

<!-- UI16 classic -->
<aiux-nacm caller="ui16" ...></aiux-nacm>

<!-- Mobile -->
<aiux-nacm caller="mobile" ...></aiux-nacm>
```

## Shared Utilities

### `shared/`

Shared Lit controllers, styles, render helpers, and re-exports (`shared/index.ts`):

- **`AMBController`**, **`aiuxFetch`**, **`buildRecordWatcherChannel`** — re-exported from `@servicenow/aiux-components-core`
- **`sharedStyles`** (from `shared/styles/shared.ts`) — CSS custom properties, AI gradient button variants, sparkle animation keyframes, fade-in animation, and reduced-motion accessibility
- **Render helpers** — `renderHtmlContent`, `renderCTAButtons`, `renderDropdownPanel`, `renderOpenPromptTemplate`, and citation renderers (`renderCitationCard`, `renderInlineCitationBadge`, `renderSourcesList`, …) from `shared/citations.ts`

### `shared/utils/`

Pure utility functions shared across NACM components (no Lit imports), re-exported through `shared/index.ts`:

- **`processActions(actions)`** — normalizes raw action objects from the skill config API into a consistent shape, sorted by order
- **`updateActions(actions, excludedActions, type)`** / **`filterActions(...)`** — filter actions based on an exclusion config
- **`applyCtaLabelMapping(actions, mapping)`** — overrides CTA action labels by sysId (backs `ctaLabelsMapping`), falling back to the config label when unmapped
- **`parseItemsRefineFlyout(refine, cta)`** — combines refine and CTA actions into a unified flyout menu item list
- **`computeVariant(variant, enableAIGradient)`** — appends `-ai` suffix when AI gradient is enabled
- **`sanitizeHtml(html)`** — sanitizes AI-generated HTML using DOMPurify (if available) or a regex-based fallback; a `style` attribute is preserved with only script-executing CSS constructs (`javascript:`, `expression(...)`, `-moz-binding`, `behavior:`) stripped out
- **`countWords(text)`** — multilingual word count supporting CJK/Thai characters
- **`meetsMinWordCount(text, minCount)`** / **`shouldNacmRenderForSelectedText(text, min)`** — the word-count render gate
- **`createPayload(options)`** — builds the invocation payload for the skill API
- **`createConversationHistoryData(responses)`** — builds conversation history from accumulated responses
- **`normalizeVariableSets(...)`** (`skill-config-mapper.ts`) — normalizes the skill-config variable sets
- Citation, autogrow, and AIEL-publish helpers (`replaceCitationsWithMarkers`, `stripCitationsFromResponse`, `handleAutogrow`, `publishAIELEvent`, …)

## Skill Config Schema

The component fetches configuration from `/api/sn_wwna/wwna/skill_config`. Key schema details:

- **Multi-skill identification**: `variable_sets[n].config_type === '828eb0e4ff317210d560ffffffffff61'` identifies the NACM multi-skill config
- **Component matching**: `variable_sets[n].props.nacm_component_id` must match `wwnaComponentId`. **Deprecated**: for backward compatibility, a variable set also matches when its `nacm_component_id` equals `documentTableName` and its `configured_columns` (an array of column names) includes `wwnaComponentId` — this table-wide pattern predates per-component configs and should not be used for new ones.
- **Button props**: JSON-encoded string at `variable_sets[n].props.button_props`
- **Dialog props**: JSON-encoded string at `variable_sets[n].props.recommendation_dialog_props`
- **Sections**: Array at `variable_sets[n].props.sections` — each section has a `default_preset_action`, refine actions, CTAs, and section-level config
- **Variant**: `variable_sets[n].props.variant` — one of `'fixed'`, `'draggable'`, `'popover'`, or `'inline'`

### Slotted Trigger — Cross-Variant Option

The `'draggable'` and `'popover'` variants support an opt-in slotted trigger. The consumer supplies their own trigger element (link, button, image, chip, …) via `<slot name="trigger">` and the wrapper swaps its built-in sparkle button for the slotted element. The response surfaces in whatever surface the variant defines: modeless dialog for `'draggable'`, popover anchored to the slotted element for `'popover'`. The `'fixed'` variant does not support this — its trigger is embedded in an inline card whose chrome (header, divider, response body) makes a slotted replacement inconsistent; consumers wanting their own trigger should use `'draggable'` or `'popover'` instead. The `'inline'` variant has no trigger button at all.

#### Activation contract — consumer dispatches `aiux-nacm:trigger`

**The wrapper does NOT auto-listen for `click` or `keydown` on the slotted element.** It binds zero event listeners to the consumer's element. The consumer fully owns activation and dispatches a single bubbling, composed `aiux-nacm:trigger` `CustomEvent` from their slotted element whenever they want the AI flow to fire. This works the same way for any gesture — click, hover-intent, focus, long-press, `IntersectionObserver` visibility, keyboard shortcut, custom logic — there is no special-cased handling per gesture.

The standard click activation looks like this:

```js
html`
  <aiux-nacm
    .documentTableName=${'incident'}
    .wwnaComponentId=${'my-component-id'}
    .skillConfigSysId=${skillConfigSysId}
  >
    <a
      slot="trigger"
      href="#"
      class="link link-primary"
      @click=${e => {
        e.preventDefault();
        e.currentTarget.dispatchEvent(
          new CustomEvent('aiux-nacm:trigger', {bubbles: true, composed: true})
        );
      }}
    >
      Summarize
    </a>
  </aiux-nacm>
`;
```

Hover-to-open is the same pattern, just on a different gesture:

```js
html`
  <aiux-nacm
    .documentTableName=${'incident'}
    .wwnaComponentId=${'my-component-id'}
    .skillConfigSysId=${skillConfigSysId}
  >
    <span
      slot="trigger"
      tabindex="0"
      @mouseenter=${e => {
        e.currentTarget.dispatchEvent(
          new CustomEvent('aiux-nacm:trigger', {bubbles: true, composed: true})
        );
      }}
    >
      Ask Now Assist
    </span>
  </aiux-nacm>
`;
```

A small helper keeps consumer call sites readable:

```ts
const dispatchAiuxNacmTrigger = (e: Event): void => {
  e.currentTarget.dispatchEvent(
    new CustomEvent('aiux-nacm:trigger', {bubbles: true, composed: true})
  );
};
```

#### Detection — slot fill is the sole gate

The wrapper auto-detects slot fill via `slotchange` + `assignedElements({flatten: true})` on its `<slot name="trigger">`. The slot listener and initial slot-fill check run in `firstUpdated()`, so the slotted-trigger state is computed after the first render and then updates reactively. There is no opt-in attribute or property to "force" the slot path: the slot path renders when, and only when, an element is actually assigned. If nothing is slotted, the wrapper renders its built-in sparkle button.

```html
<!-- Slot path: a consumer element is projected, the wrapper swaps in -->
<aiux-nacm>
  <my-trigger slot="trigger"></my-trigger>
</aiux-nacm>

<!-- Sparkle path: nothing slotted, the built-in button renders -->
<aiux-nacm></aiux-nacm>
```

Only `'draggable'` and `'popover'` support the slot path — `'fixed'` keeps its built-in trigger, and `'inline'` has no trigger button at all (the open-prompt is its input surface).

Internally the wrapper tracks slot fill in a single `@state` field (`_isTriggerSlotFilled`) and uses it directly when deciding which trigger element to render. The controller computes its own DOM-level slot check inside `_maybeAutoTrigger()` so it can skip auto-trigger when a slot path is in use without sharing a flag with the host element.

#### Sparkle and slot converge on a single activation path

Internally, the wrapper routes both trigger surfaces through the same `_activate` decision tree and the same `_openPopover()` helper for the popover variant. The differences between sparkle and slot are _purely_ about which DOM element dispatches the event:

|                                      | Sparkle                                                                                                             | Slot                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Trigger element                      | Built-in `<button>` rendered by the wrapper                                                                         | Consumer's slotted element                                                        |
| How `_activate` is invoked           | `@click=${_activate}` on the sparkle button                                                                         | `@aiux-nacm:trigger=${_activate}` on the slot wrapper, dispatched by the consumer |
| Decision tree                        | Identical (multi-action → teleport; single preset → fire; default → fire; open prompt → no-op; else → bare trigger) | Identical                                                                         |
| Popover open (popover variant)       | Imperative — `togglePopover(true)` via `_openPopover()`                                                             | Imperative — same `_openPopover()`                                                |
| `<aiux-control-popover>` auto-toggle | Blocked via `stopImmediatePropagation` on the click event                                                           | Blocked via a click swallower on the wrapper `<span>`                             |

A previous design had the slot path layer extra coordination on top of `<aiux-control-popover>`'s built-in click-to-toggle listener (a queued microtask plus an open-state flag to defuse a race with the popover's asynchronous `toggle` event). That coordination is gone — `_openPopover()` is the single source of popover open for both surfaces, and `togglePopover(true)` is idempotent, so there's no race to defuse.

#### Multi-action UX

When the varset declares 2+ `preset_actions`, `aiux-nacm:trigger` opens the teleported preset-action picker (the same `DropdownTeleportController` the sparkle path uses, anchored to the slot wrapper). Picking an action fires it; for the popover variant the response popover then opens imperatively. With 1 action the event fires it immediately. With 0 actions the event falls through to the configured default preset (when one is set) or to a bare trigger.

#### State signaling

The slot wrapper sets `data-nacm-state` to `"idle" | "loading" | "success" | "failure"` reflecting the lifecycle, so consumer CSS can style the slotted element. Example:

```css
a[slot='trigger'][data-nacm-state='loading'] {
  opacity: 0.6;
}
```

The attribute lives on the consumer's light-DOM element via the slot wrapper, so the selector goes directly on your stylesheet — no piercing of the shadow DOM needed.

#### Programmatic activation

```ts
const nacm = document.querySelector('aiux-nacm-multi-skill-wrapper');
nacm?.trigger(); // no commandName: first preset if present; otherwise default trigger path
nacm?.trigger('summarize'); // matching preset fires; no match → falls back to first preset
```

With multiple preset actions, imperative `trigger()` fires the first preset by default. Pass `commandName` to choose a specific preset. The teleported picker cannot be opened from imperative code; dispatch `aiux-nacm:trigger` from the trigger surface for the UI picker path.

#### A11y contract

- The slotted element MUST be the focusable interactive node. Do not wrap it in another `<button>` or add `tabindex` / `role` to it from the consumer side beyond what the element already requires.
- Keyboard activation is the consumer's responsibility. For a `<button>`, the browser synthesizes a click on `Enter` / `Space` — bind the dispatch to `@click` and both keyboard and mouse activation work. For non-button focusable elements (e.g. `<a>`, `<span tabindex="0">`), add a `@keydown` handler that dispatches `aiux-nacm:trigger` on `Enter` / `Space`.
- The teleported picker (when ≥2 actions are configured) uses `role="menu"` / `role="menuitem"`; focus management for the menu items is handled by the dropdown controller.

#### Gating activation

Call `event.preventDefault()` on the `aiux-nacm:trigger` event from any listener that runs before it reaches the wrapper. The wrapper checks `defaultPrevented` first thing and bails if true. (`preventDefault` on the original click is consumer business — the wrapper sees only the custom event.)

#### Knobs that do NOT apply when a slotted trigger is in use

`hideButtonOnDialog`, `hidePrimaryIcon`, `autoTriggerDefaultAction`. These target the built-in sparkle button — the consumer's element is the trigger instead.

#### Events emitted (same as every other variant)

`aiux-nacm-menu-action-clicked`, `aiux-nacm-recommendation-dialog-closed`, `aiux-nacm-call-to-action-clicked`, `aiux-nacm-feedback-submitted`. Add listeners on `<aiux-nacm>`.

#### Migration from the legacy `'anchor'` variant

The `'anchor'` variant has been removed. The slotted-trigger option lives independently of the response-surface variant now, and the consumer dispatches `aiux-nacm:trigger` from their own listener instead of relying on the wrapper's old click delegation:

| Before                                                           | After                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `variant: 'anchor'`                                              | `variant: 'popover'` (consumer keeps slotting `<… slot="trigger">`)                                                  |
| `<a slot="trigger" href="#">Ask AI</a>` (wrapper auto-listened)  | `<a slot="trigger" href="#" @click=${dispatchAiuxNacmTrigger}>Ask AI</a>` (consumer dispatches the event explicitly) |
| `custom-anchor-trigger` attribute + dispatch `aiux-nacm:trigger` | Dispatch `aiux-nacm:trigger` (same event — the opt-in attribute is gone; the dispatch IS the activation path)        |

### Props Merge Order

- **Button props**: `getTriggerDefaultProps()` → config (from `button_props` JSON) → runtime `buttonProps` prop
- **Dialog props**: `getRecommendationDialogDefaultProps()` → config (from `recommendation_dialog_props` JSON) → runtime `recommendationDialogProps` prop
- **enableAIGradient**: from merged button props, defaults to `true` when absent

### AMB Channel Name Construction

When `ambChannelName` is not explicitly provided:

```
{documentTableName}-{documentSysId}-{wwnaComponentId}-{user_sys_id}-{caller}
```

Per-section AMB channels: `{wrapperAmbChannel}-{section.props.sys_id}`

### Record Watcher Channel

```
/rw/default/{documentTableName}/{base64('sys_id=' + documentSysId)}
```

(with `=` replaced by `-`)

## File Structure

Each component is split into `index.ts` (the element + reactive properties), `controller.ts` (a `ReactiveController` holding logic/state), `view.ts` (pure render functions), and `types.ts`.

```
nacm/
├── src/
│   ├── index.ts                                    # Package entry point (re-exports)
│   └── components/
│       ├── constants.ts                            # NACM_EVENT, config IDs, defaults, messages
│       ├── aiux-nacm/                              # <aiux-nacm> orchestrator (index/controller/view/types)
│       ├── aiux-nacm-multi-skill-wrapper/         # <aiux-nacm-multi-skill-wrapper> (+ floating-body.ts)
│       ├── aiux-nacm-multi-skill-content-container/# <aiux-nacm-multi-skill-content-container>
│       ├── aiux-nacm-open-prompt/                  # <aiux-nacm-open-prompt> (+ speech-recognition/)
│       ├── shared/
│       │   ├── index.ts                            # Re-exports + render helpers
│       │   ├── citations.ts                        # Citation render helpers
│       │   ├── styles/shared.ts                    # Shared CSS (gradients, animations)
│       │   └── utils/                              # Pure utils (actions, payload, word-count, citations, autogrow, skill-config-mapper)
│       └── storybook/                              # Stories + mocks
├── test/                                           # Unit tests
├── package.json
└── README.md
```

## Dependencies

| Package                               | Purpose                                                | Kind            |
| ------------------------------------- | ------------------------------------------------------ | --------------- |
| `@servicenow/aiux-components-core`    | `AIUXElement` base class, `AMBController`, `aiuxFetch` | dependency      |
| `@servicenow/aiux-directive-icon`     | `icon()` Lit directive for inline SVG sprite icons     | dependency      |
| `@servicenow/aiux-components-control` | `<aiux-control-popover>`, `DropdownTeleportController` | peer dependency |
| `@servicenow/aiux-sn-feedback`        | `<aiux-sn-feedback>` thumbs up/down                    | peer dependency |
| `lit`                                 | Lit web component framework                            | peer dependency |

## Testing

```bash
cd components/nacm && pnpm test
```
