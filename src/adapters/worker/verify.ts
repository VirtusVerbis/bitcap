import type { HostConfig } from "../../core/types.ts";
import { formatVerifyCookies } from "../../core/cookies.ts";
import { validCookie } from "../../core/crypto.ts";
import { consumeChallengeIssue } from "./kv-rate-limit.ts";
import { rateLimitResponse } from "./responses.ts";

const MAX_BODY_BYTES = 4096;

export function sameSiteHostname(
  request: Request,
  expectedHostname: string,
): boolean {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      return new URL(origin).hostname === expectedHostname;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).hostname === expectedHostname;
    } catch {
      return false;
    }
  }
  return false;
}

export async function handleVerifyPost(
  request: Request,
  hostname: string,
  host: HostConfig,
  secret: string,
  ip: string,
  secure: boolean,
  kv: KVNamespace,
): Promise<Response> {
  if (!sameSiteHostname(request, hostname)) {
    return new Response("Forbidden", { status: 403 });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return new Response("Bad Request", { status: 400 });
  }

  let cookie: string;
  try {
    const parsed = JSON.parse(bodyText) as { cookie?: unknown };
    if (typeof parsed.cookie !== "string" || !parsed.cookie) {
      return new Response("Bad Request", { status: 400 });
    }
    cookie = parsed.cookie;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const limited = await consumeChallengeIssue(kv, hostname, ip, host.rateLimit);
  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSec);
  }

  const block = await validCookie(cookie, secret, host.pow, ip);
  if (!block) {
    return new Response("Bad Request", { status: 400 });
  }

  const ttlSeconds = Math.max(
    0,
    block.expiry - Math.floor(Date.now() / 1000),
  );
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  for (const line of formatVerifyCookies(cookie, ttlSeconds, secure)) {
    headers.append("Set-Cookie", line);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}