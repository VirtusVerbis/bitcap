import { describe, expect, it } from "vitest";
import {
  clientKey,
  hash256String,
  macChallenge,
  newChallenge,
  zeroBits,
} from "../../src/core/crypto.ts";
import { renderChallengeHtml } from "../../src/adapters/worker/challenge.ts";
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

const challengeBase = {
  challenge: "ch",
  mac: "mac",
  bits: 18,
  blockHeight: 42,
  secure: true,
  pow: { baseBits: 18, ttlHours: 1, binding: "network" as const, httpStatus: 403 },
  branding: { brandColor: "#f7931a", logoUrl: "", title: "", text: "" },
  backUrl: "https://example.com/",
};

describe("renderChallengeHtml", () => {
  it("shows Block #N when blockPlaceholder is set", () => {
    const html = renderChallengeHtml({ ...challengeBase, blockPlaceholder: true });
    expect(html).toContain("Block #N");
    expect(html).not.toContain("Block #42");
  });

  it("shows numeric block height when not placeholder", () => {
    const html = renderChallengeHtml({ ...challengeBase, blockPlaceholder: false });
    expect(html).toContain("Block #42");
  });
});

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

  it("free tier never rate-limits verify POST", async () => {
    const { cookie, ip } = await solvedCookie();
    const kv = mockKv();
    const cfg = { ...host, rateLimit: { maxPerMinute: 1, windowSec: 60 } };
    const body = JSON.stringify({ cookie });
    const makeReq = () =>
      new Request("https://example.com/.bitcap/verify", {
        method: "POST",
        headers: {
          Origin: "https://example.com",
          "Content-Type": "application/json",
        },
        body,
      });
    const res1 = await handleVerifyPost(
      makeReq(),
      "example.com",
      cfg,
      secret,
      ip,
      true,
      false,
    );
    expect(res1.status).toBe(200);
    const res2 = await handleVerifyPost(
      makeReq(),
      "example.com",
      cfg,
      secret,
      ip,
      true,
      false,
    );
    expect(res2.status).toBe(200);
    const stored = await kv.get(`rl:ch:example.com:${ip}`);
    expect(stored).toBeNull();
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