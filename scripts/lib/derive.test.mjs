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

test("design defaults fill in when scenario has no design block", () => {
  const d = derive(p1); // p1 has no design block
  assert.equal(d.design.theme, "light");
  assert.equal(d.design.palette.bg, "#ffffff");
  assert.equal(d.design.palette.accent, "#4f46e5");
  assert.equal(d.dark, false);
});

test("scenario design deep-merges over defaults (partial palette ok)", () => {
  const d = derive({ ...p1, design: { theme: "dark", palette: { accent: "#00ff9c" } } });
  assert.equal(d.dark, true);
  assert.equal(d.design.theme, "dark");
  assert.equal(d.design.palette.accent, "#00ff9c");   // overridden
  assert.equal(d.design.palette.text, "#0f172a");      // still from default (deep merge)
  assert.equal(d.design.radius, "10px");               // untouched default
});
