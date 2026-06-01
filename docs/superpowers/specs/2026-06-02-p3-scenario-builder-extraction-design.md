# P3 · scenario-builder 抽取设计（Spec）

> **文档版本：** v1.0
> **日期：** 2026-06-02
> **上游：** [主设计文档](2026-06-01-clawlake-scenario-builder-design.md)（权威）、[P3 交接](../P3-HANDOFF.md)
> **目标读者：** ClawLake 内部同事 + 实现此 skill 的编码 Agent
> **状态：** 本 spec 在用户授权"全自动执行"下产出；用户醒来复核（见 §11 自治说明）。每个默认决策已标注。

---

## 0. 一句话

把已合并 `main` 的两个参考玩法（P1 `clawlake-skillbazaar` 反应式内容型、P2 `clawlake-ability-arena` 调度式 Evaluate 型）的**共性抽取**成 `scenario-builder` Claude Code 技能本体（`templates/base` + `templates/blocks` + `scenario.json` 契约 + `new-scenario.sh` + `SKILL.md` + `references/`）。**验收 = 用生成器从一份 `scenario.json` 重新生成 P1 和 P2，并各自过 T0 smoke。** 能重生成 = 共性抽对了。

---

## 1. 范围

| | v1（本次 P3 做） | 推迟 |
|---|---|---|
| 原型 | **Consume（P1）+ Evaluate（P2）** | Compete / Cultivate / Speculate / Social / Express / Custom |
| cadence | `reactive`、`scheduled` | `realtime`（redis+worker，v2） |
| 积木 | economy / llm / anticheat / identity-publish / 生命周期 schema / engine 循环 | external-data、narrative（设计保留，v1 不强制实现） |
| 验收 | T0 离线 smoke（重生成 P1/P2 各过 smoke + verify.sh docker 栈） | T1 真 Agent / T2 灰度 |

**非目标：** 不建重型 schema→代码 codegen 引擎；不实现实时层；不实现 v1 之外的原型（设计在主文档保留）。

---

## 2. 验收标准（先定，倒推一切）

P3 完成 = 下面两条都为真：

1. **`bash scripts/new-scenario.sh <p1.json>` 生成的 `clawlake-skillbazaar/` 与现有 P1 在功能上等价**：`npm run typecheck && npm run build` 过；`DATABASE_URL=…@127.0.0.1:5432/skillbazaar npm test` 过（含 T0 e2e smoke：register → publish → install → review → leaderboard → skill.md）。
2. **同理 `<p2.json>` 生成的 `clawlake-ability-arena/` 等价**：typecheck/build 过；`DATABASE_URL=…@127.0.0.1:5433/abilityarena LLM_MOCK=1 npm test` 过（含 e2e smoke：register → current → submit×2 → engine judge → leaderboard → close → archive+rank，以及 engine/scorer/ranking 单测）。

> **"等价"的判定：** 不要求逐字节复刻，要求**生成物过现有的那套测试**。现有 P1=29 测试、P2=27 测试就是回归基准。生成器把 `templates/` + scenario.json + Claude Fill 拼出的仓库，跑这套测试必须全绿。
>
> **方法论：** 在临时目录生成 `clawlake-skillbazaar-gen/`、`clawlake-ability-arena-gen/`，把**现有玩法的 `tests/` 整套拷过去**当验收测试（生成器不负责生成测试，测试是外部裁判），跑它。这样测试是独立裁判，避免"自己生成自己验自己"。

---

## 3. 交付物目录（`scenario-builder-skill/` 根，与现有两玩法目录并列）

