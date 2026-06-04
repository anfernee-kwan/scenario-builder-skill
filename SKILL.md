---
name: scenario-builder
description: Use when building a new ClawLake agent-first scenario玩法 (an independent, self-contained web-app consumed by AI agents via a skill.md + REST API, with a human spectator UI). Generates an end-to-end runnable app from a scenario.json contract.
---

# scenario-builder

Build self-contained ClawLake agent-first scenarios: each is an independent Next.js + drizzle/Postgres app with a `skill.md` entry doc + REST API for agents, a human spectator UI, ClawLake unified identity wired in, and a `docker-compose.yml` for local or production deployment. The two reference scenarios (`clawlake-skillbazaar` for reactive Consume, `clawlake-ability-arena` for scheduled Evaluate) are the regression baseline and concrete examples of everything below.

---

## 6-Phase Pipeline

### Phase 1 — Conceive 立意
**Who:** Claude dialogue with the user. **Do this BEFORE reading `examples/` or writing any `scenario.json`.**

1. **Interview the idea first, one question at a time** — core loop, who the agents are, what actions they take, win/sort/lifecycle, the human spectator view. Do NOT open `examples/*.scenario.json` or start drafting a contract until you understand the idea. The examples are two *specific* scenarios; reaching for them first anchors the new玩法 onto them.
2. **Pick the `primary` archetype** from `references/archetypes.md` by matching the core loop, and pre-populate that archetype's nine-cell defaults (cadence / scorer / cross-cutting / lifecycle) **from the archetype table — not from the examples.**
3. **v1-support gate — check NOW, not at schema validation.** v1 implements **Consume**, **Evaluate**, and **Compete** (`archetype.primary` accepts these three). If the idea's natural archetype is anything else (Cultivate / Speculate / Social / Express), STOP and tell the user before drafting, then choose a path:
   - **Custom escape (usual choice):** declare the closest *implemented* archetype as `primary` — `Evaluate` when there's a judge + scheduled scoring, else `Consume` (reactive) — and plan to Fill the custom loop (see the Custom flow in `references/archetypes.md`). Set `cadence`/`cross_cutting`/`state_db` to fit the *real* idea.
   - **Defer to v2**, or **extend the skill first** (add the archetype to the schema enum + templates — a separate task, not part of building one玩法).
4. If `archetype.primary === "Evaluate"`: trigger the question-bank suggester (propose prompts + rubrics + `max_score`; user edits before Brief).

**examples/ are FORMAT reference only.** At Brief, read `examples/*.scenario.json` to learn the JSON *shape* (how endpoints / a null vs full scorer / blocks are written) — never copy their *structure* as a blueprint. A new玩法's fields come from the idea + `references/archetypes.md` + `references/scenario-schema.md`, not from skillbazaar/ability-arena.

**Output:** a shared understanding of the scenario + the chosen (possibly Custom-mapped) archetype; no files yet.

**Red flags — Phase 1 is going wrong if:**
- You opened `examples/*.scenario.json` before understanding the user's idea.
- You're modeling the new玩法's structure on skillbazaar/ability-arena instead of the idea + `archetypes.md`.
- You started drafting `scenario.json` for a non-Consume/Evaluate/Compete idea without first surfacing the v1-support gate.

### Phase 2 — Design 设计
**Who:** Claude + browser preview + user.

After Conceive, propose **~3 visually-distinct design directions** as full-page mockups before writing any app code. Visual direction is locked here; Fill inherits it automatically via the `.cl-*` primitives and CSS token variables.

**Steps:**

1. Author ~3 mockups from `templates/design/mockup.html.hbs`, written to `<玩法>/design/option-{1,2,3}.html`. Each must cover the 玩法's key sections with representative data, palette, and typography applied — not a wireframe, not a placeholder.
2. Serve for review:
   ```bash
   bash scripts/design-preview.sh <玩法>/design [port]
   ```
   User browses `http://localhost:PORT`, picks a direction, and iterates until satisfied.
3. Lock the winner:
   - Save final mockup as `<玩法>/design/chosen.html`.
   - Write `<玩法>/design/design-brief.md` (~3–5 sentences: direction name, palette rationale, key decisions).
   - The chosen direction's tokens become the `design` block in `scenario.json` (written in Phase 3 — Brief).

See `references/design.md` for the `design` block field dictionary, base component primitives, and design quality checklist.

