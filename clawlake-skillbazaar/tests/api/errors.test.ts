import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "../helpers/db";
import { makeReq, readJson } from "../helpers/client";
import { withAuth } from "@/lib/http";

describe("error envelope", () => {
  beforeEach(resetDb);
  it("unexpected throw in an authed handler returns a 500 envelope", async () => {
    const boom = withAuth(async () => { throw new Error("boom"); });
    const { status, body } = await readJson(await boom(makeReq("/x", { key: "clawlake-alice" })));
    expect(status).toBe(500);
    expect(body.code).toBe("internal");
  });
});
