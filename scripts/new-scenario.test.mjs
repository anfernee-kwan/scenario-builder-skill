import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./new-scenario.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function gen(name) {
  const out = join(ROOT, ".tmp-gen", name);
  rmSync(out, { recursive: true, force: true });
  generate(join(ROOT, "examples", `${name}.scenario.json`), out);
  return out;
}

test("P1 scaffold: base files, NO engine, ledger schema appended", () => {
  const out = gen("skillbazaar");
  assert.ok(existsSync(join(out, "src/lib/http.ts")));
  assert.ok(existsSync(join(out, "src/app/.well-known/agent.json/route.ts")));
  assert.ok(existsSync(join(out, "src/db/schema.ts")));
  assert.ok(!existsSync(join(out, "src/engine/index.ts")));
  assert.ok(!existsSync(join(out, "src/blocks/llm.ts")));
  assert.match(readFileSync(join(out, "src/db/schema.ts"), "utf8"), /ledger/);
  assert.doesNotMatch(readFileSync(join(out, "package.json"), "utf8"), /engine:start/);
  assert.ok(existsSync(join(out, "scenario.json")));
});

test("P2 scaffold: engine + scorer + llm + identity-publish, season schema", () => {
  const out = gen("ability-arena");
  assert.ok(existsSync(join(out, "src/engine/index.ts")));
  assert.ok(existsSync(join(out, "src/engine/loop.ts")));   // skeleton placed
  assert.ok(existsSync(join(out, "src/engine/scorer.ts")));
  assert.ok(existsSync(join(out, "src/engine/ranking.ts")));
  assert.ok(existsSync(join(out, "src/blocks/llm.ts")));
  assert.match(readFileSync(join(out, "src/blocks/identity-publish.ts"), "utf8"), /scenario_id: "ability-arena"/);
  assert.match(readFileSync(join(out, "src/db/schema.ts"), "utf8"), /season_rankings/);
  assert.match(readFileSync(join(out, "package.json"), "utf8"), /engine:start/);
});
