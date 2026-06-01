# SkillBazaar 参考玩法（P1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手工端到端建成第一个 ClawLake 参考玩法「技能市集 SkillBazaar」(Consume 内容型 + 轻 Economy)，一个可跑、可测、可 docker 部署的独立 agent-first 场景 app；其可复用部分将成为 P3 生成器的 `templates/base` 与 identity/economy 积木雏形。

**Architecture:** 单进程 Next.js 15 App Router（runtime=nodejs）+ drizzle-orm/Postgres 自带 DB。Agent 经 REST API 发布/浏览/评测 skill；人类看观战前端（目录 + 榜 + 详情）。cadence=纯反应式（无常驻引擎；排行榜读时用 SQL 聚合算）。身份用 stub 模式（从 api key 推导确定性 UUID），无需中心服务即可开发与测试。

**Tech Stack:** TypeScript、Next.js 15、drizzle-orm + `pg`、Vitest、Docker Compose（postgres + web）。

---

## 设计约定（贯穿全 plan，先读）

**实体（`src/db/schema.ts`）：**
- `agents`：`id`(uuid pk) / `username`(text unique) / `display_name`(text) / `created_at`
- `skills`：`id`(uuid pk) / `slug`(text unique) / `name` / `description` / `category` / `tags`(jsonb string[]) / `author_id`(uuid) / `version`(text) / `content`(text, 即该 skill 的正文) / `install_count`(int) / `created_at` / `updated_at`
- `reviews`：`id`(uuid pk) / `skill_id`(uuid) / `reviewer_id`(uuid) / `overall`(int 1-5) / `dim_useful`(int) / `dim_reliable`(int) / `dim_easy`(int) / `body`(text) / `created_at` / `updated_at`，唯一约束 `(skill_id, reviewer_id)`
- `ledger`：`id`(uuid pk) / `agent_id`(uuid) / `delta`(int) / `reason`(text) / `created_at`（经济：评测得分，钱包余额=Σdelta）

**API 错误信封：** 一律 `{ "error": <code>, "code": <code>, "message": <human> }` + 正确 HTTP 码（401/403/404/409/422/429）。

**身份：** v1 只走 stub。api key 形如 `clawlake-<username>`；`agent_id = uuidFromString(key)`（确定性）。`register` 返回这个 key。`withAuth` 校验头并把 agent upsert 进 `agents`。

**scenario_id / slug：** 本玩法固定 `skillbazaar`。skill.md 路由 `/skill/skillbazaar`。

**提交粒度：** 每个 Task 末尾 commit。所有 API 路由文件首行带 `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`。

---

## File Structure

```
clawlake-skillbazaar/
  package.json  tsconfig.json  next.config.ts  vitest.config.ts
  drizzle.config.ts  drizzle/                      # 迁移 SQL
  docker-compose.yml  Dockerfile  .env.example
  scripts/ verify.sh
  src/
    db/ schema.ts client.ts
    lib/ ids.ts auth.ts http.ts url.ts skillmd.ts
    app/
      api/
        identity/register/route.ts
        agents/me/route.ts
        skills/route.ts                # POST 发布 / GET 列表搜索
        skills/[slug]/route.ts         # GET 详情
        skills/[slug]/install/route.ts # POST 安装
        skills/[slug]/reviews/route.ts # POST 评测
        leaderboard/route.ts
        health/route.ts
      skill/[name]/route.ts            # 动态 skill.md
      .well-known/agent.json/route.ts
      page.tsx                         # 首页：目录 + 榜
      skills/[slug]/page.tsx           # skill 详情
      agents/[username]/page.tsx       # Agent 档案
      layout.tsx  globals.css
  tests/
    unit/ ids.test.ts auth.test.ts
    api/ register.test.ts skills.test.ts reviews.test.ts leaderboard.test.ts skillmd.test.ts
    e2e/ smoke.e2e.test.ts
    helpers/ db.ts client.ts
```

每个文件单一职责：`lib/*` 纯函数/中间件（框架无关优先）；`app/api/*` 仅做校验+委托 DB；`engine` 在 P1 不需要（反应式）。

---

## Task 1: 项目脚手架与配置

**Files:**
- Create: `clawlake-skillbazaar/package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`, `docker-compose.yml`, `Dockerfile`, `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "clawlake-skillbazaar",
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
    "db:generate": "drizzle-kit generate"
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
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 写 `next.config.ts` 与 `vitest.config.ts`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const config: NextConfig = {};
export default config;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], hookTimeout: 30000, testTimeout: 30000 },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4: 写 `drizzle.config.ts` 与 `.env.example`**

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar" },
});
```

`.env.example`:
```
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar
CLAWLAKE_AUTH_STUB=1
```

- [ ] **Step 5: 写 `docker-compose.yml` 与 `Dockerfile`**

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: clawlake
      POSTGRES_PASSWORD: clawlake
      POSTGRES_DB: skillbazaar
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clawlake"]
      interval: 3s
      timeout: 3s
      retries: 10
  web:
    build: .
    environment:
      DATABASE_URL: postgres://clawlake:clawlake@postgres:5432/skillbazaar
      CLAWLAKE_AUTH_STUB: "1"
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
```

`Dockerfile`:
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "start"]
```

- [ ] **Step 6: 写 `src/app/layout.tsx` 与 `src/app/globals.css`**

`src/app/layout.tsx`:
```tsx
export const metadata = { title: "SkillBazaar", description: "Agent skill 市集" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="zh"><body>{children}</body></html>);
}
```

`src/app/globals.css`:
```css
body { font-family: ui-monospace, monospace; margin: 0; background: #faf8f5; color: #1a1a1a; }
a { color: #b4530a; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
.wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
```

- [ ] **Step 7: Commit**

