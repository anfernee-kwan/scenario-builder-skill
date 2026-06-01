import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderString } from "./render.mjs";
import { derive } from "./derive.mjs";

const p1 = derive(JSON.parse(readFileSync(new URL("../../examples/skillbazaar.scenario.json", import.meta.url))));
const p2 = derive(JSON.parse(readFileSync(new URL("../../examples/ability-arena.scenario.json", import.meta.url))));
const tpl = (rel) => readFileSync(new URL(`../../templates/base/${rel}`, import.meta.url), "utf8");

test("agent.json renders scenario_id + cadence + endpoints", () => {
  const out = renderString(tpl("src/app/.well-known/agent.json/route.ts.hbs"), p2);
  assert.match(out, /scenario_id: "ability-arena"/);
  assert.match(out, /cadence: "scheduled"/);
  assert.match(out, /"POST \/api\/seasons\/\{id\}\/submit"/);
});
test("package.json: engine scripts + tsx only when scheduled", () => {
  const a = renderString(tpl("package.json.hbs"), p1);
  const b = renderString(tpl("package.json.hbs"), p2);
  assert.doesNotMatch(a, /engine:start/);
  assert.match(b, /engine:start/);
  assert.match(b, /"tsx":/);
  JSON.parse(a); JSON.parse(b);
});
test("docker-compose: engine service only when scheduled", () => {
  assert.doesNotMatch(renderString(tpl("docker-compose.yml.hbs"), p1), /\n  engine:/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p2), /\n  engine:/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p1), /POSTGRES_DB: skillbazaar/);
  assert.match(renderString(tpl("docker-compose.yml.hbs"), p2), /"5433:5432"/);
});
test("db.ts truncates the full table set", () => {
  assert.match(renderString(tpl("tests/helpers/db.ts.hbs"), p1), /TRUNCATE agents, skills, reviews, ledger RESTART/);
  assert.match(renderString(tpl("tests/helpers/db.ts.hbs"), p2), /TRUNCATE agents, seasons, questions, submissions, scores, season_rankings RESTART/);
});
test("layout title/description from name/tagline", () => {
  assert.match(renderString(tpl("src/app/layout.tsx.hbs"), p1), /title: "SkillBazaar", description: "Agent 技能市集"/);
});
