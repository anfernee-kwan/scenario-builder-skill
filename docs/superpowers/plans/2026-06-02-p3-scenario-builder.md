# P3 · scenario-builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `scenario-builder` Claude Code skill (schema + handlebars renderer + base/blocks templates + SKILL.md/references) that regenerates the two reference scenarios (P1 `clawlake-skillbazaar` reactive, P2 `clawlake-ability-arena` scheduled) and passes each one's existing test suite.

**Architecture:** A `scenario.json` contract (JSON-Schema-validated) drives a deterministic Node+handlebars renderer (`scripts/new-scenario.mjs`) that copies Tier-A literal files, renders Tier-B/C templates (composite files use inline `{{#if}}` for engine/llm overlay), and conditionally vendors selected `templates/blocks/*` with wiring. Claude then fills domain code (schema columns, route bodies, engine tick, seed, UI, skill.md prose) under the scenario.json contract. Acceptance = regenerate P1+P2 into temp dirs, copy each reference scenario's `tests/` in as an independent oracle, and pass.

**Tech Stack:** Node 22 ESM, `handlebars` (templating), `ajv` (JSON Schema), `node:test`/`node:assert` (renderer unit tests, zero extra dep). Generated apps: Next.js 15 App Router, drizzle-orm/pg, vitest (unchanged from P1/P2).

**Authority:** [Design spec](../specs/2026-06-02-p3-scenario-builder-extraction-design.md). Reference sources: `clawlake-skillbazaar/`, `clawlake-ability-arena/` (read these as ground truth for every literal copy).

**Autonomy:** User granted full autopilot for P3 — execute all tasks without per-task sign-off; annotate any judgment calls in commit messages. Never ship false-green: if a regen Fill can't pass the oracle suite in 3 attempts, stop and record BLOCKED/DONE_WITH_CONCERNS.

**Branch:** All implementation on `p3-scenario-builder` (created in Task 0). Design docs already on `main`.

---

## File Map (what gets created)

```
scenario-builder-skill/                 # repo root (alongside the two scenario dirs)
  package.json                          # NEW — generator tooling deps (handlebars, ajv) + scripts
  schema/scenario.schema.json           # NEW — scenario.json JSON Schema
  examples/skillbazaar.scenario.json    # NEW — P1 contract
  examples/ability-arena.scenario.json  # NEW — P2 contract
  scripts/
    lib/derive.mjs                      # NEW — derived values (project_name, db_name, flags) + pure helpers
    lib/render.mjs                      # NEW — handlebars setup, helpers, render-tree walker
    validate.mjs                        # NEW — ajv validation of a scenario.json
    new-scenario.mjs                    # NEW — orchestrator: validate → copy Tier-A → render Tier-B/C → wire blocks
    new-scenario.sh                     # NEW — thin bash wrapper
    verify.sh                           # NEW — docker-stack smoke for a generated scenario (template of P1/P2 verify.sh)
    *.test.mjs                          # NEW — node:test unit tests for derive/render/validate/new-scenario
  templates/
    base/                               # NEW — golden base (Tier-A literal + Tier-B *.hbs)
    blocks/{engine,lifecycle,scorer,llm,anticheat,identity-publish,economy}/  # NEW
    skill.md.hbs                        # NEW — 7-section skeleton + shared step-0 partial
    partials/step0-identity.hbs         # NEW — shared identity partial
  SKILL.md                              # NEW — 5-phase entry
  references/{common-patterns,archetypes,building-blocks,identity-protocol,scenario-schema,scenario-brief.template,verification}.md  # NEW
```

> **Templating note (locked decision):** all Tier-B files are `*.hbs` rendered by handlebars, INCLUDING `package.json.hbs` and `docker-compose.yml.hbs` — composite overlays use inline `{{#if scheduled}}` / `{{#if llm}}` with leading-comma JSON trick where needed. `tests/helpers/db.ts.hbs` is rendered from the computed table set (agents + domain + lifecycle + economy), removing it from Fill.

---

## Task 0: Branch + generator package scaffold

**Files:**
- Create: `package.json` (repo root)
- Modify: `.gitignore`

- [ ] **Step 1: Create the work branch**

Run:
```bash
cd /Users/anfernee/projects/scenario-builder-skill
git checkout -b p3-scenario-builder
```
Expected: `Switched to a new branch 'p3-scenario-builder'`

- [ ] **Step 2: Verify .gitignore ignores node_modules (add if missing)**

Run: `grep -q 'node_modules' .gitignore && echo OK || echo MISSING`
If `MISSING`, append a line `node_modules/` to `.gitignore`.

- [ ] **Step 3: Create root `package.json` for generator tooling**

```json
{
  "name": "clawlake-scenario-builder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test scripts/",
    "new-scenario": "node scripts/new-scenario.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "handlebars": "^4.7.8"
  }
}
```

- [ ] **Step 4: Install deps**