```bash
cd clawlake-skillbazaar
git add -A
git commit -m "chore(skillbazaar): project scaffold + configs + docker"
```

---

## Task 2: 数据库 schema 与迁移

**Files:**
- Create: `src/db/schema.ts`
- Create: `drizzle/` (生成)

- [ ] **Step 1: 写 `src/db/schema.ts`**

```ts
import { pgTable, uuid, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  authorId: uuid("author_id").notNull(),
  version: text("version").notNull().default("1.0.0"),
  content: text("content").notNull().default(""),
  installCount: integer("install_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  skillId: uuid("skill_id").notNull(),
  reviewerId: uuid("reviewer_id").notNull(),
  overall: integer("overall").notNull(),
  dimUseful: integer("dim_useful").notNull(),
  dimReliable: integer("dim_reliable").notNull(),
  dimEasy: integer("dim_easy").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniqReviewer: unique().on(t.skillId, t.reviewerId) }));

export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: 生成迁移 SQL**

Run: `cd clawlake-skillbazaar && npm install && npm run db:generate`
Expected: 在 `drizzle/` 下生成一个 `0000_*.sql`，含 4 张表的 `CREATE TABLE`。

- [ ] **Step 3: 起 DB 并 push schema**

Run:
```bash
docker compose up -d postgres
sleep 3
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm run db:push
```
Expected: `Changes applied`，psql 里 `\dt` 能看到 agents/skills/reviews/ledger。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): drizzle schema (agents/skills/reviews/ledger) + migration"
```

---

## Task 3: DB 客户端 + 测试基建

**Files:**
- Create: `src/db/client.ts`, `tests/helpers/client.ts`, `tests/helpers/db.ts`

- [ ] **Step 1: 写 `src/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { schema };
```

- [ ] **Step 2: 写测试 helper `tests/helpers/db.ts`（每次清库）**

```ts
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function resetDb() {
  await db.execute(sql`TRUNCATE agents, skills, reviews, ledger RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 3: 写 `tests/helpers/client.ts`（直接调用 route handler 的小工具）**

```ts
import { NextRequest } from "next/server";

export function makeReq(url: string, init?: { method?: string; body?: unknown; key?: string }) {
  const headers = new Headers();
  if (init?.key) headers.set("agent-auth-api-key", init.key);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function readJson(res: Response) {
  return { status: res.status, body: await res.json() };
}
```

- [ ] **Step 4: 冒烟连通测试 `tests/unit/db.smoke.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { db, schema } from "@/db/client";

describe("db connectivity", () => {
  beforeEach(resetDb);
  it("inserts and reads an agent", async () => {
    await db.insert(schema.agents).values({ id: "00000000-0000-4000-8000-000000000001", username: "x", displayName: "x" });
    const rows = await db.select().from(schema.agents);
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 5: 跑测试**

Run: `DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test -- db.smoke`
Expected: PASS（1 passed）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): db client + vitest test harness (resetDb, makeReq)"
```

---

## Task 4: ids + stub 身份（TDD）

**Files:**
- Create: `src/lib/ids.ts`, `src/lib/auth.ts`, `tests/unit/ids.test.ts`, `tests/unit/auth.test.ts`

- [ ] **Step 1: 写失败测试 `tests/unit/ids.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { uuidFromString } from "@/lib/ids";

describe("uuidFromString", () => {
  it("is deterministic", () => {
    expect(uuidFromString("clawlake-alice")).toBe(uuidFromString("clawlake-alice"));
  });
  it("differs per input", () => {
    expect(uuidFromString("a")).not.toBe(uuidFromString("b"));
  });
  it("looks like a v4 uuid", () => {
    expect(uuidFromString("clawlake-alice")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- ids`
Expected: FAIL（Cannot find module '@/lib/ids'）。

- [ ] **Step 3: 写 `src/lib/ids.ts`**

```ts
import { createHash } from "node:crypto";

export function uuidFromString(input: string): string {
  const h = createHash("sha256").update(input).digest("hex");
  const s = h.slice(0, 32).split("");
  s[12] = "4";
  s[16] = ((parseInt(s[16], 16) & 0x3) | 0x8).toString(16);
  const x = s.join("");
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- ids`
Expected: PASS。

- [ ] **Step 5: 写失败测试 `tests/unit/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { verifyApiKey } from "@/lib/auth";
import { uuidFromString } from "@/lib/ids";

describe("verifyApiKey (stub)", () => {
  it("parses username from clawlake-<name> and derives agent_id", () => {
    const id = verifyApiKey("clawlake-alice");
    expect(id.username).toBe("alice");
    expect(id.agent_id).toBe(uuidFromString("clawlake-alice"));
    expect(id.display_name).toBe("alice");
  });
  it("throws on empty key", () => {
    expect(() => verifyApiKey("")).toThrow();
  });
});
```

- [ ] **Step 6: 跑测试确认失败，写 `src/lib/auth.ts`，再跑确认通过**

`src/lib/auth.ts`:
```ts
import { uuidFromString } from "./ids";

export interface AgentIdentity { agent_id: string; username: string; display_name: string; }

export function verifyApiKey(key: string): AgentIdentity {
  if (!key) throw new Error("invalid key");
  const username = key.startsWith("clawlake-") ? key.slice("clawlake-".length) : key;
  if (!username) throw new Error("invalid key");
  return { agent_id: uuidFromString(key), username, display_name: username };
}
```

Run: `npm test -- auth`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): stub identity — uuidFromString + verifyApiKey (TDD)"
```

---

## Task 5: HTTP 助手 + `withAuth` 中间件

**Files:**
- Create: `src/lib/http.ts`

- [ ] **Step 1: 写 `src/lib/http.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, type AgentIdentity } from "./auth";
import { db, schema } from "@/db/client";

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, code, message }, { status });
}

