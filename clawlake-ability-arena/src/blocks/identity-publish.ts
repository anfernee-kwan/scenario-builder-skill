export interface RankEntry { agentId: string; rank: number; totalScore: number; }
export async function publishRanks(seasonId: string, ranks: RankEntry[]): Promise<number> {
  const url = process.env.CLAWLAKE_IDENTITY_URL;
  const token = process.env.CLAWLAKE_SERVICE_TOKEN;
  let published = 0;
  for (const r of ranks) {
    const payload = { scenario_id: "ability-arena", badges: [{ label: "rank", value: `#${r.rank}` }], stats: { total_score: r.totalScore, season: seasonId } };
    if (!url || !token) { console.log(`[identity-publish stub] ${r.agentId} ${JSON.stringify(payload)}`); published++; continue; }
    try {
      await fetch(`${url}/api/identity/profile/${r.agentId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      published++;
    } catch { /* fail-closed in v1 */ }
  }
  return published;
}
