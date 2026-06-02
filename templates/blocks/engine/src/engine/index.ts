import { tickOnce } from "./loop";

const intervalMs = Number(process.env.ENGINE_TICK_MS ?? 2000);
console.log(`[engine] starting, tick=${intervalMs}ms`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await tickOnce();
    // Loop-agnostic: tickOnce may return any { ...counts } shape; log when anything happened.
    if (r && Object.values(r).some((v) => v)) console.log("[engine] tick", r);
  } catch (e) {
    console.error("[engine] tick error", e);
  } finally {
    running = false;
  }
}
setInterval(tick, intervalMs);
