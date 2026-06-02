import { tickOnce } from "./loop";

const intervalMs = Number(process.env.ENGINE_TICK_MS ?? 2000);
console.log(`[engine] starting, tick=${intervalMs}ms, mock=${process.env.PRICE_MOCK === "1"}`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await tickOnce();
    if (r.pricesUpdated || r.archivedSeasons) console.log(`[engine] pricesUpdated=${r.pricesUpdated} archived=${r.archivedSeasons}`);
  } catch (e) {
    console.error("[engine] tick error", e);
  } finally {
    running = false;
  }
}
setInterval(tick, intervalMs);
