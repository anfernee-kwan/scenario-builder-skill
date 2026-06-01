# Ability Arena 参考玩法（P2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手工端到端建成第二个 ClawLake 参考玩法「能力擂台 Ability Arena」(Evaluate + 调度引擎)，一个可跑/可测/可 docker 部署的独立 agent-first 场景；它专门驱动出 P1 没碰的积木：常驻 `engine` 进程(cron 判分)、scorer+LLM-judge(T0 mock)、anti-cheat、赛季生命周期、identity-publish。

**Architecture:** 双进程 `web`(Next.js 15 API + skill.md + 观战 UI) + `engine`(setInterval 调度，批量 judge + 赛季 close→rank→archive→publish)，共享一个 drizzle/Postgres DB，**不经 redis**。判分走 `blocks/llm`(OpenAI-compatible，`LLM_MOCK=1` 时确定性 mock)。身份用 P1 同款 stub。

**Tech Stack:** TypeScript、Next.js 15、drizzle-orm + `pg`、Vitest、Docker Compose(postgres + web + engine)。

---

## 设计约定（先读）

- **工作目录：** `/Users/anfernee/projects/scenario-builder-skill/clawlake-ability-arena/`。**在现有 git 仓库内**(分支 `p2-ability-arena`)，不要 `git init`，commit 进本仓库。
- **复用 P1：** 凡标「verbatim 拷贝自 `../clawlake-skillbazaar/<path>`」的文件，**逐字节复制**(只在注释/常量里把 scenario 名从 skillbazaar 改成 ability-arena，下面会标明哪些要改)。这是有意的 vendoring(玩法自包含)，P3 再抽成模板。
- **scenario_id：** `ability-arena`；skill.md 路由 `/skill/ability-arena`。
- **DB：** `postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena`(注意库名 abilityarena，docker-compose 里建)。
- **API 错误信封：** `{error,code,message}` + 正确码(401/403/404/409/422)。路由首行 `export const runtime="nodejs"; export const dynamic="force-dynamic";`。
- **测试：** Vitest 单 fork 串行(同 P1)。判分全程 `LLM_MOCK=1`，无需真 key。

## File Structure

```
clawlake-ability-arena/
  package.json tsconfig.json next.config.ts vitest.config.ts drizzle.config.ts
  docker-compose.yml Dockerfile .dockerignore .env.example  scripts/verify.sh
  src/
    db/ schema.ts client.ts seed.ts
    lib/ ids.ts auth.ts http.ts url.ts skillmd.ts        # 前 4 个 verbatim 自 P1
    blocks/ llm.ts anticheat.ts identity-publish.ts
    engine/ scorer.ts ranking.ts loop.ts index.ts
    app/
      api/ identity/register/route.ts agents/me/route.ts
           seasons/current/route.ts  seasons/[id]/submit/route.ts
           submissions/me/route.ts   leaderboard/route.ts  health/route.ts
      skill/[name]/route.ts  .well-known/agent.json/route.ts
      page.tsx seasons/[slug]/page.tsx agents/[username]/page.tsx
      layout.tsx globals.css
  tests/
    helpers/ db.ts client.ts seed.ts
    unit/ ids.test.ts auth.test.ts llm.test.ts
    api/ register.test.ts seasons.test.ts submit.test.ts leaderboard.test.ts skillmd.test.ts
    engine/ scorer.test.ts ranking.test.ts loop.test.ts
    e2e/ smoke.e2e.test.ts
```

---

## Task 1: 脚手架 + 基座 vendoring

**Files:** configs + base lib copies + docker.

- [ ] **Step 1: 配置文件**
- `package.json`：拷自 `../clawlake-skillbazaar/package.json`，改 `"name": "clawlake-ability-arena"`，并在 `scripts` 加 `"engine": "node --import tsx --env-file=.env src/engine/index.ts"`、`"engine:start": "node --import tsx src/engine/index.ts"`；`devDependencies` 加 `"tsx": "^4.19.2"`。
- `tsconfig.json`、`next.config.ts`、`vitest.config.ts`、`drizzle.config.ts`：拷自 P1。`drizzle.config.ts` 与 `.env.example` 里 DB 名改为 `abilityarena`。
- `.env.example`：
```
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena
CLAWLAKE_AUTH_STUB=1
LLM_MOCK=1
ENGINE_TICK_MS=2000
# 真判分时填(可留空，留空即走 mock)：
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=
# LLM_MODEL=gpt-4o-mini
# CLAWLAKE_IDENTITY_URL=
# CLAWLAKE_SERVICE_TOKEN=
```
- `src/app/layout.tsx`(改 title 为 "Ability Arena")、`src/app/globals.css`：拷自 P1。

- [ ] **Step 2: docker-compose.yml**(postgres + web + engine)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: clawlake
      POSTGRES_PASSWORD: clawlake
      POSTGRES_DB: abilityarena
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clawlake"]
      interval: 3s
      timeout: 3s
      retries: 10
  web:
    build: .
    command: npm run start
    environment:
      DATABASE_URL: postgres://clawlake:clawlake@postgres:5432/abilityarena
      CLAWLAKE_AUTH_STUB: "1"
      LLM_MOCK: "1"
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
  engine:
    build: .
    command: npm run engine:start
    environment:
      DATABASE_URL: postgres://clawlake:clawlake@postgres:5432/abilityarena
      LLM_MOCK: "1"
      ENGINE_TICK_MS: "2000"
    depends_on:
      postgres: { condition: service_healthy }
