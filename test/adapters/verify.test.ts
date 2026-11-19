import { describe, expect, it } from "vitest";
import {
  clientKey,
  hash256String,
  macChallenge,
  newChallenge,
  zeroBits,
} from "../../src/core/crypto.ts";
import {
  handleVerifyPost,
  sameSiteHostname,
} from "../../src/adapters/worker/verify.ts";
import type { HostConfig } from "../../src/core/types.ts";

const secret = "b".repeat(64);
const host: HostConfig = {
  enabled: true,
  mode: "allowlist",
  neverChallenge: { exact: [], prefixes: [] },
  probePatterns: [],
  allow: { exact: ["/"], prefixes: [] },
  allowExtensions: [],
  pow: { baseBits: 6, ttlHours: 24, binding: "network", httpStatus: 403 },
  branding: { brandColor: "", logoUrl: "", title: "", text: "" },
  rateLimit: { maxPerMinute: 50, windowSec: 60 },
};

function mockKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

async function solvedCookie(): Promise<{ cookie: string; ip: string }> {
  const ip = "198.51.100.10";
  const client = await clientKey(secret, "network", ip);
  const c = await newChallenge(secret, host.pow, client);
  for (let nonce = 0; nonce < 500000; nonce++) {
    const hash = await hash256String(c.challenge + nonce);
    if (zeroBits(hash) >= c.bits) {
      const mac = await macChallenge(secret, c.challenge);
      return { cookie: `${c.challenge}${nonce}.${mac}`, ip };
    }
  }
  throw new Error("no nonce");
}

describe("verify", () => {
  it("sameSiteHostname accepts matching Origin", () => {
    const req = new Request("https://example.com/.bitcap/verify", {
      headers: { Origin: "https://example.com" },
    });
    expect(sameSiteHostname(req, "example.com")).toBe(true);
  });

  it("sameSiteHostname rejects cross-site Origin", () => {
    const req = new Request("https://example.com/.bitcap/verify", {
      headers: { Origin: "https://evil.example" },
    });
    expect(sameSiteHostname(req, "example.com")).toBe(false);
  });

  it("sets cookies on valid verify POST", async () => {
    const { cookie, ip } = await solvedCookie();
    const req = new Request("https://example.com/.bitcap/verify", {
      method: "POST",
      headers: {
        Origin: "https://example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cookie }),
    });
    const res = await handleVerifyPost(
      req,
      "example.com",
      host,
      secret,
      ip,
      true,
      mockKv(),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const joined = setCookie.length ? setCookie.join("\n") : res.headers.get("Set-Cookie") ?? "";
    expect(joined).toContain("HttpOnly");
    expect(joined).toContain("bitcap=");
    expect(joined).toContain("bitcap_new=");
  });
});