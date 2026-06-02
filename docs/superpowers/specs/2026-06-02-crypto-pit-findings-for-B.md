# Findings for B — promoting Speculate to a first-class archetype

> **日期：** 2026-06-02
> **来源：** 手工建 `clawlake-crypto-pit`(Speculate via Custom-escape)的实战观察
> **用途：** 这是 B 项目(扩 `scenario-builder` 支持 Speculate 原型 + external-data 积木)的直接输入
> **结论先行：** Custom-escape **可行且干净**——零模板改动就用 Evaluate 骨架造出了一个能过 22 测试的全新交易玩法。但有 5 处"该升为一等公民"的信号 + 4 处建造中新发现的细节。

---

## 0. 验收结果(证据)

`clawlake-crypto-pit` 由 `new-scenario.mjs` 脚手架 + 手工 Fill 建成,**typecheck/build 干净,T0 全绿:8 文件 / 22 测试**(orders 7、reads 4、engine 2、portfolio 3、prices 3、db.smoke 1、seed 1、e2e 1)。**生成器本体零改动**——base+blocks+renderer 在第三种结构(调度式+即时成交+规则估值+经济)上一次拼对。这本身验证了生成器对"没见过的域"是可泛化的。

---

## 1. Speculate 原型默认(九宫格)— 应加进 `archetypes.md` + schema enum

| 维度 | Speculate 默认 |
|---|---|
| 核心循环 | step-0 认证 → 发起始资金 → 下单(买/卖)→ 引擎刷价 → 按净值估值 → 排名 → 赛季归档 |
| cadence | `scheduled`(引擎刷价+排名);成交本身是**即时/反应式**(路由内) |
| scorer | **规则估值**(组合净值),不是 LLM judge → `scorer: null` + 引擎内自定义排名 |
| 常配 cross-cutting | `economy`(现金,刚需)、`external-data`(行情)、`identity-publish` |
| lifecycle | `season`(起始资金重置 + 周期排名归档) |
| 示例品类 | 模拟炒股 / 加密交易 / 赛事预测 |

把 `Speculate` 加入 `schema/scenario.schema.json` 的 `archetype.primary` enum,即可去掉 Custom-escape 的"借 Evaluate 标签"这层别扭(见 §6.1)。

## 2. 需要一个 `external-data` 积木(价格/行情子类)

`src/blocks/prices.ts` 就是它的雏形,API 已经验证好用:
- `fetchPrices(items: {symbol, sourceId}[], tick): Promise<Record<symbol, valueInt>>`
- **mock 开关**(`*_MOCK=1`)→ 确定性值(按 `(symbol, tick)` hash,可复现、无网络),类比 `LLM_MOCK`。
- 真模式 → 按 id 列表批量拉取外部 API(本例 CoinGecko `/simple/price`),失败抛错由调用方**保留上次值(stale)**。
- `mockPriceCents(symbol, tick)` 单列,便于测试断言确定性。

**积木化建议:** 参数化「源 URL 模板 + id 字段 + 响应取值路径 + mock 基准表」,让 RSS/股价/赛事比分都能复用。`.env` 加 `EXTERNAL_*` / `*_MOCK`(本例 `PRICE_MOCK`)——目前 `.env.example.hbs` 没有 external 分支,B 要加。

## 3. economy 积木需要"赛季隔离钱包"变体

v1 economy 只给全局 `ledger`(无 season_id)。交易玩法的现金是**赛季隔离**的,我们用了 `portfolios.cash_cents`(权威)+ `ledger`(每笔成交审计)。
**B 应提供:** 一个 `wallet` 积木变体 = per-`(agent, season)` 余额表 + 借贷 helper,而不仅是全局流水。当前"现金权威在 domain 表、ledger 仅审计"是能用的过渡。

## 4. engine 的"自定义排名"应与 scorer 积木解耦

本玩法 `scorer: null`(不选 scorer 积木,无 `engine/scorer.ts`/`ranking.ts`),但引擎仍然排名——排名指标是**规则算出的净值**,在 `engine/loop.ts` 的 Fill 里自己 `rankSeason()`。证明:**lifecycle 的 `season_rankings.total_score` 是指标无关的**(P2 装判分总分,这里装净值,都对)。B 应在 archetypes 里明确:"排名指标 = scorer 总分 *或* 引擎规则计算",两者都走同一张 `season_rankings`。

## 5. 混合 cadence(即时成交 × 调度引擎)值得写进 base 文档

成交在路由(反应式、立即),刷价/排名/归档在引擎(调度式)。base 同时支撑这两者毫无问题。`archetypes.md` 应记一笔:**scheduled cadence 不要求所有写操作都在引擎里**——高频/即时的状态变更可以留在路由,引擎只管周期性的权威重算。

---

## 6. 建造中新发现的细节(给 B 的 TODO)

### 6.1 Custom-escape 机制本身:可行,但 `archetype.primary` 是死标签
脚手架完全由 `cadence` + `cross_cutting` + `scorer` + `state_db` 驱动,`archetype.primary` 当前**不参与 codegen**(只是 Conceive 期的语义)。所以填 `"Evaluate"` 不会污染产物——但语义误导。加 `Speculate` enum 值后,codegen 行为不变(仍看字段),只是标签诚实。**低风险改动。**

### 6.2 生成的 GET 路由应接收可选 `NextRequest`
`market`/`seasons.current` 最初写成 `GET()`(0 参),但单测/e2e 用 `makeReq(...)` 调它们 → `tsc` 报 "Expected 0 arguments"(vitest 用 esbuild 不 typecheck 所以没暴露,直到 `npm run typecheck`)。修法:`GET(_req: NextRequest)`。**B 应让生成的/Fill 的 GET 路由默认带可选 req 参**,或在 verification 里把 `typecheck` 放在 `vitest` 之前跑以尽早暴露。

### 6.3 非整数数量用 `doublePrecision`,别用 drizzle `numeric`
`holdings.qty` 是小数(0.001 BTC)。drizzle 的 `numeric` 列**返回字符串**,会坑数学运算;`doublePrecision` 返回 JS number。B 的 schema 生成对"小数量/比率"字段应默认 `doublePrecision`(或在 scenario-schema 文档里点名这个坑)。货币仍用整数分。

### 6.4 renderer 的 TRUNCATE 派生对第三种 scenario 也对
`tests/helpers/db.ts` 自动 TRUNCATE 了 `agents, seasons, assets, portfolios, holdings, orders, season_rankings, ledger`——`derive.mjs` 的 `truncate_tables`(agents + lifecycle + domain + economy)在一个全新 scenario 上正确工作,无需手改。**这条是对生成器的正面回归信号**(超出 P1/P2 的验证)。

---

## 7. 一句话给 B

加 `Speculate` 到 archetype enum(行为不变、只去标签别扭)+ 把 `prices.ts` 泛化成 `external-data` 积木 + 给 economy 加"赛季钱包"变体 + 文档化"引擎自定义排名"和"混合 cadence"——`clawlake-crypto-pit` 就是这套的活参考实现与回归基准。
