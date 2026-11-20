import { describe, expect, it } from "vitest";
import { FREE_BLOCK_LABEL, isPaidTier } from "../../src/adapters/worker/tier.ts";

describe("isPaidTier", () => {
  it("returns true only when CF_TIER is paid", () => {
    expect(isPaidTier({ CF_TIER: "paid" })).toBe(true);
  });

  it("defaults to free when unset or other values", () => {
    expect(isPaidTier({})).toBe(false);
    expect(isPaidTier({ CF_TIER: "free" })).toBe(false);
    expect(isPaidTier({ CF_TIER: "" })).toBe(false);
    expect(isPaidTier({ CF_TIER: "PAID" })).toBe(false);
  });

  it("exports free block label", () => {
    expect(FREE_BLOCK_LABEL).toBe("Block #N");
  });
});