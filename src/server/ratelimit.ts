/** Fixed-window in-memory limiter. Good enough for one instance; a shared store (Redis) is the next step. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || now >= h.resetAt) { hits.set(key, { count: 1, resetAt: now + windowMs }); return true; }
    h.count++;
    return h.count <= max;
  };
}
