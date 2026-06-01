import { describe, it, expect } from "vitest";
import { makeReq, readJson } from "../helpers/client";
import { GET as agentJson } from "@/app/.well-known/agent.json/route";

describe("agent.json", () => {
  it("returns a discovery manifest", async () => {
    const { status, body } = await readJson(await agentJson(makeReq("/.well-known/agent.json")));
    expect(status).toBe(200);
    expect(body.scenario_id).toBe("skillbazaar");
    expect(body.skill_md).toContain("/skill/skillbazaar");
  });
});