Run: `npm install`
Expected: `node_modules/` created, `ajv` + `handlebars` present. Run `node -e "require.resolve('handlebars')" 2>/dev/null; node --input-type=module -e "import('handlebars').then(()=>console.log('hb ok'))"` → `hb ok`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(p3): generator tooling package (handlebars, ajv) + branch"
```

---

## Task 1: scenario.json Schema + both example contracts

**Files:**
- Create: `schema/scenario.schema.json`
- Create: `examples/skillbazaar.scenario.json`
- Create: `examples/ability-arena.scenario.json`

- [ ] **Step 1: Write `examples/skillbazaar.scenario.json` (P1 contract)**

```json
{
  "scenario_id": "skillbazaar",
  "name": "SkillBazaar",
  "tagline": "Agent 技能市集",
  "one_liner": "发布、浏览、评测各种 Agent 技能。优秀技能靠真实评测排名。",
  "archetype": { "primary": "Consume", "secondary": [] },
  "cross_cutting": ["economy"],
  "cadence": "reactive",
  "db_name": "skillbazaar",
  "host_port": 5432,
  "endpoints": [
    { "method": "GET",  "path": "/api/skills",                 "auth": false, "summary": "浏览/搜索", "query": "q,category" },
    { "method": "GET",  "path": "/api/skills/{slug}",          "auth": false, "summary": "详情 + 评测" },
    { "method": "POST", "path": "/api/skills",                 "auth": true,  "summary": "发布技能", "body_hint": "{name,description,category,tags,version,content}" },
    { "method": "POST", "path": "/api/skills/{slug}/install",  "auth": true,  "summary": "安装，返回 content，安装数 +1" },
    { "method": "POST", "path": "/api/skills/{slug}/reviews",  "auth": true,  "summary": "评测", "body_hint": "{overall,dim_useful,dim_reliable,dim_easy,body}(1-5)" },
    { "method": "GET",  "path": "/api/leaderboard",            "auth": false, "summary": "技能榜 + 评测者榜" }
  ],
  "scorer": null,
  "state_db": { "lifecycle": "none", "domain_tables": ["skills", "reviews"] },
  "engine": null,
  "ui_sections": ["技能榜", "评测者榜", "技能详情", "Agent 档案"]
}
```

- [ ] **Step 2: Write `examples/ability-arena.scenario.json` (P2 contract)**

```json
{
  "scenario_id": "ability-arena",
  "name": "Ability Arena",
  "tagline": "Agent 能力擂台",
  "one_liner": "作答推理/分析题，LLM 按 rubric 判分，按赛季排名。",
  "archetype": { "primary": "Evaluate", "secondary": [] },
  "cross_cutting": ["llm", "anticheat", "identity-publish"],
  "cadence": "scheduled",
  "db_name": "abilityarena",
  "host_port": 5433,
  "endpoints": [
    { "method": "GET",  "path": "/api/seasons/current",     "auth": false, "summary": "当前赛季 + 题目（不含他人答案）" },
    { "method": "POST", "path": "/api/seasons/{id}/submit", "auth": true,  "summary": "提交作答", "body_hint": "{question_id,answer,no_subagent:true}" },
    { "method": "GET",  "path": "/api/submissions/me",      "auth": true,  "summary": "自己的提交 + 分数" },
    { "method": "GET",  "path": "/api/leaderboard",         "auth": false, "summary": "赛季榜", "query": "season" }
  ],
  "scorer": {
    "type": "llm-judge",
    "subtype": "score-and-rank",
    "max_score": 10,
    "judge": { "model_env": "LLM_MODEL", "rubric_per_question": true },
    "question_bank": [
      { "idx": 1, "prompt": "一个袋子里有 3 红 2 蓝球，不放回取两次，两次都红的概率是多少？请给出推理过程。", "reference_points": "3/5 * 2/4 = 3/10", "rubric": "答案 3/10 得满分；过程清晰加分；只给答案无过程扣分。", "max_score": 10 },
      { "idx": 2, "prompt": "甲说乙在说谎，乙说丙在说谎，丙说甲乙都在说谎。谁在说真话？给出推理。", "reference_points": "标准解：乙说真话，甲丙说谎。", "rubric": "结论正确且分类讨论完整满分；结论对但过程薄弱中等分。", "max_score": 10 },
      { "idx": 3, "prompt": "为什么 0.999... = 1？给一个让非数学背景的人能信服的论证。", "reference_points": "1/3=0.333...，×3=0.999...=1；或 x=0.999..., 10x-x=9。", "rubric": "论证严密且通俗满分；只给公式不解释中等。", "max_score": 10 }
    ]
  },
  "state_db": { "lifecycle": "season", "domain_tables": ["questions", "submissions", "scores"] },
  "engine": { "tick_ms": 2000, "batch": 50 },
  "ui_sections": ["赛季榜", "赛季视图", "Agent 档案"]
}
```

- [ ] **Step 3: Write `schema/scenario.schema.json` (JSON Schema draft 2020-12)**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ClawLake scenario.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["scenario_id", "name", "tagline", "one_liner", "archetype", "cross_cutting", "cadence", "endpoints", "state_db", "ui_sections"],
  "properties": {
    "scenario_id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "name": { "type": "string", "minLength": 1 },
    "tagline": { "type": "string", "minLength": 1 },
    "one_liner": { "type": "string", "minLength": 1 },
    "archetype": {
      "type": "object", "additionalProperties": false, "required": ["primary"],
      "properties": {
        "primary": { "enum": ["Consume", "Evaluate"] },
        "secondary": { "type": "array", "items": { "enum": ["Consume", "Evaluate"] }, "default": [] }
      }
    },
    "cross_cutting": { "type": "array", "items": { "enum": ["economy", "llm", "anticheat", "identity-publish", "narrative", "external"] }, "uniqueItems": true },
    "cadence": { "enum": ["reactive", "scheduled", "realtime"] },
    "db_name": { "type": "string", "pattern": "^[a-z][a-z0-9]*$" },
    "host_port": { "type": "integer", "minimum": 1024, "maximum": 65535, "default": 5432 },
    "endpoints": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["method", "path", "auth", "summary"],
        "properties": {
          "method": { "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          "path": { "type": "string", "pattern": "^/" },
          "auth": { "type": "boolean" },
          "summary": { "type": "string" },
          "query": { "type": "string" },
          "body_hint": { "type": "string" }
        }
      }
    },
    "scorer": {
      "type": ["object", "null"],
      "additionalProperties": false,
      "required": ["type"],
      "properties": {
        "type": { "enum": ["rule", "llm-judge", "hybrid"] },
        "subtype": { "enum": ["score-and-rank", "classify"] },
        "max_score": { "type": "integer", "minimum": 1 },
        "judge": { "type": "object" },
        "question_bank": {
          "type": "array",
          "items": {
            "type": "object", "additionalProperties": false, "required": ["idx", "prompt"],
            "properties": {
              "idx": { "type": "integer" },
              "prompt": { "type": "string" },
              "reference_points": { "type": "string" },
              "rubric": { "type": "string" },
              "max_score": { "type": "integer" }
            }
          }
        }
      }
    },
    "state_db": {
      "type": "object", "additionalProperties": false, "required": ["lifecycle", "domain_tables"],
      "properties": {
        "lifecycle": { "enum": ["none", "season", "round"] },
        "domain_tables": { "type": "array", "items": { "type": "string", "pattern": "^[a-z_]+$" } }
      }
    },
    "engine": {
      "type": ["object", "null"], "additionalProperties": false,
      "properties": { "tick_ms": { "type": "integer", "minimum": 100 }, "batch": { "type": "integer", "minimum": 1 } }
    },
    "ui_sections": { "type": "array", "items": { "type": "string" } }
  },
  "allOf": [
    { "if": { "properties": { "cadence": { "const": "scheduled" } } }, "then": { "required": ["engine"], "properties": { "engine": { "type": "object" } } } }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add schema/ examples/
git commit -m "feat(p3): scenario.json schema + P1/P2 example contracts"
```

---

## Task 2: `validate.mjs` — ajv validation (TDD)

**Files:**
- Create: `scripts/validate.mjs`
- Test: `scripts/validate.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateScenario } from "./validate.mjs";

const p1 = JSON.parse(readFileSync(new URL("../examples/skillbazaar.scenario.json", import.meta.url)));
const p2 = JSON.parse(readFileSync(new URL("../examples/ability-arena.scenario.json", import.meta.url)));

test("P1 and P2 examples are valid", () => {
  assert.deepEqual(validateScenario(p1).errors, []);
  assert.deepEqual(validateScenario(p2).errors, []);
});

test("scheduled requires engine", () => {
  const bad = { ...p2, engine: null };
  assert.ok(validateScenario(bad).errors.length > 0);
});

test("unknown cadence rejected", () => {
  const bad = { ...p1, cadence: "cron" };
  assert.ok(validateScenario(bad).errors.length > 0);
});

test("unknown top-level key rejected", () => {
  const bad = { ...p1, blocks: ["economy"] };
  assert.ok(validateScenario(bad).errors.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/validate.test.mjs`
Expected: FAIL — `Cannot find module './validate.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
import Ajv from "ajv";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/scenario.schema.json", import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

export function validateScenario(scenario) {
  const valid = validateFn(scenario);
  return { valid, errors: valid ? [] : (validateFn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/validate.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/validate.mjs scripts/validate.test.mjs
git commit -m "feat(p3): ajv scenario validator + tests"
```

---

## Task 3: `derive.mjs` — derived values & flags (TDD)

