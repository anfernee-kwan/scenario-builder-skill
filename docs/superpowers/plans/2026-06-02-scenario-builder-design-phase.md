# scenario-builder Design Phase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated玩法 look like publishable products by adding (1) a `design` token block + JSON Schema, (2) a CSS-variable **design-system shell** in `templates/base` (so玩法 are never raw), (3) a self-contained mockup **preview server**, and (4) a mockup-driven **Design phase** + design-gate in `SKILL.md`.

**Architecture:** `derive.mjs` merges a neutral default `design` with the scenario's `design` block; `templates/base/src/app/globals.css.hbs` renders those tokens into `:root` CSS variables plus a set of component-primitive classes (`.cl-*`); `layout.tsx.hbs` renders an app shell (nav + container + font + theme). The skill's new Design phase produces ~3 mockups served by `scripts/design-preview.sh` (zero-dep Node static server); Fill builds bespoke UI on the primitives; Verify adds a screenshot design gate. SKILL.md change verified via writing-skills RED→GREEN.

**Tech Stack:** Node ESM, handlebars, ajv, `node:test` (generator); plain CSS variables (no framework) for generated apps. No new runtime deps.

**Authority:** [Design-phase spec](../specs/2026-06-02-scenario-builder-design-phase.md). Reference the existing generator: `scripts/lib/{derive,render}.mjs`, `scripts/lib/render.test.mjs`, `templates/base/src/app/{globals.css,layout.tsx.hbs}`, `schema/scenario.schema.json`, `examples/*.scenario.json`.

**Branch:** `design-phase` (Task 1). **v1 narrowing (vs spec):** `design.theme` enum = `dark|light` only (single palette per玩法; `both` deferred to v2). Note it where it appears.

**Never ship false-green:** if a task can't pass in 3 attempts, stop → BLOCKED/DONE_WITH_CONCERNS.

---

## Conventions

- The `design` block is **optional** in scenario.json; `derive.mjs` deep-merges it over `DEFAULT_DESIGN` so `ctx.design` is **always fully populated** (templates never see undefined tokens).
- Generator tests: `node --test 'scripts/**/*.test.mjs'` from repo root.
- Generated-app CSS uses only CSS custom properties + classes — no Tailwind/CSS-in-JS.

---

## File Map

- `schema/scenario.schema.json` — add optional `design` object (MODIFY)
- `scripts/lib/derive.mjs` — `DEFAULT_DESIGN` + deep-merge → `ctx.design`, `ctx.dark` (MODIFY)
- `scripts/lib/derive.test.mjs` — design merge tests (MODIFY)
- `templates/base/src/app/globals.css` → **delete**; `templates/base/src/app/globals.css.hbs` — design system (CREATE/REPLACE)
- `templates/base/src/app/layout.tsx.hbs` — app shell (MODIFY)
- `scripts/lib/render.test.mjs` — globals/layout render assertions (MODIFY)
- `templates/design/mockup.html.hbs` — mockup scaffold (CREATE)
- `scripts/design-preview.sh` — zero-dep static server (CREATE)
- `examples/crypto-pit.scenario.json` — add a `design` block (MODIFY)
- `references/design.md` — design reference (CREATE)
- `references/verification.md` — add design gate (MODIFY)
- `SKILL.md` — Design phase + rules + verify gate (MODIFY, via writing-skills)

---

## Task 1: `design` schema block + derive merge

**Files:** `schema/scenario.schema.json`, `scripts/lib/derive.mjs`, `scripts/lib/derive.test.mjs`

- [ ] **Step 1: Branch**
```bash
cd /Users/anfernee/projects/scenario-builder-skill
git checkout -b design-phase
```