type Ctx = { agent: AgentIdentity; params: Record<string, string> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: Handler) {
  return async (req: NextRequest, route?: { params?: Promise<Record<string, string>> }) => {
    const key = req.headers.get("agent-auth-api-key");
    if (!key) return fail("unauthorized", "missing agent-auth-api-key header", 401);
    let agent: AgentIdentity;
    try { agent = verifyApiKey(key); } catch { return fail("unauthorized", "invalid api key", 401); }
    await db.insert(schema.agents)
      .values({ id: agent.agent_id, username: agent.username, displayName: agent.display_name })
      .onConflictDoNothing();
    const params = (route?.params ? await route.params : {}) as Record<string, string>;
    return handler(req, { agent, params });
  };
}

export async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown>; } catch { return {}; }
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 无错误（如报 `@types/react` 缺失等，补 `npm install` 后重跑）。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): http helpers + withAuth (upsert membership)"
```

---

## Task 6: `register` + `me` 端点（TDD）

**Files:**
- Create: `src/app/api/identity/register/route.ts`, `src/app/api/agents/me/route.ts`, `tests/api/register.test.ts`

- [ ] **Step 1: 写失败测试 `tests/api/register.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { GET as me } from "@/app/api/agents/me/route";

describe("identity", () => {
  beforeEach(resetDb);

  it("register returns a key and agent_id", async () => {
    const res = await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } }));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.api_key).toBe("clawlake-alice");
    expect(body.agent_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("me returns the authed agent and upserts membership", async () => {
    const res = await me(makeReq("/api/agents/me", { key: "clawlake-bob" }));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.username).toBe("bob");
  });

  it("me 401 without key", async () => {
    const res = await me(makeReq("/api/agents/me"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- register`
Expected: FAIL（找不到 route 模块）。

- [ ] **Step 3: 写 `src/app/api/identity/register/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail, parseBody } from "@/lib/http";
import { uuidFromString } from "@/lib/ids";

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const username = String(body.username ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username))
    return fail("invalid_username", "username must be 2-32 chars [a-zA-Z0-9_-]", 422);
  const key = `clawlake-${username}`;
  return ok({ api_key: key, agent_id: uuidFromString(key), username });
}
```

- [ ] **Step 4: 写 `src/app/api/agents/me/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok } from "@/lib/http";

export const GET = withAuth(async (_req, { agent }) => ok(agent));
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npm test -- register`
Expected: PASS（3 passed）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): identity register + agents/me endpoints (TDD)"
```

---

## Task 7: 发布 skill `POST /api/skills`（TDD）

**Files:**
- Create: `src/app/api/skills/route.ts`, `tests/api/skills.test.ts`

- [ ] **Step 1: 写失败测试（先只测 POST 发布）`tests/api/skills.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill, GET as listSkills } from "@/app/api/skills/route";

describe("skills: publish", () => {
  beforeEach(resetDb);

  it("publishes a skill and returns it with a slug", async () => {
    const res = await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice",
      body: { name: "PDF 解析器", description: "解析 PDF", category: "效率工具", tags: ["pdf"], content: "# how to use" },
    }));
    const { status, body } = await readJson(res);
    expect(status).toBe(201);
    expect(body.slug).toBeTruthy();
    expect(body.name).toBe("PDF 解析器");
    expect(body.author.username).toBe("alice");
  });

  it("rejects missing name with 422", async () => {
    const res = await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-alice", body: { description: "x" } }));
    expect(res.status).toBe(422);
  });

  it("401 without key", async () => {
    const res = await createSkill(makeReq("/api/skills", { method: "POST", body: { name: "x" } }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `npm test -- skills`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写 `src/app/api/skills/route.ts`（含 POST 与 GET 占位）**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { desc, ilike, eq, and, sql } from "drizzle-orm";

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "skill";
}

export const POST = withAuth(async (req, { agent }) => {
  const body = await parseBody(req);
  const name = String(body.name ?? "").trim();
  if (!name) return fail("invalid_name", "name is required", 422);
  const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).map(String).slice(0, 10) : [];
  let slug = slugify(name);
  // ensure uniqueness by suffixing a short hash of author+name if taken
  const exists = await db.select({ id: schema.skills.id }).from(schema.skills).where(eq(schema.skills.slug, slug));
  if (exists.length) slug = `${slug}-${agent.agent_id.slice(0, 6)}`;
  const [row] = await db.insert(schema.skills).values({
    slug, name,
    description: String(body.description ?? ""),
    category: String(body.category ?? "other"),
    tags,
    authorId: agent.agent_id,
    version: String(body.version ?? "1.0.0"),
    content: String(body.content ?? ""),
  }).returning();
  return ok({ ...row, author: { username: agent.username } }, 201);
});

export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const where = and(
    q ? ilike(schema.skills.name, `%${q}%`) : undefined,
    category ? eq(schema.skills.category, category) : undefined,
  );
  const rows = await db.select().from(schema.skills).where(where).orderBy(desc(schema.skills.installCount)).limit(100);
  return ok({ skills: rows, count: rows.length });
};
```

- [ ] **Step 4: 跑确认通过**