**Files:**
- Create: `scripts/lib/derive.mjs`
- Test: `scripts/lib/derive.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derive } from "./derive.mjs";

const p1 = JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url)));
const p2 = JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url)));

test("derives project_name, flags, default db_name", () => {
  const d1 = derive(p1);
  assert.equal(d1.project_name, "clawlake-skillbazaar");
  assert.equal(d1.scheduled, false);
  assert.equal(d1.llm, false);
  assert.equal(d1.db_name, "skillbazaar");
  assert.deepEqual(d1.truncate_tables, ["agents", "skills", "reviews", "ledger"]);

  const d2 = derive(p2);
  assert.equal(d2.project_name, "clawlake-ability-arena");
  assert.equal(d2.scheduled, true);
  assert.equal(d2.llm, true); // auto from scorer.type === llm-judge
  assert.deepEqual(d2.truncate_tables, ["agents", "seasons", "questions", "submissions", "scores", "season_rankings"]);
  assert.ok(d2.blocks.includes("engine") && d2.blocks.includes("lifecycle") && d2.blocks.includes("scorer"));
});

test("db_name defaults to id minus dashes when absent", () => {
  const { db_name } = derive({ ...p2, db_name: undefined });
  assert.equal(db_name, "abilityarena");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/derive.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// Pure: scenario.json (already validated) -> derived values consumed by templates + wiring.
export function derive(s) {
  const scheduled = s.cadence === "scheduled";
  const llm = (s.scorer && s.scorer.type === "llm-judge") || (s.cross_cutting ?? []).includes("llm");
  const db_name = s.db_name ?? s.scenario_id.replace(/-/g, "");
  const host_port = s.host_port ?? 5432;

  // Selected blocks (cross_cutting set ∪ engine/lifecycle/scorer implied by cadence/scorer/state_db).
  const blocks = new Set(s.cross_cutting ?? []);
  if (llm) blocks.add("llm");
  if (scheduled) blocks.add("engine");
  if (s.scorer) { blocks.add("scorer"); }
  if (s.state_db.lifecycle && s.state_db.lifecycle !== "none") blocks.add("lifecycle");

  // TRUNCATE order: agents first, lifecycle parent tables, then domain, economy ledger last.
  // CASCADE handles FK order; we keep a stable, readable order matching the reference scenarios.
  const lifecycleTables = s.state_db.lifecycle === "season" ? ["seasons"] : s.state_db.lifecycle === "round" ? ["rounds"] : [];
  const lifecycleRankingTables = s.state_db.lifecycle === "season" ? ["season_rankings"] : s.state_db.lifecycle === "round" ? ["round_rankings"] : [];
  const economyTables = blocks.has("economy") ? ["ledger"] : [];
  const truncate_tables = ["agents", ...lifecycleTables, ...s.state_db.domain_tables, ...lifecycleRankingTables, ...economyTables];

  return {
    ...s,
    project_name: `clawlake-${s.scenario_id}`,
    db_name, host_port, scheduled, llm,
    blocks: [...blocks],
    truncate_tables,
  };
}
```

> **Note (annotated judgment):** truncate order is cosmetic (CASCADE makes order irrelevant for correctness) but ordered to match the reference scenarios' resetDb lists so the rendered `tests/helpers/db.ts` reads identically to ground truth.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/derive.test.mjs`
Expected: PASS (2 tests). If `truncate_tables` order mismatches the reference, adjust the order arrays — the reference is `clawlake-skillbazaar/tests/helpers/db.ts` and `clawlake-ability-arena/tests/helpers/db.ts`.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/derive.mjs scripts/lib/derive.test.mjs
git commit -m "feat(p3): derived-values helper (flags, blocks, truncate set) + tests"
```

---

## Task 4: Tier-A literal base files (copy from reference)

**Files (create under `templates/base/`):** literal copies — read each source file and write byte-identical.

- [ ] **Step 1: Copy the Tier-A literal set**

Copy each file VERBATIM from `clawlake-skillbazaar/` (these are diff=0 between P1 and P2 — confirmed) into `templates/base/`:

```
clawlake-skillbazaar/src/lib/ids.ts                      -> templates/base/src/lib/ids.ts
clawlake-skillbazaar/src/lib/auth.ts                     -> templates/base/src/lib/auth.ts
clawlake-skillbazaar/src/lib/http.ts                     -> templates/base/src/lib/http.ts
clawlake-skillbazaar/src/lib/url.ts                      -> templates/base/src/lib/url.ts
clawlake-skillbazaar/src/db/client.ts                    -> templates/base/src/db/client.ts
clawlake-skillbazaar/src/app/api/health/route.ts         -> templates/base/src/app/api/health/route.ts
clawlake-skillbazaar/src/app/api/identity/register/route.ts -> templates/base/src/app/api/identity/register/route.ts
clawlake-skillbazaar/src/app/api/agents/me/route.ts      -> templates/base/src/app/api/agents/me/route.ts
clawlake-skillbazaar/src/app/globals.css                 -> templates/base/src/app/globals.css
clawlake-skillbazaar/tsconfig.json                       -> templates/base/tsconfig.json
clawlake-skillbazaar/next.config.ts                      -> templates/base/next.config.ts
clawlake-skillbazaar/vitest.config.ts                    -> templates/base/vitest.config.ts
clawlake-skillbazaar/Dockerfile                          -> templates/base/Dockerfile
clawlake-skillbazaar/.dockerignore                       -> templates/base/.dockerignore   # if present; else create matching P1
clawlake-skillbazaar/tests/helpers/client.ts             -> templates/base/tests/helpers/client.ts
```

Implementation: `mkdir -p` the target dirs, then `cp` each. Do NOT edit contents.

- [ ] **Step 2: Verify copies are byte-identical**

Run (sample): `diff clawlake-skillbazaar/src/lib/http.ts templates/base/src/lib/http.ts && echo SAME`
Expected: `SAME` for each. Also confirm `.dockerignore` exists in source first: `ls clawlake-skillbazaar/.dockerignore`; if absent, omit that line.

- [ ] **Step 3: Commit**

```bash
git add templates/base
git commit -m "feat(p3): Tier-A literal base files (verbatim from reference)"
```

---

## Task 5: Tier-B template files + `render.mjs` walker (TDD)

**Files:**
- Create: `templates/base/src/app/layout.tsx.hbs`, `templates/base/src/app/skill/[name]/route.ts.hbs`, `templates/base/src/app/.well-known/agent.json/route.ts.hbs`, `templates/base/drizzle.config.ts.hbs`, `templates/base/package.json.hbs`, `templates/base/docker-compose.yml.hbs`, `templates/base/.env.example.hbs`, `templates/base/src/app/page.tsx.hbs`, `templates/base/tests/helpers/db.ts.hbs`
- Create: `scripts/lib/render.mjs`
- Test: `scripts/lib/render.test.mjs`

- [ ] **Step 1: Write `templates/base/src/app/layout.tsx.hbs`**

Base it on `clawlake-skillbazaar/src/app/layout.tsx`, replacing the metadata line:
```hbs
export const metadata = { title: "{{name}}", description: "{{tagline}}" };
```
Keep the rest of the file (the default Next layout body) identical to the reference.

- [ ] **Step 2: Write `templates/base/src/app/skill/[name]/route.ts.hbs`**

Base it on `clawlake-skillbazaar/src/app/skill/[name]/route.ts`, replacing the slug guard:
```hbs
  if (name !== "{{scenario_id}}") return new Response("not found", { status: 404 });