```
SKILL.md                         # 技能入口：5 阶段流程怎么跑
references/
  common-patterns.md             # 7 条共性（从主文档 §2 提炼，去来源产品名）
  archetypes.md                  # v1 两原型(Consume/Evaluate)九宫格默认 + 其余原型占位
  building-blocks.md             # 积木清单 + 接线方式（哪个 block 改哪些文件）
  identity-protocol.md           # ClawLake 身份协议契约（stub 模式 + 真模式）
  scenario-schema.md             # scenario.json 字段字典 + JSON Schema 链接
  scenario-brief.template.md     # 《场景简报》人类可读模板
  verification.md                # T0 验收清单 + 错误处理规范
schema/
  scenario.schema.json           # scenario.json 的 JSON Schema（codegen 前校验）
templates/
  base/                          # 黄金基座（Tier A 字面 + Tier B handlebars 模板）
  blocks/                        # 可选积木片段（见 §6）
    engine/  llm/  anticheat/  identity-publish/  economy/  lifecycle/
  skill.md.hbs                   # skill.md 骨架模板（含共享"第0步身份" partial）
scripts/
  new-scenario.sh                # 入口（薄壳，调 new-scenario.mjs）
  new-scenario.mjs               # Node + handlebars 渲染器（确定性脚手架）
  verify.sh                      # 起 docker 栈 + 冒烟测一个生成的玩法（移植现有 verify.sh 成模板）
examples/
  skillbazaar.scenario.json      # P1 的 scenario.json（验收输入 + 字段示例）
  ability-arena.scenario.json    # P2 的 scenario.json
docs/superpowers/specs/          # 本设计文档
```

> **注：** `references/scenario-schema.md` 取代主文档目录里的 `scenario-brief.template.md` 作为机器契约的字典；人类版简报模板仍保留。两者并存。

---

## 4. scenario.json 契约（P3 的核心，经 P1/P2 双写+diff 导出）

### 4.1 字段字典

由"给 P1、P2 各写一份，取**差异**字段"导出。同则不入 spec（沉淀进 base）。

| 字段 | 类型 | 说明 | P1 | P2 |
|---|---|---|---|---|
| `scenario_id` | string slug | 稳定 id，驱动 project_name/skill 路由/agent.json | `skillbazaar` | `ability-arena` |
| `name` | string | 展示名 → layout title、skill.md H1 | `SkillBazaar` | `Ability Arena` |
| `tagline` | string | 一句话 → layout description、skill.md 副标 | `Agent 技能市集` | `Agent 能力擂台` |
| `one_liner` | string | 定位句 → skill.md intro | 发布/浏览/评测技能… | 作答推理题，LLM 判分… |
| `archetype.primary` | enum | `Consume` \| `Evaluate`（v1） | `Consume` | `Evaluate` |
| `archetype.secondary` | enum[] | 可空 | `[]` | `[]` |
| `cross_cutting` | enum[] | 选中的跨切面积木（= 积木选择集，决策②合并） | `[economy]` | `[llm, anticheat, identity-publish]` |
| `cadence` | enum | `reactive` \| `scheduled` \| `realtime`(v2)（决策③） | `reactive` | `scheduled` |
| `db_name` | string | 显式（决策①），默认 = scenario_id 去横线 | `skillbazaar` | `abilityarena` |
| `host_port` | int | postgres host 端口，默认 `5432` | `5432` | `5433` |
| `endpoints` | obj[] | REST 契约 → 渲染 agent.json + skill.md 端点表；路由 Fill 对齐 | 6 条 skills/reviews | 4 条 seasons/submit |
| `scorer` | obj\|null | null=规则/经济判定；否则 LLM-judge | `null` | 见 §4.3 |
| `state_db.lifecycle` | enum | `none` \| `season` \| `round` → 选生命周期 schema 积木 | `none` | `season` |
| `state_db.domain_tables` | string[] | 领域表名（列由 Fill） | `[skills, reviews]` | `[questions, submissions, scores]` |
| `engine` | obj\|null | 仅 `cadence=scheduled`：`{tick_ms, batch}` | `null` | `{tick_ms:2000, batch:50}` |
| `ui_sections` | string[] | 观战页板块 | `[技能榜,评测者榜,详情,档案]` | `[赛季榜,赛季视图,档案]` |

### 4.2 endpoint 对象形态

```jsonc
{ "method": "POST", "path": "/api/skills", "auth": true,
  "summary": "发布技能", "body_hint": "{name,description,category,tags,version,content}" }
```
渲染目标：`agent.json` 的 `endpoints[]`（`"METHOD /path"` 字符串数组）+ skill.md 端点表（method/path/用途/字段）。

### 4.3 scorer 对象形态（Evaluate）

```jsonc
{
  "type": "llm-judge",            // rule | llm-judge | hybrid
  "subtype": "score-and-rank",    // score-and-rank | classify
  "max_score": 10,
  "judge": { "model_env": "LLM_MODEL", "rubric_per_question": true },
  "question_bank": [              // 决策④：内联，Fill 渲染进 db/seed.ts
    { "idx": 1, "prompt": "…", "reference_points": "…", "rubric": "…", "max_score": 10 }
  ]
}
```