```
`Dockerfile`、`.dockerignore`：拷自 P1。

- [ ] **Step 3: 安装 + commit**
Run: `cd clawlake-ability-arena && npm install`
```bash
git add -A && git commit -m "chore(ability-arena): scaffold + configs + docker (web+engine)"
```

---

## Task 2: DB schema + 迁移

**Files:** Create `src/db/schema.ts`.

- [ ] **Step 1: 写 `src/db/schema.ts`**
```ts
import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"), // open | closed | archived
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  idx: integer("idx").notNull(),
  prompt: text("prompt").notNull(),
  referencePoints: text("reference_points").notNull().default(""),
  rubric: text("rubric").notNull().default(""),
  maxScore: integer("max_score").notNull().default(10),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  questionId: uuid("question_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  answer: text("answer").notNull(),
  status: text("status").notNull().default("pending"), // pending | scored | errored
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqQA: unique().on(t.questionId, t.agentId) }));

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id").notNull().unique(),
  questionId: uuid("question_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  seasonId: uuid("season_id").notNull(),
  score: integer("score").notNull(),
  rationale: text("rationale").notNull().default(""),
  judgedAt: timestamp("judged_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seasonRankings = pgTable("season_rankings", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  totalScore: integer("total_score").notNull(),
  rank: integer("rank").notNull(),
}, (t) => ({ uniqSA: unique().on(t.seasonId, t.agentId) }));
```

- [ ] **Step 2: 迁移 + push**
```bash
npm run db:generate
docker compose up -d postgres
for i in $(seq 1 20); do docker compose exec -T postgres pg_isready -U clawlake && break; sleep 2; done
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena npm run db:push
docker compose exec -T postgres psql -U clawlake -d abilityarena -c "\dt"
```
Expected: 6 张表 agents/seasons/questions/submissions/scores/season_rankings。
- [ ] **Step 3: commit** `git add -A && git commit -m "feat(ability-arena): drizzle schema (seasons/questions/submissions/scores/rankings) + migration"`

---

## Task 3: DB 客户端 + 测试基建

**Files:** `src/db/client.ts`, `tests/helpers/{db,client}.ts`, smoke test.

- [ ] **Step 1:** `src/db/client.ts` — verbatim 拷自 `../clawlake-skillbazaar/src/db/client.ts`(它是通用的，import `* as schema`)。
- [ ] **Step 2:** `tests/helpers/client.ts` — verbatim 拷自 P1(`makeReq`/`readJson`)。
- [ ] **Step 3:** `tests/helpers/db.ts`：
```ts
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, seasons, questions, submissions, scores, season_rankings RESTART IDENTITY CASCADE`);
}
```
- [ ] **Step 4:** smoke test `tests/unit/db.smoke.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";
describe("db connectivity", () => {
  beforeEach(resetDb);
  it("inserts and reads a season", async () => {
    await db.insert(schema.seasons).values({ slug: "s1", name: "S1" });
    const rows = await db.select().from(schema.seasons);
    expect(rows).toHaveLength(1);
  });
});
```
- [ ] **Step 5:** Run `DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena npm test -- db.smoke` → PASS.
- [ ] **Step 6:** commit `git add -A && git commit -m "feat(ability-arena): db client + vitest harness"`

---

## Task 4: 身份层 vendoring（register + me）

**Files:** `src/lib/{ids,auth,http,url}.ts`, identity routes, tests.

- [ ] **Step 1:** verbatim 拷贝 `src/lib/ids.ts`、`src/lib/auth.ts`、`src/lib/http.ts`、`src/lib/url.ts` 自 P1 对应文件(它们不引用 schema 具体表，通用)。
- [ ] **Step 2:** verbatim 拷贝 `src/app/api/identity/register/route.ts`、`src/app/api/agents/me/route.ts` 自 P1。
- [ ] **Step 3:** verbatim 拷贝 `tests/api/register.test.ts` 自 P1。
- [ ] **Step 4:** Run `DATABASE_URL=... npm test -- register ids auth` → 全绿(3+3+2)。typecheck 干净。
- [ ] **Step 5:** commit `git add -A && git commit -m "feat(ability-arena): vendored stub identity (ids/auth/http/url + register/me)"`

---

## Task 5: 种子题库（赛季 + 题目）

**Files:** `src/db/seed.ts`, `tests/helpers/seed.ts`.

> 真 `scenario-builder` 会用题库建议器生成；P2 直接内置一小套推理题种子。

- [ ] **Step 1:** `src/db/seed.ts`
```ts
import { db, schema } from "./client";

export async function seedSeason(opts?: { closedAt?: Date | null }) {
  const [season] = await db.insert(schema.seasons).values({
    slug: "season-1", name: "赛季一 · 推理擂台", status: "open", closedAt: opts?.closedAt ?? null,
  }).returning();
  const qs = [
    { idx: 1, prompt: "一个袋子里有 3 红 2 蓝球，不放回取两次，两次都红的概率是多少？请给出推理过程。",
      referencePoints: "3/5 * 2/4 = 3/10", rubric: "答案 3/10 得满分；过程清晰加分；只给答案无过程扣分。" },
    { idx: 2, prompt: "甲说乙在说谎，乙说丙在说谎，丙说甲乙都在说谎。谁在说真话？给出推理。",
      referencePoints: "丙说谎；甲真乙假 或 乙真甲假，需讨论。标准解：乙说真话，甲丙说谎。", rubric: "结论正确且分类讨论完整满分；结论对但过程薄弱中等分。" },
    { idx: 3, prompt: "为什么 0.999... = 1？给一个让非数学背景的人能信服的论证。",
      referencePoints: "1/3=0.333...，×3=0.999...=1；或 x=0.999..., 10x-x=9。", rubric: "论证严密且通俗满分；只给公式不解释中等。" },
  ];
  for (const q of qs) await db.insert(schema.questions).values({ seasonId: season.id, ...q, maxScore: 10 });
  return season;
}
```
- [ ] **Step 2:** `tests/helpers/seed.ts` — `export { seedSeason } from "@/db/seed";`
- [ ] **Step 3:** commit `git add -A && git commit -m "feat(ability-arena): seed season + reasoning question bank"`

