import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateScenario } from "./validate.mjs";
import { derive } from "./lib/derive.mjs";
import { renderTree, renderString, registerPartial } from "./lib/render.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

export function generate(scenarioPath, outDir, opts = {}) {
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
  const { valid, errors } = validateScenario(scenario);
  if (!valid) throw new Error("scenario.json invalid:\n" + errors.join("\n"));
  // Refuse to write into a non-empty dir unless --force: a re-run does a full clean
  // re-render and would overwrite any hand-written Fill code. Back up / re-Fill, or
  // scaffold into a fresh dir. (Per-region Fill-merge across re-runs is a v2 enhancement.)
  if (!opts.force && existsSync(outDir) && readdirSync(outDir).length > 0) {
    throw new Error(
      `output dir not empty: ${outDir}\n` +
      `Refusing to overwrite (it may contain hand-written Fill code).\n` +
      `Re-run with --force to overwrite, or choose a fresh --out dir.`
    );
  }
  const ctx = derive(scenario);

  registerPartial("step0-identity", readFileSync(join(ROOT, "templates/partials/step0-identity.hbs"), "utf8"));

  // 1) base: copy Tier-A + render Tier-B/C
  mkdirSync(outDir, { recursive: true });
  renderTree(join(ROOT, "templates/base"), outDir, ctx);

  // 2) blocks per manifest
  const manifest = JSON.parse(readFileSync(join(ROOT, "templates/blocks/manifest.json"), "utf8"));
  const fillHooks = [];
  for (const [name, spec] of Object.entries(manifest)) {
    if (!blockActive(spec.when, ctx)) continue;
    for (const rel of spec.copy ?? []) copyInto(join(ROOT, "templates/blocks", name, rel), join(outDir, rel));
    for (const rel of spec.render ?? []) {
      const out = rel.replace(/\.hbs$/, "");
      renderInto(join(ROOT, "templates/blocks", name, rel), join(outDir, out), ctx);
    }
    for (const rel of spec.fill ?? []) {
      const src = join(ROOT, "templates/blocks", name, rel + ".fill");
      if (existsSync(src)) copyInto(src, join(outDir, rel)); // place buildable skeleton
      fillHooks.push(rel);
    }
    if (spec.schema_partial) appendSchemaPartial(join(ROOT, "templates/blocks", spec.schema_partial), outDir);
  }

  // 3) write the source scenario.json into the output as source-of-truth
  writeFileSync(join(outDir, "scenario.json"), JSON.stringify(scenario, null, 2) + "\n");

  return { ctx, fillHooks, fillTargets: fillTargets(ctx) };
}

function blockActive(when, ctx) {
  if (when === "scheduled") return ctx.scheduled;
  if (when === "scorer") return !!ctx.scorer;
  if (when === "llm") return ctx.llm;
  if (when === "anticheat") return ctx.cross_cutting.includes("anticheat");
  if (when === "identity-publish") return ctx.cross_cutting.includes("identity-publish");
  if (when === "economy") return ctx.cross_cutting.includes("economy");
  if (when.startsWith("lifecycle:")) return ctx.state_db.lifecycle === when.split(":")[1];
  return false;
}
function copyInto(src, dest) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
function renderInto(src, dest, ctx) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, renderString(readFileSync(src, "utf8"), ctx)); }
function appendSchemaPartial(src, outDir) {
  const dest = join(outDir, "src/db/schema.ts");
  appendFileSync(dest, "\n" + readFileSync(src, "utf8").replace(/^import .*$/gm, "").trimStart() + "\n");
}
function fillTargets(ctx) {
  const t = ["src/db/schema.ts (domain table columns)", "domain API route bodies", "src/db/seed.ts", "src/app/page.tsx + section pages", "src/lib/skillmd.ts (rules prose + quickstart)"];
  if (ctx.scheduled) t.push("src/engine/loop.ts (tick body)");
  return t;
}

// CLI
if (process.argv[1] && process.argv[1].endsWith("new-scenario.mjs")) {
  const scenarioPath = process.argv[2];
  if (!scenarioPath) { console.error("usage: new-scenario.mjs <scenario.json> [--out DIR]"); process.exit(1); }
  const outIdx = process.argv.indexOf("--out");
  const outDir = outIdx > -1 ? process.argv[outIdx + 1] : join(ROOT, `clawlake-${JSON.parse(readFileSync(scenarioPath, "utf8")).scenario_id}`);
  const force = process.argv.includes("--force");
  const r = generate(scenarioPath, outDir, { force });
  console.log(`scaffolded → ${outDir}`);
  console.log("NEXT — Claude Fill these (under scenario.json contract):");
  for (const t of [...r.fillTargets, ...r.fillHooks]) console.log("  - " + t);
}
