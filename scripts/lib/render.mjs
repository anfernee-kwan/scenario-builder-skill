import Handlebars from "handlebars";
import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

Handlebars.registerHelper("includes", (arr, v) => Array.isArray(arr) && arr.includes(v));
Handlebars.registerHelper("eq", (a, b) => a === b);

export function renderString(src, ctx) {
  return Handlebars.compile(src, { noEscape: true })(ctx);
}

export function renderTree(srcDir, outDir, ctx) {
  for (const entry of readdirSync(srcDir)) {
    const sp = join(srcDir, entry);
    if (statSync(sp).isDirectory()) { renderTree(sp, join(outDir, entry), ctx); continue; }
    if (entry.endsWith(".hbs")) {
      const outPath = join(outDir, entry.slice(0, -4));
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, renderString(readFileSync(sp, "utf8"), ctx));
    } else {
      mkdirSync(outDir, { recursive: true });
      copyFileSync(sp, join(outDir, entry));
    }
  }
}

export function registerPartial(name, src) { Handlebars.registerPartial(name, src); }
