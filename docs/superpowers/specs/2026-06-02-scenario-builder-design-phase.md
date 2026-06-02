# scenario-builder · Design Phase — 设计文档（Spec）

> **文档版本：** v1.0
> **日期：** 2026-06-02
> **目标读者：** 实现此增强的编码 Agent；用 scenario-builder 造玩法的人
> **上游：** `scenario-builder` 技能(本仓库,P3 产出)
> **目的：** 让生成的玩法页面达到**可发布的互联网产品级**视觉,而不是当前的「白底黑字、零设计」。做法:在 skill 流程里加一个**可视化、mockup 驱动的 Design 阶段**(逐玩法 bespoke),并给 `templates/base` 一套**设计系统骨架**保底。

---

## 1. 问题与目标

**问题:** 当前 base 只有近乎空的 `globals.css`(5 行)+ 裸 `layout.tsx`,`page.tsx` 是裸 Fill。生成的玩法功能能跑,但页面是无样式 HTML,**没法当产品发布**。

**目标:** skill 跑的过程中,跟用户**敲定每个玩法的页面设计方向与风格**(bespoke),产出接近可发布产品的 web 页面。两条腿:
1. **流程加一步 Design**(可视化 mockup 驱动:给 3 个方向 → 选/迭代 → 锁定)。
2. **base 升级成设计系统骨架**(CSS 变量 + 组件原语)保底,任何玩法开箱非裸;选中方向通过 token 让它"上品牌";Fill 在其上做 bespoke。

**已锁定的策略决策(brainstorm):** 逐玩法 **bespoke**(非共享单一 default);设计步 **可视化 mockup 驱动**(非纯文字);预览机制 **自包含**(skill 自带迷你预览服务器,不依赖外部工具);base 仍提供**非裸骨架 + 组件原语**,bespoke 在其上定制。

---

## 2. 流程变更:5 → 6 阶段

`Conceive → **Design(新)** → Brief → Scaffold → Fill → Verify`

| 阶段 | 谁 | 变化 |
|---|---|---|
| 1 Conceive | Claude 对话 | 不变(玩法概念 + 原型) |
| **2 Design(新)** | Claude + 浏览器预览 + 用户 | 见 §3。产出 = 锁定的设计方向(design brief) |
| 3 Brief | Claude 写、用户批准 | scenario.json **新增 `design` 块**(§4);外加 `design-brief.md` + `design/chosen.html` |
| 4 Scaffold | 确定性脚本 | base shell 把 `design` token 渲染成 CSS 变量(§5) |
| 5 Fill | Claude 受约束 | UI 按 `design/chosen.html` + design 块**定制实现**(§6) |
| 6 Verify | 脚本 + Claude | 新增**设计评审关**:截图比对方向 + 设计质量清单(§7) |

---

## 3. Design 阶段(可视化、mockup 驱动)

玩法概念清楚后:
1. **生成 ~3 个设计方向 mockup。** 每方向一张**代表性迷你整页**(含调色板 + 排版 + 该玩法关键板块的真实布局,如净值榜/行情/详情)。保真度 = brainstorm 里验证过的那种(够读出气质与布局,不必像素级)。方向之间气质要**明显不同**(如:专业暗色终端 / 浅色现代 fintech / 张扬 neo-brutalist)。
2. **用户在浏览器里挑/迭代。** 可改色、换方向、要求更高保真;迭代写新文件。
3. **锁定方向** → 落成 design brief:`scenario.json` 的 `design` 块(机器 token)+ `design-brief.md`(气质/理由/参考)+ `design/chosen.html`(Fill 的视觉锚)。

### 3.1 自包含预览机制(关键)
skill 必须装到别的项目里也能跑设计步,**不依赖** superpowers 的 brainstorming companion 或任何外部工具。因此 skill 自带:
- `scripts/design-preview.sh` —— 一个极小的静态文件服务器(Node 内置 `http`,零依赖,跟 `verify.sh` 一个路子),serve 一个目录并打印 `http://localhost:<port>`。
- `templates/design/mockup.html.hbs` —— mockup 页模板/脚手架(含一套可复用的展示 CSS,便于快速产出方向卡或整页 mockup)。
- 产物落在**新玩法**的 `design/` 目录:`option-1.html` / `option-2.html` / `option-3.html` / `chosen.html`。用户 `bash scripts/design-preview.sh <玩法>/design` 打开浏览器看。

