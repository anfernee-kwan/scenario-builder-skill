const hits = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.resetAt) { hits.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (e.count >= max) return false;
  e.count++;
  return true;
}
