import hosts from "../../../config/hosts.json";
import type { HostConfig, HostsConfig } from "../../core/types.ts";
import { classifyPath, requestPath } from "../../core/routing.ts";
import {
  clientKey,
  getCookieValue,
  isBindableIp,
  newChallenge,
  parseCookies,
  validCookie,
} from "../../core/crypto.ts";
import { clearNewMarkerHeaders } from "../../core/cookies.ts";
import { resolveHostAction } from "../../core/hosts.ts";
import { renderChallengeHtml } from "./challenge.ts";
import { maybeIncrementBlock, readBlockCount } from "./kv-blocks.ts";
import { consumeChallengeIssue } from "./kv-rate-limit.ts";
import {
  bindingDeniedResponse,
  challengeHeaders,
  disabledHostResponse,
  rateLimitResponse,
  unavailableResponse,
  unknownHostResponse,
} from "./responses.ts";
import { handleVerifyPost } from "./verify.ts";
import { COOKIE_NEW } from "../../core/types.ts";
import { isPaidTier } from "./tier.ts";
import type { RateLimitConfig } from "../../core/types.ts";
import type { ChallengeRateLimitResult } from "./kv-rate-limit.ts";

export interface Env {
  CF_TIER?: string;
  BITCAP_KV?: KVNamespace;
  BITCAP_SECRET: string;
  ASSETS: Fetcher;
}

async function checkChallengeRateLimit(
  env: Env,
  hostname: string,
  clientIp: string,
  rateLimit?: RateLimitConfig,
): Promise<ChallengeRateLimitResult> {
  if (!isPaidTier(env) || !env.BITCAP_KV) {
    return { allowed: true };
  }
  return consumeChallengeIssue(
    env.BITCAP_KV,
    hostname,
    clientIp,
    rateLimit,
  );
}

const hostMap = hosts as HostsConfig;
const VERIFY_PATH = "/.bitcap/verify";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const secure = url.protocol === "https:";

    if (url.pathname.startsWith("/.bitcap/")) {
      if (url.pathname === VERIFY_PATH && request.method.toUpperCase() === "POST") {
        return handleBitcapVerify(request, env, hostname, secure);
      }
      return serveAsset(request, env, url);
    }

    const host = hostMap[hostname];
    const hostAction = resolveHostAction(host);
    if (hostAction === "deny_unknown") {
      return unknownHostResponse();
    }
    if (hostAction === "deny_disabled") {
      return disabledHostResponse();
    }
    if (hostAction === "pass") {
      return fetch(request);
    }

    const activeHost = host as HostConfig;

    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return fetch(request);
    }

    const path = requestPath(url);
    const decision = classifyPath(activeHost, path);
    if (decision === "pass") {
      return fetch(request);
    }

    const ip = request.headers.get("CF-Connecting-IP");
    if (!isBindableIp(ip, activeHost.pow.binding)) {
      return bindingDeniedResponse();
    }
    const clientIp = ip ?? "";

    const secret = env.BITCAP_SECRET;
    if (!secret) {
      return unavailableResponse();
    }

    const cookies = parseCookies(request.headers.get("Cookie"));
    const rawCookie = getCookieValue(cookies);

    if (rawCookie) {
      const block = await validCookie(rawCookie, secret, activeHost.pow, clientIp);
      if (block) {
        if (isPaidTier(env) && env.BITCAP_KV) {
          await maybeIncrementBlock(
            env.BITCAP_KV,
            hostname,
            block.salt,
            Boolean(cookies[COOKIE_NEW]),
            block.expiry,
            activeHost.pow.ttlHours,
          );
        }
        const origin = await fetch(request);
        if (!cookies[COOKIE_NEW]) {
          return origin;
        }
        const res = new Response(origin.body, origin);
        for (const h of clearNewMarkerHeaders(secure)) {
          res.headers.append("Set-Cookie", h);
        }
        return res;
      }
    }

    const limited = await checkChallengeRateLimit(
      env,
      hostname,
      clientIp,
      activeHost.rateLimit,
    );
    if (!limited.allowed) {
      return rateLimitResponse(limited.retryAfterSec);
    }

    if (method === "HEAD") {
      return new Response(null, {
        status: activeHost.pow.httpStatus,
        headers: challengeHeaders(secure),
      });
    }

    const client = await clientKey(secret, activeHost.pow.binding, clientIp);
    const c = await newChallenge(secret, activeHost.pow, client);
    const paid = isPaidTier(env) && env.BITCAP_KV;
    const blockHeight = paid
      ? (await readBlockCount(env.BITCAP_KV!, hostname)) + 1
      : 0;
    const back =
      request.headers.get("Referer") &&
      new URL(request.headers.get("Referer")!).hostname === hostname
        ? request.headers.get("Referer")!
        : `${url.origin}/`;

    const html = renderChallengeHtml({
      challenge: c.challenge,
      mac: c.mac,
      bits: c.bits,
      blockHeight,
      blockPlaceholder: !paid,
      secure,
      pow: activeHost.pow,
      branding: activeHost.branding,
      backUrl: back,
    });

    return new Response(html, {
      status: activeHost.pow.httpStatus,
      headers: challengeHeaders(secure),
    });
  },
};

async function handleBitcapVerify(
  request: Request,
  env: Env,
  hostname: string,
  secure: boolean,
): Promise<Response> {
  const host = hostMap[hostname];
  const hostAction = resolveHostAction(host);
  if (hostAction === "deny_unknown") {
    return unknownHostResponse();
  }
  if (hostAction === "deny_disabled") {
    return disabledHostResponse();
  }
  if (hostAction === "pass") {
    return unavailableResponse();
  }

  const activeHost = host as HostConfig;
  const ip = request.headers.get("CF-Connecting-IP");
  if (!isBindableIp(ip, activeHost.pow.binding)) {
    return bindingDeniedResponse();
  }

  const secret = env.BITCAP_SECRET;
  if (!secret) {
    return unavailableResponse();
  }

  return handleVerifyPost(
    request,
    hostname,
    activeHost,
    secret,
    ip ?? "",
    secure,
    isPaidTier(env),
    env.BITCAP_KV,
  );
}

async function serveAsset(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const name = url.pathname.slice("/.bitcap/".length).split("?")[0];
  if (!name || name.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `/${name}`;
  const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  const headers = new Headers(res.headers);
  if (name.endsWith(".js")) {
    headers.set("Content-Type", "application/javascript; charset=utf-8");
  }
  headers.set("Cache-Control", "public, max-age=86400");
  return new Response(res.body, { status: res.status, headers });
}