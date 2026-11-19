// The four view ids -- SPEC section 1 and 3.
//
// In their own module with no imports and no side effects, so the richness
// gate and the config loader can share them without importing view-switch.js,
// which registers a custom element as a side effect of being imported. A pure
// module that pulls in an element definition is not pure, and in an SSR
// isolate it is also needless work.
//
// VIEW_RELATED is "related_lists", matching the id the shipped config uses in
// its views list (ui_design/samples/config.cs0001623.json). The config
// artefact wins: a mismatch here would make the Related option silently
// absent from any config that lists it.

export const VIEW_INTELLIGENT = 'intelligent';
export const VIEW_DETAILS = 'details';
export const VIEW_ACTIVITY = 'activity';
export const VIEW_RELATED = 'related_lists';

// Canonical display order. The switch renders in this order regardless of the
// order a config lists its views, so the control does not rearrange itself
// between records.
export const ALL_VIEWS = [
  VIEW_INTELLIGENT,
  VIEW_DETAILS,
  VIEW_ACTIVITY,
  VIEW_RELATED
];