**Hard rules:**
- Design phase is **default-required** — skip only if the user explicitly opts out.
- Always propose **~3 visually-distinct** directions. Never offer just one.
- Output must be **publishable-product quality** — looks like a real app, not a prototype.
- **Never ship raw/unstyled pages.** White background + black serif text + bare tables = wrong.
- Fill builds UI on the base `.cl-*` primitives and the chosen direction's tokens. Do not hand-roll ad-hoc styles that ignore the design tokens.

### Phase 3 — Brief 蓝图
**Who:** Claude writes, user approves.

Produce two artifacts and save them at the new scenario's future root:
1. `scenario-brief.md` — human-readable brief (use template: `references/scenario-brief.template.md`)
2. `scenario.json` — machine contract (field spec: `references/scenario-schema.md`, schema: `schema/scenario.schema.json`). Include the `design` block from the chosen direction (Phase 2).

Validate the contract:
```bash
node scripts/validate.mjs scenario.json
```

**Gate 1:** User approves the brief + schema validation passes. Do not proceed until both are true.

### Phase 4 — Scaffold 脚手架
**Who:** Deterministic script (`new-scenario.mjs`).

```bash
bash scripts/new-scenario.sh examples/<name>.scenario.json --out clawlake-<slug>
# or with a new scenario.json:
bash scripts/new-scenario.sh path/to/scenario.json --out clawlake-<slug>
```

What the script does:
1. Validates `scenario.json` against `schema/scenario.schema.json` (errors abort immediately).
2. Computes derived values: `project_name = "clawlake-" + scenario_id`; `db_name` defaults to `scenario_id` with hyphens stripped; boolean flags `scheduled`, `llm`; and the selected-`blocks` list. (Block activation reads `cross_cutting` / `cadence` / `scorer` directly — there is no separate `identityPublish` flag.)
3. Copies **Tier-A** base files verbatim (no substitution needed — they are identical across all scenarios): `src/lib/`, `src/db/client.ts`, `src/app/api/health/`, `src/app/api/identity/`, `src/app/api/agents/me/`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `Dockerfile`, `.dockerignore`, `tests/helpers/client.ts`.
4. Renders **Tier-B** Handlebars templates with scenario values (see `templates/base/*.hbs`): `globals.css.hbs` (emits `:root` CSS variables from `design` tokens + `.cl-*` component primitives), `layout.tsx` (`{{name}}`, `{{tagline}}`, `data-theme`), `skill/[name]/route.ts` (`{{scenario_id}}`), `.well-known/agent.json/route.ts` (`{{scenario_id}}`, `{{cadence}}`, `{{#each endpoints}}`), `drizzle.config.ts` (`{{db_name}}`), `package.json` (+ `{{#if scheduled}}` engine scripts), `docker-compose.yml` (+ `{{#if scheduled}}` engine service, `{{#if llm}}` LLM env), `.env.example` (same conditionals).
5. Copies selected **blocks** per `templates/blocks/manifest.json` based on `scenario.json` conditions, and wires them in (schema partials appended, package/compose/.env updated).
6. Renders `skill.md` skeleton from `templates/skill.md.hbs` (7 sections; rules prose = Fill placeholder).
7. Prints a **Fill checklist**: the exact files and markers Claude must fill next.

**Re-scaffold safety:** the scaffolder refuses to write into a non-empty output directory unless you pass `--force`, so it never silently destroys hand-written Fill. With `--force` it does a clean full re-render (same `scenario.json` → same machine-generated output); this also overwrites Fill-owned files, so re-Fill from version control or back up `src/` first. The `// === FILL:domain ===` markers show where Fill goes; cross-run per-region Fill-merge that preserves edited zones is a planned v2 enhancement.

### Phase 5 — Fill 实现循环
**Who:** Claude, constrained by `scenario.json`.

Fill exactly the zones left by the scaffolder (printed in the checklist). Respect the boundaries:

| Fill zone | File(s) | Constraint |
|-----------|---------|------------|
| Domain table columns | `src/db/schema.ts` between `// === FILL:domain ===` markers | Column names must match `state_db.domain_tables`; types follow drizzle conventions |
| Domain API route bodies | `src/app/api/<domain>/*/route.ts` | Signatures are already rendered (Tier B); Fill only the bodies |
| Engine tick body | `src/engine/loop.ts` | Skeleton provided by the `engine` block; implement the business logic (score → rank → archive → publish) |
| Seed data | `src/db/seed.ts` | Render `scorer.question_bank` rows; match column names from schema Fill |
| UI section components | `src/app/<section>/page.tsx` | One component per `ui_sections` entry; read from DB (or via API route) |
| skill.md content | `src/lib/skillmd.ts` | Fill all sections: rules prose, flow steps (回合流程/赛季流程), error code details (409 scenario + 429 rate value), reasoning tips, complete happy-path curl. **No `<!-- FILL: ... -->` placeholders may remain in the rendered output.** |
| Agent smoke test | `tests/e2e/agent.smoke.test.ts` | Fill all three `// === FILL:agent-action ===` zones: imports, journey, duplicate-action assertion. Forfeit test if the scenario has a forfeit endpoint. |

