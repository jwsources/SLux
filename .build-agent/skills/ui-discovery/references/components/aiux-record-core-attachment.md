# @servicenow/aiux-components-attachment

## Import

```js
import '@servicenow/aiux-components-attachment';
```


Attachment management panel that lists, uploads, previews, and edits file attachments on a ServiceNow record, with a full and compact display mode.

## Installation

```js
import '@servicenow/aiux-components-attachment';
```

## Usage

```html
<aiux-record-core-attachment
  table="incident"
  sysId="a1b2c3d4"
  mode="full"
></aiux-record-core-attachment>
```

## Properties

| Property (attribute if different)    | Type                     | Default                | Description                                                                                                                                                                                 |
| ------------------------------------ | ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table`                              | String                   | `undefined`            | Table name of the record whose attachments are shown                                                                                                                                        |
| `sysId`                              | String                   | `undefined`            | sys_id of the record whose attachments are shown                                                                                                                                            |
| `mode`                               | String                   | `'full'`               | Display mode: `'full'`, `'compact'`, or `'custom'`                                                                                                                                          |
| `fileManagementHeader`               | String                   | `''`                   | Header text shown above the attachment list                                                                                                                                                 |
| `classicForm`                        | Boolean                  | `false`                | Render in classic-form-compatible layout                                                                                                                                                    |
| `isReadOnly`                         | Boolean                  | `false`                | Disables upload/edit/delete actions                                                                                                                                                         |
| `isFileUploadDisabled`               | Boolean                  | `false`                | Hides the upload control only                                                                                                                                                               |
| `isFileEditDisabled`                 | Boolean                  | `false`                | Hides edit/rename controls only                                                                                                                                                             |
| `showSkeletonLoader`                 | Boolean                  | `true`                 | Declared but currently not read anywhere in the render/load path — has no observable effect (as of current source). The loading state always renders the skeleton regardless of this value. |
| `loadDocViewerIfNecessary`           | Boolean                  | `false`                | Declared but currently not read anywhere in the render/load path — has no observable effect (as of current source). Preview always loads the document viewer regardless of this value.      |
| `primaryUpfrontAction`               | String                   | `'none'`               | Primary call-to-action shown when the list is empty                                                                                                                                         |
| `showUploadInstruction`              | String                   | `'autoGenerate'`       | Upload instruction mode: `'autoGenerate'` (build text from allowed types + max size), `'custom'` (use `customUploadInstruction`), or `'none'`                                               |
| `customUploadInstruction`            | String                   | `''`                   | Overrides the default upload instruction text                                                                                                                                               |
| `showCompactModeDropZone`            | Boolean                  | `false`                | Shows a drop zone even in compact mode                                                                                                                                                      |
| `size`                               | Number                   | `DEFAULT_LIST_SIZE`    | Constrains the panel's rendered size                                                                                                                                                        |
| `showMore`                           | Boolean                  | `true`                 | Shows a "show more" control when the list overflows                                                                                                                                         |
| `thumbnailSize`                      | String                   | `THUMBNAIL_SIZES.MD`   | Thumbnail size for image/file previews                                                                                                                                                      |
| `emptyPanelSize`                     | String                   | `EMPTY_PANEL_SIZES.LG` | Size of the empty-state panel when there are no attachments                                                                                                                                 |
| `showMetadata`                       | Boolean                  | `true`                 | Shows file metadata (size, uploaded by, date)                                                                                                                                               |
| `showThumbnails`                     | Boolean                  | `undefined`            | Whether to render thumbnails for supported file types                                                                                                                                       |
| `showSearch`                         | Boolean                  | `false`                | Shows a search box above the attachment list                                                                                                                                                |
| `hideFooter` (attr: `hide-footer`)   | Boolean                  | `false`                | Suppresses the in-card Delete/Download-all action row; use when a parent renders its own footer and calls `bulkDelete()`/`downloadAll()` directly                                           |
| `isMultiFileUpload`                  | Boolean                  | `true`                 | Allows selecting/uploading multiple files at once                                                                                                                                           |
| `previewModalOnUpload`               | Boolean                  | `true`                 | Opens the preview modal immediately after upload                                                                                                                                            |
| `disableUploadModal`                 | Boolean                  | `false`                | Disables the upload modal entirely                                                                                                                                                          |
| `allowedFileTypes`                   | String                   | `''`                   | Comma-separated list of accepted file extensions/MIME types                                                                                                                                 |
| `maxFileSizeAllowed`                 | String                   | `''`                   | Maximum allowed file size                                                                                                                                                                   |
| `skipPreviewForUnsupportedFileTypes` | Boolean                  | `false`                | Skips generating a preview for file types the viewer doesn't support                                                                                                                        |
| `overlayContainer`                   | String                   | `''`                   | Selector/id of the container to render overlays (modals/drop zones) into                                                                                                                    |
| `enableDocumentManagement`           | Boolean                  | `false`                | Enables document-management-specific behavior                                                                                                                                               |
| `view`                               | String                   | `''`                   | View name used when fetching attachment metadata                                                                                                                                            |
| `actionConfigId`                     | String                   | `''`                   | ID of the action configuration record to apply                                                                                                                                              |
| `recordDisplayValue`                 | String                   | `''`                   | Display value of the parent record, used in UI text                                                                                                                                         |
| `nowDsDomainId`                      | String                   | `''`                   | Now Data Store domain ID (Now Design Studio integration)                                                                                                                                    |
| `nowDsDomainScope`                   | String                   | `''`                   | Now Data Store domain scope                                                                                                                                                                 |
| `nowDsRecordId`                      | String                   | `''`                   | Now Data Store record ID                                                                                                                                                                    |
| `nowDsRecordTable`                   | String                   | `''`                   | Now Data Store record table                                                                                                                                                                 |
| `selectedFiles`                      | `Set<string>`            | `new Set()`            | Currently selected file IDs                                                                                                                                                                 |
| `filePreviewItem`                    | `AttachmentItem \| null` | `null`                 | The attachment currently open in preview                                                                                                                                                    |
| `showFilePreview`                    | Boolean                  | `false`                | Whether the preview modal is open                                                                                                                                                           |
| `refreshRequested`                   | Number                   | `0`                    | Increment to force a re-fetch of the attachment list                                                                                                                                        |

## Events

All events bubble and are `composed: true` (cross Shadow DOM boundaries). Event names are namespace-scoped with the `aiux-record-core-attachment:` prefix.

| Event                                              | `detail` shape                                              | Fired when                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `aiux-record-core-attachment:upload-succeeded`     | ⚠️ two shapes — see note below                              | An upload completes                                             |
| `aiux-record-core-attachment:delete-succeeded`     | ⚠️ two shapes — see note below                              | A single or bulk delete is confirmed                            |
| `aiux-record-core-attachment:rename-succeeded`     | ⚠️ two shapes — see note below                              | A rename is submitted                                           |
| `aiux-record-core-attachment:sort-changed`         | `{ direction: 'ascending' \| 'descending' }`                | The attachment sort direction changes                           |
| `aiux-record-core-attachment:previewed`            | `{ file: AttachmentItem }`                                  | An attachment preview is opened                                 |
| `aiux-record-core-attachment:downloaded`           | `{ file: AttachmentItem }`                                  | A single attachment is downloaded                               |
| `aiux-record-core-attachment:downloaded-all`       | `{ recordSysId: string }`                                   | The download-all action runs                                    |
| `aiux-record-core-attachment:downloaded-selective` | `{ files: string[] }` (selected file IDs)                   | The download-selected action runs                               |
| `aiux-record-core-attachment:state-change`         | `{ selectedCount, isUploading, hasAttachments, canCreate }` | Footer-relevant state changes; consume when using `hide-footer` |

> ⚠️ **`upload-succeeded`, `delete-succeeded`, and `rename-succeeded` have different `detail` shapes depending on which code path dispatches them.** The host component (`attachment.ts`) and the internal controller (`attachment-controller.ts`) both dispatch the same event name with different payloads. Which one you receive depends on where you attach your listener and which flow ran. **Consumers must defensively handle both shapes.**
>
> **`upload-succeeded`:**
>
> - Host wrapper: `{ files: string[] }` — an array of plain file-name strings.
> - Controller: `{ files: FileEntry[] }` — an array of file-entry objects.
>
> So `e.detail.files` may be an array of **strings** _or_ an array of **objects**. Guard with e.g. `typeof e.detail.files[0] === 'string'` before use.
>
> **`delete-succeeded`:**
>
> - Host wrapper: `{ isMulti: boolean, files: AttachmentItem[] }`.
> - Controller: `{ item: AttachmentItem }` (single delete) _or_ `{ items: AttachmentItem[] }` (bulk delete).
>
> So `e.detail` may have `{ isMulti, files }`, `{ item }`, or `{ items }`. Check for each field (`e.detail.files ?? e.detail.items ?? [e.detail.item]`) rather than assuming one shape.
>
> **`rename-succeeded`:**
>
> - Host wrapper: `{ file: AttachmentItem, newName: string }`.
> - Controller: `{ item: AttachmentItem }` where `item.name` has already been updated.
>
> So `e.detail` may have `{ file, newName }` or `{ item }`. Use `e.detail.file ?? e.detail.item` before reading the renamed attachment.
>
> **Note for maintainers:** this dual-shape inconsistency should ideally be fixed at the source level — both dispatch sites should emit a single canonical `detail` shape — rather than being documented around here.

## Slots

| Slot      | Available in    | Description                                                                                                                                                               |
| --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (default) | `mode="custom"` | Consumer-supplied content rendered in place of the built-in list UI. In `custom` mode only the file input, upload modal, and notifications are rendered by the component. |

## Methods

Public methods for external control (e.g. a wrapping modal that renders its own footer with `hide-footer` set):

| Method               | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `bulkDelete()`       | Trigger bulk-delete confirmation on the current selection |
| `downloadAll()`      | Download all attachments                                  |
| `downloadSelected()` | Download only the currently selected attachments          |
| `triggerUpload()`    | Programmatically open the native file picker              |

## SSR compatibility

Extends `AIUXElement`; all reactive properties above are safe to set before first render (SSR and CSR).
