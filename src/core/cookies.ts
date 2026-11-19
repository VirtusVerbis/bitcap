import { COOKIE_NAME, COOKIE_NEW } from "./types.ts";

export function buildCookieHeader(
  name: string,
  value: string,
  maxAgeSec: number,
  secure: boolean,
  httpOnly: boolean,
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

export function formatVerifyCookies(
  rawCookie: string,
  ttlSeconds: number,
  secure: boolean,
): string[] {
  return [
    buildCookieHeader(COOKIE_NAME, rawCookie, ttlSeconds, secure, true),
    buildCookieHeader(COOKIE_NEW, "1", 300, secure, true),
  ];
}

export function clearNewMarkerHeaders(secure: boolean): string[] {
  const base = `${COOKIE_NEW}=; Path=/; Max-Age=0; SameSite=Lax`;
  return secure
    ? [base, `${base}; Secure`]
    : [base];
}