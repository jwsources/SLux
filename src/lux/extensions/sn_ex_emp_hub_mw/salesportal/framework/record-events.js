import {isServer} from 'lit';

// THE RECORD-CHANGE BUS -- one mechanism, every page, no per-page wiring.
//
// WHY A DOCUMENT EVENT, and not a module singleton or application.js.
//
// application.js is the wrong home: its own documentation states setup() runs
// "once per SSR request before loaders run, and again on the client only as a
// CSR fallback (when the page was not server-rendered)". So on a normally
// server-rendered page setup() executes on the SERVER and the browser never
// runs it -- a client-side service installed there would not exist. navigate()
// is client-only but does not run on first load.
//
// A module-level subscriber Set would work in the browser but is shared across
// SSR requests in the same isolate, so server-side subscriptions could leak
// between users' renders.
//
// A DOCUMENT EVENT has neither problem, and it is the platform's own
// convention. From components/record/src/components/attachments/attachment-bar.ts:
//
//     document.addEventListener(
//       ATTACHMENT_EVENTS.UPLOAD_SUCCEEDED,
//       this._refreshAttachments
//     );
//
// with cross-record filtering in _eventMatchesContext: a detail carrying a
// table or sysId that does not match the listener's own record is ignored, and
// a detail without them matches everything. matchesRecord below mirrors that
// semantics deliberately, so our events behave like the platform's.
//
// Document events also cross shadow boundaries, which a Lit event from a page
// does not: the record pages mount their content inside the shell's shadow
// root, so a bubbling composed event from a component is reachable but a
// sibling page-level listener is not.

export const RECORD_EVENTS = {
  // A record was written: a UI action submitted, or the platform reported a
  // live update from elsewhere.
  CHANGED: 'rv-record:changed',
  // A refresh finished. Published by whoever DID the work, so a refresh
  // control can stop indicating on real completion rather than on a timer --
  // a timer would clear the spinner while the read was still in flight and
  // report success it had not observed.
  REFRESHED: 'rv-record:refreshed'
};

/**
 * Announce that a record changed. Anything interested re-reads.
 *
 * detail is {table, sysId, reason} -- table and sysId so a listener for a
 * different record can ignore it, reason for logging and for a listener that
 * wants to treat a local write differently from an external one.
 */
export function publishRecordChange(detail) {
  if (isServer || typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent(RECORD_EVENTS.CHANGED, {detail: detail || {}})
  );
}

/**
 * True when an event concerns the given record.
 *
 * Mirrors the platform's _eventMatchesContext: a detail with no table and no
 * sysId matches EVERYTHING, which is what lets a broad refresh signal reach
 * every listener without each publisher having to know who is listening.
 */
export function matchesRecord(event, table, sysId) {
  const detail = event?.detail;
  if (!detail || typeof detail !== 'object') return true;
  if (detail.table && table && detail.table !== table) return false;
  if (detail.sysId && sysId && detail.sysId !== sysId) return false;
  return true;
}

/**
 * True when an event concerns the given SCOPE -- one named slice of a page.
 *
 * A scope is how a PARTIAL refresh stays partial. A detail with no scope is a
 * whole-record change and matches every slice; a detail naming a scope matches
 * only that one. So one event type serves both the full refresh after a write
 * and a single applet re-reading itself, and a subscriber opts in by asking.
 *
 * Deliberately the same permissive shape as matchesRecord: absent means all,
 * which is what lets an existing subscriber keep working unchanged when a new
 * scope is introduced.
 */
export function scopeMatches(event, scope) {
  const eventScope = event?.detail?.scope;
  if (!eventScope) return true;
  return eventScope === scope;
}

/**
 * Announce that a refresh FINISHED, so a control can stop indicating.
 *
 * Published by whoever performed the read, never by the control that asked --
 * a control cannot know when work it delegated has completed, and guessing
 * with a timer reports success that was never observed.
 */
export function publishRefreshDone(detail) {
  if (isServer || typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent(RECORD_EVENTS.REFRESHED, {detail: detail || {}})
  );
}

/** Subscribe for refresh completion. SSR-safe, returns the unsubscribe. */
export function subscribeRefreshDone(handler) {
  if (isServer || typeof document === 'undefined') return () => {};
  document.addEventListener(RECORD_EVENTS.REFRESHED, handler);
  return () => document.removeEventListener(RECORD_EVENTS.REFRESHED, handler);
}

/**
 * Subscribe a host element for its connected lifetime. Returns the
 * unsubscribe, so a caller that wants to stop earlier can.
 *
 * SSR-SAFE: a no-op on the server, returning a no-op unsubscribe, so a caller
 * needs no isServer guard of its own.
 */
export function subscribeRecordChanges(handler) {
  if (isServer || typeof document === 'undefined') return () => {};
  document.addEventListener(RECORD_EVENTS.CHANGED, handler);
  return () => document.removeEventListener(RECORD_EVENTS.CHANGED, handler);
}

/**
 * The provider's formHandlers, ready to bind. ONE expression per page.
 *
 * Names and signatures read from RecordHandlers in
 * libraries/client-scripting/src/form.ts:
 *   onSubmitSucceeded?: (success: boolean, response) => void
 *   onLiveUpdated?:     (updatedFields: string[]) => void
 *
 * onSubmitSucceeded is the UI-action signal: ActionsAPI runs a server-side
 * action through g_form.submit() and the form environment reports the result
 * here. onLiveUpdated maps to EVENT_LIVE_UPDATED, the platform's own
 * live-update event, so a write from another session or a background job
 * reaches the page without polling.
 *
 * Both publish rather than refreshing anything themselves, which is what makes
 * one page's write visible to every surface watching that record -- Details,
 * the action bar, an attachment panel, the graph.
 */
export function recordFormHandlers({table, sysId} = {}) {
  return {
    onSubmitSucceeded: success => {
      if (!success) return;
      publishRecordChange({table, sysId, reason: 'ui-action'});
    },
    onLiveUpdated: fields => {
      publishRecordChange({
        table,
        sysId,
        reason: 'live-update',
        fields: fields || []
      });
    }
  };
}

/**
 * Reload the provider inside a shadow root.
 *
 * The provider owns the form payload AND the UI action set, and a page's own
 * Table API reads cannot refresh either -- so a page that re-reads its data
 * still shows a stale action bar unless it also calls this. That split is why
 * an agent proposing a major case updated the fields and left the buttons
 * alone.
 */
export function reloadProviderIn(root) {
  if (isServer) return;
  const provider = root?.querySelector('aiux-record-provider');
  if (provider && typeof provider.reload === 'function') provider.reload();
}
