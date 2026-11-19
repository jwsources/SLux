import {css} from 'lit';

// THE ONE DECLARATION SITE FOR THE FRAMEWORK'S TABLE LOOK.
//
// Two components render a record table -- the Remediation card in the
// Intelligence view and every applet in the Related records view. The rules
// are declared here once and imported by both, rather than copied: a copy in
// each file is two declarations that drift, and a comment asking the next
// person to keep them in sync is not a mechanism.
//
// Every value reads a --rv-* custom property with a fallback, so a table
// inherits the host theme exactly as the cards do.
//
// SPEC section 6: "tables scroll inside their cards". The wrapper owns the
// horizontal scroll so the page never scrolls sideways, and it is focusable so
// a keyboard user can reach a scroll region that has no other focusable
// content. role=group plus an aria-label is what makes that tab stop
// announce what it is instead of being a silent landing point.

export const rvTable = css`
  .rv-table-wrap {
    overflow-x: auto;
    border-radius: var(--rv-radius-tile, 8px);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--rv-size-body, 14px);
  }

  th,
  td {
    text-align: start;
    padding: 8px 10px;
    border-block-end: 1px solid var(--rv-surface-hairline, #e5e3dd);
    white-space: nowrap;
  }

  th {
    font-size: var(--rv-size-label, 12px);
    font-weight: var(--rv-weight-semibold, 600);
    color: var(--rv-ink-muted, #5b5a55);
  }

  /* Opt-in wrapping for a prose column -- a title or description must not
     force the whole table into a horizontal scroll. */
  td.rv-wrap {
    white-space: normal;
    min-width: 12rem;
  }

  /* The last row carries no rule, so the table does not look truncated. */
  tbody tr:last-child td {
    border-block-end: 0;
  }
`;
