# Brief — screenshot to spec (`build_agent_core#sub_implementation`)

For when the input is an **image** — a screenshot or a mockup — and the output is
a component spec.

🔑 **This is not `figma-to-widget`.** That skill triggers on a Figma **URL** and
extracts structured blocks from the Figma API. Here there is no structure to
extract: a PNG has pixels, so every claim has to be read off the image and then
grounded in a documented component. Different input, different method.

Run this as **spec-only first**. The spec is the artifact the parent reviews; code
generation is a separate delegation once the spec is agreed.

---

## Assemble the payload

1. The **environment preamble** from `SKILL.md` §2, verbatim.
2. The image.
3. The brief below.
4. Where the component will live, and which existing page or component it must
   sit beside — so its styling and primitives match the app it is joining.

```
YOU ARE WRITING A SPEC FROM AN IMAGE. You do NOT write component code in this
pass.

LOAD, IN THIS ORDER:
  1. activate_skill aiux-tailwind-vision-spec — the deterministic visual-to-class
     mapping, and your FIRST authority for every region.
  2. activate_skill ui-discovery — to check whether an existing component or
     widget already renders this region, before specifying a new one.
  3. activate_skill components and patterns — for primitive selection and for
     cross-cutting behaviour (status colour, truncation, loading and empty
     states) the image cannot show you.

PHASE 1 — DECOMPOSE BLIND. Before naming a single component, describe only what
is literally in the image: the containment tree outer to inner, box model,
fills, borders and radii, typography per text run, icons, and any visible state.
Naming a component early anchors everything that follows onto a guess.

PHASE 2 — MAP. For each region from Phase 1, in order:
  a. Look up its visual signature in aiux-tailwind-vision-spec and record the
     component, variant and classes it gives you.
  b. Check ui-discovery for an existing component that already covers it.
  c. Map every observed token onto the documented tokens. A token with no home
     goes under `overrides` as literal CSS — never silently dropped.
  d. Assign a confidence: high / medium / low.

PHASE 3 — EMIT THE SPEC in the format below.

HARD RULES:
  - NEVER invent a tag, prop, slot, class, variant or allowed value. Everything
    traces to a skill or to a line you read in the installed source.
  - EVERY measurement comes from the image. Mark estimates ~approx. Never omit
    a value silently.
  - A GAP IS A CONFIRMED ABSENCE, NOT AN UNSEARCHED ONE. Before declaring one,
    show that aiux-tailwind-vision-spec does not cover the region AND that
    ui-discovery returned nothing at medium confidence or better.
  - An image cannot show interaction, focus order, keyboard behaviour, empty or
    error states, or how text behaves at 320px. State those as REQUIREMENTS for
    the implementer rather than inventing them, and flag any text that would
    overflow.
  - ICONS ARE CONTESTED — VERIFY BEFORE SPECIFYING ONE. aiux-tailwind-vision-spec
    specifies an `sn-aix-icon` ELEMENT with outline-only variants; aiux-build
    documents an `icon()` DIRECTIVE from `@servicenow/aiux-directive-icon`.
    Those are different mechanisms and both cannot be right. Read the installed
    source before you name either, and state which one you confirmed and where.
    Styles and icon assets live under
    `node_modules/@servicenow/aiux/components/` — readable with fs_read_file,
    invisible to fs_grep.
```

---

## Spec format

Field names are the contract the implementation pass reads. Keep them stable.

```markdown
# UI Spec: <name>

## Meta
- Source: image
- Grounded in: aiux-tailwind-vision-spec, ui-discovery
- Target location: <path where this will live>
- Overall confidence: <high|medium|low>

## Layout tree
<indented hierarchy of region ids>

## Regions

### R1 — <label>
- Component: <tag or class>   (confidence: <high|medium|low>)
- Grounded by: <skill section, or ui-discovery row, or source file and line>
- Reuse: <existing component that covers this, or "none — new">
- Variant / props: { ... }
- Slots: { slotName: [child region ids] }
- Tokens: <every observed token: background, radius, padding, type, ...>
- Overrides: <tokens with no documented home — literal CSS>
- Notes: <ambiguities, ~approx values>

### GAP-1 — <label>
- Checked: aiux-tailwind-vision-spec (not covered) + ui-discovery ("<query>") — no match
- Needs: <the missing capability>
- Closest: <nearest component, and exactly what it cannot reproduce>

## Requirements the image cannot show
- Keyboard: <what must be reachable, and in what order>
- States: <loading, empty, error>
- Reflow: <what happens at 320px; which text will overflow>
- Motion: <only if the image implies a transition>

## Assembly
<order and nesting for the implementer>
```

---

## Before emitting — self-check

- Does every component, prop and class trace to a skill or a quoted source line?
- Is every GAP backed by **both** lookups actually having been run?
- Did every Phase 1 token reach either `Tokens` or `Overrides`?
- Is the spec free of framework code? Composition belongs to the implementer.