```
Keep imports/`renderSkillMd`/headers identical to reference.

- [ ] **Step 3: Write `templates/base/src/app/.well-known/agent.json/route.ts.hbs`**

```hbs
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "{{scenario_id}}",
    skill_md: `${base}/skill/{{scenario_id}}`,
    protocol: "rest",
    cadence: "{{cadence}}",
    endpoints: [{{#each endpoints}}"{{this.method}} {{this.path}}"{{#unless @last}}, {{/unless}}{{/each}}]
  });
}
```
> Verify against `clawlake-ability-arena/src/app/.well-known/agent.json/route.ts` for exact import/field shape; match it (this template must reproduce both P1 and P2 outputs).

- [ ] **Step 4: Write `templates/base/drizzle.config.ts.hbs`**

Base on `clawlake-skillbazaar/drizzle.config.ts`; the only variable is the DB in the connection string / dbCredentials — replace the db name with `{{db_name}}` and host port with `127.0.0.1:{{host_port}}` if present in the source. Match source structure exactly.

- [ ] **Step 5: Write `templates/base/package.json.hbs`**

```hbs
{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate"{{#if scheduled}},
    "engine": "node --import tsx --env-file=.env src/engine/index.ts",
    "engine:start": "node --import tsx src/engine/index.ts"{{/if}}
  },
  "dependencies": {
    "drizzle-orm": "^0.36.4",
    "next": "15.1.3",
    "pg": "^8.13.1",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.0.0",
    "drizzle-kit": "^0.28.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"{{#if scheduled}},
    "tsx": "^4.19.2"{{/if}}
  }
}
```
> Leading-comma-inside-`{{#if}}` keeps JSON valid whether or not the engine block renders.

- [ ] **Step 6: Write `templates/base/docker-compose.yml.hbs`**

```hbs
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: clawlake
      POSTGRES_PASSWORD: clawlake
      POSTGRES_DB: {{db_name}}
    ports: ["{{host_port}}:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clawlake"]
      interval: 3s
      timeout: 3s
      retries: 10
  web:
    build: .
    command: npm run start
    environment:
      DATABASE_URL: postgres://clawlake:clawlake@postgres:5432/{{db_name}}
      CLAWLAKE_AUTH_STUB: "1"{{#if llm}}
      LLM_MOCK: "1"{{/if}}
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }{{#if scheduled}}
  engine:
    build: .
    command: npm run engine:start
    environment:
      DATABASE_URL: postgres://clawlake:clawlake@postgres:5432/{{db_name}}{{#if llm}}
      LLM_MOCK: "1"{{/if}}
      ENGINE_TICK_MS: "{{engine.tick_ms}}"
    depends_on:
      postgres: { condition: service_healthy }{{/if}}
```
> P1's web has no `command: npm run start` line in the reference; adding it is harmless and matches P2. Annotated: unify on explicit `command` for both — verify P1 still builds/serves (it will; `start` is the default intent).

- [ ] **Step 7: Write `templates/base/.env.example.hbs`**

```hbs
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:{{host_port}}/{{db_name}}
CLAWLAKE_AUTH_STUB=1{{#if llm}}
LLM_MOCK=1{{/if}}{{#if scheduled}}
ENGINE_TICK_MS={{engine.tick_ms}}{{/if}}{{#if llm}}
# 真判分时填(留空即走 mock)：
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=
# LLM_MODEL=gpt-4o-mini
# CLAWLAKE_IDENTITY_URL=
# CLAWLAKE_SERVICE_TOKEN={{/if}}
```

- [ ] **Step 8: Write `templates/base/src/app/page.tsx.hbs` (minimal buildable home; Fill replaces with real spectator UI)**

```hbs
export const dynamic = "force-dynamic";
export default async function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>{{name}}</h1>
      <p>{{tagline}}</p>
      {/* FILL: spectator sections — {{#each ui_sections}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} */}
    </main>
  );
}
```

- [ ] **Step 9: Write `templates/base/tests/helpers/db.ts.hbs`**

```hbs
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function resetDb() {
  await db.execute(sql`TRUNCATE {{#each truncate_tables}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 10: Write `scripts/lib/render.mjs` (handlebars setup + tree walker)**

```js
import Handlebars from "handlebars";
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

Handlebars.registerHelper("includes", (arr, v) => Array.isArray(arr) && arr.includes(v));
Handlebars.registerHelper("eq", (a, b) => a === b);

// Render one .hbs string with the derived context.
export function renderString(src, ctx) {
  return Handlebars.compile(src, { noEscape: true })(ctx);
}

// Walk a template dir: *.hbs -> rendered (suffix stripped); everything else -> copied verbatim.
export function renderTree(srcDir, outDir, ctx) {
  for (const entry of readdirSync(srcDir)) {
    const sp = join(srcDir, entry);
    if (statSync(sp).isDirectory()) { renderTree(sp, join(outDir, entry), ctx); continue; }
    if (entry.endsWith(".hbs")) {
      const outPath = join(outDir, entry.slice(0, -4));
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, renderString(readFileSync(sp, "utf8"), ctx));
    } else {
      mkdirSync(outDir, { recursive: true });
      copyFileSync(sp, join(outDir, entry));
    }
  }
}

export function registerPartial(name, src) { Handlebars.registerPartial(name, src); }
```

- [ ] **Step 11: Write the failing test `scripts/lib/render.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderString } from "./render.mjs";
import { derive } from "./derive.mjs";

const p1 = derive(JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url))));
const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));
const tpl = (rel) => readFileSync(new URL(`../../templates/base/${rel}`, import.meta.url), "utf8");

test("agent.json renders scenario_id + cadence + endpoints", () => {
  const out = renderString(tpl("src/app/.well-known/agent.json/route.ts.hbs"), p2);
  assert.match(out, /scenario_id: "ability-arena"/);
  assert.match(out, /cadence: "scheduled"/);
  assert.match(out, /"POST \/api\/seasons\/\{id\}\/submit"/);
});

test("package.json: engine scripts + tsx only when scheduled", () => {
  const a = renderString(tpl("package.json.hbs"), p1);
  const b = renderString(tpl("package.json.hbs"), p2);
  assert.doesNotMatch(a, /engine:start/);
  assert.match(b, /engine:start/);
  assert.match(b, /"tsx":/);
  JSON.parse(a); JSON.parse(b); // both valid JSON
});

test("docker-compose: engine service only when scheduled", () => {
  assert.doesNotMatch(renderString(tpl("docker-compose.yml.hbs"), p1), /\n  engine:/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p2), /\n  engine:/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p1), /POSTGRES_DB: skillbazaar/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p2), /"5433:5432"/);
});

test("db.ts truncates the full table set", () => {
  assert.match(renderString(tpl("tests/helpers/db.ts.hbs"), p1), /TRUNCATE agents, skills, reviews, ledger RESTART/);
  assert.match(renderString(tpl("tests/helpers/db.ts.hbs"), p2), /TRUNCATE agents, seasons, questions, submissions, scores, season_rankings RESTART/);
});

test("layout title/description from name/tagline", () => {
  assert.match(renderString(tpl("src/app/layout.tsx.hbs"), p1), /title: "SkillBazaar", description: "Agent 技能市集"/);
});
```

- [ ] **Step 12: Run tests to verify they fail then pass**

Run: `node --test scripts/lib/render.test.mjs`
First expected: FAIL (templates missing or asserts mismatch). Fix templates until: PASS (5 tests). If an assert mismatches the reference output, the reference file is ground truth — adjust the template, not the assert (unless the assert encodes the wrong expectation).

- [ ] **Step 13: Commit**

```bash
git add templates/base scripts/lib/render.mjs scripts/lib/render.test.mjs
git commit -m "feat(p3): Tier-B handlebars templates + render walker + tests"
```

---

## Task 6: `skill.md.hbs` + shared step-0 partial (TDD)

**Files:**
- Create: `templates/partials/step0-identity.hbs`
- Create: `templates/skill.md.hbs`
- Create: `templates/base/src/lib/skillmd.ts.hbs`
- Test: `scripts/lib/skillmd.test.mjs`

> **Approach:** `src/lib/skillmd.ts.hbs` renders a `renderSkillMd(baseUrl)` function returning the 7-section markdown (matching the reference shape). Section ③ (rules) and ⑦ (quickstart specifics) carry Fill placeholders; sections ①②④⑤⑥ render deterministically from scenario.json. The shared step-0 partial is inlined at render time so the generated file is self-contained (no runtime partial dependency).

- [ ] **Step 1: Write `templates/partials/step0-identity.hbs`**

Reproduce the step-0 block from `clawlake-skillbazaar/src/lib/skillmd.ts` verbatim (the `## 第 0 步 · 获取 ClawLake 身份…` section through the closing note), with `${id}` left as a literal template-string interpolation (it stays JS, not handlebars). This is the DRY identity text shared by all scenarios.

- [ ] **Step 2: Write `templates/base/src/lib/skillmd.ts.hbs`**

```hbs
export function renderSkillMd(baseUrl: string): string {
  const id = baseUrl;
  return `# {{name}} — {{tagline}}（skill.md）

scenario_id: \`{{scenario_id}}\` · base_url: ${baseUrl} · version: 1

{{one_liner}}

{{> step0-identity}}

## 玩法规则
<!-- FILL: rules prose for archetype {{archetype.primary}} -->

## 通信协议（REST，鉴权头 \`agent-auth-api-key: <key>\`）
| 方法 | 路径 | 用途 |
|---|---|---|
{{#each endpoints}}| {{this.method}} | ${baseUrl}{{this.path}}{{#if this.query}}?{{this.query}}{{/if}} | {{this.summary}}{{#unless this.auth}}（免鉴权）{{/unless}} |
{{/each}}

{{#if scorer}}## 打分与排名
<!-- FILL: scoring + ranking explanation (type {{scorer.type}}) -->
{{/if}}{{#if (includes cross_cutting "anticheat")}}## 公平规则
<!-- FILL: anti-cheat rules (rate limit, no_subagent 等) -->
{{/if}}
## 快速开始
\`\`\`
KEY=$(curl -s -X POST ${id}/api/identity/register -d '{"username":"demo"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["api_key"])')
<!-- FILL: minimal happy-path curl sequence from endpoints -->
\`\`\`
`;
}
```

- [ ] **Step 3: Write the failing test `scripts/lib/skillmd.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import { derive } from "./derive.mjs";
import { renderString, registerPartial } from "./render.mjs";

registerPartial("step0-identity", readFileSync(new URL("../../templates/partials/step0-identity.hbs", import.meta.url), "utf8"));
const tpl = readFileSync(new URL("../../templates/base/src/lib/skillmd.ts.hbs", import.meta.url), "utf8");
const p1 = derive(JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url))));
const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));

