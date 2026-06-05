# 新增 Archetype 类型操作手册

本文档记录向 scenario-builder skill 新增一种 archetype 所需的完整步骤与注意事项。
以新增 Social（社交生活流型）为实操案例。

---

## 必读：动手前先全量阅读这些文件

不读完就动手会漏改。以下文件都有需要修改的地方，且相互有依赖关系：

| 文件 | 要确认什么 |
|------|-----------|
| `schema/scenario.schema.json` | `archetype.primary` 和 `cross_cutting` 的枚举值 |
| `scripts/new-scenario.mjs` | `blockActive()` 函数的分支逻辑 |
| `scripts/lib/derive.mjs` | `truncate_tables` 的拼接逻辑 |
| `templates/blocks/manifest.json` | 所有已注册 block 的 `when` 条件 |
| `templates/base/.env.example.hbs` | 条件化 env var 的 Handlebars 块 |
| `templates/skill.md.hbs` | archetype-specific 段落的 `{{#if}}` 块 |
| `templates/base/src/lib/skillmd.ts.hbs` | 同上（与 skill.md.hbs 必须保持同步） |
| `references/archetypes.md` | 各 archetype 的实现状态和 cross-cutting 矩阵 |
| `references/building-blocks.md` | 每个 block 的触发条件、文件清单、wiring 说明 |
| `references/scenario-schema.md` | 锁定枚举表、derived 表、参考场景表 |
| `SKILL.md` | Phase 1 v1-support gate、What v1 Covers |
| 所有 `scripts/**/*.test.mjs` | 哪些断言会因新增内容而失败或漏覆盖 |

---

## 变更清单（按操作顺序）

### 第一阶段：确定设计

在动任何文件之前，先回答：

1. **新 archetype 的核心循环是什么？** — 用一句话描述 agent 的行动→结果→状态变化链。
2. **需要哪些新 block？** — 每个新 cross_cutting 值对应一个 block（schema partial + helper 文件）。
3. **用什么 lifecycle？** — `none` / `season` / `round`，影响 schema partial 的 append 位置。
4. **用什么 cadence？** — `reactive` 不需要 engine block，`scheduled` 需要。
5. **skill.md 需要什么专属段落？** — Compete 有"回合流程"，Evaluate 有"赛季流程"，Social 有"生活流节奏"。新 archetype 是否需要类似的段落？

---

### 第二阶段：新建 block 文件（先建，后注册）

每个新 cross_cutting 值需要至多三种文件：

```
templates/blocks/<block-name>/schema.partial.ts          # drizzle 表定义（无 import）—— 有表才需要
templates/blocks/<block-name>/src/blocks/<block-name>.ts # helper 函数 —— 有业务逻辑才需要
templates/blocks/<block-name>/src/engine/loop.ts.fill    # engine tick 骨架 —— 仅当 block 提供 fill 时
```

manifest 支持四种操作：`schema_partial`、`copy`（直接复制）、`render`（Handlebars 渲染）、`fill`（放置骨架占位文件）。根据实际需要组合，不是每种都要。

**注意事项：**
- `schema.partial.ts` 不写 import 行——生成器用 `appendSchemaPartial()` append 到已有 schema.ts，import 在 base template 里已经有了。
- helper 文件的 import 路径用 `@/db/client`、`@/db/schema`——这是生成项目的路径别名，不是 skill 仓库自身的路径，VSCode 会报 TS 错误，属正常现象，不影响测试。
- 如果 block 有需要条件化的 env var，记录在 `.env.example.hbs` 的 `{{#if (includes cross_cutting "block-name")}}` 块里。

---

### 第三阶段：修改核心文件（11 处）

按顺序操作，避免遗漏：

**1. `schema/scenario.schema.json`**
```json
"primary": { "enum": ["Consume", "Evaluate", "Compete", "Social", "<NewArchetype>"] }
"cross_cutting": { "items": { "enum": [..., "new-block-1", "new-block-2"] } }
```

**2. `scripts/new-scenario.mjs` → `blockActive()` 和 `fillTargets()`**

`blockActive()` 当前已是通用 fallthrough，新 cross_cutting block 不需要改——但注意 **`fillTargets()`** 也在这个文件里，它决定脚手架完成后打印给 Fill 的清单。如果新 archetype 引入了新的 Fill 区域（不同于现有的 domain 表、API route、seed、UI、skill.md、smoke test），需要在 `fillTargets()` 里追加：
```js
function fillTargets(ctx) {
  const t = [...]; // 现有 Fill 目标
  if (ctx.scheduled) t.push("src/engine/loop.ts (tick body)");
  // 如果新 archetype 有额外 Fill 目标，在此追加
  return t;
}
```
只有需要特殊派生逻辑的 block（类似 `llm` 从 scorer 隐式激活）才需要在 `blockActive()` 里加 `if`。

