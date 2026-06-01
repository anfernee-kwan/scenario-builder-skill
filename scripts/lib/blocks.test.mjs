import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderString } from "./render.mjs";
import { derive } from "./derive.mjs";

const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));

test("identity-publish renders scenario_id", () => {
  const tpl = readFileSync(new URL("../../templates/blocks/identity-publish/src/blocks/identity-publish.ts.hbs", import.meta.url), "utf8");
  const out = renderString(tpl, p2);
  assert.match(out, /scenario_id: "ability-arena"/);
  assert.match(out, /export async function publishRanks/);
});

test("manifest is valid JSON with the 7 blocks", () => {
  const m = JSON.parse(readFileSync(new URL("../../templates/blocks/manifest.json", import.meta.url), "utf8"));
  for (const b of ["engine","scorer","llm","lifecycle","anticheat","identity-publish","economy"]) assert.ok(m[b], `missing ${b}`);
});