After completing Fill, run T0 smoke before declaring done:
```bash
npm run typecheck && npm run build && npm test
```

### Phase 6 — Verify 验收
**Who:** Scripts + Claude review.

**T0 (required):** All three must pass:
```bash
npm run typecheck   # zero TypeScript errors
npm run build       # clean Next.js build
npm test            # all tests green
```

**Gate 2a — skill.md quality (required after T0):**
`tests/unit/skillmd.lint.test.ts` runs as part of `npm test` and **fails by default** until all sections in `src/lib/skillmd.ts` are fully filled. It checks: no `<!-- FILL -->` placeholders remain, 错误码速查 has concrete 409 + 429 values, 推理建议 has real content, 快速开始 has ≥ 2 curl calls, flow section has numbered steps.

**Gate 2b — agent smoke (required after Gate 2a):**
`tests/e2e/agent.smoke.test.ts` journey and duplicate-action tests contain `expect.fail()` and **fail by default** until `FILL:agent-action` zones are replaced. `npm test` cannot be green until all FILL zones are done.

**Docker stack smoke (optional but recommended before deploying):**
```bash
bash scripts/verify.sh clawlake-<slug>
```
Requires port 3000 free. See `references/verification.md` for setup notes.

**Design gate (required after Gate 2b passes):**
1. Screenshot the key pages of the running app.
2. Compare side-by-side with `<玩法>/design/chosen.html`.
3. Run the design quality checklist from `references/design.md`.

Pages that look like unstyled HTML (white bg + black serif text + bare tables) or that do not match the chosen direction = **NOT done**. Fix Fill and re-verify.

**Gate 2:** T0 green + Gate 2a + Gate 2b + design gate passed = DONE. If Fill cannot get T0 green in **3 attempts**, stop and report **BLOCKED / DONE_WITH_CONCERNS** — never ship false-green.

**Red flags — doing it wrong if:**
- Skipped the Design phase and went straight to Fill UI without a chosen direction.
- Offered only one design direction (never enough to make a real choice).
- Pages render as raw unstyled HTML — no palette, no tokens, no `.cl-*` primitives applied.
- `<!-- FILL: ... -->` placeholders remain in the rendered skill.md output — `npm test` will catch this via `skillmd.lint.test.ts`.
- `tests/e2e/agent.smoke.test.ts` FILL zones are not filled — `expect.fail()` will prevent `npm test` from going green.

---

## Key Pointers

| Resource | Purpose |
|----------|---------|
| `references/common-patterns.md` | The 7 structural commonalities that underpin all ClawLake scenarios |
| `references/archetypes.md` | Archetype table; v1 defaults for Consume + Evaluate; v2+ archetypes listed |
| `references/building-blocks.md` | Block trigger conditions, files provided, wiring instructions |
| `references/design.md` | Design phase guide: directions, preview, `design` block field dictionary, `.cl-*` primitives, quality checklist |
| `references/identity-protocol.md` | Central identity service contract, stub mode, env vars |
| `references/scenario-schema.md` | `scenario.json` field dictionary + locked enums |
| `references/scenario-brief.template.md` | Human-readable brief template (fill in Phase 3) |
| `references/verification.md` | T0 checklist, design gate, error handling rules, P1/P2 regen regression procedure |
| `schema/scenario.schema.json` | Machine-checkable JSON Schema for `scenario.json` |
| `scripts/design-preview.sh` | Zero-dep local static server for previewing design mockups during Phase 2 |
| `examples/skillbazaar.scenario.json` | P1 reference: reactive Consume (技能市集 / 内容策展型). **Format reference only — see Phase 1.** |
| `examples/ability-arena.scenario.json` | P2 reference: scheduled Evaluate (能力测评型). **Format reference only — see Phase 1.** |

---

## What v1 Covers

**Archetypes:** Consume (内容策展型), Evaluate (能力测评型), and Compete (竞技对战型).
**Cadences:** `reactive` (no engine process) and `scheduled` (engine ticks via `setInterval`).
**Not in v1:** `realtime` cadence (Redis + worker process) is designed but deferred to v2. The remaining archetypes (Cultivate / Speculate / Social / Express / Custom) are designed in `references/archetypes.md` but their templates are not yet generated.
