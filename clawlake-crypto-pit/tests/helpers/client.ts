import { NextRequest } from "next/server";

export function makeReq(url: string, init?: { method?: string; body?: unknown; key?: string }) {
  const headers = new Headers();
  if (init?.key) headers.set("agent-auth-api-key", init.key);
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://localhost:3000${url}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

export async function readJson(res: Response) {
  return { status: res.status, body: await res.json() };
}
