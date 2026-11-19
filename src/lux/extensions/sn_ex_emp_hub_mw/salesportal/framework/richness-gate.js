import {i18n} from '@servicenow/aiux/aiux-services/src/i18n.js';

import {
  ALL_VIEWS,
  VIEW_ACTIVITY,
  VIEW_DETAILS,
  VIEW_INTELLIGENT,
  VIEW_RELATED
} from './views.js';

// THE RICHNESS GATE -- SPEC section 4.
//
// The Intelligent view is offered only when BOTH halves hold:
//   1. a layout config matched the record's table and condition, AND
//   2. the Otto payload yields a brief AND at least one real finding.
// Otherwise the option is hidden and the page defaults to Details. An empty
// Intelligent view is never rendered -- that is the whole purpose of this
// module, and it is why the check is on CONTENT rather than on the mere
// presence of a payload object.
//
// Pure functions, no DOM, no component imports. Everything here can be
// exercised by calling it.

export const PAYLOAD_LOADING = 'loading';
export const PAYLOAD_READY = 'ready';
export const PAYLOAD_ERROR = 'error';
export const PAYLOAD_ABSENT = 'absent';

// A brief counts only if it actually says something. DATA_CONTRACT section 3:
// brief is {summary, alerts[], stats[]}. A brief object whose summary is blank
// renders as an empty card, so it does not count as a brief.
export function hasBrief(payload) {
  const summary = payload?.brief?.summary;
  return typeof summary === 'string' && summary.trim() !== '';
}

// DATA_CONTRACT section 3, verbatim: findings are
// {id, title, detail, sources[], target, severity} and "no source or target
// means no finding".
//
// So a finding needs BOTH at least one source AND a target. This is the rule
// that stops a narrative-derived assertion with nothing behind it from
// counting as evidence -- which is also ACCEPTANCE's position: facts and
// states come from records, never from prose.
export function isRealFinding(finding) {
  if (!finding) return false;
  const hasSource =
    Array.isArray(finding.sources) &&
    finding.sources.some(
      source => source !== undefined && source !== null && String(source).trim() !== ''
    );
  const hasTarget =
    finding.target !== undefined &&
    finding.target !== null &&
    String(finding.target).trim() !== '';
  return hasSource && hasTarget;
}

export function countRealFindings(payload) {
  const findings = payload?.findings;
  if (!Array.isArray(findings)) return 0;
  return findings.filter(isRealFinding).length;
}

// Does the payload carry enough to render a non-empty Intelligent view?
export function payloadIsRich(payload) {
  return hasBrief(payload) && countRealFindings(payload) > 0;
}

// ---------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------
// Returns:
//   intelligentAvailable  the option may be selected
//   intelligentPending    the option renders disabled with a skeleton
//   findingCount          how many findings survived the source+target test
//   reason                why, for diagnosis
//
// pending and available are mutually exclusive, and when neither is true the
// ViewSwitch omits the option from the DOM entirely.

export function evaluateRichness({
  configMatched = false,
  payload = null,
  payloadState = PAYLOAD_ABSENT
} = {}) {
  // THE CONFIG HALF IS A GRID CHECK, NOT A CONTENT CHECK.
  //
  // It exists because the Intelligence view needs a grid to lay its cards out
  // in, and a grid comes from a config. With no config there is nothing to
  // render into, so the option is hidden rather than pending -- there is
  // nothing to wait for either.
  //
  // WHAT THIS MUST NOT BECOME: a content gate. This half used to be satisfied
  // only by a config whose CONDITION matched, and the condition was an encoded
  // query on a single demo field. That made one field decide whether the tab
  // existed, so Intelligence appeared on 1 record out of 1411 -- and a major
  // case with real business impact, a probable cause, a child case, an SLA, a
  // work order and a change showed no tab at all because that unrelated flag
  // happened to be empty.
  //
  // Configs are now unconditional per table, so this reduces to "does this
  // table have a layout" -- a structural question. Whether there is anything
  // worth SAYING is decided below, from the payload, which is the only thing
  // that should decide it.
  if (!configMatched) {
    return {
      intelligentAvailable: false,
      intelligentPending: false,
      findingCount: 0,
      reason: 'no-config-match'
    };
  }

  if (payloadState === PAYLOAD_LOADING) {
    // SPEC section 4: show Details with a skeleton on the Intelligent option.
    // The option is pending, not available, and resolveActiveView below will
    // not select it.
    return {
      intelligentAvailable: false,
      intelligentPending: true,
      findingCount: 0,
      reason: 'payload-loading'
    };
  }

  if (payloadState === PAYLOAD_ERROR) {
    return {
      intelligentAvailable: false,
      intelligentPending: false,
      findingCount: 0,
      reason: 'payload-error'
    };
  }

  const findingCount = countRealFindings(payload);
  const brief = hasBrief(payload);

  if (!brief || findingCount === 0) {
    return {
      intelligentAvailable: false,
      intelligentPending: false,
      findingCount,
      reason: !brief ? 'no-brief' : 'no-findings'
    };
  }

  return {
    intelligentAvailable: true,
    intelligentPending: false,
    findingCount,
    reason: 'rich'
  };
}