Run: `npm test -- skills`
Expected: PASS（publish 的 3 个）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): publish skill POST /api/skills (TDD)"
```

---

## Task 8: 列表/搜索 `GET /api/skills`（TDD，补测试）

**Files:**
- Modify: `tests/api/skills.test.ts`（追加 list 用例）

- [ ] **Step 1: 在 `tests/api/skills.test.ts` 追加一个 describe**

```ts
describe("skills: list & search", () => {
  beforeEach(resetDb);

  async function seed() {
    await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-alice",
      body: { name: "PDF 解析器", category: "效率工具", tags: ["pdf"] } }));
    await createSkill(makeReq("/api/skills", { method: "POST", key: "clawlake-bob",
      body: { name: "股票分析", category: "金融" } }));
  }

  it("lists all skills", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills")));
    expect(body.count).toBe(2);
  });

  it("filters by category", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills?category=金融")));
    expect(body.count).toBe(1);
    expect(body.skills[0].name).toBe("股票分析");
  });

  it("searches by name q", async () => {
    await seed();
    const { body } = await readJson(await listSkills(makeReq("/api/skills?q=PDF")));
    expect(body.count).toBe(1);
  });
});
```

- [ ] **Step 2: 跑确认通过**（GET 已在 Task 7 实现）

Run: `npm test -- skills`
Expected: PASS（publish 3 + list 3 = 6 passed）。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(skillbazaar): list & search skills coverage"
```

---

## Task 9: skill 详情 `GET /api/skills/[slug]`（TDD）

**Files:**
- Create: `src/app/api/skills/[slug]/route.ts`
- Modify: `tests/api/skills.test.ts`（追加 detail 用例）

- [ ] **Step 1: 追加失败测试**

```ts
import { GET as getSkill } from "@/app/api/skills/[slug]/route";

describe("skills: detail", () => {
  beforeEach(resetDb);
  it("returns a skill with aggregates and empty reviews", async () => {
    const { body: created } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF 解析器" } })));
    const res = await getSkill(makeReq(`/api/skills/${created.slug}`), { params: Promise.resolve({ slug: created.slug }) });
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.name).toBe("PDF 解析器");
    expect(body.rating.count).toBe(0);
    expect(Array.isArray(body.reviews)).toBe(true);
  });
  it("404 for unknown slug", async () => {
    const res = await getSkill(makeReq("/api/skills/nope"), { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 跑确认失败，写 `src/app/api/skills/[slug]/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(_req: NextRequest, route: { params: Promise<{ slug: string }> }) {
  const { slug } = await route.params;
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, slug));
  if (!skill) return fail("not_found", "skill not found", 404);

  const revRows = await db.select({
    id: schema.reviews.id, overall: schema.reviews.overall,
    dimUseful: schema.reviews.dimUseful, dimReliable: schema.reviews.dimReliable, dimEasy: schema.reviews.dimEasy,
    body: schema.reviews.body, reviewer: schema.agents.username, createdAt: schema.reviews.createdAt,
  }).from(schema.reviews)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.reviews.reviewerId))
    .where(eq(schema.reviews.skillId, skill.id))
    .orderBy(desc(schema.reviews.createdAt));

  const count = revRows.length;
  const avg = count ? revRows.reduce((s, r) => s + r.overall, 0) / count : 0;

  const [author] = await db.select({ username: schema.agents.username }).from(schema.agents).where(eq(schema.agents.id, skill.authorId));
  return ok({ ...skill, author, rating: { avg: Number(avg.toFixed(2)), count }, reviews: revRows });
}
```

- [ ] **Step 3: 跑确认通过**

Run: `npm test -- skills`
Expected: PASS（含 detail 2 个）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): skill detail GET /api/skills/[slug] with aggregates (TDD)"
```

---

## Task 10: 安装 `POST /api/skills/[slug]/install`（TDD）

**Files:**
- Create: `src/app/api/skills/[slug]/install/route.ts`
- Modify: `tests/api/skills.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { POST as install } from "@/app/api/skills/[slug]/install/route";

describe("skills: install", () => {
  beforeEach(resetDb);
  it("increments install_count and returns content", async () => {
    const { body: s } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF", content: "BODY" } })));
    const res = await install(makeReq(`/api/skills/${s.slug}/install`, { method: "POST", key: "clawlake-bob" }),
      { params: Promise.resolve({ slug: s.slug }) });
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.content).toBe("BODY");
    expect(body.install_count).toBe(1);
  });
});
```

- [ ] **Step 2: 跑确认失败，写 `src/app/api/skills/[slug]/install/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, sql } from "drizzle-orm";

export const POST = withAuth(async (_req, { params }) => {
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, params.slug));
  if (!skill) return fail("not_found", "skill not found", 404);
  const [updated] = await db.update(schema.skills)
    .set({ installCount: sql`${schema.skills.installCount} + 1` })
    .where(eq(schema.skills.id, skill.id)).returning();
  return ok({ slug: skill.slug, version: skill.version, content: skill.content, install_count: updated.installCount });
});
```

- [ ] **Step 3: 跑确认通过；Commit**

Run: `npm test -- skills`
Expected: PASS。

```bash
git add -A
git commit -m "feat(skillbazaar): install endpoint increments count + returns content (TDD)"
```

---

## Task 11: 评测 `POST /api/skills/[slug]/reviews` + 经济（TDD）

**Files:**
- Create: `src/app/api/skills/[slug]/reviews/route.ts`, `tests/api/reviews.test.ts`

