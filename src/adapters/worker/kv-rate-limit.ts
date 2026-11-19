import type { RateLimitConfig } from "../../core/types.ts";

export const DEFAULT_RATE_LIMIT: Required<RateLimitConfig> = {
  maxPerMinute: 5,
  windowSec: 60,
};

export function resolveRateLimit(
  config?: RateLimitConfig,
): Required<RateLimitConfig> {
  return {
    maxPerMinute: config?.maxPerMinute ?? DEFAULT_RATE_LIMIT.maxPerMinute,
    windowSec: config?.windowSec ?? DEFAULT_RATE_LIMIT.windowSec,
  };
}

export type ChallengeRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

export async function consumeChallengeIssue(
  kv: KVNamespace,
  hostname: string,
  ip: string,
  config?: RateLimitConfig,
): Promise<ChallengeRateLimitResult> {
  const { maxPerMinute, windowSec } = resolveRateLimit(config);
  const key = `rl:ch:${hostname}:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  const current = Number.isFinite(count) && count >= 0 ? count : 0;

  if (current >= maxPerMinute) {
    return { allowed: false, retryAfterSec: windowSec };
  }

  await kv.put(key, String(current + 1), { expirationTtl: windowSec });
  return { allowed: true };
}