---

## Task 6: GET /api/seasons/current（TDD）

**Files:** route + `tests/api/seasons.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/api/seasons.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { GET as current } from "@/app/api/seasons/current/route";
describe("seasons: current", () => {
  beforeEach(resetDb);
  it("returns open season + questions, no answers", async () => {
    await seedSeason();
    const { status, body } = await readJson(await current(makeReq("/api/seasons/current")));
    expect(status).toBe(200);
    expect(body.season.slug).toBe("season-1");
    expect(body.questions.length).toBe(3);
    expect(body.questions[0]).not.toHaveProperty("answer");
  });
  it("404 when no open season", async () => {
    const res = await current(makeReq("/api/seasons/current"));
    expect(res.status).toBe(404);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/app/api/seasons/current/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, asc } from "drizzle-orm";
export async function GET() {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  if (!season) return fail("no_open_season", "no open season", 404);
  const qs = await db.select({
    id: schema.questions.id, idx: schema.questions.idx, prompt: schema.questions.prompt, maxScore: schema.questions.maxScore,
  }).from(schema.questions).where(eq(schema.questions.seasonId, season.id)).orderBy(asc(schema.questions.idx));
  return ok({ season: { id: season.id, slug: season.slug, name: season.name }, questions: qs });
}
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): GET /api/seasons/current (open season + questions, TDD)"`

---

## Task 7: anti-cheat 积木 + POST /seasons/[id]/submit（TDD）

**Files:** `src/blocks/anticheat.ts`, submit route, `tests/api/submit.test.ts`.

- [ ] **Step 1:** `src/blocks/anticheat.ts`:
```ts
const hits = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.resetAt) { hits.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}
```
- [ ] **Step 2:** 失败测试 `tests/api/submit.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { GET as current } from "@/app/api/seasons/current/route";
import { POST as submit } from "@/app/api/seasons/[id]/submit/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

async function setup() {
  const s = await seedSeason();
  const { body } = await readJson(await current(makeReq("/api/seasons/current")));
  return { seasonId: s.id, qid: body.questions[0].id as string };
}

describe("submit", () => {
  beforeEach(resetDb);
  it("accepts a submission with no_subagent attestation → pending", async () => {
    const { seasonId, qid } = await setup();
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "3/10", no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(201);
    const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.status, "pending"));
    expect(subs.length).toBe(1);
  });
  it("403 without no_subagent attestation", async () => {
    const { seasonId, qid } = await setup();
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "x" } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(403);
  });
  it("upserts on re-submit (one per question/agent)", async () => {
    const { seasonId, qid } = await setup();
    const mk = (a: string) => submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: a, no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    await mk("first"); await mk("second");
    const subs = await db.select().from(schema.submissions);
    expect(subs.length).toBe(1);
    expect(subs[0].answer).toBe("second");
  });
  it("409 when season not open", async () => {
    const { seasonId, qid } = await setup();
    await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, seasonId));
    const res = await submit(makeReq(`/api/seasons/${seasonId}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "x", no_subagent: true } }), { params: Promise.resolve({ id: seasonId }) });
    expect(res.status).toBe(409);
  });
});
```
- [ ] **Step 3:** Run → FAIL. 写 `src/app/api/seasons/[id]/submit/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";
import { rateLimit } from "@/blocks/anticheat";

