import { describe, expect, it } from "vitest";
import { classifyPath } from "../../src/core/routing.ts";
import type { HostConfig } from "../../src/core/types.ts";

const probeHost: HostConfig = {
  enabled: true,
  mode: "probe",
  neverChallenge: { exact: ["/robots.txt"], prefixes: [] },
  probePatterns: ["/wp-admin*", "/*.php"],
  allow: { exact: ["/"], prefixes: ["/mobile/"] },
  allowExtensions: [],
  pow: { baseBits: 18, ttlHours: 24, binding: "network", httpStatus: 403 },
  branding: { brandColor: "#f7931a", logoUrl: "", title: "", text: "" },
};

const allowHost: HostConfig = {
  ...probeHost,
  mode: "allowlist",
  allow: {
    exact: ["/"],
    prefixes: ["/assets/", "/mobile/"],
  },
  allowExtensions: [".png"],
};

describe("classifyPath probe mode", () => {
  it("passes normal paths", () => {
    expect(classifyPath(probeHost, "/")).toBe("pass");
    expect(classifyPath(probeHost, "/mobile/x.png")).toBe("pass");
  });

  it("gates probe paths", () => {
    expect(classifyPath(probeHost, "/wp-admin")).toBe("gate");
    expect(classifyPath(probeHost, "/xmlrpc.php")).toBe("gate");
  });

  it("neverChallenge wins", () => {
    expect(classifyPath(probeHost, "/robots.txt")).toBe("pass");
  });

  it("passes bitcap assets", () => {
    expect(classifyPath(probeHost, "/.bitcap/worker.js")).toBe("pass");
  });
});

describe("classifyPath allowlist mode", () => {
  it("passes allow list", () => {
    expect(classifyPath(allowHost, "/")).toBe("pass");
    expect(classifyPath(allowHost, "/assets/index.js")).toBe("pass");
  });

  it("passes allowExtensions", () => {
    expect(classifyPath(allowHost, "/evil.png")).toBe("pass");
  });

  it("gates unknown paths", () => {
    expect(classifyPath(allowHost, "/wp-admin")).toBe("gate");
  });
});