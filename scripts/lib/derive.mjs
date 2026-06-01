// Pure: scenario.json (already validated) -> derived values consumed by templates + wiring.
export function derive(s) {
  const scheduled = s.cadence === "scheduled";
  const llm = (s.scorer && s.scorer.type === "llm-judge") || (s.cross_cutting ?? []).includes("llm");
  const db_name = s.db_name ?? s.scenario_id.replace(/-/g, "");
  const host_port = s.host_port ?? 5432;

  const blocks = new Set(s.cross_cutting ?? []);
  if (llm) blocks.add("llm");
  if (scheduled) blocks.add("engine");
  if (s.scorer) blocks.add("scorer");
  if (s.state_db.lifecycle && s.state_db.lifecycle !== "none") blocks.add("lifecycle");

  const lifecycleTables = s.state_db.lifecycle === "season" ? ["seasons"] : s.state_db.lifecycle === "round" ? ["rounds"] : [];
  const lifecycleRankingTables = s.state_db.lifecycle === "season" ? ["season_rankings"] : s.state_db.lifecycle === "round" ? ["round_rankings"] : [];
  const economyTables = blocks.has("economy") ? ["ledger"] : [];
  const truncate_tables = ["agents", ...lifecycleTables, ...s.state_db.domain_tables, ...lifecycleRankingTables, ...economyTables];

  return { ...s, project_name: `clawlake-${s.scenario_id}`, db_name, host_port, scheduled, llm, blocks: [...blocks], truncate_tables };
}
