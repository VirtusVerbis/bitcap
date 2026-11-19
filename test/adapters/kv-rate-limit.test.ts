import { describe, expect, it } from "vitest";
import {
  consumeChallengeIssue,
  resolveRateLimit,
} from "../../src/adapters/worker/kv-rate-limit.ts";

function mockKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    store,
  } as unknown as KVNamespace;
}

describe("consumeChallengeIssue", () => {
  it("allows up to maxPerMinute then blocks", async () => {
    const kv = mockKv();
    const cfg = { maxPerMinute: 2, windowSec: 60 };
    expect((await consumeChallengeIssue(kv, "example.com", "1.2.3.4", cfg)).allowed).toBe(
      true,
    );
    expect((await consumeChallengeIssue(kv, "example.com", "1.2.3.4", cfg)).allowed).toBe(
      true,
    );
    const third = await consumeChallengeIssue(kv, "example.com", "1.2.3.4", cfg);
    expect(third.allowed).toBe(false);
    if (!third.allowed) {
      expect(third.retryAfterSec).toBe(60);
    }
  });

  it("resolveRateLimit fills defaults", () => {
    expect(resolveRateLimit(undefined).maxPerMinute).toBe(5);
    expect(resolveRateLimit({ maxPerMinute: 10 }).windowSec).toBe(60);
  });
});