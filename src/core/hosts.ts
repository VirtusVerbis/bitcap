import type { HostConfig } from "./types.ts";

export type HostAction = "serve" | "pass" | "deny_unknown" | "deny_disabled";

export function resolveHostAction(
  host: HostConfig | undefined,
): HostAction {
  if (!host) {
    return "deny_unknown";
  }
  if (!host.enabled) {
    return host.whenDisabled === "pass" ? "pass" : "deny_disabled";
  }
  return "serve";
}