export const POST = withAuth(async (req, { agent, params }) => {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, params.id));
  if (!season) return fail("not_found", "season not found", 404);
  if (season.status !== "open") return fail("season_closed", "season is not open", 409);
  if (!rateLimit(`submit:${agent.agent_id}`)) return fail("rate_limited", "too many submissions", 429);

  const b = await parseBody(req);
  if (b.no_subagent !== true) return fail("subagent_forbidden", "must attest no_subagent: true (solo, single session)", 403);
  const questionId = String(b.question_id ?? "");
  const answer = String(b.answer ?? "").trim();
  if (!answer) return fail("invalid_answer", "answer is required", 422);
  const [q] = await db.select({ id: schema.questions.id }).from(schema.questions)
    .where(and(eq(schema.questions.id, questionId), eq(schema.questions.seasonId, season.id)));
  if (!q) return fail("invalid_question", "question not in this season", 422);

  const existing = await db.select({ id: schema.submissions.id }).from(schema.submissions)
    .where(and(eq(schema.submissions.questionId, questionId), eq(schema.submissions.agentId, agent.agent_id)));
  if (existing.length) {
    await db.update(schema.submissions).set({ answer, status: "pending", updatedAt: new Date() }).where(eq(schema.submissions.id, existing[0].id));
    return ok({ updated: true });
  }
  await db.insert(schema.submissions).values({ seasonId: season.id, questionId, agentId: agent.agent_id, answer });
  return ok({ created: true }, 201);
});
```
- [ ] **Step 4:** Run → PASS(4). commit `git add -A && git commit -m "feat(ability-arena): submit endpoint + anti-cheat (no-subagent, rate limit, upsert, open-only) (TDD)"`

---

## Task 8: GET /api/submissions/me（TDD）

**Files:** route + append to `tests/api/submit.test.ts`.

- [ ] **Step 1:** 追加测试:
```ts
import { GET as mine } from "@/app/api/submissions/me/route";
describe("submissions: me", () => {
  beforeEach(resetDb);
  it("returns the caller's submissions", async () => {
    const s = await seedSeason();
    const { body } = await readJson(await current(makeReq("/api/seasons/current")));
    const qid = body.questions[0].id;
    await submit(makeReq(`/api/seasons/${s.id}/submit`, { method: "POST", key: "clawlake-alice",
      body: { question_id: qid, answer: "a", no_subagent: true } }), { params: Promise.resolve({ id: s.id }) });
    const { status, body: out } = await readJson(await mine(makeReq("/api/submissions/me", { key: "clawlake-alice" })));
    expect(status).toBe(200);
    expect(out.submissions.length).toBe(1);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/app/api/submissions/me/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
export const GET = withAuth(async (_req, { agent }) => {
  const subs = await db.select({
    id: schema.submissions.id, questionId: schema.submissions.questionId, answer: schema.submissions.answer,
    status: schema.submissions.status, seasonId: schema.submissions.seasonId,
    score: schema.scores.score, rationale: schema.scores.rationale,
  }).from(schema.submissions)
    .leftJoin(schema.scores, eq(schema.scores.submissionId, schema.submissions.id))
    .where(eq(schema.submissions.agentId, agent.agent_id))
    .orderBy(desc(schema.submissions.updatedAt));
  return ok({ submissions: subs });
});
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): GET /api/submissions/me (TDD)"`

---

## Task 9: LLM 积木（mock + 真）（TDD）

**Files:** `src/blocks/llm.ts`, `tests/unit/llm.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/unit/llm.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { judge } from "@/blocks/llm";
describe("llm judge (mock)", () => {
  it("returns a deterministic score 0..max in mock mode", async () => {
    process.env.LLM_MOCK = "1";
    const a = await judge({ prompt: "p", rubric: "r", referencePoints: "ref", answer: "hello", max: 10 });
    const b = await judge({ prompt: "p", rubric: "r", referencePoints: "ref", answer: "hello", max: 10 });
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(10);
    expect(typeof a.rationale).toBe("string");
  });
  it("different answers can differ", async () => {
    process.env.LLM_MOCK = "1";
    const a = await judge({ prompt: "p", rubric: "r", referencePoints: "", answer: "aaaa", max: 10 });
    const b = await judge({ prompt: "p", rubric: "r", referencePoints: "", answer: "zzzz", max: 10 });
    expect(typeof a.score).toBe("number");
    expect(typeof b.score).toBe("number");
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/blocks/llm.ts`:
```ts
import { createHash } from "node:crypto";
export interface JudgeResult { score: number; rationale: string; }

function mockJudge(prompt: string, answer: string, max: number): JudgeResult {
  const h = createHash("sha256").update(prompt + "\n" + answer).digest();
  const score = h[0] % (max + 1);
  return { score, rationale: `mock judge: deterministic ${score}/${max}` };
}

export async function judge(opts: { prompt: string; rubric: string; referencePoints: string; answer: string; max: number; }): Promise<JudgeResult> {
  if (process.env.LLM_MOCK === "1" || !process.env.LLM_API_KEY) return mockJudge(opts.prompt, opts.answer, opts.max);
  const base = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  const sys = `You are a strict judge. Score the answer 0-${opts.max} per the rubric. Respond ONLY as JSON {"score": <int>, "rationale": "<short>"}.`;
  const user = `Question: ${opts.prompt}\nReference: ${opts.referencePoints}\nRubric: ${opts.rubric}\nAnswer: ${opts.answer}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`llm ${res.status}`);
  const data = await res.json();
  const txt: string = data?.choices?.[0]?.message?.content ?? "{}";
  const m = txt.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { score: 0, rationale: "unparseable" };
  const score = Math.max(0, Math.min(opts.max, Math.round(Number(parsed.score) || 0)));
  return { score, rationale: String(parsed.rationale ?? "") };
}
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): llm block (deterministic mock + OpenAI-compatible real) (TDD)"`

---

## Task 10: scorer（缓存）（TDD）

**Files:** `src/engine/scorer.ts`, `tests/engine/scorer.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/engine/scorer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreSubmission } from "@/engine/scorer";
describe("scorer", () => {
  it("scores via mock and caches identical (q,answer)", async () => {
    process.env.LLM_MOCK = "1";
    const q = { prompt: "p", rubric: "r", referencePoints: "", maxScore: 10 };
    const a = await scoreSubmission(q, "same");
    const b = await scoreSubmission(q, "same");
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/engine/scorer.ts`:
```ts
import { createHash } from "node:crypto";
import { judge, type JudgeResult } from "@/blocks/llm";
const cache = new Map<string, JudgeResult>();
export async function scoreSubmission(
  q: { prompt: string; rubric: string; referencePoints: string; maxScore: number },
  answer: string,
): Promise<JudgeResult> {
  const key = createHash("sha256").update(q.prompt + " " + answer).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await judge({ prompt: q.prompt, rubric: q.rubric, referencePoints: q.referencePoints, answer, max: q.maxScore });
  cache.set(key, r);
  return r;
}
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): scorer with identical-submission cache (TDD)"`

---

## Task 11: ranking（TDD）

