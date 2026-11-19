import { describe, expect, it } from "vitest";
import { resolveHostAction } from "../../src/core/hosts.ts";
import type { HostConfig } from "../../src/core/types.ts";

const baseHost: HostConfig = {
  enabled: true,
  mode: "allowlist",
  neverChallenge: { exact: [], prefixes: [] },
  probePatterns: [],
  allow: { exact: ["/"], prefixes: [] },
  allowExtensions: [],
  pow: { baseBits: 18, ttlHours: 1, binding: "network", httpStatus: 403 },
  branding: { brandColor: "", logoUrl: "", title: "", text: "" },
};

describe("resolveHostAction", () => {
  it("denies unknown hosts", () => {
    expect(resolveHostAction(undefined)).toBe("deny_unknown");
  });

  it("denies disabled hosts by default", () => {
    expect(resolveHostAction({ ...baseHost, enabled: false })).toBe("deny_disabled");
  });

  it("passes when disabled and whenDisabled is pass", () => {
    expect(
      resolveHostAction({ ...baseHost, enabled: false, whenDisabled: "pass" }),
    ).toBe("pass");
  });

  it("serves enabled hosts", () => {
    expect(resolveHostAction(baseHost)).toBe("serve");
  });
});