import type { BrandingConfig } from "./types.ts";
import { COOKIE_NAME } from "./types.ts";

export interface ChallengeStrings {
  title: string;
  block: string;
  text: string;
  diff: string;
  nonce: string;
  mining: string;
  found: string;
  nocook: string;
  nojs: string;
  back: string;
  cookie: string;
}

const DEFAULT_STRINGS: ChallengeStrings = {
  title: "Mining requested page",
  block: "Block #%s",
  text: "Proof of work at the edge: double SHA-256, like Bitcoin.",
  diff: "Difficulty",
  nonce: "Nonce",
  mining: "Mining …",
  found: "Block found",
  nocook: "Your browser did not accept the cookie. Please allow cookies for this site and reload.",
  nojs: "This page needs JavaScript.",
  back: "Go back",
  cookie: "Cookie %1$s, %2$d h, strictly necessary.",
};

export function stringsForHost(
  branding: BrandingConfig,
  ttlHours: number,
): ChallengeStrings {
  const t = { ...DEFAULT_STRINGS };
  if (branding.title.trim()) {
    t.title = branding.title.trim();
  }
  if (branding.text.trim()) {
    t.text = branding.text.trim();
  }
  t.cookie = t.cookie
    .replace("%1$s", COOKIE_NAME)
    .replace("%2$d", String(ttlHours));
  return t;
}