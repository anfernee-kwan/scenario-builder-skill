import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/scenario.schema.json", import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

export function validateScenario(scenario) {
  const valid = validateFn(scenario);
  return { valid, errors: valid ? [] : (validateFn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) };
}

// CLI: validate a scenario.json file. Exit 0 = valid, 1 = invalid, 2 = usage/read error.
// Used at the Brief gate (Gate ①) before scaffolding.
if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const path = process.argv[2];
  if (!path) { console.error("usage: node scripts/validate.mjs <scenario.json>"); process.exit(2); }
  let scenario;
  try { scenario = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { console.error(`cannot read/parse ${path}: ${e.message}`); process.exit(2); }
  const { valid, errors } = validateScenario(scenario);
  if (valid) { console.log(`✓ ${path} is a valid scenario.json`); process.exit(0); }
  console.error(`✗ ${path} is INVALID:`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