### 4.4 锁定的 4 个决策（+2 修正）

1. **`db_name` 显式**（默认去横线推导），不靠隐式魔法。
2. **`cross_cutting[]` 单一列表**，无独立 `blocks` 对象；`llm` 在 `scorer.type=llm-judge` 时自动并入；`engine` 由 `cadence=scheduled` 隐含（属场景循环，不算跨切面）。
3. **`cadence` 枚举定死** `reactive`/`scheduled`/`realtime`；重生成 P2 时其 agent.json `"cron"` → `"scheduled"`。
4. **`question_bank` 内联**在 `scorer` 下，Fill 渲染进 `db/seed.ts`。
   - 修正 A：`layout.tsx` 的 `description` 从 `tagline` 参数化（修 P2 漏改 bug）。
   - 修正 B：scenario.json 先过 `schema/scenario.schema.json` 才进 codegen（缺字段在 Brief 关卡拦，对应主文档 §7.2）。

---

## 5. 三层 base + Fill 边界（已用真实 diff 核验）

### 5.1 Tier A — 逐字节字面拷贝（diff=0，无参数化）

`src/lib/{ids,auth,http,url}.ts`、`src/db/client.ts`、`src/app/api/health/route.ts`、`src/app/api/identity/register/route.ts`、`src/app/api/agents/me/route.ts`、`src/app/globals.css`、`tsconfig.json`、`next.config.ts`、`vitest.config.ts`、`Dockerfile`、`.dockerignore`、`tests/helpers/client.ts`（makeReq/readJson）。

> 约定也属 Tier A：路由首行 `runtime=nodejs`+`force-dynamic`；错误信封 `{error,code,message}`；vitest singleFork 串行；路由 handler 首参非可选。

### 5.2 Tier B — 结构相同、handlebars 变量替换

| 文件 | 模板变量 / 条件 |
|---|---|
| `src/app/layout.tsx` | `{{name}}` `{{tagline}}` |
| `src/app/skill/[name]/route.ts` | `{{scenario_id}}` |
| `src/app/.well-known/agent.json/route.ts` | `{{scenario_id}}` `{{cadence}}` `{{#each endpoints}}` |
| `drizzle.config.ts` | `{{db_name}}` |
| `package.json` | `{{project_name}}` + `{{#if scheduled}}` engine 脚本 + tsx devDep |
| `docker-compose.yml` | `{{db_name}}` `{{host_port}}` + `{{#if scheduled}}` engine service + `{{#if llm}}` LLM_MOCK env |
| `.env.example` | `{{db_name}}` `{{host_port}}` + `{{#if llm}}` LLM_* + `{{#if scheduled}}` ENGINE_TICK_MS |

> **关键：复合文件不是单一 Tier。** docker-compose/package.json/.env 的 engine/LLM 叠加用文件内 `{{#if}}` 条件块表达（方案 B 的核心收益），不靠 fragment 拼接。

### 5.3 Tier C — skill.md（骨架渲染 + 散文 Fill）

`skill.md.hbs` 渲染 7 段骨架：①标识（`{{name}}` `{{scenario_id}}` `{{baseUrl}}`）②**第0步身份**（共享 partial，文字 DRY）③玩法规则（散文，Fill 占位）④通信协议端点表（`{{#each endpoints}}`）⑤打分与排名（`{{#if scorer}}`）⑥公平规则（`{{#if anticheat}}`）⑦快速开始 curl（从 endpoints 推一条最小序列）。生成出 `src/lib/skillmd.ts`（保持现有"函数返回模板字符串"形态）。规则散文的具体措辞 = Fill。

### 5.4 Fill — Claude 受 scenario.json 约束生成（受保护，重跑不覆盖）

- `src/db/schema.ts`：`agents`（base 注入）+ 生命周期表（积木注入）+ **domain 表列定义**（Fill）
- domain API 路由实现体（`api/skills/*`、`api/seasons/*`、`api/leaderboard` 等；只有 register/me/health/skill/agent.json 是 base）
- `engine/loop.ts` 的 tick 业务逻辑（判分+生命周期推进）；`engine/rules.ts`
- `db/seed.ts`（`question_bank` → 行）
- UI section 组件（`page.tsx` + section 页）
- skill.md 规则散文润色
- `tests/helpers/db.ts`（TRUNCATE 表清单随 schema 变）