**3. `scripts/lib/derive.mjs` → `truncate_tables`**

每个新 block 若有自己的表，必须在此追加，且必须追加在 `economyTables` **之后**（顺序影响现有测试断言）：
```js
const relationshipTables = blocks.has("relationship") ? ["relationships"] : [];
const memoryTables       = blocks.has("memory")       ? ["agent_memories"] : [];
const notificationTables = blocks.has("notification") ? ["user_agent_bindings", "notifications"] : [];
const truncate_tables = ["agents", ...lifecycleTables, ...s.state_db.domain_tables,
  ...lifecycleRankingTables, ...economyTables,
  ...relationshipTables, ...memoryTables, ...notificationTables];
```
注意：`render.test.mjs` 里有硬编码的 TRUNCATE 语句顺序断言，在末尾追加不会破坏它。

**4. `templates/blocks/manifest.json`**

每个新 block 加一条，按实际需要组合字段：
```json
"block-name": {
  "when": "block-name",
  "schema_partial": "block-name/schema.partial.ts",
  "copy": ["src/blocks/block-name.ts"],
  "render": ["src/blocks/block-name.ts.hbs"],
  "fill": ["src/engine/loop.ts"]
}
```
- `copy`：直接复制，无模板替换——helper 文件用此
- `render`：Handlebars 渲染后输出（`.hbs` 扩展名去掉）——需要注入 `scenario_id` 等变量时用，参考 `identity-publish`
- `fill`：放置 `.fill` 骨架文件作为 Fill 占位——参考 `engine` block
- `when` 值必须与 `cross_cutting` 枚举值完全一致

**5. `templates/base/.env.example.hbs`**

在文件末尾追加条件化 env var 块，模式参考 `identity-publish` 段落。

**6. `templates/skill.md.hbs`**

在 Evaluate 的 `{{#if}}` 块之后追加新 archetype 的专属段落：
```handlebars
{{#if (eq archetype.primary "NewArchetype")}}
## 新段落标题
<!-- FILL: ... -->

{{/if}}
```

**7. `templates/base/src/lib/skillmd.ts.hbs`**

与 `skill.md.hbs` 保持完全同步，改相同的位置。两个文件必须一起改，漏掉一个会导致 Phase 6 design gate 失败。

**8–11. 四个参考文档**

| 文件 | 改什么 |
|------|-------|
| `references/archetypes.md` | 头部"v1 implements"计数；新 archetype 从"未实现"表移除；补完整 defaults 表和 Core loop 描述；更新 cross-cutting 矩阵（加新列） |
| `references/building-blocks.md` | 新 block 各加一行到 Block Table |
| `references/scenario-schema.md` | 更新 `archetype.primary` 行；更新 `cross_cutting` 枚举行；更新 derived `truncate_tables` 说明；更新锁定枚举表；在参考场景表加新行 |
| `SKILL.md` | Phase 1 gate 句子（"v1 implements..."）；Custom escape 描述；What v1 Covers 两行 |

---

### 第四阶段：新建参考场景文件

`examples/<archetype-slug>.scenario.json` — 供 `new-scenario.test.mjs` 的 P3 测试使用，也是后续构建者的格式参考。

字段要求：
- `archetype.primary` 用新 archetype 名
- `cross_cutting` 包含新 block 的所有默认值
- `state_db.domain_tables` 列出真实的业务表名（**不含** block 自带的表，block 表由 schema partial 追加）
- `engine` 填合理的 `tick_ms` 推荐值（在 `references/archetypes.md` 新章节里说明推荐范围）
- 先用 `node scripts/validate.mjs examples/<slug>.scenario.json` 验证通过，再进入第五阶段

---

### 第五阶段：修改测试文件（5 个）

**易漏项：** 测试文件不会因为漏改而报错（它们只是不覆盖新代码），但这意味着新 block 出问题时测试不会抓到。每次新增 archetype 必须主动补：