test("renders title, scenario_id, step-0, endpoints table", () => {
  const out = renderString(tpl, p1);
  assert.match(out, /# SkillBazaar — Agent 技能市集/);
  assert.match(out, /scenario_id: \\`skillbazaar\\`/);
  assert.match(out, /第 0 步 · 获取 ClawLake 身份/);
  assert.match(out, /\| POST \| \$\{baseUrl\}\/api\/skills \| 发布技能 \|/);
});

test("scorer + anticheat sections gated by scenario", () => {
  assert.doesNotMatch(renderString(tpl, p1), /## 打分与排名/);
  const out2 = renderString(tpl, p2);
  assert.match(out2, /## 打分与排名/);
  assert.match(out2, /## 公平规则/);
});
```

- [ ] **Step 4: Run tests to verify they fail then pass**

Run: `node --test scripts/lib/skillmd.test.mjs`
First: FAIL. Fix template/partial until PASS (2 tests). Adjust escaping of backticks/`${}` as needed — the output is TypeScript source, so backticks inside the rendered string must stay escaped (`\``).

- [ ] **Step 5: Commit**

```bash
git add templates/partials templates/base/src/lib/skillmd.ts.hbs templates/skill.md.hbs scripts/lib/skillmd.test.mjs
git commit -m "feat(p3): skill.md renderer + shared step-0 identity partial + tests"
```

> Note: `templates/skill.md.hbs` (top-level standalone skill.md, used outside the app) renders the SAME 7-section body driving the dynamic route; for v1 the canonical output is `src/lib/skillmd.ts` (served by the route). Make `templates/skill.md.hbs` a thin reference that documents the structure; the live artifact is the rendered `skillmd.ts`.

---

## Task 7: blocks — engine / lifecycle / scorer / llm (P2 scheduled path)

**Files (create under `templates/blocks/`):** copy from `clawlake-ability-arena/` as ground truth; parameterize only where noted.

- [ ] **Step 1: Create the block files**

```
clawlake-ability-arena/src/engine/index.ts    -> templates/blocks/engine/src/engine/index.ts        (verbatim; reads ENGINE_TICK_MS)
clawlake-ability-arena/src/engine/loop.ts      -> templates/blocks/engine/src/engine/loop.ts.fill    (SKELETON; tick body is Fill — see Step 2)
clawlake-ability-arena/src/engine/scorer.ts    -> templates/blocks/scorer/src/engine/scorer.ts        (verbatim)
clawlake-ability-arena/src/engine/ranking.ts   -> templates/blocks/scorer/src/engine/ranking.ts       (verbatim)
clawlake-ability-arena/src/blocks/llm.ts       -> templates/blocks/llm/src/blocks/llm.ts              (verbatim)
```
Create a `templates/blocks/lifecycle/season/schema.partial.ts` containing the `seasons` + `season_rankings` drizzle table definitions copied verbatim from `clawlake-ability-arena/src/db/schema.ts`.

- [ ] **Step 2: Define the engine `loop.ts` skeleton**

`templates/blocks/engine/src/engine/loop.ts.fill` holds the GENERIC frame; the per-scenario tick body (judge pending + lifecycle archive) is Fill. The skeleton:
```ts
// FILL: import scenario scorer/ranking/blocks as needed.
export async function tickOnce(now: Date = new Date(), batch = 50): Promise<{ judged: number; archivedSeasons: number }> {
  // FILL: 1) judge pending submissions (per scenario scorer)
  // FILL: 2) lifecycle: archive due/closed rounds with no pending work; compute + persist rankings; publish (if identity-publish)
  return { judged: 0, archivedSeasons: 0 };
}
```
> For the P2 regen, Fill reproduces `clawlake-ability-arena/src/engine/loop.ts` (the reference is the Fill output; the C1 per-season-no-starvation logic and transactioned writes must be present — the engine/loop.test.ts oracle enforces this).

- [ ] **Step 3: Document block wiring in a manifest**

Create `templates/blocks/manifest.json` describing, per block: files to copy, schema partials to merge, package.json/docker/.env overlays (already handled by Tier-B `{{#if}}`), and Fill hooks. Example:
```json
{
  "engine":   { "when": "scheduled", "copy": ["src/engine/index.ts"], "fill": ["src/engine/loop.ts"] },
  "scorer":   { "when": "scorer", "copy": ["src/engine/scorer.ts", "src/engine/ranking.ts"] },
  "llm":      { "when": "llm", "copy": ["src/blocks/llm.ts"] },
  "lifecycle":{ "when": "lifecycle:season", "schema_partial": "lifecycle/season/schema.partial.ts" },
  "anticheat":{ "when": "anticheat", "copy": ["src/blocks/anticheat.ts"] },
  "identity-publish": { "when": "identity-publish", "render": ["src/blocks/identity-publish.ts.hbs"] },
  "economy":  { "when": "economy", "schema_partial": "economy/schema.partial.ts" }
}
```

- [ ] **Step 4: Commit**

```bash
git add templates/blocks
git commit -m "feat(p3): scheduled-path blocks (engine/lifecycle/scorer/llm) + manifest"
```

---

## Task 8: blocks — anticheat / identity-publish / economy (TDD on the parameterized one)

**Files:**
- Create: `templates/blocks/anticheat/src/blocks/anticheat.ts` (verbatim from reference)
- Create: `templates/blocks/identity-publish/src/blocks/identity-publish.ts.hbs`
- Create: `templates/blocks/economy/schema.partial.ts`
- Test: `scripts/lib/blocks.test.mjs`

- [ ] **Step 1: Copy anticheat + economy schema partial**

`clawlake-ability-arena/src/blocks/anticheat.ts` → `templates/blocks/anticheat/src/blocks/anticheat.ts` (verbatim).
`templates/blocks/economy/schema.partial.ts` = the `ledger` table definition copied verbatim from `clawlake-skillbazaar/src/db/schema.ts`.

- [ ] **Step 2: Write `templates/blocks/identity-publish/src/blocks/identity-publish.ts.hbs`**

Copy `clawlake-ability-arena/src/blocks/identity-publish.ts`, replacing the one hardcoded id:
```hbs
    const payload = { scenario_id: "{{scenario_id}}", badges: [{ label: "rank", value: `#${r.rank}` }], stats: { total_score: r.totalScore, season: seasonId } };
```
Keep the rest verbatim.

- [ ] **Step 3: Write failing test `scripts/lib/blocks.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderString } from "./render.mjs";
import { derive } from "./derive.mjs";

const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));

