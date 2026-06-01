# ClawLake scenario-builder — P3 交接文档（新 session 先读这份）

> 日期：2026-06-02。上一段 session 的 context 快满，这份是续做 **P3** 的交接。

---

## ✅ P3 DONE（2026-06-02 完成）

**状态：DONE。** scenario-builder 技能本体已建成并通过验收，合并回 `main`。

- **设计 spec：** `docs/superpowers/specs/2026-06-02-p3-scenario-builder-extraction-design.md`
- **TDD 计划：** `docs/superpowers/plans/2026-06-02-p3-scenario-builder.md`
- **交付物（全部就位）：** `schema/scenario.schema.json`、`examples/{skillbazaar,ability-arena}.scenario.json`、`templates/base/`（Tier-A 字面 + Tier-B handlebars）、`templates/blocks/`（engine/lifecycle/scorer/llm/anticheat/identity-publish/economy + manifest）、`templates/partials/step0-identity.hbs`、`templates/skill.md.hbs`、`scripts/{validate,new-scenario}.mjs`+`lib/{derive,render}.mjs`、`scripts/{new-scenario,verify}.sh`、`SKILL.md`、`references/`（7 篇）。
- **机制：** `scenario.json`（ajv 校验）→ `new-scenario.mjs`（Node + handlebars：Tier-A 拷 + Tier-B 渲染 + 按 manifest 条件叠加 blocks + schema 合并）→ Claude 受约束 Fill（domain schema 列 / 路由体 / engine tick / seed / UI / skill.md 散文）。
- **验收（全绿）：** 生成器单测 17/17；**从 scenario.json 重生成 P1（reactive）过其 29 测试、P2（scheduled）过其 27 测试，零模板改动**（base+blocks+renderer 一次拼对）。final opus review 通过（fix 后）。
- **v1 范围：** 原型 Consume + Evaluate；cadence reactive + scheduled。realtime（redis+worker）/ Compete / 其余原型 = v2 设计保留。
- **已知 v2 增强（非阻塞）：** 重跑脚手架目前是「非空目录拒写，`--force` 全量重渲染」；**跨 run 的 per-region Fill-merge（保留 `// === FILL:domain ===` 区已填内容）留待 v2**。生成的 schema.ts 会带 base 超集 import（含未必用到的 `jsonb`），`tsconfig` 无 `noUnusedLocals` 故无害。

下文是当初的 P3 启动交接（保留作历史背景）。

---

## 现在在哪

- **ClawLake** = 面向 AI Agent 的「场景玩法」平台。真正目标 = 做出 `scenario-builder`（一个 Claude Code 技能），用抽取出的共性**批量生成**更多同类玩法。
- **P1、P2 已完成并合并进 `main`。** 两个**结构迥异**的参考玩法已就位 —— 这就是 P3 抽模板的经验依据：
  - `clawlake-skillbazaar/` — **P1，反应式内容型**（Consume + 轻 economy）。**无引擎**，逻辑在 API 路由里。29 测试，verify OK。
  - `clawlake-ability-arena/` — **P2，调度式 Evaluate 型**（双进程：web + 常驻 cron `engine`）。27 测试，verify OK。
- 本仓库是**本地 git**（无 remote），在 `main`。最新 commit `8c12312` 附近。

## P3 要做什么

把 P1 与 P2 的共性**抽取**成 `scenario-builder` 技能本体（就放在本仓库根 = `scenario-builder-skill/`）。交付物（见主设计文档 §3.2）：
- `SKILL.md` — 5 阶段流程（Conceive→Brief→Scaffold→Fill→Verify）
- `references/` — common-patterns.md / archetypes.md / building-blocks.md / identity-protocol.md / scenario-brief.template.md / verification.md
- `templates/base/` — 干净基座（**P1 和 P2 都有的**部分）
- `templates/blocks/` — 可选跨切面积木（**只 P2 有的**部分）
- `templates/skill.md.hbs`（含共享的「第 0 步身份」partial）
- `scripts/new-scenario.sh`、`scripts/verify.sh`
- **验收方式**：用生成器从一份 `scenario.json` **重新生成 P1（SkillBazaar）和 P2（Ability Arena）并过各自的冒烟测试**。能重生成 = 共性抽对了。

## base vs blocks 分析（P3 的核心输入，由 P1↔P2 对比得出）

**两者都有 → 进 `templates/base`：**
- stub 身份：`src/lib/ids.ts`、`auth.ts`、`http.ts`（ok/fail/withAuth+错误信封/parseBody）、`url.ts`
- `src/db/client.ts`（通用）；drizzle + vitest + Next 脚手架；Dockerfile/.dockerignore/docker-compose(postgres+web)；layout/globals
- `register` + `agents/me` 路由
- 动态 `skill/[name]/route.ts` + `lib/skillmd.ts`（内联「第 0 步」身份 partial）、`.well-known/agent.json`、`api/health`
- 观战 UI 壳（home/detail/profile server-component 套路）
- 测试基建（resetDb、makeReq/readJson）
- 约定：路由首行 `runtime=nodejs`+`force-dynamic`；vitest singleFork 串行；错误信封 `{error,code,message}`；**路由 handler 首参必须非可选**（`next build` 要求）

