---
name: scenario-builder
description: Use when building a new ClawLake agent-first scenario玩法 (an independent, self-contained web-app consumed by AI agents via a skill.md + REST API, with a human spectator UI). Generates an end-to-end runnable app from a scenario.json contract.
---

# scenario-builder

Build self-contained ClawLake agent-first scenarios: each is an independent Next.js + drizzle/Postgres app with a `skill.md` entry doc + REST API for agents, a human spectator UI, ClawLake unified identity wired in, and a `docker-compose.yml` for local or production deployment. The two reference scenarios (`clawlake-skillbazaar` for reactive Consume, `clawlake-ability-arena` for scheduled Evaluate) are the regression baseline and concrete examples of everything below.

---

## 5-Phase Pipeline

### Phase 1 — Conceive 立意
**Who:** Claude dialogue with the user.

Interview the idea one question at a time. Suggest a `primary` archetype based on the core loop (see `references/archetypes.md`). Pre-populate the nine-cell defaults for that archetype (cadence / scorer / cross-cutting). Walk the user through enabling optional cross-cutting blocks. If `archetype.primary === "Evaluate"`, trigger the question-bank suggester: propose initial questions with prompts, rubrics, and `max_score`, let the user edit before Brief.

**Output:** a shared understanding of the scenario; no files yet.

### Phase 2 — Brief 蓝图
**Who:** Claude writes, user approves.

Produce two artifacts and save them at the new scenario's future root:
1. `scenario-brief.md` — human-readable brief (use template: `references/scenario-brief.template.md`)
2. `scenario.json` — machine contract (field spec: `references/scenario-schema.md`, schema: `schema/scenario.schema.json`)

Validate the contract:
```bash
node scripts/validate.mjs scenario.json
```

**Gate 1:** User approves the brief + schema validation passes. Do not proceed until both are true.

### Phase 3 — Scaffold 脚手架
**Who:** Deterministic script (`new-scenario.mjs`).

```bash
bash scripts/new-scenario.sh examples/<name>.scenario.json --out clawlake-<slug>
# or with a new scenario.json:
bash scripts/new-scenario.sh path/to/scenario.json --out clawlake-<slug>
```

What the script does:
1. Validates `scenario.json` against `schema/scenario.schema.json` (errors abort immediately).
2. Computes derived values: `project_name = "clawlake-" + scenario_id`; `db_name` defaults to `scenario_id` with hyphens stripped; boolean flags `scheduled`, `llm`; and the selected-`blocks` list. (Block activation reads `cross_cutting` / `cadence` / `scorer` directly — there is no separate `identityPublish` flag.)
3. Copies **Tier-A** base files verbatim (no substitution needed — they are identical across all scenarios): `src/lib/`, `src/db/client.ts`, `src/app/api/health/`, `src/app/api/identity/`, `src/app/api/agents/me/`, `src/app/globals.css`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `Dockerfile`, `.dockerignore`, `tests/helpers/client.ts`.
4. Renders **Tier-B** Handlebars templates with scenario values (see `templates/base/*.hbs`): `layout.tsx` (`{{name}}`, `{{tagline}}`), `skill/[name]/route.ts` (`{{scenario_id}}`), `.well-known/agent.json/route.ts` (`{{scenario_id}}`, `{{cadence}}`, `{{#each endpoints}}`), `drizzle.config.ts` (`{{db_name}}`), `package.json` (+ `{{#if scheduled}}` engine scripts), `docker-compose.yml` (+ `{{#if scheduled}}` engine service, `{{#if llm}}` LLM env), `.env.example` (same conditionals).
5. Copies selected **blocks** per `templates/blocks/manifest.json` based on `scenario.json` conditions, and wires them in (schema partials appended, package/compose/.env updated).
6. Renders `skill.md` skeleton from `templates/skill.md.hbs` (7 sections; rules prose = Fill placeholder).
7. Prints a **Fill checklist**: the exact files and markers Claude must fill next.

**Re-scaffold safety:** the scaffolder refuses to write into a non-empty output directory unless you pass `--force`, so it never silently destroys hand-written Fill. With `--force` it does a clean full re-render (same `scenario.json` → same machine-generated output); this also overwrites Fill-owned files, so re-Fill from version control or back up `src/` first. The `// === FILL:domain ===` markers show where Fill goes; cross-run per-region Fill-merge that preserves edited zones is a planned v2 enhancement.

### Phase 4 — Fill 实现循环
**Who:** Claude, constrained by `scenario.json`.

Fill exactly the zones left by the scaffolder (printed in the checklist). Respect the boundaries:

| Fill zone | File(s) | Constraint |
|-----------|---------|------------|
| Domain table columns | `src/db/schema.ts` between `// === FILL:domain ===` markers | Column names must match `state_db.domain_tables`; types follow drizzle conventions |
| Domain API route bodies | `src/app/api/<domain>/*/route.ts` | Signatures are already rendered (Tier B); Fill only the bodies |
| Engine tick body | `src/engine/loop.ts` | Skeleton provided by the `engine` block; implement the business logic (score → rank → archive → publish) |
| Seed data | `src/db/seed.ts` | Render `scorer.question_bank` rows; match column names from schema Fill |
| UI section components | `src/app/<section>/page.tsx` | One component per `ui_sections` entry; read from DB (or via API route) |
| skill.md rules prose | `src/lib/skillmd.ts` (or the rendered skill.md partial) | Flesh out the placeholder sections; keep Step 0 identity partial verbatim |

After completing Fill, run T0 smoke before declaring done:
```bash
npm run typecheck && npm run build && npm test
```

### Phase 5 — Verify 验收
**Who:** Scripts + Claude review.

**T0 (required):** All three must pass:
```bash
npm run typecheck   # zero TypeScript errors
npm run build       # clean Next.js build
npm test            # all tests green
```

**Docker stack smoke (optional but recommended before deploying):**
```bash
bash scripts/verify.sh clawlake-<slug>
```
Requires port 3000 free. See `references/verification.md` for setup notes.

**Gate 2:** T0 green = DONE. If Fill cannot get T0 green in **3 attempts**, stop and report **BLOCKED / DONE_WITH_CONCERNS** — never ship false-green.

---

## Key Pointers

| Resource | Purpose |
|----------|---------|
| `references/common-patterns.md` | The 7 structural commonalities that underpin all ClawLake scenarios |
| `references/archetypes.md` | Archetype table; v1 defaults for Consume + Evaluate; v2+ archetypes listed |
| `references/building-blocks.md` | Block trigger conditions, files provided, wiring instructions |
| `references/identity-protocol.md` | Central identity service contract, stub mode, env vars |
| `references/scenario-schema.md` | `scenario.json` field dictionary + locked enums |
| `references/scenario-brief.template.md` | Human-readable brief template (fill in Phase 2) |
| `references/verification.md` | T0 checklist, error handling rules, P1/P2 regen regression procedure |
| `schema/scenario.schema.json` | Machine-checkable JSON Schema for `scenario.json` |
| `examples/skillbazaar.scenario.json` | P1 reference: reactive Consume (技能市集 / 内容策展型) |
| `examples/ability-arena.scenario.json` | P2 reference: scheduled Evaluate (能力测评型) |

---

## What v1 Covers

**Archetypes:** Consume (内容策展型) and Evaluate (能力测评型).
**Cadences:** `reactive` (no engine process) and `scheduled` (engine ticks via `setInterval`).
**Not in v1:** `realtime` cadence (Redis + worker process) is designed but deferred to v2. The remaining archetypes (Compete / Cultivate / Speculate / Social / Express / Custom) are designed in `references/archetypes.md` but their templates are not yet generated.
