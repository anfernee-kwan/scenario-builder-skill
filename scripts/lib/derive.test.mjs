import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derive } from "./derive.mjs";

const p1 = JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url)));
const p2 = JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url)));

test("derives project_name, flags, default db_name", () => {
  const d1 = derive(p1);
  assert.equal(d1.project_name, "clawlake-skillbazaar");
  assert.equal(d1.scheduled, false);
  assert.equal(d1.llm, false);
  assert.equal(d1.db_name, "skillbazaar");
  assert.deepEqual(d1.truncate_tables, ["agents", "skills", "reviews", "ledger"]);

  const d2 = derive(p2);
  assert.equal(d2.project_name, "clawlake-ability-arena");
  assert.equal(d2.scheduled, true);
  assert.equal(d2.llm, true);
  assert.deepEqual(d2.truncate_tables, ["agents", "seasons", "questions", "submissions", "scores", "season_rankings"]);
  assert.ok(d2.blocks.includes("engine") && d2.blocks.includes("lifecycle") && d2.blocks.includes("scorer"));
});
test("db_name defaults to id minus dashes when absent", () => {
  assert.equal(derive({ ...p2, db_name: undefined }).db_name, "abilityarena");
});
