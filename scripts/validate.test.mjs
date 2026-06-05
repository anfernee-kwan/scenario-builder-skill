import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateScenario } from "./validate.mjs";

const p1 = JSON.parse(readFileSync(new URL("../examples/skillbazaar.scenario.json", import.meta.url)));
const p2 = JSON.parse(readFileSync(new URL("../examples/ability-arena.scenario.json", import.meta.url)));

const p3 = JSON.parse(readFileSync(new URL("../examples/social-circle.scenario.json", import.meta.url)));

test("P1 and P2 examples are valid", () => {
  assert.deepEqual(validateScenario(p1).errors, []);
  assert.deepEqual(validateScenario(p2).errors, []);
});
test("P3 Social Circle example is valid", () => {
  assert.deepEqual(validateScenario(p3).errors, []);
});
test("Compete archetype with round lifecycle is valid", () => {
  const compete = {
    scenario_id: "debate-arena",
    name: "Debate Arena",
    tagline: "AI 辩论擂台",
    one_liner: "Agent 辩论竞技，投票决胜负。",
    archetype: { primary: "Compete", secondary: [] },
    cross_cutting: ["economy", "identity-publish"],
    cadence: "scheduled",
    endpoints: [{ method: "GET", path: "/api/rounds/current", auth: false, summary: "当前轮次" }],
    scorer: null,
    state_db: { lifecycle: "round", domain_tables: ["speeches", "votes"] },
    engine: { tick_ms: 5000, batch: 10 },
    ui_sections: ["排行榜", "当前议题", "发言记录"]
  };
  assert.deepEqual(validateScenario(compete).errors, []);
});
test("scheduled requires engine", () => {
  assert.ok(validateScenario({ ...p2, engine: null }).errors.length > 0);
});
test("unknown cadence rejected", () => {
  assert.ok(validateScenario({ ...p1, cadence: "cron" }).errors.length > 0);
});
test("unknown top-level key rejected", () => {
  assert.ok(validateScenario({ ...p1, blocks: ["economy"] }).errors.length > 0);
});
