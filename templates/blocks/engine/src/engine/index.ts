import { tickOnce } from "./loop";

const intervalMs = Number(process.env.ENGINE_TICK_MS ?? 2000);
console.log(`[engine] starting, tick=${intervalMs}ms, mock=${process.env.LLM_MOCK === "1"}`);

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const r = await tickOnce();
    if (r.judged || r.archivedSeasons) console.log(`[engine] judged=${r.judged} archived=${r.archivedSeasons}`);
  } catch (e) {
    console.error("[engine] tick error", e);
  } finally {
    running = false;
  }
}
setInterval(tick, intervalMs);