- [ ] **Step 2: Add `design` to `schema/scenario.schema.json`** — inside `properties` (sibling of `ui_sections`), add:
```json
"design": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "vibe": { "type": "string" },
    "theme": { "enum": ["dark", "light"] },
    "palette": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "bg": { "type": "string" }, "surface": { "type": "string" }, "text": { "type": "string" },
        "muted": { "type": "string" }, "accent": { "type": "string" }, "success": { "type": "string" },
        "danger": { "type": "string" }, "border": { "type": "string" }
      }
    },
    "typography": {
      "type": "object", "additionalProperties": false,
      "properties": { "sans": { "type": "string" }, "mono": { "type": "string" }, "display": { "type": "string" }, "scale": { "enum": ["compact", "comfortable"] } }
    },
    "radius": { "type": "string" },
    "shadow": { "enum": ["none", "soft", "hard"] },
    "density": { "enum": ["compact", "comfortable"] }
  }
}
```
(Do NOT add `design` to the top-level `required` array — it's optional.)

- [ ] **Step 3: Write failing test** — add to `scripts/lib/derive.test.mjs`:
```js
test("design defaults fill in when scenario has no design block", () => {
  const d = derive(p1); // p1 has no design block
  assert.equal(d.design.theme, "light");
  assert.equal(d.design.palette.bg, "#ffffff");
  assert.equal(d.design.palette.accent, "#4f46e5");
  assert.equal(d.dark, false);
});

test("scenario design deep-merges over defaults (partial palette ok)", () => {
  const d = derive({ ...p1, design: { theme: "dark", palette: { accent: "#00ff9c" } } });
  assert.equal(d.dark, true);
  assert.equal(d.design.theme, "dark");
  assert.equal(d.design.palette.accent, "#00ff9c");   // overridden
  assert.equal(d.design.palette.text, "#0f172a");      // still from default (deep merge)
  assert.equal(d.design.radius, "10px");               // untouched default
});
```

- [ ] **Step 4: Run — expect FAIL.** `node --test scripts/lib/derive.test.mjs`

- [ ] **Step 5: Implement in `scripts/lib/derive.mjs`** — add near top (module scope):
```js
export const DEFAULT_DESIGN = {
  vibe: "clean neutral",
  theme: "light",
  palette: { bg: "#ffffff", surface: "#f7f8fa", text: "#0f172a", muted: "#64748b", accent: "#4f46e5", success: "#16a34a", danger: "#dc2626", border: "#e2e8f0" },
  typography: { sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", mono: "ui-monospace, 'SF Mono', Menlo, monospace", display: "inherit", scale: "comfortable" },
  radius: "10px", shadow: "soft", density: "comfortable",
};
```
Inside `derive(s)`, before the `return`, compute:
```js
const d = s.design ?? {};
const design = {
  ...DEFAULT_DESIGN, ...d,
  palette: { ...DEFAULT_DESIGN.palette, ...(d.palette ?? {}) },
  typography: { ...DEFAULT_DESIGN.typography, ...(d.typography ?? {}) },
};
const dark = design.theme === "dark";
```
and add `design, dark` to the returned object.

- [ ] **Step 6: Run — expect PASS.** `node --test scripts/lib/derive.test.mjs`

- [ ] **Step 7: Confirm examples still validate** (design optional): `node scripts/validate.mjs examples/skillbazaar.scenario.json && node scripts/validate.mjs examples/ability-arena.scenario.json` → both VALID.

- [ ] **Step 8: Commit**
```bash
git add schema/scenario.schema.json scripts/lib/derive.mjs scripts/lib/derive.test.mjs
git commit -m "feat(design): scenario.json design block + derive deep-merge over neutral defaults"
```

---

## Task 2: base design-system shell (globals.css.hbs + layout shell)

**Files:** delete `templates/base/src/app/globals.css`; create `templates/base/src/app/globals.css.hbs`; modify `templates/base/src/app/layout.tsx.hbs`; extend `scripts/lib/render.test.mjs`.

- [ ] **Step 1: Write failing render tests** — add to `scripts/lib/render.test.mjs`:
```js
test("globals.css renders design tokens into :root variables", () => {
  const out = renderString(tpl("src/app/globals.css.hbs"), p2);
  assert.match(out, /:root\s*\{/);
  assert.match(out, /--accent:/);
  assert.match(out, /--bg:/);
  // component primitives present
  assert.match(out, /\.cl-card/);
  assert.match(out, /\.cl-table/);
  assert.match(out, /\.cl-badge/);
  assert.match(out, /\.cl-btn/);
  assert.match(out, /\.cl-nav/);
});

test("globals.css uses the scenario's accent when design provided", () => {
  const ctx = derive({ ...p2, design: { theme: "dark", palette: { accent: "#00ff9c" } } });
  const out = renderString(tpl("src/app/globals.css.hbs"), ctx);
  assert.match(out, /--accent:\s*#00ff9c/);
});

test("layout renders the app shell (nav with scenario name + container)", () => {
  const out = renderString(tpl("src/app/layout.tsx.hbs"), p2);
  assert.match(out, /cl-nav/);
  assert.match(out, /cl-container/);
  assert.match(out, /Ability Arena/);
});
```

- [ ] **Step 2: Run — expect FAIL** (globals.css.hbs missing / layout has no shell). `node --test scripts/lib/render.test.mjs`

- [ ] **Step 3: Delete the old flat CSS + create `templates/base/src/app/globals.css.hbs`:**
```bash
git rm templates/base/src/app/globals.css
```
Create `templates/base/src/app/globals.css.hbs` with EXACTLY:
```hbs
:root {
  --bg: {{design.palette.bg}};
  --surface: {{design.palette.surface}};
  --text: {{design.palette.text}};
  --muted: {{design.palette.muted}};
  --accent: {{design.palette.accent}};
  --success: {{design.palette.success}};
  --danger: {{design.palette.danger}};
  --border: {{design.palette.border}};
  --radius: {{design.radius}};
  --font-sans: {{design.typography.sans}};
  --font-mono: {{design.typography.mono}};
  --pad: {{#if (eq design.density "compact")}}10px{{else}}16px{{/if}};
  --shadow: {{#if (eq design.shadow "none")}}none{{else}}{{#if (eq design.shadow "hard")}}4px 4px 0 var(--border){{else}}0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.05){{/if}}{{/if}};
  color-scheme: {{design.theme}};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px; line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3 { line-height: 1.2; margin: 0 0 .5em; }
h1 { font-size: 1.6rem; } h2 { font-size: 1.2rem; } h3 { font-size: 1rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }

.cl-nav {
  display: flex; align-items: center; gap: 1rem;
  padding: 14px 24px; border-bottom: 1px solid var(--border);
  background: var(--surface); position: sticky; top: 0; z-index: 10;
}
.cl-nav .brand { font-weight: 700; font-size: 1.05rem; }
.cl-nav a { color: var(--muted); font-size: .9rem; }
.cl-container { max-width: 960px; margin: 0 auto; padding: 28px 24px 64px; }

.cl-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow);
  padding: var(--pad); margin-bottom: 16px;
}
.cl-stat { font-size: 2rem; font-weight: 700; letter-spacing: -.5px; }
.cl-muted { color: var(--muted); }
.cl-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.cl-table th, .cl-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.cl-table th { color: var(--muted); font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; }
.cl-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: .78rem; font-weight: 600; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
.cl-badge.up { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.cl-badge.down { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.cl-btn { display: inline-block; padding: 8px 16px; border-radius: var(--radius); background: var(--accent); color: #fff; border: 0; font-weight: 600; cursor: pointer; }
.cl-list { list-style: none; padding: 0; margin: 0; }
.cl-list li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.cl-rank { width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; }
```
> Uses the `eq` helper already registered in `render.mjs`. `color-mix` is supported by the Next 15 toolchain's modern target.

- [ ] **Step 4: Update `templates/base/src/app/layout.tsx.hbs`** to render the shell. Replace its body with:
```hbs
import "./globals.css";
export const metadata = { title: "{{name}}", description: "{{tagline}}" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" data-theme="{{design.theme}}">
      <body>
        <nav className="cl-nav">
          <span className="brand">{{name}}</span>
          <span className="cl-muted" style={{ fontSize: ".85rem" }}>{{tagline}}</span>
        </nav>
        <div className="cl-container">{children}</div>
      </body>
    </html>
  );
}
```
> Check the current `layout.tsx.hbs` first; preserve any import it had for globals.css (this version imports it). If the reference layout structured `<html>/<body>` differently, keep Next's requirements (one html/body) — the above is the canonical shape.

- [ ] **Step 5: Run render tests — expect PASS.** `node --test scripts/lib/render.test.mjs`

- [ ] **Step 6: Run the FULL generator suite** (the orchestrator/scaffold tests render the whole base tree — confirm globals.css.hbs renders cleanly in renderTree): `npm test` → all green.

- [ ] **Step 7: Commit**
```bash
git add templates/base/src/app/globals.css.hbs templates/base/src/app/layout.tsx.hbs scripts/lib/render.test.mjs
git commit -m "feat(design): base design-system shell (globals.css tokens + component primitives + layout nav/container)"
```

---

## Task 3: self-contained preview (mockup template + preview server)

**Files:** `templates/design/mockup.html.hbs`, `scripts/design-preview.sh`

- [ ] **Step 1: Create `templates/design/mockup.html.hbs`** — a standalone HTML scaffold the Design phase copies/edits per direction. It's a full document (design mockups are bespoke, authored by Claude during Design):
```hbs
<!DOCTYPE html>
<html lang="zh" data-theme="{{theme}}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{name}} — design mockup</title>
<style>
  /* Direction tokens — edit per mockup */
  :root { --bg:{{bg}}; --surface:{{surface}}; --text:{{text}}; --muted:{{muted}}; --accent:{{accent}}; --border:{{border}}; --radius:{{radius}}; }
  * { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--text); font-family:{{font}}; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 28px 24px; }
  .nav { display:flex; gap:1rem; align-items:center; padding:14px 24px; border-bottom:1px solid var(--border); background:var(--surface); }
  .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; }
</style>
</head>
<body>
  <nav class="nav"><b>{{name}}</b></nav>
  <div class="wrap">
    <!-- MOCKUP: Claude replaces this body with a representative full-page layout for this玩法 + direction -->
    <div class="card"><h2>{{name}}</h2><p style="color:var(--muted)">{{vibe}}</p></div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Create `scripts/design-preview.sh`** (zero-dep Node static server):
```bash
#!/usr/bin/env bash
set -euo pipefail
DIR="${1:-.}"
PORT="${2:-4500}"
exec node --input-type=module -e '
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
const dir = process.argv[1]; const port = Number(process.argv[2]);
const types = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".svg":"image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/" || p.endsWith("/")) p += "index.html";
    const full = join(dir, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(full);
    res.writeHead(200, { "content-type": types[extname(full)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
server.listen(port, () => console.log(`design preview → http://localhost:${port}  (serving ${dir})`));
' "$DIR" "$PORT"
```
Then `chmod +x scripts/design-preview.sh`.

- [ ] **Step 3: Smoke-test the preview server.** Run:
```bash
bash -n scripts/design-preview.sh   # syntax ok
mkdir -p /tmp/dp && printf '<!doctype html><h1>ok-preview</h1>' > /tmp/dp/index.html
bash scripts/design-preview.sh /tmp/dp 4599 & SRV=$!; sleep 1
curl -fsS http://localhost:4599/ | grep -q "ok-preview" && echo "PREVIEW OK" || echo "PREVIEW FAIL"
kill $SRV 2>/dev/null; rm -rf /tmp/dp
```
Expected: `PREVIEW OK`. (If port 4599 is busy, pick another.)

- [ ] **Step 4: Commit**
```bash
git add templates/design/mockup.html.hbs scripts/design-preview.sh
git commit -m "feat(design): self-contained mockup template + zero-dep design-preview server"
```

---

## Task 4: example design block + crypto-pit regression input

**Files:** `examples/crypto-pit.scenario.json`

- [ ] **Step 1: Add a `design` block to `examples/crypto-pit.scenario.json`** (the Terminal-Noir direction), as a sibling of `ui_sections`:
```json
"design": {
  "vibe": "professional trading terminal",
  "theme": "dark",
  "palette": { "bg": "#0a0e14", "surface": "#11161f", "text": "#cbd5e1", "muted": "#64748b", "accent": "#00ff9c", "success": "#00ff9c", "danger": "#ff4d4d", "border": "#1e2630" },
  "typography": { "sans": "Inter, system-ui, sans-serif", "mono": "'SF Mono', ui-monospace, monospace", "display": "Inter, system-ui, sans-serif", "scale": "compact" },
  "radius": "4px", "shadow": "none", "density": "compact"
}
```

- [ ] **Step 2: Validate** `node scripts/validate.mjs examples/crypto-pit.scenario.json` → VALID. Run `npm test` (root) → still green (derive/render tests handle the new block).

- [ ] **Step 3: Commit**
```bash
git add examples/crypto-pit.scenario.json
git commit -m "feat(design): crypto-pit example gets Terminal-Noir design block"
```

---

## Task 5: SKILL.md Design phase + design gate + references/design.md (writing-skills)

**Files:** `SKILL.md`, `references/design.md`, `references/verification.md`. **Use writing-skills RED→GREEN for the SKILL.md change.**

- [ ] **Step 1: RED — baseline.** Dispatch a subagent (read-only) given the CURRENT `SKILL.md` + a "build a new玩法" task; observe whether it (a) runs any design step, (b) would ship raw white/black pages. Document the baseline (it has no Design phase → it won't).

- [ ] **Step 2: Write `references/design.md`** — covering: how to propose ~3 design directions (vibe vocabulary; distinct aesthetics); the `design` block field dictionary (from spec §4); the component-primitive class list (`.cl-card/.cl-table/.cl-badge/.cl-btn/.cl-stat/.cl-nav/.cl-container/.cl-list/.cl-rank`) + usage; `scripts/design-preview.sh <玩法>/design` usage + the `design/` artifact layout (`option-{1,2,3}.html`, `chosen.html`, `design-brief.md` from `templates/design/mockup.html.hbs`); the design-quality checklist (hierarchy / consistent token use / no raw defaults / responsive / interaction states).

- [ ] **Step 3: Edit `SKILL.md`** — insert the Design phase + rules:
  - Add **Phase 2 — Design** between Conceive and Brief; renumber subsequent phases (Brief→3, Scaffold→4, Fill→5, Verify→6). Design phase text: after Conceive, produce ~3 visually-distinct design-direction mockups from `templates/design/mockup.html.hbs` into `<玩法>/design/option-{1,2,3}.html`; serve via `bash scripts/design-preview.sh <玩法>/design`; user picks/iterates; save winner as `design/chosen.html` + write the `design` block into scenario.json (Brief) + `design/design-brief.md`.
  - **Hard rules** (bullet list): Design phase is **default-required**; give **~3 visually-distinct directions**; output must be **publishable product quality**; **never ship raw white/black unstyled pages**; Fill builds UI on the base component primitives + the chosen direction.
  - **Verify (Phase 6):** add the **design gate** — screenshot key pages, compare to `design/chosen.html`, run the §design checklist; "looks like unstyled HTML" = not done.
  - **Red flags self-check:** "skipped Design and went straight to Fill UI / only offered one direction / pages render as raw HTML = doing it wrong."
  - Pointers table: add `references/design.md`, `scripts/design-preview.sh`.

- [ ] **Step 4: Update `references/verification.md`** — add the design gate to the T0/Verify checklist (screenshot + design checklist; raw pages fail).

- [ ] **Step 5: GREEN — verify.** Dispatch a fresh subagent given the EDITED `SKILL.md` + the same "build a new玩法" task; confirm it now (a) runs the Design phase (proposes ~3 directions via the preview), (b) treats raw white/black as unacceptable, (c) plans bespoke UI on the primitives. Document the before/after. If it still skips/under-delivers, tighten the rules (REFACTOR) and re-test.

- [ ] **Step 6: word-count check** `wc -w SKILL.md` (keep it lean) and `npm test` (root) still green (no code changed, sanity).

- [ ] **Step 7: Commit**
```bash
git add SKILL.md references/design.md references/verification.md
git commit -m "docs(design): SKILL.md Design phase + design gate + references/design.md (writing-skills RED->GREEN verified)"
```

---

## Task 6: Acceptance — regenerate crypto-pit WITH design, prove styled + tests green

**Files:** none committed (temp regen); this is the acceptance gate.

- [ ] **Step 1: Scaffold crypto-pit (now with its design block) into a temp dir**
```bash
rm -rf .tmp-design/crypto-pit
node scripts/new-scenario.mjs examples/crypto-pit.scenario.json --out .tmp-design/crypto-pit
```

- [ ] **Step 2: Confirm the design system rendered (NOT raw).** 
```bash
grep -q '#00ff9c' .tmp-design/crypto-pit/src/app/globals.css && echo "accent token rendered"
grep -q '.cl-card' .tmp-design/crypto-pit/src/app/globals.css && echo "primitives present"
grep -q 'cl-nav' .tmp-design/crypto-pit/src/app/layout.tsx && echo "shell present"
grep -q 'data-theme="dark"' .tmp-design/crypto-pit/src/app/layout.tsx && echo "dark theme set"
```
Expected: all four echo. (This proves a scaffolded玩法 is visibly designed, not raw.)

- [ ] **Step 3: Fill domain + UI on primitives, then run crypto-pit's suite as oracle.** Copy the Fill files from the committed `clawlake-crypto-pit/` reference (schema domain tables, routes, engine, seed, helpers, tests) into the temp dir — EXCEPT keep the temp dir's rendered `globals.css`/`layout.tsx` (the new design shell) and `tests/helpers/db.ts`. The page components (`page.tsx`, `agents/[username]/page.tsx`) may be copied as-is (they still work); optionally restyle them with `.cl-*` classes. Then:
```bash
cd .tmp-design/crypto-pit && npm install
docker compose up -d postgres   # port 5436
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5436/cryptopit npm run db:push
npm run typecheck && npm run build
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5436/cryptopit PRICE_MOCK=1 npm test
```
Expected: typecheck/build clean; **22 tests green** (CSS/shell changes don't affect functional tests). This proves the design shell integrates without breaking the玩法.

- [ ] **Step 4: (design eyeball)** Start the app or `bash scripts/design-preview.sh` on a static export isn't needed — instead `npm run dev` briefly OR just confirm Step 2's tokens. Note in the report that the home page now uses `--bg:#0a0e14` (dark terminal) vs the old white. Clean up: `docker compose stop`, `cd - && rm -rf .tmp-design`.

- [ ] **Step 5: Commit** (empty milestone if no source change):
```bash
cd /Users/anfernee/projects/scenario-builder-skill
git commit --allow-empty -m "test(design): scaffolded crypto-pit renders dark design shell + 22 tests green (design phase verified)"
```

---

## Task 7: Final review + merge

- [ ] **Step 1: Final code review** (requesting-code-review) over `git diff main..design-phase` — focus: CSS correctness/validity, schema, derive deep-merge, no broken existing render/scaffold tests, SKILL.md clarity, no source-product names. Run `npm test` (root) to confirm green.
- [ ] **Step 2: Address blocking findings.**
- [ ] **Step 3: Merge + push**
```bash
git checkout main && git merge --no-ff design-phase -m "feat(design): mockup-driven Design phase + base design-system shell"
git push origin main
```
- [ ] **Step 4: Update memory** — note the Design phase is in the skill; generated玩法 are now styled by default.

---

## Self-Review (run by plan author)

- **Spec coverage:** §2 flow (Design phase) → Task 5; §3 preview mechanism → Task 3; §4 `design` block + schema → Task 1; §5 base shell → Task 2; §6 Fill-on-primitives → Tasks 2 (primitives) + 5 (rule) + 6 (demo); §7 Verify design gate → Task 5 Step 4; §8 SKILL.md/references → Task 5; §9 acceptance → Tasks 1–6 (esp. Task 6); §10 YAGNI honored (no framework, single palette, static mockups); §11 file list → File Map. No gaps. (`design.theme` narrowed to dark|light per the v1 note.)
- **Placeholder scan:** all code blocks complete; CSS/schema/derive/preview shown in full; the per-direction mockup body is intentionally Claude-authored at runtime (it's bespoke content, not plan code). OK.
- **Type/name consistency:** `ctx.design` (deep-merged) + `ctx.dark`, `DEFAULT_DESIGN`, component classes `.cl-nav/.cl-container/.cl-card/.cl-stat/.cl-table/.cl-badge/.cl-btn/.cl-list/.cl-rank`, `eq` helper (already in render.mjs), preview `scripts/design-preview.sh <dir> [port]` — consistent across Tasks 1–6.
- **Dependency:** Task 6 needs postgres@5436 (Task 6 Step 3 starts it). Task 2 deletes `globals.css` (Tier-A) and replaces with `globals.css.hbs` (Tier-B) — the orchestrator's renderTree handles `.hbs` automatically, so no new-scenario.mjs change needed.