> v1 用「静态 HTML mockup + 本地 serve」即可,不接管完整的实时-编辑 companion。形式已与用户确认。

---

## 4. scenario.json 新增 `design` 块

机器可用的 token(Scaffold 据此渲染 CSS 变量),刻意朴素——不是重型主题引擎:

```jsonc
"design": {
  "vibe": "professional trading terminal",          // 一句话气质(= 选中方向)
  "theme": "dark",                                   // "dark" | "light" | "both"
  "palette": {
    "bg": "#0a0e14", "surface": "#11161f", "text": "#cbd5e1", "muted": "#64748b",
    "accent": "#00ff9c", "success": "#00ff9c", "danger": "#ff4d4d", "border": "#1e2630"
  },
  "typography": { "sans": "Inter", "mono": "SF Mono", "display": "Inter", "scale": "compact" },
  "radius": "4px",                                   // CSS 长度
  "shadow": "none",                                  // "none" | "soft" | "hard"
  "density": "compact"                               // "compact" | "comfortable"
}
```

- **Schema:** 在 `schema/scenario.schema.json` 加 `design`(对象,`additionalProperties:false`,字段如上;`palette` 必填上述键;enum 校验 theme/shadow/density)。`design` 可选——缺省时 base 用一套中性默认 token(保证永不裸),但 skill 的 Design 阶段**默认必走**(见 §8 规则)。
- **人类版:** `design-brief.md`(模板 `references/scenario-brief.template.md` 增设计段,或独立 `design/design-brief.md`):气质、参考产品、为何选它、关键板块的视觉处理。
- **派生(derive.mjs):** 由 `design` 计算便利量(如 `dark = theme==='dark'`),供模板用。

---

## 5. base 设计系统骨架(治本)

`templates/base` 升级:
- **`src/app/globals.css` → `globals.css.hbs`(Tier-B,由 `design` 渲染):** `:root` 注入 CSS 变量(`--bg/--surface/--text/--muted/--accent/--success/--danger/--border/--radius/--font-sans/--font-mono/--density-pad` 等);一套**组件原语 class**(`.cl-card / .cl-table / .cl-badge / .cl-btn / .cl-stat / .cl-nav / .cl-container`),全部用变量,带合理的间距/层级/hover/响应式。`theme:both` 时加 `@media (prefers-color-scheme)` 或 `[data-theme]`。
- **`src/app/layout.tsx.hbs`:** 渲染**应用外壳**——`.cl-container` + 顶部 `.cl-nav`(玩法名/品牌 + 链接),加载选定字体(Google Fonts link 或 system stack),设 `data-theme`。
- 结果:**任何玩法 scaffold 完就有像样的壳**(导航 + 容器 + 排版 + 组件样式),选中方向的 token 让它在品牌上;Fill 只管用这些 class 拼板块,默认就好看。

> 这把当前 Tier-A 的 `globals.css` 变成 Tier-B(随 `design` 渲染);`layout.tsx` 已是 Tier-B。组件原语是 CSS class,Fill 直接用类名,**不引入任何前端框架/CSS 库**(纯 CSS 变量 + 现有 Next/React)。

---

## 6. Fill:按选中方向做 bespoke 页面

观战页(home/净值榜/详情/Agent 档案/叙事等,随玩法)由 Claude **照着 `design/chosen.html` + `design` 块定制实现**——用 base 的组件原语 class 打底,按方向定制布局与点睛。目标:页面**像选中的那个 mockup**,不是通用模板。Step 0 身份段等 skill.md 约定不变。

---

## 7. Verify:新增设计评审关