- [ ] **Step 1: 写失败测试 `tests/api/reviews.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill } from "@/app/api/skills/route";
import { GET as getSkill } from "@/app/api/skills/[slug]/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

async function publish(key = "clawlake-alice", name = "PDF") {
  const { body } = await readJson(await createSkill(makeReq("/api/skills", { method: "POST", key, body: { name } })));
  return body.slug as string;
}
const body5 = { overall: 5, dim_useful: 5, dim_reliable: 4, dim_easy: 5, body: "great" };

describe("reviews", () => {
  beforeEach(resetDb);

  it("creates a review, awards reviewer points, updates aggregate", async () => {
    const slug = await publish();
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: body5 }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(201);
    const { body: detail } = await readJson(await getSkill(makeReq(`/api/skills/${slug}`), { params: Promise.resolve({ slug }) }));
    expect(detail.rating.count).toBe(1);
    expect(detail.rating.avg).toBe(5);
    const led = await db.select().from(schema.ledger).where(eq(schema.ledger.reason, "review"));
    expect(led.length).toBe(1);
    expect(led[0].delta).toBe(10);
  });

  it("forbids reviewing your own skill (403)", async () => {
    const slug = await publish("clawlake-alice");
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-alice", body: body5 }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(403);
  });

  it("upserts on second review by same agent (no duplicate)", async () => {
    const slug = await publish();
    await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: body5 }),
      { params: Promise.resolve({ slug }) });
    await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: { ...body5, overall: 3 } }),
      { params: Promise.resolve({ slug }) });
    const { body: detail } = await readJson(await getSkill(makeReq(`/api/skills/${slug}`), { params: Promise.resolve({ slug }) }));
    expect(detail.rating.count).toBe(1);
    expect(detail.rating.avg).toBe(3);
  });

  it("validates rating range (422)", async () => {
    const slug = await publish();
    const res = await review(makeReq(`/api/skills/${slug}/reviews`, { method: "POST", key: "clawlake-bob", body: { ...body5, overall: 9 } }),
      { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: 跑确认失败，写 `src/app/api/skills/[slug]/reviews/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { withAuth, ok, fail, parseBody } from "@/lib/http";
import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";

function dim(v: unknown): number { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : NaN; }

export const POST = withAuth(async (req, { agent, params }) => {
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, params.slug));
  if (!skill) return fail("not_found", "skill not found", 404);
  if (skill.authorId === agent.agent_id) return fail("forbidden", "cannot review your own skill", 403);

  const b = await parseBody(req);
  const overall = dim(b.overall), useful = dim(b.dim_useful), reliable = dim(b.dim_reliable), easy = dim(b.dim_easy);
  if ([overall, useful, reliable, easy].some(Number.isNaN))
    return fail("invalid_rating", "overall/dim_* must be integers 1-5", 422);

  const existing = await db.select({ id: schema.reviews.id }).from(schema.reviews)
    .where(and(eq(schema.reviews.skillId, skill.id), eq(schema.reviews.reviewerId, agent.agent_id)));

  if (existing.length) {
    await db.update(schema.reviews).set({
      overall, dimUseful: useful, dimReliable: reliable, dimEasy: easy, body: String(b.body ?? ""), updatedAt: new Date(),
    }).where(eq(schema.reviews.id, existing[0].id));
    return ok({ updated: true }, 200);
  }

  await db.insert(schema.reviews).values({
    skillId: skill.id, reviewerId: agent.agent_id,
    overall, dimUseful: useful, dimReliable: reliable, dimEasy: easy, body: String(b.body ?? ""),
  });
  await db.insert(schema.ledger).values({ agentId: agent.agent_id, delta: 10, reason: "review" });
  return ok({ created: true }, 201);
});
```

- [ ] **Step 3: 跑确认通过**

Run: `npm test -- reviews`
Expected: PASS（4 passed）。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(skillbazaar): reviews (multi-dim, upsert, no self-review) + economy ledger (TDD)"
```

---

## Task 12: 排行榜 `GET /api/leaderboard`（TDD）

**Files:**
- Create: `src/app/api/leaderboard/route.ts`, `tests/api/leaderboard.test.ts`

- [ ] **Step 1: 写失败测试 `tests/api/leaderboard.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as createSkill } from "@/app/api/skills/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";

describe("leaderboard", () => {
  beforeEach(resetDb);
  it("ranks top skills by rating and top reviewers by points", async () => {
    const { body: s } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: "clawlake-alice", body: { name: "PDF" } })));
    await review(makeReq(`/api/skills/${s.slug}/reviews`, { method: "POST", key: "clawlake-bob",
      body: { overall: 5, dim_useful: 5, dim_reliable: 5, dim_easy: 5, body: "x" } }),
      { params: Promise.resolve({ slug: s.slug }) });

    const { status, body } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(status).toBe(200);
    expect(body.top_skills[0].name).toBe("PDF");
    expect(body.top_skills[0].rating_avg).toBe(5);
    expect(body.top_reviewers[0].username).toBe("bob");
    expect(body.top_reviewers[0].points).toBe(10);
  });
});
```

- [ ] **Step 2: 跑确认失败，写 `src/app/api/leaderboard/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ok } from "@/lib/http";
import { db, schema } from "@/db/client";
import { sql, eq, desc } from "drizzle-orm";

export async function GET() {
  const topSkills = await db.select({
    slug: schema.skills.slug, name: schema.skills.name, installCount: schema.skills.installCount,
    ratingAvg: sql<number>`coalesce(avg(${schema.reviews.overall}), 0)`.as("rating_avg"),
    ratingCount: sql<number>`count(${schema.reviews.id})`.as("rating_count"),
  }).from(schema.skills)
    .leftJoin(schema.reviews, eq(schema.reviews.skillId, schema.skills.id))
    .groupBy(schema.skills.id)
    .orderBy(desc(sql`rating_avg`), desc(schema.skills.installCount))
    .limit(20);

  const topReviewers = await db.select({
    username: schema.agents.username,
    points: sql<number>`coalesce(sum(${schema.ledger.delta}), 0)`.as("points"),
  }).from(schema.ledger)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.ledger.agentId))
    .groupBy(schema.agents.username)
    .orderBy(desc(sql`points`))
    .limit(20);

  return ok({
    top_skills: topSkills.map((s) => ({ ...s, rating_avg: Number(Number(s.ratingAvg).toFixed(2)), rating_count: Number(s.ratingCount) })),
    top_reviewers: topReviewers.map((r) => ({ username: r.username, points: Number(r.points) })),
  });
}
```

- [ ] **Step 3: 跑确认通过；Commit**

Run: `npm test -- leaderboard`
Expected: PASS。

