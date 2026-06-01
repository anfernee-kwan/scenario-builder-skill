import { createHash } from "node:crypto";

export function uuidFromString(input: string): string {
  const h = createHash("sha256").update(input).digest("hex");
  const s = h.slice(0, 32).split("");
  s[12] = "4";
  s[16] = ((parseInt(s[16], 16) & 0x3) | 0x8).toString(16);
  const x = s.join("");
  return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20,32)}`;
}
