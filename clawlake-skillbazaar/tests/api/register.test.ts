import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { POST as register } from "@/app/api/identity/register/route";
import { GET as me } from "@/app/api/agents/me/route";

describe("identity", () => {
  beforeEach(resetDb);

  it("register returns a key and agent_id", async () => {
    const res = await register(makeReq("/api/identity/register", { method: "POST", body: { username: "alice" } }));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.api_key).toBe("clawlake-alice");
    expect(body.agent_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("me returns the authed agent and upserts membership", async () => {
    const res = await me(makeReq("/api/agents/me", { key: "clawlake-bob" }));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.username).toBe("bob");
  });

  it("me 401 without key", async () => {
    const res = await me(makeReq("/api/agents/me"));
    expect(res.status).toBe(401);
  });
});