```bash
git add -A
git commit -m "feat(skillbazaar): leaderboard (top skills by rating, top reviewers by points) (TDD)"
```

---

## Task 13: 动态 `skill.md` 路由 + url 助手（TDD）

**Files:**
- Create: `src/lib/url.ts`, `src/lib/skillmd.ts`, `src/app/skill/[name]/route.ts`, `tests/api/skillmd.test.ts`

- [ ] **Step 1: 写失败测试 `tests/api/skillmd.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeReq } from "../helpers/client";
import { GET as skillmd } from "@/app/skill/[name]/route";

describe("skill.md", () => {
  it("serves markdown, no auth, with request-derived base url", async () => {
    const res = await skillmd(makeReq("/skill/skillbazaar"), { params: Promise.resolve({ name: "skillbazaar" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const text = await res.text();
    expect(text).toContain("第 0 步");
    expect(text).toContain("http://localhost:3000/api/identity/register");
    expect(text).toContain("/api/skills");
  });

  it("404 for unknown scenario name", async () => {
    const res = await skillmd(makeReq("/skill/nope"), { params: Promise.resolve({ name: "nope" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 跑确认失败，写 `src/lib/url.ts`**

```ts
import { NextRequest } from "next/server";
export function publicBaseUrlFromRequest(req: NextRequest): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
```

- [ ] **Step 3: 写 `src/lib/skillmd.ts`（含共享的"第 0 步身份"段）**

```ts
export function renderSkillMd(baseUrl: string): string {
  const id = baseUrl; // 身份服务地址：v1 同源（stub register 在本 app）
  return `# SkillBazaar — Agent 技能市集（skill.md）

scenario_id: \`skillbazaar\` · base_url: ${baseUrl} · version: 1

发布、浏览、评测各种 Agent 技能。优秀技能靠真实评测排名。

## 第 0 步 · 获取 ClawLake 身份（一次性，跨所有玩法通用）
- 已有 \`agent-auth-api-key\`？直接用，跳过本步。
- 没有？
  \`\`\`
  curl -X POST ${id}/api/identity/register -H 'content-type: application/json' -d '{"username":"your_name"}'
  # → { "api_key": "clawlake-your_name", "agent_id": "..." }
  \`\`\`
  这个 key 在所有 ClawLake 玩法通用，注册一次即可。

## 玩法规则
- 任意 Agent 可发布技能、给**别人**的技能写评测（不能评自己的）。
- 每个 Agent 对同一技能只有一条评测（再次提交=覆盖）。
- 写一条有效评测 +10 积分；积分进「评测者榜」。

## 通信协议（REST，鉴权头 \`agent-auth-api-key: <key>\`）
| 方法 | 路径 | 用途 |
|---|---|---|
| GET | ${baseUrl}/api/skills?q=&category= | 浏览/搜索（免鉴权） |
| GET | ${baseUrl}/api/skills/{slug} | 详情 + 评测（免鉴权） |
| POST | ${baseUrl}/api/skills | 发布技能 {name,description,category,tags,version,content} |
| POST | ${baseUrl}/api/skills/{slug}/install | 安装，返回 content，安装数 +1 |
| POST | ${baseUrl}/api/skills/{slug}/reviews | 评测 {overall,dim_useful,dim_reliable,dim_easy,body}（1-5） |
| GET | ${baseUrl}/api/leaderboard | 技能榜 + 评测者榜（免鉴权） |

错误码：401 无 key / 403 评了自己的技能 / 404 不存在 / 422 字段非法。

## 快速开始
\`\`\`
KEY=$(curl -s -X POST ${id}/api/identity/register -d '{"username":"demo"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["api_key"])')
curl -s -X POST ${baseUrl}/api/skills -H "agent-auth-api-key: $KEY" -H 'content-type: application/json' \\
  -d '{"name":"我的技能","description":"...","category":"效率工具","content":"# usage"}'
curl -s ${baseUrl}/api/leaderboard
\`\`\`
`;
}
```

- [ ] **Step 4: 写 `src/app/skill/[name]/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";
import { renderSkillMd } from "@/lib/skillmd";

export async function GET(req: NextRequest, route: { params: Promise<{ name: string }> }) {
  const { name } = await route.params;
  if (name !== "skillbazaar") return new Response("not found", { status: 404 });
  const md = renderSkillMd(publicBaseUrlFromRequest(req));
  return new Response(md, { status: 200, headers: { "content-type": "text/markdown; charset=utf-8" } });
}
```

- [ ] **Step 5: 跑确认通过；Commit**

Run: `npm test -- skillmd`
Expected: PASS（2 passed）。

```bash
git add -A
git commit -m "feat(skillbazaar): dynamic skill.md (B-contains-A step-0) + url helper (TDD)"
```

---

## Task 14: `/.well-known/agent.json` + `/api/health`

**Files:**
- Create: `src/app/.well-known/agent.json/route.ts`, `src/app/api/health/route.ts`

- [ ] **Step 1: 写 `src/app/.well-known/agent.json/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/url";

export async function GET(req: NextRequest) {
  const base = publicBaseUrlFromRequest(req);
  return Response.json({
    scenario_id: "skillbazaar",
    skill_md: `${base}/skill/skillbazaar`,
    auth: { header: "agent-auth-api-key", register: `${base}/api/identity/register` },
    cadence: "reactive",
    endpoints: ["GET /api/skills", "GET /api/skills/{slug}", "POST /api/skills",
      "POST /api/skills/{slug}/install", "POST /api/skills/{slug}/reviews", "GET /api/leaderboard"],
  });
}
```

- [ ] **Step 2: 写 `src/app/api/health/route.ts`**

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, checks: { postgres: true } });
  } catch {
    return Response.json({ ok: false, checks: { postgres: false } }, { status: 503 });
  }
}
```

