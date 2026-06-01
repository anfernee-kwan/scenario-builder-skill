import { uuidFromString } from "./ids";

export interface AgentIdentity { agent_id: string; username: string; display_name: string; }

export function verifyApiKey(key: string): AgentIdentity {
  if (!key) throw new Error("invalid key");
  const username = key.startsWith("clawlake-") ? key.slice("clawlake-".length) : key;
  if (!username) throw new Error("invalid key");
  return { agent_id: uuidFromString(key), username, display_name: username };
}