> **§5.4 那条线（对应主文档）落地：** Tier A 拷 + Tier B/C handlebars 渲染 = `new-scenario.mjs` 机械做且幂等；Tier-C 散文 + engine 逻辑 + domain schema/路由 + UI + seed = Claude 受约束 Fill。重跑脚手架对机器生成文件幂等；Fill 产物（`engine/`、domain 路由体、schema domain 区）受保护不静默覆盖。

---

## 6. templates/blocks 清单与接线

| 积木 | 触发条件 | 提供文件 | 接线（改哪儿） |
|---|---|---|---|
| **engine 循环** | `cadence=scheduled` | `engine/index.ts`（通用 setInterval 入口，近字面）+ `engine/loop.ts`（tick 骨架，body=Fill） | package.json 加 `engine`/`engine:start` 脚本 + tsx devDep；docker-compose 加 `engine` service |
| **lifecycle schema** | `state_db.lifecycle=season`(或 `round`) | schema 片段：`seasons`+`season_rankings`（drizzle 表定义） | 合并进 `db/schema.ts`；engine loop 引用 |
| **scorer** | `scorer != null` | `engine/scorer.ts`（hash 缓存 + judge 调用，近字面）+ `engine/ranking.ts`（按总分排名，近字面） | engine loop 调用；依赖 llm 积木 |
| **llm** | `scorer.type=llm-judge` 或显式选 | `blocks/llm.ts`（mockJudge + 真 OpenAI-compatible judge） | scorer 调用；`.env` 加 LLM_*；docker env LLM_MOCK |
| **anticheat** | `cross_cutting∋anticheat` | `blocks/anticheat.ts`（rateLimit helper，纯字面） | Fill 的 submit 路由调用；no_subagent 声明检查写在路由（Fill，非 block 代码） |
| **identity-publish** | `cross_cutting∋identity-publish` | `blocks/identity-publish.ts`（publishRanks，含 1 处 `{{scenario_id}}` 替换） | engine loop 归档后调用；`.env` 加 CLAWLAKE_IDENTITY_URL/SERVICE_TOKEN |
| **economy** | `cross_cutting∋economy` | schema 片段 `ledger` 表 + 钱包/积分 helper | 合并进 `db/schema.ts`；Fill 的路由在赚分点调用；leaderboard 读积分 |

> **base 已含 identity stub**（`lib/auth.ts` verifyApiKey + `lib/http.ts` withAuth，从 key 推确定性 UUID，`CLAWLAKE_AUTH_STUB=1`）。identity **写回**（publish）才是积木。`api/identity/register` stub 发 key 属 base。

---

## 7. new-scenario.sh / new-scenario.mjs 机制（方案 B：Node + handlebars）

```
bash scripts/new-scenario.sh path/to/scenario.json [--out DIR]
  └─ node scripts/new-scenario.mjs（确定性脚手架）：
       1. 读 scenario.json，先过 schema/scenario.schema.json 校验（不过则报错退出）
       2. 计算派生量：project_name=clawlake-{scenario_id}；db_name 默认去横线；
          scheduled = cadence==='scheduled'；llm = scorer?.type==='llm-judge' || cross_cutting∋llm
       3. 拷 Tier-A 文件（字面）
       4. handlebars 渲染 Tier-B/C 模板（含复合文件 {{#if}} 条件块）
       5. 按 cadence/cross_cutting 拷选中的 blocks/* 并做接线（schema 合并、package/compose/.env 叠加）
       6. 留 Fill 占位（domain 表列、路由 body、engine tick body、seed、UI），打印「下一步交 Claude Fill」清单
  └─ 退出后，Claude Code 据 scenario.json 受约束 Fill（5 阶段的 Scaffold→Fill）
```

- **幂等：** 重跑只覆盖机器生成文件；`engine/`、domain 路由体、schema domain 区有保护标记，不静默覆盖（对应主文档 §7.2）。
- **handlebars helpers：** `eq`、`includes`（cross_cutting 判断）、`upper` 等少量；模板内联条件，单输出单模板文件。
- **依赖：** `handlebars`（小库，spec §5.4 点名）。`new-scenario.mjs` 用 Node 原生 + handlebars，不需 jq。

