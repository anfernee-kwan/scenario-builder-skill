# Design Reference

The Design phase (Phase 2) locks the visual direction before any code is written. It produces three artifacts: a chosen mockup HTML file, a `design-brief.md`, and a `design` block in `scenario.json`. Fill then builds the UI on the resulting CSS tokens and base component primitives.

---

## Proposing Directions

After Conceive, propose **~3 visually-distinct** design directions — not variations of one idea, but genuinely different design worlds. Each direction should reflect a different aesthetic sensibility that is plausible for the 玩法's audience. Examples of contrasting directions:

- **Professional dark terminal** — dark surface (#0f1117 bg), monospaced accent typeface, muted greens/cyans for data, high information density. Fits competitive agent leaderboards and monitoring dashboards.
- **Clean light fintech** — white/off-white bg, generous whitespace, Inter-style sans, subtle blue/indigo accents, rounded cards, medium density. Fits skill markets and publish/earn loops.
- **Bold neo-brutalist** — heavy black borders, punchy accent color (yellow/orange), loud display typeface, flat fills, low density. Fits competitive arenas where bold attitude is the point.

These are **illustrations**, not prescriptions — derive the directions from the actual 玩法 idea.

### Generating mockups

Each direction is authored from `templates/design/mockup.html.hbs` and written to:

```
<玩法>/design/option-1.html
<玩法>/design/option-2.html
<玩法>/design/option-3.html
```

Each mockup should cover the 玩法's key sections (leaderboard, submission view, skill page, or whatever is primary for this scenario) with representative data, palette, and typography applied. The mockup must look like a real published product — not a wireframe, not raw HTML, not placeholder lorem ipsum.

---

## Preview and Selection

Serve the mockup directory with the zero-dependency local static server:

```bash
bash scripts/design-preview.sh <玩法>/design [port]
# default port: 8787
```

The script prints `http://localhost:PORT` — open it in a browser, browse the three options, iterate. Once a direction is agreed:

1. Save the final mockup as `<玩法>/design/chosen.html`.
2. Write a short `<玩法>/design/design-brief.md` (direction name, key decisions, palette rationale, ~3–5 sentences).
3. Translate the chosen direction's visual tokens into the `design` block in `scenario.json` (described below).

---

## The `design` Block (in `scenario.json`)

All fields are optional. When the block is absent, the generator applies a neutral light default.

| Field | Type | Values / Notes |
|-------|------|----------------|
| `vibe` | string | Free-text label for the direction (e.g., `"dark terminal"`, `"clean fintech"`). Human label only. |
| `theme` | `"dark"` \| `"light"` | Drives `data-theme` on `<html>`. v1 only; `"both"` (toggle) is a v2 idea. |
| `palette.bg` | CSS color | Page background. |
| `palette.surface` | CSS color | Card / panel background. |
| `palette.text` | CSS color | Primary body text. |
| `palette.muted` | CSS color | Secondary / supporting text. |
| `palette.accent` | CSS color | Interactive highlight (links, active states, buttons). |
| `palette.success` | CSS color | Positive delta, up-trend indicators. |
| `palette.danger` | CSS color | Negative delta, error states. |
| `palette.border` | CSS color | Dividers, card outlines. |
| `typography.sans` | font-family string | Body copy and UI labels. |
| `typography.mono` | font-family string | Code, IDs, API values. |
| `typography.display` | font-family string | Hero headings, leaderboard ranks. |
| `typography.scale` | number | Base font-size multiplier (default `1`). |
| `radius` | CSS value | Border-radius for cards and buttons (e.g., `"0"`, `"0.5rem"`, `"1rem"`). |
| `shadow` | CSS box-shadow | Card elevation shadow. Empty string = flat/no shadow. |
| `density` | `"compact"` \| `"normal"` \| `"spacious"` | Controls padding and line-height rhythm. |

The Scaffold step renders these values into `:root` CSS variables in `globals.css.hbs` (Tier-B rendered). Fill builds UI using the `.cl-*` primitives below — not hand-rolled ad-hoc styles.

---

## Base Component Primitives (`.cl-*` classes)

Generated in `globals.css.hbs` from the design tokens. Fill builds all UI from these so every component inherits the chosen direction without repeating token references.

| Class | Purpose |
|-------|---------|
| `.cl-nav` | Top navigation bar — bg `surface`, padding from density, brand + tagline slot. |
| `.cl-container` | Centered max-width page wrapper with responsive horizontal padding. |
| `.cl-card` | Surface-background panel with `radius`, `shadow`, and `border`. |
| `.cl-stat` | Metric display block: large value + small label, suitable for KPI rows. |
| `.cl-muted` | Applies `muted` color to any text element. |
| `.cl-table` | Full-width data table: `border-collapse`, striped rows via surface/bg alternation, readable cell padding. |
| `.cl-badge` | Inline pill label. `.up` variant = `success` bg; `.down` variant = `danger` bg. |
| `.cl-btn` | Primary interactive button: `accent` bg, hover/focus states, `radius` applied. |
| `.cl-list` | Clean unstyled list for agent rosters, skill inventories, etc. |
| `.cl-rank` | Large rank numeral display (leaderboard position), display typeface, accent-colored. |

---

## Design Quality Checklist

Run this before marking the Design phase done and again in the Verify phase:

- [ ] **Clear visual hierarchy** — headings, subheadings, and data values are visually distinct.
- [ ] **Consistent token use** — no hard-coded colors or font stacks in component code; all values come from `--cl-*` CSS variables.
- [ ] **No raw browser defaults** — pages must NOT render as white background + black serif text + unstyled tables. If it looks like a plain HTML document from 1999, it is wrong.
- [ ] **Responsive** — key sections are readable and not broken at mobile widths.
- [ ] **Visible interaction states** — buttons and links have clear hover and focus styles.
- [ ] **Matches chosen direction** — screenshot key pages side-by-side with `chosen.html`; the palette, typeface, and density should be recognizably the same.

---

## Notes

- v1 `theme` is `dark` or `light` (single palette). A user-toggleable `"both"` mode is a v2 idea — don't wire it in v1.
- The mockup files (`design/`) are committed alongside `scenario.json` as design artifacts. They are not served in production.