// ---------------------------------------------------------------------------
// VIEW OPTIONS FOR THE SWITCH
// ---------------------------------------------------------------------------
// Details is unconditionally available: it is the floor the page falls back
// to, so it can never be gated. Activity and Related are available whenever
// the config lists them.
//
// Labels are localised here, with literal keys, because this is the single
// place the four views are named and the build's message extraction needs
// literals at the call site.

function labelFor(viewId) {
  switch (viewId) {
    case VIEW_INTELLIGENT:
      return i18n.getMessage('Intelligence');
    case VIEW_DETAILS:
      return i18n.getMessage('Details');
    case VIEW_ACTIVITY:
      return i18n.getMessage('Activity');
    case VIEW_RELATED:
      return i18n.getMessage('Related lists');
    default:
      return viewId;
  }
}

export function buildViewOptions({config = null, gate = null} = {}) {
  // A config may restrict which views exist at all. When it does not, all four
  // are candidates.
  const allowed =
    Array.isArray(config?.views) && config.views.length
      ? config.views
      : ALL_VIEWS;

  // Preserve the canonical order rather than the config's, so the switch does
  // not reorder itself between records.
  return ALL_VIEWS.filter(viewId => allowed.includes(viewId)).map(viewId => {
    if (viewId === VIEW_INTELLIGENT) {
      return {
        id: viewId,
        label: labelFor(viewId),
        available: gate?.intelligentAvailable === true,
        pending: gate?.intelligentPending === true
      };
    }
    return {
      id: viewId,
      label: labelFor(viewId),
      available: true,
      pending: false
    };
  });
}

// ---------------------------------------------------------------------------
// WHICH VIEW IS ACTIVE
// ---------------------------------------------------------------------------
// This is the function that implements "enable it when the payload lands
// WITHOUT moving the user off their current view".
//
// The caller passes the view currently on screen. Once that is a real value,
// this function only ever changes it if it has become unavailable. It does NOT
// recompute a preferred default on every call -- which is exactly how an
// auto-switch bug would appear: the payload lands, the gate flips to
// available, a recomputed default returns Intelligent, and the user is yanked
// off the Details page they were reading.
//
// current === '' (or absent) means "nothing on screen yet, choose the default".

export function resolveActiveView({current = '', options = []} = {}) {
  const selectable = options.filter(option => option.available === true);
  if (!selectable.length) return VIEW_DETAILS;

  const isSelectable = id => selectable.some(option => option.id === id);

  // First render: prefer Intelligent when it is already available, otherwise
  // Details. SPEC section 4: otherwise default to Details.
  if (!current) {
    return isSelectable(VIEW_INTELLIGENT) ? VIEW_INTELLIGENT : VIEW_DETAILS;
  }

  // Steady state: keep the user where they are while it remains valid.
  if (isSelectable(current)) return current;

  // The current view disappeared -- a payload error after the user had opened
  // the Intelligent view, for instance. Fall to Details, which is always
  // available.
  return isSelectable(VIEW_DETAILS) ? VIEW_DETAILS : selectable[0].id;
}
