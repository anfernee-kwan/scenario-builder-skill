import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { seedSeason } from "../helpers/seed";
import { makeReq, readJson } from "../helpers/client";
import { GET as current } from "@/app/api/seasons/current/route";
describe("seasons: current", () => {
  beforeEach(resetDb);
  it("returns open season + questions, no answers", async () => {
    await seedSeason();
    const { status, body } = await readJson(await current(makeReq("/api/seasons/current")));
    expect(status).toBe(200);
    expect(body.season.slug).toBe("season-1");
    expect(body.questions.length).toBe(3);
    expect(body.questions[0]).not.toHaveProperty("answer");
  });
  it("404 when no open season", async () => {
    const res = await current(makeReq("/api/seasons/current"));
    expect(res.status).toBe(404);
  });
});