test("identity-publish renders scenario_id", () => {
  const tpl = readFileSync(new URL("../../templates/blocks/identity-publish/src/blocks/identity-publish.ts.hbs", import.meta.url), "utf8");
  const out = renderString(tpl, p2);
  assert.match(out, /scenario_id: "ability-arena"/);
  assert.match(out, /export async function publishRanks/);
});
```

- [ ] **Step 4: Run → fail → fix → pass**

Run: `node --test scripts/lib/blocks.test.mjs` → PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add templates/blocks scripts/lib/blocks.test.mjs
git commit -m "feat(p3): anticheat/identity-publish/economy blocks + parameterization test"
```

---

## Task 9: `new-scenario.mjs` orchestrator + `new-scenario.sh` (TDD)

**Files:**
- Create: `scripts/new-scenario.mjs`
- Create: `scripts/new-scenario.sh`
- Test: `scripts/new-scenario.test.mjs`

- [ ] **Step 1: Write `scripts/new-scenario.mjs`**

```js
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateScenario } from "./validate.mjs";
import { derive } from "./lib/derive.mjs";
import { renderTree, renderString, registerPartial } from "./lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

export function generate(scenarioPath, outDir) {
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  const { valid, errors } = validateScenario(scenario);
  if (!valid) throw new Error("scenario.json invalid:\n" + errors.join("\n"));
  const ctx = derive(scenario);

  // step-0 partial available to skillmd template
  registerPartial("step0-identity", readFileSync(join(ROOT, "templates/partials/step0-identity.hbs"), "utf8"));

  // 1) base: copy Tier-A + render Tier-B/C
  mkdirSync(outDir, { recursive: true });
  renderTree(join(ROOT, "templates/base"), outDir, ctx);

  // 2) blocks per manifest
  const manifest = JSON.parse(readFileSync(join(ROOT, "templates/blocks/manifest.json"), "utf8"));
  const fillHooks = [];
  for (const [name, spec] of Object.entries(manifest)) {
    if (!blockActive(spec.when, ctx)) continue;
    for (const rel of spec.copy ?? []) copyInto(join(ROOT, "templates/blocks", name, rel), join(outDir, rel));
    for (const rel of spec.render ?? []) { const out = rel.replace(/\.hbs$/, ""); renderInto(join(ROOT, "templates/blocks", name, rel), join(outDir, out), ctx); }
    for (const rel of spec.fill ?? []) fillHooks.push(rel);
    if (spec.schema_partial) appendSchemaPartial(join(ROOT, "templates/blocks", spec.schema_partial), outDir);
  }

  // 3) write the source scenario.json into the output as source-of-truth
  writeFileSync(join(outDir, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n");

  return { ctx, fillHooks, fillTargets: fillTargets(ctx) };
}

function blockActive(when, ctx) {
  if (when === "scheduled") return ctx.scheduled;
  if (when === "scorer") return !!ctx.scorer;
  if (when === "llm") return ctx.llm;
  if (when === "anticheat") return ctx.cross_cutting.includes("anticheat");
  if (when === "identity-publish") return ctx.cross_cutting.includes("identity-publish");
  if (when === "economy") return ctx.cross_cutting.includes("economy");
  if (when.startsWith("lifecycle:")) return ctx.state_db.lifecycle === when.split(":")[1];
  return false;
}
function copyInto(src, dest) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
function renderInto(src, dest, ctx) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, renderString(readFileSync(src, "utf8"), ctx)); }
function appendSchemaPartial(src, outDir) {
  const dest = join(outDir, "src/db/schema.ts");
  appendFileSync(dest, "\n" + readFileSync(src, "utf8").replace(/^import .*$/gm, "").trimStart() + "\n");
}
function fillTargets(ctx) {
  const t = ["src/db/schema.ts (domain table columns)", "domain API route bodies", "src/db/seed.ts", "src/app/page.tsx + section pages", "src/lib/skillmd.ts (rules prose + quickstart)"];
  if (ctx.scheduled) t.push("src/engine/loop.ts (tick body)");
  return t;
}

// CLI
if (process.argv[1] && process.argv[1].endsWith("new-scenario.mjs")) {
  const scenarioPath = process.argv[2];
  const outIdx = process.argv.indexOf("--out");
  const outDir = outIdx > -1 ? process.argv[outIdx + 1] : join(ROOT, `clawlake-${JSON.parse(readFileSync(scenarioPath, "utf8")).scenario_id}`);
  const r = generate(scenarioPath, outDir);
  console.log(`scaffolded → ${outDir}`);
  console.log("NEXT — Claude Fill these (under scenario.json contract):");
  for (const t of [...r.fillTargets, ...r.fillHooks]) console.log("  - " + t);
}
```

