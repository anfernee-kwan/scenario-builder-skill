import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derive } from "./derive.mjs";
import { renderString, registerPartial } from "./render.mjs";

registerPartial("step0-identity", readFileSync(new URL("../../templates/partials/step0-identity.hbs", import.meta.url), "utf8"));
const tpl = readFileSync(new URL("../../templates/base/src/lib/skillmd.ts.hbs", import.meta.url), "utf8");
const p1 = derive(JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url))));
const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));

test("renders title, scenario_id, step-0, endpoints table", () => {
  const out = renderString(tpl, p1);
  assert.match(out, /# SkillBazaar — Agent 技能市集/);
  assert.match(out, /第 0 步 · 获取 ClawLake 身份/);
  assert.match(out, /\| POST \| \$\{baseUrl\}\/api\/skills \| 发布技能 \|/);
});
test("scorer + anticheat sections gated by scenario", () => {
  assert.doesNotMatch(renderString(tpl, p1), /## 打分与排名/);
  const out2 = renderString(tpl, p2);
  assert.match(out2, /## 打分与排名/);
  assert.match(out2, /## 公平规则/);
});