**只 P2（调度/Evaluate）有 → 进 `templates/blocks`：**
- `src/engine/`（`loop.ts` cron tick + `index.ts` setInterval 入口）= **调度循环积木**（cadence=scheduled）
- `blocks/llm.ts`（mock + 真 OpenAI-compatible）= **LLM Access 积木**
- `engine/scorer.ts`（judge + 缓存）= **scorer 积木**；`engine/ranking.ts` = 排名
- `blocks/anticheat.ts`（限流 + no_subagent 声明）= **anti-cheat 积木**
- `blocks/identity-publish.ts` = **身份回写积木**
- rounds/赛季生命周期 schema 模式（seasons/questions/submissions/scores/season_rankings）
- docker-compose 的 `engine` service

**只 P1 有 → Economy 积木：** `ledger` 表 + 钱包/积分 + 评测经济。

**P3 必须抓住的关键结构轴：cadence = 反应式（P1，无引擎，逻辑在路由）vs 调度式（P2，常驻 engine 进程 + docker engine 服务）。** base 要能同时支撑两者；engine 只在 scheduled cadence 时作为积木叠加。

## scenario.json（spec→codegen 契约）— P3 里要设计的形态

见主设计文档 §4：identity/meta（scenario_id、名称、原型 primary+secondary+跨切面勾选）、membership、comm-protocol（端点、cadence）、rules、scorer（Evaluate 带题库）、跨切面（economy/llm/external/anticheat/narrative/identity-publish）、state&DB（实体含 season/round 生命周期）、UI、scenario-loop（cadence）。**具体字段在 P3 里定**——办法是：分别为 P1、P2 各写一份 `scenario.json`，看两者**差异**的字段就是真正要参数化的。

## v1 范围（主设计文档 §1.3）

v1 = base + **Consume + Evaluate** 两原型 + 它们需要的积木。**Compete/实时层（redis+worker）推迟到 v2。** 所以 P3 生成器只需能重生成 P1（Consume）和 P2（Evaluate）。

## 怎么跑 / 环境

- 仓库：`/Users/anfernee/projects/scenario-builder-skill`（= cwd）。本地 git，分支 `main`。
- P1 测试：`cd clawlake-skillbazaar && DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5432/skillbazaar npm test`（postgres 在 5432）
- P2 测试：`cd clawlake-ability-arena && DATABASE_URL=postgres://clawlake:clawlake@127.0.0.1:5433/abilityarena LLM_MOCK=1 npm test`（postgres 在 5433）
- 每个玩法 `bash scripts/verify.sh` 跑全 docker 栈（先停掉另一个玩法的 web 容器以释放 3000 端口）
- LLM 判分默认 `LLM_MOCK=1`（确定性、无需 key）；真判分填 `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`
- docker 容器可能还开着；清理：各玩法目录 `docker compose down`

## P3 该走的流程（同 P1/P2）

1. `superpowers:brainstorming` — 敲定抽取边界（base vs blocks）、`scenario.json` 形态、`new-scenario.sh` 怎么工作（模板替换 vs Claude-Code 受约束生成）。写一份 P3 设计 spec。
2. `superpowers:writing-plans` — bite-sized TDD 计划。
3. `superpowers:subagent-driven-development` — 在分支 `p3-...` 上执行，分批 implementer→review，最后 opus 整体 review，合并回 main。

## 约束 / 偏好（重要）

- **committed 文档/代码里不得出现来源产品名**（用户在意不留"抄袭"痕迹）。一切以 ClawLake 自有产品口径表述，用通用品类词。
- 每个玩法自包含、各自 vendoring；玩法间只共享契约 = skill.md 规范 + 身份协议。
- 依赖：假定有一个中心 ClawLake 身份服务（开发期用 AUTH_STUB 顶替；identity-publish 也 stub）。谁来建 = 待定（主设计文档 §8.1）。

## 新 session 先读这些

- `docs/superpowers/specs/2026-06-01-clawlake-scenario-builder-design.md` — **主设计文档（权威）**
- `docs/superpowers/specs/2026-06-01-p2-ability-arena-design.md` — P2 设计，其 §7 专门写了"复用 vs 差异（给 P3 的信号）"
- `docs/superpowers/plans/2026-06-01-p1-skillbazaar-reference-scenario.md`、`...p2-ability-arena.md` — 实际建了什么
- 两个玩法目录本身（`clawlake-skillbazaar/`、`clawlake-ability-arena/`）
- 记忆会自动加载（clawlake-project、scenario-common-patterns）
