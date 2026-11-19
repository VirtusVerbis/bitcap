import {
  extensionAllowed,
  anyPattern,
  pathRulesMatch,
} from "./patterns.ts";
import type { HostConfig, RouteDecision } from "./types.ts";

export function requestPath(url: URL): string {
  const path = url.pathname || "/";
  return path === "" ? "/" : path;
}

export function classifyPath(host: HostConfig, path: string): RouteDecision {
  if (!host.enabled) {
    return "pass";
  }

  if (pathRulesMatch(host.neverChallenge, path)) {
    return "pass";
  }

  if (path.startsWith("/.bitcap/")) {
    return "pass";
  }

  if (host.mode === "probe") {
    if (anyPattern(host.probePatterns, path)) {
      return "gate";
    }
    return "pass";
  }

  // allowlist
  if (pathRulesMatch(host.allow, path)) {
    return "pass";
  }
  if (extensionAllowed(path, host.allowExtensions)) {
    return "pass";
  }
  return "gate";
}