T0 的功能门(typecheck/build/test)之外,加一个**设计质量门**:
- 起站 → **截图**关键页(home/榜/详情)→ 比对 `design/chosen.html` 方向。
- 一张清单:有清晰视觉层级 / 一致间距与 token / **无裸 HTML 默认(白底黑字、Times New Roman、无间距表格)** / 移动端不破版 / 交互态(hover/focus)存在。
- **判定:** 像选中方向且过清单 = DONE;**「页面长得像没样式的 HTML」直接判不合格**,回 Fill。截图可用 base 已有的 docker 栈(`scripts/verify.sh`)+ 手动/工具截图;v1 允许 Claude 自评截图,不强制接入自动视觉测试。

---

## 8. SKILL.md / references 变更(用 writing-skills 改)

- **SKILL.md:** 插入 Design 阶段(§2/§3);硬规则:**Design 阶段默认必走;给 ~3 个气质明显不同的方向;产出可发布产品级;绝不交白底黑字裸页**。加 red-flag 自检:「页面像无样式 HTML / 只有一个方向没给选 / 跳过 Design 直接 Fill UI = 做错了」。Verify 段加设计门。
- **`references/design.md`(新):** 设计方向怎么提(气质词库/参考品类)、`design` 块字段字典、组件原语清单与用法、`design-preview.sh` 怎么用、设计质量清单。
- 因为是改技能本体,SKILL.md 的改动走 **writing-skills 的 RED→GREEN**(先验证当前 agent 会跳过设计/交裸页,再验证改后会走 Design 步)。

---

## 9. 验收(本增强自己的 T0)

1. **Schema:** `design` 块校验通过(含一份带 design 的示例);缺省时 base 用中性默认。
2. **预览机制:** `scripts/design-preview.sh <dir>` 能本地 serve 并打印 URL;`templates/design/mockup.html.hbs` 能渲染出方向 mockup。
3. **base shell:** 一个带 `design` 块的 scaffold 产物 `npm run build` 干净,且页面**可见地有设计**(CSS 变量生效、组件原语有样式)——非裸。
4. **回归:** 给现有玩法(crypto-pit)补一个 `design` 块重生成 → `build` + 既有测试(crypto-pit 22 / P1 29 / P2 27)**仍全绿**(CSS 不被测试断言,功能不受影响),且页面从"裸"变"有设计"。
5. **SKILL.md 守则:** writing-skills RED→GREEN 证明改后 agent 会走 Design 步、不交裸页。

> 注:base shell 改动会改变 P1/P2/crypto-pit **重生成后的外观**,但不影响其测试(测试不查 CSS)。已存在的玩法目录不被动改;重生成才应用新 shell。

---

## 10. 范围(YAGNI)

**做:** Design 阶段(~3 方向 mockup,可迭代)、自包含静态预览、`design` token 块 + schema、base 设计系统骨架(CSS 变量 + 组件原语 class)、layout 外壳、Fill 按方向定制、Verify 设计门、SKILL.md/references 更新。
**不做(推迟):** 重型主题引擎/设计 token 管线;引入 Tailwind/CSS-in-JS/组件库;实时所见即所得编辑器(v1 用静态 mockup + 本地 serve);自动化视觉回归测试(v1 用 Claude 自评截图);多套预置主题市场。

---

## 11. 触及文件一览

- `SKILL.md`(新 Design 阶段 + 规则 + Verify 门)— writing-skills
- `references/design.md`(新)
- `schema/scenario.schema.json`(`design` 块)
- `examples/*.scenario.json`(给示例补 `design` 块,至少一个)
- `templates/base/src/app/globals.css` → `globals.css.hbs`(设计系统 + 组件原语)
- `templates/base/src/app/layout.tsx.hbs`(应用外壳 + 字体 + data-theme)
- `templates/design/mockup.html.hbs`(新,mockup 脚手架)
- `scripts/design-preview.sh`(新,自包含静态服务器)
- `scripts/lib/derive.mjs`(派生 design 便利量)
- Fill/Verify 指引(SKILL.md + references/verification.md)

---

## 12. 一句话

加一个 mockup 驱动的 **Design 阶段**(3 方向→选→锁)+ 给 base 一套 **CSS 变量设计系统骨架**,让每个生成玩法 bespoke 且开箱非裸、达到可发布产品级;`design` 块是 spec→CSS 的契约,自包含预览让它在任何项目里都能跑。