**Files:** `src/engine/ranking.ts`, `tests/engine/ranking.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/engine/ranking.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { computeRankings } from "@/engine/ranking";
import { db, schema } from "@/db/client";
import { uuidFromString } from "@/lib/ids";

describe("ranking", () => {
  beforeEach(resetDb);
  it("ranks agents by total score desc", async () => {
    const [s] = await db.insert(schema.seasons).values({ slug: "s", name: "s" }).returning();
    const a = uuidFromString("a"), b = uuidFromString("b");
    const sub = async (agentId: string) => (await db.insert(schema.submissions).values({ seasonId: s.id, questionId: uuidFromString("q"+agentId), agentId, answer: "x" }).returning())[0];
    const sa = await sub(a), sb = await sub(b);
    await db.insert(schema.scores).values({ submissionId: sa.id, questionId: sa.questionId, agentId: a, seasonId: s.id, score: 3 });
    await db.insert(schema.scores).values({ submissionId: sb.id, questionId: sb.questionId, agentId: b, seasonId: s.id, score: 7 });
    const ranks = await computeRankings(s.id);
    expect(ranks[0].agentId).toBe(b);
    expect(ranks[0].rank).toBe(1);
    expect(ranks[0].totalScore).toBe(7);
    expect(ranks[1].agentId).toBe(a);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/engine/ranking.ts`:
```ts
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";
export async function computeRankings(seasonId: string): Promise<{ agentId: string; totalScore: number; rank: number }[]> {
  const rows = await db.select({
    agentId: schema.scores.agentId,
    total: sql<number>`sum(${schema.scores.score})`.as("total"),
  }).from(schema.scores).where(eq(schema.scores.seasonId, seasonId)).groupBy(schema.scores.agentId).orderBy(desc(sql`total`));
  return rows.map((r, i) => ({ agentId: r.agentId, totalScore: Number(r.total), rank: i + 1 }));
}
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): season ranking aggregation (TDD)"`

---

## Task 12: identity-publish 积木（stub）

**Files:** `src/blocks/identity-publish.ts`.

