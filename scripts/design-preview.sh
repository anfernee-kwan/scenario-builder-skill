#!/usr/bin/env bash
set -euo pipefail
DIR="${1:-.}"
PORT="${2:-4500}"
exec node --input-type=module -e '
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
const dir = process.argv[1]; const port = Number(process.argv[2]);
const types = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".svg":"image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/" || p.endsWith("/")) p += "index.html";
    const full = join(dir, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(full);
    res.writeHead(200, { "content-type": types[extname(full)] ?? "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
server.listen(port, () => console.log(`design preview → http://localhost:${port}  (serving ${dir})`));
' "$DIR" "$PORT"