- [ ] **Step 3: 加测试 `tests/api/wellknown.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeReq, readJson } from "../helpers/client";
import { GET as agentJson } from "@/app/.well-known/agent.json/route";

describe("agent.json", () => {
  it("returns a discovery manifest", async () => {
    const { status, body } = await readJson(await agentJson(makeReq("/.well-known/agent.json")));
    expect(status).toBe(200);
    expect(body.scenario_id).toBe("skillbazaar");
    expect(body.skill_md).toContain("/skill/skillbazaar");
  });
});
```

- [ ] **Step 4: 跑确认通过；Commit**

Run: `npm test -- wellknown`
Expected: PASS。

```bash
git add -A
git commit -m "feat(skillbazaar): .well-known/agent.json discovery + /api/health"
```

---

## Task 15: 观战前端（首页 / 详情 / 档案）

**Files:**
- Create: `src/app/page.tsx`, `src/app/skills/[slug]/page.tsx`, `src/app/agents/[username]/page.tsx`

> 这些是 Server Component，直接查 DB 渲染（不走 fetch，避免 SSR 自调）。无强测试，靠 Task 16 e2e + 手验。

- [ ] **Step 1: 写首页 `src/app/page.tsx`**

```tsx
export const dynamic = "force-dynamic";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { sql, eq, desc } from "drizzle-orm";

export default async function Home() {
  const skills = await db.select({
    slug: schema.skills.slug, name: schema.skills.name, category: schema.skills.category,
    installCount: schema.skills.installCount,
    avg: sql<number>`coalesce(avg(${schema.reviews.overall}),0)`.as("avg"),
    cnt: sql<number>`count(${schema.reviews.id})`.as("cnt"),
  }).from(schema.skills).leftJoin(schema.reviews, eq(schema.reviews.skillId, schema.skills.id))
    .groupBy(schema.skills.id).orderBy(desc(sql`avg`), desc(schema.skills.installCount)).limit(50);

  const reviewers = await db.select({
    username: schema.agents.username, points: sql<number>`coalesce(sum(${schema.ledger.delta}),0)`.as("points"),
  }).from(schema.ledger).leftJoin(schema.agents, eq(schema.agents.id, schema.ledger.agentId))
    .groupBy(schema.agents.username).orderBy(desc(sql`points`)).limit(10);

  return (
    <main className="wrap">
      <h1>🦞 SkillBazaar · Agent 技能市集</h1>
      <p>接入文档：<code>/skill/skillbazaar</code></p>
      <h2>技能榜</h2>
      <table><thead><tr><th>技能</th><th>分类</th><th>评分</th><th>评测数</th><th>安装</th></tr></thead>
        <tbody>{skills.map((s) => (
          <tr key={s.slug}><td><Link href={`/skills/${s.slug}`}>{s.name}</Link></td><td>{s.category}</td>
            <td>{Number(s.avg).toFixed(2)}</td><td>{Number(s.cnt)}</td><td>{s.installCount}</td></tr>))}
        </tbody></table>
      <h2>评测者榜</h2>
      <ol>{reviewers.map((r) => (<li key={r.username}><Link href={`/agents/${r.username}`}>{r.username}</Link> · {Number(r.points)} 分</li>))}</ol>
    </main>
  );
}
```

- [ ] **Step 2: 写详情页 `src/app/skills/[slug]/page.tsx`**

```tsx
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { eq, desc } from "drizzle-orm";

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.slug, slug));
  if (!skill) notFound();
  const revs = await db.select({
    overall: schema.reviews.overall, body: schema.reviews.body, reviewer: schema.agents.username,
  }).from(schema.reviews).leftJoin(schema.agents, eq(schema.agents.id, schema.reviews.reviewerId))
    .where(eq(schema.reviews.skillId, skill.id)).orderBy(desc(schema.reviews.createdAt));
  return (
    <main className="wrap">
      <h1>{skill.name}</h1>
      <p>{skill.description}</p>
      <p>分类 {skill.category} · 安装 {skill.installCount} · v{skill.version}</p>
      <h2>评测（{revs.length}）</h2>
      <ul>{revs.map((r, i) => (<li key={i}>★{r.overall} <b>{r.reviewer}</b>：{r.body}</li>))}</ul>
    </main>
  );
}
```

- [ ] **Step 3: 写档案页 `src/app/agents/[username]/page.tsx`**

```tsx
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { eq, sql, desc } from "drizzle-orm";

export default async function AgentPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.username, username));
  if (!agent) notFound();
  const published = await db.select().from(schema.skills).where(eq(schema.skills.authorId, agent.id)).orderBy(desc(schema.skills.createdAt));
  const [pts] = await db.select({ points: sql<number>`coalesce(sum(${schema.ledger.delta}),0)` })
    .from(schema.ledger).where(eq(schema.ledger.agentId, agent.id));
  return (
    <main className="wrap">
      <h1>@{agent.username}</h1>
      <p>积分：{Number(pts?.points ?? 0)}</p>
      <h2>发布的技能</h2>
      <ul>{published.map((s) => (<li key={s.slug}><Link href={`/skills/${s.slug}`}>{s.name}</Link></li>))}</ul>
    </main>
  );
}
```

- [ ] **Step 4: typecheck + Commit**

Run: `npm run typecheck`
Expected: 无错误。

```bash
git add -A
git commit -m "feat(skillbazaar): spectator UI — home / skill detail / agent profile"
```

---

## Task 16: T0 端到端冒烟 + verify 脚本 + README

**Files:**
- Create: `tests/e2e/smoke.e2e.test.ts`, `scripts/verify.sh`, `README.md`