> **Annotated judgment — schema partial import dedup:** `appendSchemaPartial` strips `import` lines from partials and relies on the base `schema.ts` already importing the needed drizzle column helpers. The base `schema.ts` is itself Fill-seeded with `agents` + the full pg-core import (see Task 10 Step 1). If a partial needs a helper not imported, Fill adds it. Keep the base schema import line a superset (`uuid, text, integer, timestamp, jsonb, unique`).

- [ ] **Step 2: Write `scripts/new-scenario.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec node "$HERE/new-scenario.mjs" "$@"
```
Then `chmod +x scripts/new-scenario.sh`.

- [ ] **Step 3: Write failing test `scripts/new-scenario.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./new-scenario.mjs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function gen(name) { const out = join(ROOT, ".tmp-gen", name); rmSync(out, { recursive: true, force: true }); generate(join(ROOT, "examples", `${name}.scenario.json`), out); return out; }

test("P1 scaffold: base files, NO engine, ledger schema appended", () => {
  const out = gen("skillbazaar");
  assert.ok(existsSync(join(out, "src/lib/http.ts")));
  assert.ok(existsSync(join(out, "src/app/.well-known/agent.json/route.ts")));
  assert.ok(!existsSync(join(out, "src/engine/index.ts")));
  assert.ok(!existsSync(join(out, "src/blocks/llm.ts")));
  assert.match(readFileSync(join(out, "src/db/schema.ts"), "utf8"), /ledger/);
  assert.doesNotMatch(readFileSync(join(out, "package.json"), "utf8"), /engine:start/);
});

test("P2 scaffold: engine + scorer + llm + identity-publish, season schema", () => {
  const out = gen("ability-arena");
  assert.ok(existsSync(join(out, "src/engine/index.ts")));
  assert.ok(existsSync(join(out, "src/engine/scorer.ts")));
  assert.ok(existsSync(join(out, "src/blocks/llm.ts")));
  assert.match(readFileSync(join(out, "src/blocks/identity-publish.ts"), "utf8"), /scenario_id: "ability-arena"/);
  assert.match(readFileSync(join(out, "src/db/schema.ts"), "utf8"), /season_rankings/);
  assert.match(readFileSync(join(out, "package.json"), "utf8"), /engine:start/);
});

import { dirname } from "node:path";
```

- [ ] **Step 4: Run → fail → fix → pass**

Run: `node --test scripts/new-scenario.test.mjs`
Expected after fixes: PASS (2 tests). This requires Task 10's base `schema.ts.hbs` to exist (agents table seed). If it doesn't yet, do Task 10 Step 1 first, then return.

- [ ] **Step 5: Commit**

```bash
git add scripts/new-scenario.mjs scripts/new-scenario.sh scripts/new-scenario.test.mjs
git commit -m "feat(p3): new-scenario orchestrator (base+blocks+schema merge) + scaffold tests"
```

---

## Task 10: base `schema.ts.hbs` seed + Fill protection markers

**Files:**
- Create: `templates/base/src/db/schema.ts.hbs`

- [ ] **Step 1: Write `templates/base/src/db/schema.ts.hbs` (agents + Fill region)**

```hbs
import { pgTable, uuid, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// === FILL:domain BEGIN (Claude defines domain tables: {{#each state_db.domain_tables}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}) ===
// === FILL:domain END ===
```
> Lifecycle + economy schema partials are appended AFTER this file by the orchestrator (Task 9 `appendSchemaPartial`). Fill writes domain tables between the markers. The markers are the "protected region" contract — re-running scaffold must not clobber content the engineer/Claude wrote (v1: orchestrator only writes on a fresh out dir; re-gen safety is a documented constraint, full merge deferred).

- [ ] **Step 2: Re-run Task 9 tests**

Run: `node --test scripts/new-scenario.test.mjs` → PASS (now schema.ts exists; ledger/season_rankings appended).

- [ ] **Step 3: Run the full renderer suite**

Run: `npm test` (root) → all `scripts/**/*.test.mjs` PASS.

- [ ] **Step 4: Commit**

```bash
git add templates/base/src/db/schema.ts.hbs
git commit -m "feat(p3): base schema.ts (agents + Fill-domain markers)"
```

---

## Task 11: End-to-end regenerate P1 (reactive) — acceptance oracle

**Files:** generate into `.tmp-gen/skillbazaar/`, then Fill domain, then run P1's test suite copied in as oracle.

- [ ] **Step 1: Scaffold P1**

Run:
```bash
node scripts/new-scenario.mjs examples/skillbazaar.scenario.json --out .tmp-gen/skillbazaar
```
Expected: prints `scaffolded → .tmp-gen/skillbazaar` + Fill list.

- [ ] **Step 2: Fill the domain (Claude, guided by scenario.json + reference)**

Using `clawlake-skillbazaar/` as the reference Fill output, write into `.tmp-gen/skillbazaar/`:
- `src/db/schema.ts` domain tables (`skills`, `reviews`) between the FILL markers (copy column defs from reference).
- domain routes: `src/app/api/skills/route.ts`, `src/app/api/skills/[slug]/route.ts`, `.../install/route.ts`, `.../reviews/route.ts`, `src/app/api/leaderboard/route.ts` (copy from reference).
- economy earn logic (+10 review points via `ledger`) lives in the reviews route (copy from reference).
- `src/db/seed.ts` if reference has one (P1 may not seed; check).
- UI: `src/app/page.tsx`, `src/app/skills/[slug]/page.tsx`, `src/app/agents/[username]/page.tsx` (copy from reference).
- `src/lib/skillmd.ts`: replace FILL placeholders with the reference's rules prose + quickstart.

> **Honesty note:** for regression of a KNOWN scenario the Fill output equals the reference domain code — that is expected and correct. P3 proves base+blocks+renderer compose into a working app; generating NOVEL domains is validated by T1/new scenarios (out of P3 scope).

- [ ] **Step 3: Bring in the oracle test suite**

Copy `clawlake-skillbazaar/tests/` → `.tmp-gen/skillbazaar/tests/` EXCEPT `tests/helpers/db.ts` (the rendered one is authoritative) and `tests/helpers/client.ts` (already in base). Then copy `clawlake-skillbazaar/drizzle.config.ts` equivalence is already rendered.

- [ ] **Step 4: Install, push schema, run typecheck/build/test**

Run:
```bash
cd .tmp-gen/skillbazaar && npm install
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm run db:push
npm run typecheck && npm run build
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test
```
Expected: typecheck/build clean; all P1 tests (incl. e2e smoke) PASS. Postgres@5432 must be up with db `skillbazaar` (see handoff env). If down, `docker compose up -d postgres` in the reference dir first, OR run the generated `docker compose up -d postgres`.

- [ ] **Step 5: If green, commit the generated artifact as a fixture; if not green after 3 Fill attempts, STOP**

```bash
cd /Users/anfernee/projects/scenario-builder-skill
git add .tmp-gen/skillbazaar  # or move under examples/generated/ — see Task 13
git commit -m "test(p3): regenerated P1 passes its full suite (reactive path verified)"
```
On failure: record the failing test + reason in the commit/HANDOFF; do NOT fake green.

---

## Task 12: End-to-end regenerate P2 (scheduled) — acceptance oracle

Same shape as Task 11, for P2.

- [ ] **Step 1: Scaffold P2**

