import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/scenario.schema.json", import.meta.url)));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateFn = ajv.compile(schema);

export function validateScenario(scenario) {
  const valid = validateFn(scenario);
  return { valid, errors: valid ? [] : (validateFn.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) };
}