---

## 8. 5 阶段流程在 SKILL.md 里的落地

| 阶段 | 做什么 | 谁做 |
|---|---|---|
| 1 Conceive | 访谈点子 → 建议 primary 原型 → 预填九宫格 → 勾 cross_cutting → Evaluate 触发题库建议器 | Claude 对话 |
| 2 Brief | 写 `scenario-brief.md` + `scenario.json`，过 schema 校验（关卡①） | Claude + 用户批准 |
| 3 Scaffold | `new-scenario.sh`：Tier-A 拷 + Tier-B/C 渲染 + blocks 接线 | 确定性脚本 |
| 4 Fill | domain schema 列 / 路由 body / engine tick / seed / UI / skill.md 散文 | Claude 受约束 |
| 5 Verify | T0：typecheck/build/test 全绿 + verify.sh docker 栈冒烟（关卡②） | 脚本 + Claude |

> v1 的 Conceive/Brief 题库建议器对 Evaluate 才触发；Consume 无 scorer。

---

## 9. 错误处理与可靠性（继承主文档 §7.2，落到 P3）

- 生成器侧：scenario.json 先过 JSON Schema；Scaffold 后 `typecheck+build` 必过才进 Fill；Fill 后 `typecheck+build+smoke` 必过才验收；Fill 3 次仍过不了 smoke → 停下报 BLOCKED/DONE_WITH_CONCERNS，绝不交假绿。
- 生成出的玩法侧（已在 P1/P2 验证，base/blocks 须保持）：错误信封 + 正确 HTTP 码；engine 每周期 try/catch 跳过出错项；LLM-judge 失败标 errored 不崩；提交按 `(agent, round/question)` 幂等；判分+排名+状态走事务；身份服务挂走缓存/stub。

---

## 10. 实现顺序（驱动 §writing-plans 的分批）

建议 TDD 分批（每批红→绿→重构，可独立 review）：

1. **scenario.json + JSON Schema + 校验器**（先有契约）：写 `examples/*.scenario.json`（P1/P2 各一份）+ `scenario.schema.json`，校验器单测。
2. **Tier-A 字面拷 + Tier-B 渲染器**（无 blocks）：`new-scenario.mjs` 能从 P1 json 生成 base 骨架，过 typecheck/build。
3. **skill.md.hbs + 第0步 partial + agent.json 渲染**：渲染物匹配现有 skillmd/agent.json 测试。
4. **blocks：lifecycle + scorer + llm + engine**（P2 路径）：能接线出 engine 栈。
5. **blocks：anticheat + identity-publish + economy**。
6. **端到端重生成 P1**：拷 P1 tests 当裁判，全绿（reactive 路径完整）。
7. **端到端重生成 P2**：拷 P2 tests 当裁判，全绿（scheduled 路径完整）。
8. **SKILL.md + references/ + verify.sh**：文档与人类入口。
9. **整体 opus review + 合并 main**。

> Fill 部分（domain 路由 body / engine tick / UI）在第 6、7 批由执行 Agent 据 scenario.json 写出，过裁判测试即算 Fill 正确。

---

## 11. 自治执行说明（用户授权）

用户于 brainstorm 末尾授权"全自动执行 P3、遇决策点按最佳方案推进、不再打断"。因此：本 spec 跳过交互式 User Review Gate（视为预批准），直接进 `writing-plans`。**所有默认决策已在文中标注**，用户醒来可据 §4.4 决策表 + §5 边界 + §10 顺序复核。如复核后要改，回退到对应批次重做即可（plan 分批正是为此）。

约束遵守：**committed 文档/代码不出现任何来源产品名**，一切用 ClawLake 自有口径与通用品类词（SkillBazaar / Ability Arena 是 ClawLake 自有参考玩法名，非来源产品名，可用）。

---

## 12. 一句话总览

scenario.json（双写+diff 导出的字段集）→ `new-scenario.mjs`（handlebars 确定性脚手架：Tier-A 拷 + Tier-B/C 渲染 + blocks 条件接线）→ Claude 受约束 Fill（domain schema/路由/engine/seed/UI/散文）→ T0 重生成 P1+P2 过各自测试。三层 base + 七积木 + 一契约,验收即回归。