Run: `node scripts/new-scenario.mjs examples/ability-arena.scenario.json --out .tmp-gen/ability-arena`

- [ ] **Step 2: Fill the domain + engine tick (Claude, guided by reference)**

Into `.tmp-gen/ability-arena/`, using `clawlake-ability-arena/` as reference:
- `src/db/schema.ts` domain tables (`questions`, `submissions`, `scores`) between FILL markers.
- domain routes: `src/app/api/seasons/current/route.ts`, `src/app/api/seasons/[id]/submit/route.ts` (with the `no_subagent` check + `rateLimit` from anticheat block), `src/app/api/submissions/me/route.ts`, `src/app/api/leaderboard/route.ts`.
- `src/engine/loop.ts` tick body: judge pending via `scorer` + season archive (the C1 per-season-no-starvation logic + transactioned writes + `publishRanks`) — copy from reference.
- `src/db/seed.ts`: render `question_bank` into `seedSeason` (copy reference shape; the 3 questions come from scenario.json).
- `tests/helpers/seed.ts`: copy from reference (oracle dependency).
- UI: `src/app/page.tsx`, `src/app/seasons/[slug]/page.tsx`, `src/app/agents/[username]/page.tsx`.
- `src/lib/skillmd.ts`: fill rules/scoring/anticheat prose + quickstart from reference.

- [ ] **Step 3: Bring in the oracle test suite**

Copy `clawlake-ability-arena/tests/` → `.tmp-gen/ability-arena/tests/` EXCEPT `tests/helpers/db.ts` (rendered) and `tests/helpers/client.ts` (base). Keep `tests/engine/*`, `tests/api/*`, `tests/e2e/*`, `tests/unit/llm.test.ts`, `tests/helpers/seed.ts`.

- [ ] **Step 4: Install, push schema, run typecheck/build/test (LLM_MOCK)**

Run:
```bash
cd .tmp-gen/ability-arena && npm install
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena npm run db:push
npm run typecheck && npm run build
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena LLM_MOCK=1 npm test
```
Expected: clean typecheck/build; all P2 tests (api/engine/e2e/unit, incl. C1 regression + scorer cache + ranking) PASS. Postgres@5433/db `abilityarena` must be up.

- [ ] **Step 5: Commit or STOP (same rule as Task 11 Step 5)**

```bash
git commit -m "test(p3): regenerated P2 passes its full suite (scheduled path verified)"
```

---

## Task 13: SKILL.md + references/ + verify.sh + cleanup

**Files:**
- Create: `SKILL.md`, `references/*.md`, `scripts/verify.sh`
- Decide fate of `.tmp-gen/` fixtures

- [ ] **Step 1: Write `scripts/verify.sh`**

Template of the reference verify.sh, parameterized by reading the generated `scenario.json` (db_name, host_port, scheduled). It: `docker compose up -d --build` in the target dir → wait postgres → `npm run db:push` → wait `/api/health` → curl `/skill/<id>` + `/.well-known/agent.json` → (if scheduled) check engine logs + `docker compose stop engine` → `npm test`. Base it on `clawlake-ability-arena/scripts/verify.sh` (the superset that handles engine), gating the engine lines on `scheduled`.

- [ ] **Step 2: Write `SKILL.md`**

Frontmatter (`name: scenario-builder`, `description: …when building a new ClawLake agent-first scenario…`) + the 5-phase flow (Conceive→Brief→Scaffold→Fill→Verify) from spec §8, pointing at `references/*`, `schema/scenario.schema.json`, `scripts/new-scenario.sh`, and the Fill checklist the orchestrator prints. Include the two gates (Brief approval, Verify) and the "never ship false-green" rule.

- [ ] **Step 3: Write `references/*.md`**

- `common-patterns.md` — the 7 commonalities (from spec/main doc §2), no source-product names.
- `archetypes.md` — Consume + Evaluate nine-cell defaults (cadence/scorer/cross-cutting/example category), other archetypes as designed-not-implemented placeholders.
- `building-blocks.md` — the §6 wiring table (block → trigger → files → wiring).
- `identity-protocol.md` — §6.1 central-service contract + stub mode.
- `scenario-schema.md` — field dictionary (spec §4.1) + link to `schema/scenario.schema.json`.
- `scenario-brief.template.md` — human-readable brief template (the prose companion to scenario.json).
- `verification.md` — T0 checklist (spec §9 / main §7.1) + error-handling rules.

- [ ] **Step 4: Decide `.tmp-gen/` fate**

Move passing fixtures to `examples/generated/{skillbazaar,ability-arena}/` WITHOUT `node_modules`/`.next` (add those to `.gitignore`), OR delete `.tmp-gen/` and rely on the regen procedure being re-runnable (document the commands in `verification.md`). Recommended: delete generated app trees from git (they're reproducible); keep only the `examples/*.scenario.json` inputs + the documented regen commands. Annotate the choice in the commit.

- [ ] **Step 5: Run full generator suite once more**

Run: `npm test` (root) → all PASS.

- [ ] **Step 6: Commit**

```bash
git add SKILL.md references scripts/verify.sh .gitignore
git commit -m "docs(p3): SKILL.md 5-phase entry + references + verify.sh"
```

---

## Task 14: Final review + merge

- [ ] **Step 1: Self-review diff vs spec coverage** — every spec §3 deliverable exists; every §4.1 field is in schema + examples; every §6 block has a template + manifest entry + wiring; acceptance §2 both green.

- [ ] **Step 2: Dispatch opus code review** (requesting-code-review skill) over the full `p3-scenario-builder` diff. Address blocking findings.

- [ ] **Step 3: Update `docs/superpowers/P3-HANDOFF.md`** to DONE (or DONE_WITH_CONCERNS + leftover list).

- [ ] **Step 4: Merge to main**

```bash
git checkout main && git merge --no-ff p3-scenario-builder -m "feat(p3): scenario-builder skill — regenerates P1+P2 from scenario.json"
```

- [ ] **Step 5: Update memory** — mark P3 DONE in `clawlake-project.md`.

---

## Self-Review (run by plan author)

- **Spec coverage:** §3 deliverables → Tasks 1,4,5,6,7,8,9,13 (templates/schema/scripts/SKILL/references); §4.1 fields → Task 1 schema + Task 3 derive; §5 tiers → Tasks 4 (A), 5 (B), 6 (C), 10 (Fill markers); §6 blocks → Tasks 7,8 + manifest; §7 mechanism → Task 9; §8 phases → Task 13 SKILL.md; §9 reliability → carried by blocks/base copies + "never false-green" in Tasks 11/12; §2 acceptance → Tasks 11,12. No gaps.
- **Placeholders:** Fill markers in templates are intentional contract, not plan placeholders; every NEW code step has full code; literal copies name a concrete in-repo source file. OK.
- **Type consistency:** `derive()` output keys (`project_name, db_name, scheduled, llm, blocks, truncate_tables, host_port`) are the exact names used in templates and `new-scenario.mjs`; `generate()`/`renderTree`/`renderString`/`registerPartial`/`validateScenario` signatures consistent across Tasks 2,3,5,9. `tickOnce` signature matches reference. OK.
- **Ordering caveat:** Task 9 Step 4 depends on Task 10 Step 1 (base schema.ts.hbs). Flagged inline; do Task 10 Step 1 before Task 9 Step 4 if executing strictly in order.
