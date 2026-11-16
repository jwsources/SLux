# ServiceNow voice and visual standards

## 5. Embedded ServiceNow voice and terminology

### Brand foundations

- Positioning: the AI control tower for business reinvention.
- Purpose: make the world work better for everyone.
- Outcome: turn friction into flow across the enterprise.
- Philosophy: put AI to work for people.

These principles guide relevance and tone; they are not mandatory slogans to insert into every report.

### Personality and voice

Be founded on empathy, fueled by tech optimism, ambitious, and grounded in plain language. Every report should express at least one of these traits:

- Positively curious: explore possibilities and simplify complexity.
- People obsessed: connect technology to the work and needs of people.
- Refreshingly direct: say what matters without corporate fog or “AI bingo.”

For analytical reports, the natural tone is serious enough for decisions, human rather than impersonal, and confident only to the degree supported by evidence. Be clear and useful, not promotional.

### Writing rules

- Put people and outcomes first. Technology is the enabler, not the hero.
- Lead with proof before claims.
- Use active voice, specific examples, short paragraphs, and varied sentence lengths.
- Prefer familiar words. Explain acronyms at first use; avoid unnecessary jargon in external-facing content.
- Write “people,” not “humans.”
- Use sentence case for headings and labels. Preserve official product names and exact source titles.
- Title case is reserved for published-material titles where appropriate.
- ALL CAPS is limited to short Mono-styled eyebrows or category labels.
- Spell out “and” in prose and headlines; reserve ampersands for compact UI labels where necessary.
- Set em dashes tight—without surrounding spaces.
- Use bold, not colored words, for emphasis inside body paragraphs.
- Be specific about the actual work rather than saying “improve efficiency” without explanation.
- Cut words that add no meaning. Avoid generic introductions, repeated conclusions, forced jokes, exclamation points, and hype.
- Do not overpromise or make unsupported superiority claims.
- Do not introduce competitor names into branded promotional narrative. If a requested named comparison conflicts with governing brand restrictions, surface the conflict rather than silently rewriting the assignment.
- Use “we” or “us” only when actually speaking for ServiceNow; do not impersonate corporate authority in an independent research summary.
- Avoid “digital workers” and “digital workforce.”
- Use approved signature language only when it naturally helps the message, not as repetitive decoration.

### Confidence without distortion

State established findings directly. Retain meaningful qualifiers for forecasts, incomplete evidence, scenarios, and contested findings. “Could,” “may,” and similar terms are appropriate when the evidence genuinely requires uncertainty. A research report must never sacrifice accuracy for declarative marketing style.

## 6. Embedded visual brand rules

### Palette

| Name | Hex | Role |
|---|---|---|
| Infinite Blue | `#032D42` | Primary identity; dark hero, header, navigation, headings, and light-surface text |
| Wasabi Green | `#63DF4E` | Restrained accent; headline lead and short category labels on dark surfaces |
| White | `#FFFFFF` | Dark-surface text and light reading surfaces |
| Black | `#000000` | Optional maximum-contrast light-surface text |
| Lightest neutral | `#F9FAFB` | Light reading background |
| Soft neutral | `#F3F4F6` | Supporting surfaces |
| Border neutral | `#E5E7EB` | Light dividers and borders |
| Bright Blue | `#52B8FF` | Limited chart and infographic use |
| Bright Indigo | `#7661FF` | Limited chart and infographic use |
| Bright Purple | `#BF71F2` | Limited chart and infographic use |

### Color rules

- Infinite Blue is primary and visually anchors the report.
- Wasabi Green is accent-only. Never use it as a page, hero, or section background or for body copy.
- Use white text on dark surfaces; use Infinite Blue or black text on light surfaces.
- Do not use green text on white or light surfaces. It does not meet normal text contrast requirements.
- Do not use gray body text, gray metadata, or gray fine print. Create hierarchy with size, weight, and spacing instead.
- Use opaque solid surface fills. Transparency may be used for shadows, not to produce uncertain text-background contrast.
- Supplementary colors belong in charts or small visual distinctions, not large solid backgrounds or body typography.
- Do not use color alone to communicate risk, confidence, category, or status.

For simplicity and consistent accessibility, this skill uses white-on-blue or blue-on-white buttons rather than green-filled buttons. Buttons must remain recognizable and provide hover and focus states.

### Typography

Use ServiceNow Sans for text and headlines; ServiceNow Sans Mono for eyebrows, annotations, and compact labels. Arial is the approved fallback when ServiceNow Sans is unavailable.

- Headline: Sans, bold 700.
- Section heading: Sans, bold 700.
- Body: Sans, light 300; use regular 400 for dense tables and form controls.
- Button or navigation label: Sans, book 450.
- Eyebrow or annotation: Mono, regular 400.

The general headline hierarchy is approximately body:subheadline:headline = 1:2:4. For long-form reports, use responsive headline sizes and 1.6 body line-height for readability rather than forcing the ratio on every screen. Do not create a separate CSS font-family named ServiceNow Sans Display; use ServiceNow Sans at bold weight for HTML headlines.

### Signature headline

On Infinite Blue, a headline of three or more words may lead with a complete Wasabi Green phrase and finish in white. Green comes first. Do not scatter green words across a sentence or reverse the treatment. A headline shorter than three words stays white.

### Layout, corners, and density

- Use centered `.container` wrappers for all horizontal page alignment.
- Use up to 72rem for the overall interactive report shell and controls; keep narrative measure at 52rem or less, preferably around 65–80 characters per line.
- Individual full-width sections use vertical spacing; the container owns horizontal gutters.
- Cards may have internal padding.
- Use generous whitespace and restrained shadows; do not crowd the page.
- Cards and content panels: 16px radius. Small containers: minimum 8px. Large outer treatments: 24px. Buttons: pill-shaped.
- Use borders of at least 2px where borders are present.
- Left-align headings and body text. Centered footer text is acceptable.
- Avoid hover-lift effects on long narrative sections; use them sparingly for truly interactive summary cards.

### Dark and light balance

Use an Infinite Blue header and hero by default. A dark executive summary preserves the primary identity. A white or off-white reading area is an intentional long-form layout choice. All reading-area text remains Infinite Blue or black.

A fully dark report is also acceptable when appropriate: use opaque Infinite Blue surfaces, white body text, and limited green accents. Never import gray-label patterns from an unrelated dashboard system.

### Logo and icons

Use the exact logo SVG embedded in the reference implementation below. Preserve its path data, proportions, and original green “o.” The logo has a natural size of 132×20px; never scale below 100px wide. Provide at least 1.5rem of clear space around it. Do not stretch, recolor, approximate, shadow, or add effects to it.

The embedded logo is the one approved inline SVG exception. For representational icons, use only exact authorized supplied assets rendered as images. No icon assets are required by this skill: use clear text labels by default. Never create freehand SVG icons, use emoji as icons, or invent decorative illustrations to fill space.

*Made with ServiceNow EmployeeWorks*
