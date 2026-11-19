import { describe, expect, it } from "vitest";
import {
  clientKey,
  macChallenge,
  newChallenge,
  validCookie,
  zeroBits,
  hash256String,
} from "../../src/core/crypto.ts";
import type { PowConfig } from "../../src/core/types.ts";

const secret = "a".repeat(64);
const pow: PowConfig = {
  baseBits: 8,
  ttlHours: 24,
  binding: "network",
  httpStatus: 403,
};

async function bruteNonce(challenge: string, bits: number): Promise<string> {
  for (let nonce = 0; nonce < 500000; nonce++) {
    const hash = await hash256String(challenge + nonce);
    if (zeroBits(hash) >= bits) {
      return String(nonce);
    }
  }
  throw new Error("no nonce");
}

describe("crypto", () => {
  it("computes stable clientKey", async () => {
    const k1 = await clientKey(secret, "network", "203.0.113.50");
    const k2 = await clientKey(secret, "network", "203.0.113.99");
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{12}$/);
  });

  it("validates cookie round-trip", async () => {
    const client = await clientKey(secret, "network", "198.51.100.10");
    const c = await newChallenge(secret, pow, client);
    const nonce = await bruteNonce(c.challenge, c.bits);
    const mac = await macChallenge(secret, c.challenge);
    const cookie = `${c.challenge}${nonce}.${mac}`;
    const block = await validCookie(cookie, secret, pow, "198.51.100.10");
    expect(block).not.toBeNull();
    expect(block?.salt).toMatch(/^[0-9a-f]{12}$/);
  });

  it("rejects tampered mac", async () => {
    const client = await clientKey(secret, "network", "198.51.100.10");
    const c = await newChallenge(secret, pow, client);
    const cookie = `${c.challenge}12345.${"0".repeat(16)}`;
    expect(await validCookie(cookie, secret, pow, "198.51.100.10")).toBeNull();
  });
});