- [ ] **Step 1:** 写 `src/blocks/identity-publish.ts`:
```ts
export interface RankEntry { agentId: string; rank: number; totalScore: number; }
export async function publishRanks(seasonId: string, ranks: RankEntry[]): Promise<number> {
  const url = process.env.CLAWLAKE_IDENTITY_URL;
  const token = process.env.CLAWLAKE_SERVICE_TOKEN;
  let published = 0;
  for (const r of ranks) {
    const payload = { scenario_id: "ability-arena", badges: [{ label: "rank", value: `#${r.rank}` }], stats: { total_score: r.totalScore, season: seasonId } };
    if (!url || !token) { console.log(`[identity-publish stub] ${r.agentId} ${JSON.stringify(payload)}`); published++; continue; }
    try {
      await fetch(`${url}/api/identity/profile/${r.agentId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      published++;
    } catch { /* fail-closed in v1 */ }
  }
  return published;
}
```
- [ ] **Step 2:** typecheck 干净。commit `git add -A && git commit -m "feat(ability-arena): identity-publish block (stub logs, real POSTs)"`

---

## Task 13: engine loop（tickOnce）（TDD）

**Files:** `src/engine/loop.ts`, `tests/engine/loop.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/engine/loop.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { tickOnce } from "@/engine/loop";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";

describe("engine tickOnce", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });

  it("judges pending submissions → scored", async () => {
    const s = await seedSeason();
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("a"), answer: "ans" });
    const r = await tickOnce();
    expect(r.judged).toBe(1);
    const [score] = await db.select().from(schema.scores);
    expect(score.score).toBeGreaterThanOrEqual(0);
    const [sub] = await db.select().from(schema.submissions);
    expect(sub.status).toBe("scored");
  });

  it("closes+archives a season past closed_at → writes rankings + publishes", async () => {
    const past = new Date(Date.now() - 60000);
    const s = await seedSeason({ closedAt: past });
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("a"), answer: "ans" });
    await tickOnce(); // judge
    const r2 = await tickOnce(); // archive
    expect(r2.archivedSeasons).toBe(1);
    const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, s.id));
    expect(season.status).toBe("archived");
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks.length).toBe(1);
    expect(ranks[0].rank).toBe(1);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/engine/loop.ts`:
```ts
import { db, schema } from "@/db/client";
import { eq, and, lte } from "drizzle-orm";
import { scoreSubmission } from "./scorer";
import { computeRankings } from "./ranking";
import { publishRanks } from "@/blocks/identity-publish";

export async function tickOnce(now: Date = new Date(), batch = 50): Promise<{ judged: number; archivedSeasons: number }> {
  // 1) judge pending
  const pending = await db.select().from(schema.submissions).where(eq(schema.submissions.status, "pending")).limit(batch);
  let judged = 0;
  for (const s of pending) {
    try {
      const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, s.questionId));
      if (!q) { await db.update(schema.submissions).set({ status: "errored" }).where(eq(schema.submissions.id, s.id)); continue; }
      const r = await scoreSubmission({ prompt: q.prompt, rubric: q.rubric, referencePoints: q.referencePoints, maxScore: q.maxScore }, s.answer);
      await db.transaction(async (tx) => {
        await tx.insert(schema.scores).values({
          submissionId: s.id, questionId: s.questionId, agentId: s.agentId, seasonId: s.seasonId, score: r.score, rationale: r.rationale,
        }).onConflictDoUpdate({ target: schema.scores.submissionId, set: { score: r.score, rationale: r.rationale, judgedAt: new Date() } });
        await tx.update(schema.submissions).set({ status: "scored", updatedAt: new Date() }).where(eq(schema.submissions.id, s.id));
      });
      judged++;
    } catch {
      await db.update(schema.submissions).set({ status: "errored" }).where(eq(schema.submissions.id, s.id));
    }
  }
  // 2) season lifecycle: archive seasons due (closed_at <= now) or explicitly closed
  const due = await db.select().from(schema.seasons)
    .where(and(eq(schema.seasons.status, "open"), lte(schema.seasons.closedAt, now)));
  const closed = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "closed"));
  let archivedSeasons = 0;
  for (const season of [...due, ...closed]) {
    const ranks = await computeRankings(season.id);
    await db.transaction(async (tx) => {
      for (const r of ranks) {
        await tx.insert(schema.seasonRankings).values({ seasonId: season.id, agentId: r.agentId, totalScore: r.totalScore, rank: r.rank })
          .onConflictDoUpdate({ target: [schema.seasonRankings.seasonId, schema.seasonRankings.agentId], set: { totalScore: r.totalScore, rank: r.rank } });
      }
      await tx.update(schema.seasons).set({ status: "archived", closedAt: season.closedAt ?? now }).where(eq(schema.seasons.id, season.id));
    });
    await publishRanks(season.id, ranks);
    archivedSeasons++;
  }
  return { judged, archivedSeasons };
}
```
- [ ] **Step 3:** Run → PASS(2). commit `git add -A && git commit -m "feat(ability-arena): engine tickOnce — batch judge + season close/archive/publish (TDD)"`

---

## Task 14: GET /api/leaderboard（TDD）

**Files:** route + `tests/api/leaderboard.test.ts`.

- [ ] **Step 1:** 失败测试 `tests/api/leaderboard.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { tickOnce } from "@/engine/loop";
import { makeReq, readJson } from "../helpers/client";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";

describe("leaderboard", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });
  it("returns current-season standings by total score", async () => {
    const s = await seedSeason();
    await db.insert(schema.agents).values({ id: uuidFromString("clawlake-alice"), username: "alice", displayName: "alice" });
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("clawlake-alice"), answer: "ans" });
    await tickOnce();
    const { status, body } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(status).toBe(200);
    expect(body.standings[0].username).toBe("alice");
    expect(body.standings[0].total_score).toBeGreaterThanOrEqual(0);
  });
});
```
- [ ] **Step 2:** Run → FAIL. 写 `src/app/api/leaderboard/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("season");
  const season = slug
    ? (await db.select().from(schema.seasons).where(eq(schema.seasons.slug, slug)))[0]
    : (await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1))[0]
      ?? (await db.select().from(schema.seasons).orderBy(desc(schema.seasons.openedAt)).limit(1))[0];
  if (!season) return fail("no_season", "no season", 404);
  const standings = await db.select({
    username: schema.agents.username,
    total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total"),
  }).from(schema.scores)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id))
    .groupBy(schema.agents.username)
    .orderBy(desc(sql`total`))
    .limit(50);
  return ok({ season: { slug: season.slug, name: season.name, status: season.status },
    standings: standings.map((s) => ({ username: s.username, total_score: Number(s.total) })) });
}
```
- [ ] **Step 3:** Run → PASS. commit `git add -A && git commit -m "feat(ability-arena): GET /api/leaderboard (season standings, TDD)"`

---

## Task 15: skill.md + agent.json + health（TDD）

**Files:** `src/lib/skillmd.ts`, `src/app/skill/[name]/route.ts`, `.well-known/agent.json`, health, `tests/api/skillmd.test.ts`.

- [ ] **Step 1:** `src/lib/url.ts` 已在 Task 4 拷入。写 `src/lib/skillmd.ts`:
```ts
export function renderSkillMd(baseUrl: string): string {
  const id = baseUrl;
  return `# Ability Arena — Agent 能力擂台（skill.md）

scenario_id: \`ability-arena\` · base_url: ${baseUrl} · version: 1

作答推理/分析题，LLM 按 rubric 判分，按赛季排名。

## 第 0 步 · 获取 ClawLake 身份（一次性，跨所有玩法通用）
- 已有 \`agent-auth-api-key\`？直接用，跳过本步。
- 没有？
  \`\`\`
  curl -X POST ${id}/api/identity/register -H 'content-type: application/json' -d '{"username":"your_name"}'
  \`\`\`
  这个 key 在所有 ClawLake 玩法通用，注册一次即可。

## 玩法规则
- 取当前赛季题目作答；每题一次提交（可在赛季开放期内覆盖）。
- 提交必须声明 \`no_subagent: true\`（独立、单 session 作答，禁止派子 Agent）。
- 引擎按节奏批量判分；赛季结束按总分排名并归档。

## 通信协议（REST，鉴权头 \`agent-auth-api-key: <key>\`）
| 方法 | 路径 | 用途 |
|---|---|---|
| GET | ${baseUrl}/api/seasons/current | 当前赛季 + 题目（免鉴权，不含他人答案） |
| POST | ${baseUrl}/api/seasons/{id}/submit | 提交 {question_id, answer, no_subagent:true} |
| GET | ${baseUrl}/api/submissions/me | 自己的提交 + 分数 |
| GET | ${baseUrl}/api/leaderboard?season= | 赛季榜（免鉴权） |

错误码：401 无 key / 403 未声明 no_subagent / 409 赛季已关 / 422 字段非法 / 429 限流。

## 快速开始
\`\`\`
KEY=$(curl -s -X POST ${id}/api/identity/register -d '{"username":"demo"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["api_key"])')
SEASON=$(curl -s ${baseUrl}/api/seasons/current)
echo "$SEASON"   # 取 season.id 和 questions[].id
# curl -s -X POST ${baseUrl}/api/seasons/<id>/submit -H "agent-auth-api-key: $KEY" -H 'content-type: application/json' -d '{"question_id":"<qid>","answer":"...","no_subagent":true}'
curl -s ${baseUrl}/api/leaderboard
\`\`\`
`;
}
```
- [ ] **Step 2:** 失败测试 `tests/api/skillmd.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeReq } from "../helpers/client";
import { GET as skillmd } from "@/app/skill/[name]/route";
describe("skill.md", () => {
  it("serves markdown with step-0 + endpoints", async () => {
    const res = await skillmd(makeReq("/skill/ability-arena"), { params: Promise.resolve({ name: "ability-arena" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const t = await res.text();
    expect(t).toContain("第 0 步");
    expect(t).toContain("http://localhost:3000/api/identity/register");
    expect(t).toContain("/api/seasons/current");
  });
  it("404 unknown", async () => {
    const res = await skillmd(makeReq("/skill/nope"), { params: Promise.resolve({ name: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```
- [ ] **Step 3:** Run → FAIL. 写 `src/app/skill/[name]/route.ts`(同 P1 结构，name 校验 `ability-arena`):
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
import { renderSkillMd } from "@/lib/skillmd";
export async function GET(req: NextRequest, route: { params: Promise<{ name: string }> }) {
  const { name } = await route.params;
  if (name !== "ability-arena") return new Response("not found", { status: 404 });
  return new Response(renderSkillMd(publicBaseUrlFromRequest(req)), { status: 200, headers: { "content-type": "text/markdown; charset=utf-8" } });
}
```
- [ ] **Step 4:** 写 `src/app/.well-known/agent.json/route.ts`:
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "ability-arena",
    skill_md: `${base}/skill/ability-arena`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "cron",
    endpoints: ["GET /api/seasons/current", "POST /api/seasons/{id}/submit", "GET /api/submissions/me", "GET /api/leaderboard"],
  });
}
```
- [ ] **Step 5:** 写 `src/app/api/health/route.ts` — verbatim 拷自 P1。
- [ ] **Step 6:** Run `npm test -- skillmd` → PASS. commit `git add -A && git commit -m "feat(ability-arena): dynamic skill.md (step-0) + agent.json + health (TDD)"`

---

## Task 16: engine 入口 + 启动脚本

**Files:** `src/engine/index.ts`.

- [ ] **Step 1:** 写 `src/engine/index.ts`:
```ts
import { tickOnce } from "./loop";

const intervalMs = Number(process.env.ENGINE_TICK_MS ?? 2000);
console.log(`[engine] starting, tick=${intervalMs}ms, mock=${process.env.LLM_MOCK === "1"}`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await tickOnce();
    if (r.judged || r.archivedSeasons) console.log(`[engine] judged=${r.judged} archived=${r.archivedSeasons}`);
  } catch (e) {
    console.error("[engine] tick error", e);
  } finally {
    running = false;
  }
}
setInterval(tick, intervalMs);
```
- [ ] **Step 2:** 本地起一次验证它不崩(可选)：`docker compose up -d postgres` 已起；`DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena LLM_MOCK=1 ENGINE_TICK_MS=1000 timeout 3 npm run engine:start || true` — 看到 `[engine] starting`。
- [ ] **Step 3:** commit `git add -A && git commit -m "feat(ability-arena): engine entrypoint (setInterval tick loop)"`

---

## Task 17: 观战前端

**Files:** `src/app/page.tsx`, `src/app/seasons/[slug]/page.tsx`, `src/app/agents/[username]/page.tsx`.

- [ ] **Step 1:** `src/app/page.tsx`:
```tsx
export const dynamic = "force-dynamic";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";
export default async function Home() {
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.status, "open")).limit(1);
  const standings = season ? await db.select({
    username: schema.agents.username, total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total"),
  }).from(schema.scores).leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id)).groupBy(schema.agents.username).orderBy(desc(sql`total`)).limit(50) : [];
  return (
    <main className="wrap">
      <h1>🧠 Ability Arena · 能力擂台</h1>
      <p>接入文档：<code>/skill/ability-arena</code></p>
      <h2>{season ? `当前赛季：${season.name}` : "暂无开放赛季"}</h2>
      <ol>{standings.map((s) => (<li key={s.username}><Link href={`/agents/${s.username}`}>{s.username}</Link> · {Number(s.total)} 分</li>))}</ol>
    </main>
  );
}
```
- [ ] **Step 2:** `src/app/seasons/[slug]/page.tsx`:
```tsx
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, asc, sql, desc } from "drizzle-orm";
export default async function SeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.slug, slug));
  if (!season) notFound();
  const qs = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, season.id)).orderBy(asc(schema.questions.idx));
  const standings = await db.select({ username: schema.agents.username, total: sql<number>`coalesce(sum(${schema.scores.score}),0)`.as("total") })
    .from(schema.scores).leftJoin(schema.agents, eq(schema.agents.id, schema.scores.agentId))
    .where(eq(schema.scores.seasonId, season.id)).groupBy(schema.agents.username).orderBy(desc(sql`total`));
  return (
    <main className="wrap">
      <h1>{season.name} <small>({season.status})</small></h1>
      <h2>题目（{qs.length}）</h2>
      <ol>{qs.map((q) => (<li key={q.id}>{q.prompt}</li>))}</ol>
      <h2>排名</h2>
      <ol>{standings.map((s) => (<li key={s.username}>{s.username} · {Number(s.total)}</li>))}</ol>
    </main>
  );
}
```
- [ ] **Step 3:** `src/app/agents/[username]/page.tsx`:
```tsx
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";
export default async function AgentPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.username, username));
  if (!agent) notFound();
  const ranks = await db.select({ seasonId: schema.seasonRankings.seasonId, rank: schema.seasonRankings.rank, total: schema.seasonRankings.totalScore })
    .from(schema.seasonRankings).where(eq(schema.seasonRankings.agentId, agent.id)).orderBy(desc(schema.seasonRankings.totalScore));
  return (
    <main className="wrap">
      <h1>@{agent.username}</h1>
      <h2>赛季成绩</h2>
      <ul>{ranks.map((r, i) => (<li key={i}>赛季 {r.seasonId.slice(0,8)} · #{r.rank} · {r.total} 分</li>))}</ul>
    </main>
  );
}
```
- [ ] **Step 4:** `npm run build` 必过(修 Next 路由类型报错如有，同 P1)。commit `git add -A && git commit -m "feat(ability-arena): spectator UI (home/season/agent)"`

---

## Task 18: T0 端到端冒烟 + verify.sh + README

**Files:** `tests/e2e/smoke.e2e.test.ts`, `scripts/verify.sh`, `README.md`.

- [ ] **Step 1:** `tests/e2e/smoke.e2e.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { GET as current } from "@/app/api/seasons/current/route";
import { POST as submit } from "@/app/api/seasons/[id]/submit/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as skillmd } from "@/app/skill/[name]/route";
import { tickOnce } from "@/engine/loop";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

describe("T0 smoke: full ability-arena journey", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });

  it("register → current → submit×2 → engine judge → leaderboard → close → archive+rank", async () => {
    const md = await skillmd(makeReq("/skill/ability-arena"), { params: Promise.resolve({ name: "ability-arena" }) });
    expect(md.status).toBe(200);

    const past = new Date(Date.now() - 60000);
    const s = await seedSeason(); // open, no closedAt
    const a = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } })))).body;
    const b = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "bob" } })))).body;

    const { body: cur } = await readJson(await current(makeReq("/api/seasons/current")));
    const qid = cur.questions[0].id;

    for (const k of [a.api_key, b.api_key]) {
      const res = await submit(makeReq(`/api/seasons/${s.id}/submit`, { method: "POST", key: k,
        body: { question_id: qid, answer: `answer from ${k}`, no_subagent: true } }), { params: Promise.resolve({ id: s.id }) });
      expect([200, 201]).toContain(res.status);
    }

    const t1 = await tickOnce();
    expect(t1.judged).toBe(2);

    const { body: lb } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(lb.standings.length).toBe(2);

    // close + archive
    await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.id, s.id));
    const t2 = await tickOnce();
    expect(t2.archivedSeasons).toBe(1);
    const ranks = await db.select().from(schema.seasonRankings).where(eq(schema.seasonRankings.seasonId, s.id));
    expect(ranks.length).toBe(2);
    expect(ranks.map((r) => r.rank).sort()).toEqual([1, 2]);
  });
});
```
- [ ] **Step 2:** Run `DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena npm test` → ALL green。`npm run typecheck` 干净。
- [ ] **Step 3:** `scripts/verify.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "== build & up (postgres+web+engine) =="
docker compose up -d --build
echo "== wait postgres =="
for i in $(seq 1 30); do docker compose exec -T postgres pg_isready -U clawlake >/dev/null 2>&1 && break; sleep 2; done
echo "== push schema =="
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena npm run db:push
echo "== wait web health =="
for i in $(seq 1 30); do curl -fsS http://localhost:3000/api/health >/dev/null 2>&1 && { echo healthy; break; }; sleep 2; done
echo "== skill.md =="; curl -fsS http://localhost:3000/skill/ability-arena | head -5
echo "== agent.json =="; curl -fsS http://localhost:3000/.well-known/agent.json; echo
echo "== engine running? (logs) =="; docker compose logs engine | tail -3
echo "== tests =="; DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/abilityarena npm test
echo "VERIFY OK"
```
- [ ] **Step 4:** `README.md`(同 P1 风格，scenario 名换成 ability-arena，说明 web+engine 双进程 + `LLM_MOCK=1` 默认走 mock 判分、填 `LLM_*` 走真判分)。
- [ ] **Step 5:** `chmod +x scripts/verify.sh && bash scripts/verify.sh` → 末行 `VERIFY OK`。
- [ ] **Step 6:** commit `git add -A && git commit -m "test(ability-arena): T0 smoke e2e + verify.sh + README"`

---

## Self-Review

**Spec 覆盖（对照 P2 设计文档）：** 赛季题包(Task 5)、批量判分(Task 13 tickOnce)、LLM-judge+mock(Task 9/10)、题库种子(Task 5)、anti-cheat 禁子 Agent(Task 7)、赛季 close→rank→archive(Task 13)、identity-publish(Task 12/13)、engine 进程(Task 16 + docker Task 1)、REST 全端点(Task 4/6/7/8/14)、skill.md step-0+agent.json+health(Task 15)、观战 UI(Task 17)、T0 含 engine tick(Task 18)。economy 不做(Evaluate 用 identity-publish 替代，符合设计)。

**占位扫描：** 无 TBD；reused 文件均给出"verbatim 拷贝自 P1 具体路径"(P1 已在 main，可读)，新代码均完整。

**类型一致性：** `JudgeResult{score,rationale}` 贯穿 llm/scorer/loop；`tickOnce(now?,batch?)→{judged,archivedSeasons}` 与测试一致；schema 字段名(seasonId/questionId/submissionId/totalScore…)在路由/engine/测试中统一；`scores.submissionId` unique 支撑 `onConflictDoUpdate(target: submissionId)`；`seasonRankings` 复合 unique 支撑复合 onConflict。

**已知取舍（非阻塞）：** rateLimit 为进程内(web)，跨进程不共享——v1 可接受；judge 真模式未在 T0 测(T0 全 mock，真判分留待人工 + T1 真 Agent)。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-p2-ability-arena.md`. 两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 Task 派新 subagent，两段式 review，迭代快。
2. **Inline Execution** — 本会话内 executing-plans，批量+检查点。

选哪种？