| 文件 | 补什么 |
|------|-------|
| `scripts/lib/blocks.test.mjs` | 新 block 存在性断言（`assert.ok(m["block-name"])`） |
| `scripts/validate.test.mjs` | 读入新 example，加 `validateScenario(p3).errors` 断言 |
| `scripts/lib/derive.test.mjs` | 读入新 example，断言 `blocks` 含新 block，`truncate_tables` 含新表 |
| `scripts/new-scenario.test.mjs` | 加 P3 脚手架测试：断言新 block 文件存在、schema 含新表关键字 |
| `scripts/lib/skillmd.test.mjs` | 读入新 example，断言新专属段落渲染出来，旧 archetype 段落不出现 |

---

## 常见陷阱

**陷阱 1：`blockActive()` 的旧逻辑**
Social 之前 `blockActive()` 是显式 if 枚举每个 block，新 block 会走到 `return false`，文件静默不被 copy。现已重构为通用 fallthrough，新 block 不需要改这里——但如果未来有人回退这个函数，同样的问题会复现。

**陷阱 2：`truncate_tables` 顺序**
`render.test.mjs` 里的 P1/P2 断言是精确字符串匹配 TRUNCATE 语句。新表必须追加在 `economyTables` 之后（即末尾），不能插到中间，否则已有断言会断。

**陷阱 3：skill.md.hbs 和 skillmd.ts.hbs 没同步**
两个文件结构一致但独立存在，必须同时改。漏掉一个，`skillmd.lint.test.ts`（生成项目内的 `npm test`）会抓到 FILL 占位符残留，导致 Gate 2a 失败。

**陷阱 4：schema.partial.ts 的 import**
`appendSchemaPartial()` 会用正则 `/^import .*$/gm` strip 所有 import 行，所以 schema partial 不需要也不应写 import。写了不会报错，只是多余。VSCode 对 schema partial 和 helper 文件报 TS 错误属正常（缺少生成项目上下文），不影响 skill 仓库自身的 `npm test`。

**陷阱 5：cross-cutting 矩阵列数**
`references/archetypes.md` 底部矩阵如果新增了 block 列，必须给所有已有 archetype 行填上该列（`—` / `optional` / `✓`），否则 Markdown 表格列数错位，渲染乱掉。

**陷阱 6：blocks.test.mjs 不会自动失败**
该测试只检查旧的已知 block 是否存在，不会因为新 block 缺失而失败。必须手动补断言，否则新 block 注册错误时测试套件不报警。

**陷阱 7：render 类 block 的 .hbs 文件命名**
manifest 的 `render` 数组里的路径必须带 `.hbs` 后缀，生成器会自动去掉后缀作为输出路径。`copy` 数组里的路径不带 `.hbs`。两种操作混用时极易写错，参考 `identity-publish` block 的 manifest 条目作为模板。

**陷阱 8：`fillTargets()` 打印清单不完整**
`new-scenario.mjs` 里的 `fillTargets()` 控制脚手架完成后打印给构建者的 Fill 指引。如果新 archetype 引入了新的 Fill 区域却没在这里追加，构建者不会知道还有东西需要填——这个遗漏不会被测试抓到，只会在 Phase 5 Fill 时困惑。

**陷阱 9：Fill UI 前没读 layout.tsx**
脚手架生成的 `layout.tsx` 已经包含 `<nav class="cl-nav">` 和 `<div class="cl-container">`。直接照 mockup 结构写 page.tsx 会双重嵌套，导致样式错乱。Fill 任何 UI 文件前必须先读 `layout.tsx`。

**陷阱 10：Server Component 里规避 "use client"**
用字符串 onClick（如 `onClick="toggleTheme()"`）或 `as object` 类型强转来避免声明 `"use client"` 会在运行时直接报错，且 `npm run typecheck` 和 `npm run build` 都抓不到。有交互逻辑就提成独立的 Client Component，这是唯一正确做法。

**陷阱 11：UI 验收靠代码审查自我声明**
`npm run typecheck && npm run build` 通过不代表 UI 正确。Design gate 要求启动 app（`npm run dev` 或 `docker compose up`）用浏览器实际访问，对比 `chosen.html`。双重容器嵌套、运行时 React 错误、CSS token 未应用——这三类问题代码审查全部看不出来。

---

## 验证命令

```bash
# 1. 验证新 example 通过 schema 校验（在第四阶段结束后）
node scripts/validate.mjs examples/<slug>.scenario.json

# 2. 全量跑测试（Windows 下 npm test 的 glob 有问题，用显式路径）
node --test \
  scripts/validate.test.mjs \
  scripts/new-scenario.test.mjs \
  scripts/lib/derive.test.mjs \
  scripts/lib/blocks.test.mjs \
  scripts/lib/skillmd.test.mjs \
  scripts/lib/render.test.mjs
```

全部 pass 才算完成。
