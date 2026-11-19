import hosts from "../../../config/hosts.json";
import type { HostConfig, HostsConfig } from "../../core/types.ts";
import { classifyPath, requestPath } from "../../core/routing.ts";
import {
  clientKey,
  getCookieValue,
  newChallenge,
  parseCookies,
  validCookie,
} from "../../core/crypto.ts";
import { renderChallengeHtml } from "./challenge.ts";
import {
  clearNewMarkerHeaders,
  maybeIncrementBlock,
  readBlockCount,
} from "./kv-blocks.ts";
import { COOKIE_NEW, VERSION } from "../../core/types.ts";

export interface Env {
  BITCAP_KV: KVNamespace;
  BITCAP_SECRET: string;
  ASSETS: Fetcher;
}

const hostMap = hosts as HostsConfig;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (url.pathname.startsWith("/.bitcap/")) {
      return serveAsset(request, env, url);
    }

    const host = hostMap[hostname];
    if (!host || !host.enabled) {
      return fetch(request);
    }

    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return fetch(request);
    }

    const path = requestPath(url);
    const decision = classifyPath(host, path);
    if (decision === "pass") {
      return fetch(request);
    }

    const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
    const cookies = parseCookies(request.headers.get("Cookie"));
    const rawCookie = getCookieValue(cookies);
    const secret = env.BITCAP_SECRET;

    if (!secret) {
      return new Response("BITCAP_SECRET not configured", { status: 500 });
    }

    if (rawCookie) {
      const block = await validCookie(rawCookie, secret, host.pow, ip);
      if (block) {
        await maybeIncrementBlock(
          env.BITCAP_KV,
          hostname,
          block.salt,
          Boolean(cookies[COOKIE_NEW]),
          block.expiry,
          host.pow.ttlHours,
        );
        const origin = await fetch(request);
        if (!cookies[COOKIE_NEW]) {
          return origin;
        }
        const res = new Response(origin.body, origin);
        for (const h of clearNewMarkerHeaders()) {
          res.headers.append("Set-Cookie", h);
        }
        return res;
      }
    }

    if (method === "HEAD") {
      return new Response(null, {
        status: host.pow.httpStatus,
        headers: challengeHeaders(),
      });
    }

    const client = await clientKey(secret, host.pow.binding, ip);
    const c = await newChallenge(secret, host.pow, client);
    const blockHeight = (await readBlockCount(env.BITCAP_KV, hostname)) + 1;
    const secure = url.protocol === "https:";
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
      secure,
      pow: host.pow,
      branding: host.branding,
      backUrl: back,
    });

    return new Response(html, {
      status: host.pow.httpStatus,
      headers: challengeHeaders(),
    });
  },
};

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

function challengeHeaders(): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
  };
}