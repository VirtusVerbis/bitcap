export type GateMode = "probe" | "allowlist";
export type BindingMode = "network" | "ip" | "none";

export interface PathRules {
  exact: string[];
  prefixes: string[];
}

export interface RateLimitConfig {
  maxPerMinute?: number;
  windowSec?: number;
}

export interface PowConfig {
  baseBits: number;
  ttlHours: number;
  binding: BindingMode;
  httpStatus: number;
}

export interface BrandingConfig {
  brandColor: string;
  logoUrl: string;
  title: string;
  text: string;
}

export type WhenDisabled = "pass" | "deny";

export interface HostConfig {
  enabled: boolean;
  whenDisabled?: WhenDisabled;
  mode: GateMode;
  neverChallenge: PathRules;
  probePatterns: string[];
  allow: PathRules;
  allowExtensions: string[];
  pow: PowConfig;
  branding: BrandingConfig;
  rateLimit?: RateLimitConfig;
}

export type HostsConfig = Record<string, HostConfig>;

export type RouteDecision = "pass" | "gate";

export interface ValidBlock {
  expiry: number;
  salt: string;
}

export const COOKIE_NAME = "bitcap";
export const COOKIE_NEW = "bitcap_new";
export const ASSET_PREFIX = "/.bitcap/";
export const VERSION = "0.1.0";