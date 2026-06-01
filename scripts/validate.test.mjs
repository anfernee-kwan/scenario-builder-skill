import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateScenario } from "./validate.mjs";

const p1 = JSON.parse(readFileSync(new URL("../examples/skillbazaar.scenario.json", import.meta.url)));
const p2 = JSON.parse(readFileSync(new URL("../examples/ability-arena.scenario.json", import.meta.url)));

test("P1 and P2 examples are valid", () => {
  assert.deepEqual(validateScenario(p1).errors, []);
  assert.deepEqual(validateScenario(p2).errors, []);
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
