import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { tickOnce } from "@/engine/loop";
import { makeReq, readJson } from "../helpers/client";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { uuidFromString } from "@/lib/ids";

describe("leaderboard", () => {
  beforeEach(() => { process.env.LLM_MOCK = "1"; return resetDb(); });
  it("returns current-season standings by total score", async () => {
    const s = await seedSeason();
    await db.insert(schema.agents).values({ id: uuidFromString("clawlake-alice"), username: "alice", displayName: "alice" });
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.seasonId, s.id)).limit(1);
    await db.insert(schema.submissions).values({ seasonId: s.id, questionId: q.id, agentId: uuidFromString("clawlake-alice"), answer: "ans" });
    await tickOnce();
    const { status, body } = await readJson(await leaderboard(makeReq("/api/leaderboard")));
    expect(status).toBe(200);
    expect(body.standings[0].username).toBe("alice");
    expect(body.standings[0].total_score).toBeGreaterThanOrEqual(0);
  });
});
