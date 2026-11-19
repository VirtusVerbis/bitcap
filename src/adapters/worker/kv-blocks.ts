export async function readBlockCount(
  kv: KVNamespace,
  hostname: string,
): Promise<number> {
  const raw = await kv.get(`blocks:${hostname}`);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function maybeIncrementBlock(
  kv: KVNamespace,
  hostname: string,
  salt: string,
  hasNewMarker: boolean,
  expiry: number,
  ttlHours: number,
): Promise<void> {
  if (!hasNewMarker) return;

  const solvedAt = expiry - ttlHours * 3600;
  const now = Math.floor(Date.now() / 1000);
  if (solvedAt < now - 15 * 60) return;

  const dedupeKey = `seen:${hostname}:${salt}`;
  const existing = await kv.get(dedupeKey);
  if (existing) return;

  await kv.put(dedupeKey, "1", { expirationTtl: 15 * 60 });

  const countKey = `blocks:${hostname}`;
  const current = await readBlockCount(kv, hostname);
  await kv.put(countKey, String(current + 1));
}