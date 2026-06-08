# scenario-builder-skill

Claude Code skill 仓库，用于生成 ClawLake agent-first 场景玩法。每个生成的场景是独立的 Next.js + Drizzle/Postgres 应用。

## 使用方式

使用者须将整个仓库置于 Claude Code 可访问路径（克隆到本地或作为项目根目录），然后通过 `SKILL.md` 触发 `scenario-builder` skill。

## 核心文件

| 文件 / 目录 | 用途 |
|------------|------|
| `SKILL.md` | Skill 入口，定义 6 阶段流水线 |
| `schema/scenario.schema.json` | scenario.json 的 JSON Schema |
| `references/` | 阶段参考文档（archetype 表、block 规则、设计指南等）；`agent-event-sensing.md` 记录 cron 轮询方案 |
| `templates/` | Handlebars 模板（base Tier-B + blocks + design mockup） |
| `examples/` | 4 个参考 scenario.json（仅作格式参考） |
| `scripts/` | 生成器脚本（validate、new-scenario、verify、design-preview） |

## 三个参考场景

| 目录 | Archetype | Cadence |
|------|-----------|---------|
| `clawlake-skillbazaar/` | Consume | reactive |
| `clawlake-ability-arena/` | Evaluate | scheduled |
| `clawlake-crypto-pit/` | Evaluate (Custom) | scheduled |

## 常用命令

```bash
# 校验 scenario.json
node scripts/validate.mjs path/to/scenario.json

# 生成新场景
bash scripts/new-scenario.sh path/to/scenario.json --out clawlake-<slug>

# 预览设计 mockup
bash scripts/design-preview.sh <玩法>/design [port]

# 启动生成的场景（Docker 全栈，一条命令）
# 自动完成：postgres → migrate（db:push + seed）→ web + engine
cd clawlake-<slug> && docker compose up --build

# 本地开发（postgres 已运行）
cd clawlake-<slug>
cp .env.example .env
npm install
DATABASE_URL=... npm run db:push
DATABASE_URL=... npx tsx src/db/seed.ts
npm run dev:all       # web + engine 同时启动（scheduled 场景）

# 全栈 Docker 验收
bash scripts/verify.sh clawlake-<slug>

# 运行生成器自身的测试
npm test
```

> ⚠️ `src/db/seed.ts` 是 Fill 阶段手动创建的文件（无脚手架模板），docker-compose 的 `migrate` 服务依赖它。Fill 时必须创建，否则 `docker compose up` 在 migrate 阶段报错。

## 修改 skill 时的约束

- **改 SKILL.md**：6 阶段顺序和门控逻辑不得破坏；红旗规则（Red flags）必须保留。
- **改 templates/**：改动后须用参考场景回归验证——`bash scripts/new-scenario.sh examples/skillbazaar.scenario.json --out /tmp/regen-sb --force && cd /tmp/regen-sb && npm test`。
- **改 schema/scenario.schema.json**：同步更新 `references/scenario-schema.md` 的字段字典。
- **改 scripts/**：`npm test` 必须全绿（`scripts/**/*.test.mjs`）。
- **不要**在参考场景目录（`clawlake-*/`）里做实验性改动；它们是回归基线。

## v1 支持范围

- Archetype：Consume、Evaluate、Compete、Social（其余 4 种在 `references/archetypes.md` 有设计，模板未实现）
- Cadence：reactive、scheduled（realtime 延至 v2）

## Skill 扩展指南

新增 archetype 类型、block、或其他 skill 能力时，必须先阅读：

- `docs/agent_doc/skill_feature_expansion.md` — 完整操作步骤、22 处变更清单、8 个常见陷阱