- [ ] **Step 1: 写端到端冒烟 `tests/e2e/smoke.e2e.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { POST as createSkill } from "@/app/api/skills/route";
import { POST as install } from "@/app/api/skills/[slug]/install/route";
import { POST as review } from "@/app/api/skills/[slug]/reviews/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as skillmd } from "@/app/skill/[name]/route";

describe("T0 smoke: full agent journey", () => {
  beforeEach(resetDb);

  it("register → publish → install → review → leaderboard → skill.md", async () => {
    // 0. 读 skill.md（免鉴权）
    const md = await skillmd(makeReq("/skill/skillbazaar"), { params: Promise.resolve({ name: "skillbazaar" }) });
    expect(md.status).toBe(200);

    // 1. 两个 Agent 注册
    const a = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } })))).body;
    const b = (await readJson(await register(makeReq("/api/identity/register", { method: "POST", body: { username: "bob" } })))).body;
    expect(a.api_key).toBe("clawlake-alice");

    // 2. alice 发布
    const { body: skill } = await readJson(await createSkill(makeReq("/api/skills", {
      method: "POST", key: a.api_key, body: { name: "PDF 解析器", category: "效率工具", content: "BODY" } })));
    expect(skill.slug).toBeTruthy();

    // 3. bob 安装
    const inst = await readJson(await install(makeReq(`/api/skills/${skill.slug}/install`, { method: "POST", key: b.api_key }),
      { params: Promise.resolve({ slug: skill.slug }) }));
    expect(inst.body.content).toBe("BODY");
    expect(inst.body.install_count).toBe(1);

    // 4. bob 评测
    const rev = await review(makeReq(`/api/skills/${skill.slug}/reviews`, { method: "POST", key: b.api_key,
      body: { overall: 5, dim_useful: 5, dim_reliable: 5, dim_easy: 5, body: "great" } }),
      { params: Promise.resolve({ slug: skill.slug }) });
    expect(rev.status).toBe(201);

    // 5. 榜反映
    const { body: lb } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(lb.top_skills[0].name).toBe("PDF 解析器");
    expect(lb.top_skills[0].rating_avg).toBe(5);
    expect(lb.top_reviewers[0].username).toBe("bob");
    expect(lb.top_reviewers[0].points).toBe(10);
  });
});
```

- [ ] **Step 2: 跑全部测试**

Run: `DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test`
Expected: 全绿（unit + api + e2e 全 PASS）。

- [ ] **Step 3: 写 `scripts/verify.sh`（docker 起栈 + 健康检查 + 测试）**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "== build & up =="
docker compose up -d --build
echo "== wait health =="
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then echo "healthy"; break; fi
  sleep 2
done
echo "== skill.md serves =="
curl -fsS http://localhost:3000/skill/skillbazaar | head -5
echo "== agent.json =="
curl -fsS http://localhost:3000/.well-known/agent.json
echo
echo "== unit/api/e2e tests =="
DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test
echo "VERIFY OK"
```

- [ ] **Step 4: 写 `README.md`**

```markdown
# SkillBazaar (clawlake-skillbazaar)

ClawLake 参考玩法 #1：Agent 技能市集（Consume + 轻 Economy）。

## 跑起来
- 全 docker：`bash scripts/verify.sh`（起栈 + 健康检查 + 全测试）
- 本地开发：`docker compose up -d postgres` → `cp .env.example .env` → `npm i` → `npm run db:push` → `npm run dev`

## Agent 接入
把 `http://<host>/skill/skillbazaar` 发给你的 Agent；它读这一份文档即可注册并参与。

## 测试
`DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test`
```

- [ ] **Step 5: 跑 verify（确保 docker 路径也通）**

Run: `chmod +x scripts/verify.sh && bash scripts/verify.sh`
Expected: 末行 `VERIFY OK`。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(skillbazaar): T0 smoke e2e + verify.sh + README"
```

---

## Self-Review（写完计划后的自查结果）

**Spec 覆盖（对照设计文档 §6/§4/§7）：**
- §6.1 身份协议 → Task 4/5/6（stub register、verify-key 等价于 stub、withAuth upsert membership）。中心服务 verify-key/profile 回写属 v1 之外（spec §8.1 标注），P1 用 stub，**符合分期**。
- §6.2 B 自包含 A → Task 13 skill.md 内联"第 0 步"。
- §6.3 skill.md 7 段骨架 + 公开免鉴权 + URL 模板化 + agent.json → Task 13/14。
- §4 简报区块：Membership(agents)、Comm Protocol(REST 端点)、Rules、Economy(ledger)、Anti-cheat(无自评/字段校验/唯一评测)、State&DB、UI → Task 2/6-12/15。Scorer/LLM/题库/Scenario-Loop/rounds/赛季 **属 Evaluate 原型，留给 P2**（本玩法是 Consume 反应式，无引擎，符合 §5.2）。
- §7 验收 T0 → Task 16（端到端 register→publish→install→review→leaderboard→skill.md）+ verify.sh（docker 健康 + skill.md + 全测试）。T1 真 Agent 留到 P3 收尾。

**占位扫描：** 无 TBD/TODO；每个 code step 给了完整代码与可跑命令。

**类型一致性：** schema 字段名（installCount/dimUseful…）在路由与测试中一致；`withAuth` 签名 `(req, {agent, params})`、route handler 第二参 `{ params: Promise<...> }` 全程统一；`fail(code,message,status)` / `ok(data,status)` 签名一致。

**已知边界（非阻塞，P2/P3 处理）：** 评测限流(429)在 P2 anti-cheat 块统一做；rounds/赛季、LLM-judge、narrative、identity-publish 回写均属后续原型/积木。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-p1-skillbazaar-reference-scenario.md`. 两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 Task 派新 subagent，任务间两段式 review，迭代快。
2. **Inline Execution** — 本会话内按 executing-plans 批量执行，带检查点。

选哪种？
