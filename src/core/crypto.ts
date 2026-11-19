import type { BindingMode, PowConfig, ValidBlock } from "./types.ts";
import { COOKIE_NAME } from "./types.ts";

export const CLIENT_KEY_HEX = 16;
export const CHALLENGE_MAC_HEX = 32;

const COOKIE_RE = new RegExp(
  `^1\\.(\\d{10})\\.([0-9a-f]{${CLIENT_KEY_HEX}})\\.(\\d{1,3})\\.([0-9a-f]{12})\\.(\\d{1,12})\\.([0-9a-f]{${CHALLENGE_MAC_HEX}})$`,
);

export function zeroBits(data: Uint8Array): number {
  let bits = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte === 0) {
      bits += 8;
      continue;
    }
    for (let m = 0x80; m && !(byte & m); m >>= 1) {
      bits++;
    }
    break;
  }
  return bits;
}

export async function hash256(data: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const h1 = await crypto.subtle.digest("SHA-256", buf);
  const h2 = await crypto.subtle.digest("SHA-256", h1);
  return new Uint8Array(h2);
}

export async function hash256String(text: string): Promise<Uint8Array> {
  return hash256(new TextEncoder().encode(text));
}

function hexEncode(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSha256Hex(
  secret: string,
  message: string,
  truncate: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  const full = hexEncode(new Uint8Array(sig));
  return full.slice(0, truncate);
}

function parseIpBytes(ip: string): Uint8Array | null {
  if (ip.includes(":")) {
    const expanded = expandIpv6(ip);
    if (!expanded) return null;
    return expanded;
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out[i] = n;
  }
  return out;
}

function expandIpv6(ip: string): Uint8Array | null {
  const halves = ip.split("::");
  let left: string[] = [];
  let right: string[] = [];
  if (halves.length === 1) {
    left = ip.split(":").filter(Boolean);
  } else if (halves.length === 2) {
    left = halves[0] ? halves[0].split(":") : [];
    right = halves[1] ? halves[1].split(":") : [];
  } else {
    return null;
  }
  const groups = [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const v = parseInt(groups[i] || "0", 16);
    if (!Number.isFinite(v) || v < 0 || v > 0xffff) return null;
    out[i * 2] = (v >> 8) & 0xff;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

export function isBindableIp(ip: string | null | undefined, binding: BindingMode): boolean {
  if (binding === "none") return true;
  if (!ip || !ip.trim()) return false;
  return parseIpBytes(ip.trim()) !== null;
}

export async function clientKey(
  secret: string,
  binding: BindingMode,
  ip: string,
): Promise<string> {
  let net: string;
  if (binding === "none") {
    net = "any";
  } else {
    const bin = parseIpBytes(ip.trim());
    if (!bin) {
      net = "__invalid_ip__";
    } else if (binding === "ip") {
      net = hexEncode(bin);
    } else {
      const slice = bin.length === 4 ? bin.subarray(0, 3) : bin.subarray(0, 8);
      net = hexEncode(slice);
    }
  }
  return hmacSha256Hex(secret, `client|${binding}|${net}`, CLIENT_KEY_HEX);
}

export async function macChallenge(
  secret: string,
  challenge: string,
): Promise<string> {
  return hmacSha256Hex(secret, `challenge|${challenge}`, CHALLENGE_MAC_HEX);
}

export interface NewChallenge {
  challenge: string;
  mac: string;
  bits: number;
}

export async function newChallenge(
  secret: string,
  pow: PowConfig,
  client: string,
): Promise<NewChallenge> {
  const bits = pow.baseBits;
  const expiry = Math.floor(Date.now() / 1000) + pow.ttlHours * 3600;
  const salt = hexEncode(crypto.getRandomValues(new Uint8Array(6)));
  const challenge = `1.${expiry}.${client}.${bits}.${salt}.`;
  const mac = await macChallenge(secret, challenge);
  return { challenge, mac, bits };
}

export async function validCookie(
  raw: string,
  secret: string,
  pow: PowConfig,
  clientIp: string,
): Promise<ValidBlock | null> {
  const m = COOKIE_RE.exec(raw);
  if (!m) return null;

  const expiry = Number(m[1]);
  const client = m[2];
  const bits = Number(m[3]);
  const salt = m[4];
  const nonce = m[5];
  const mac = m[6];

  if (!isBindableIp(clientIp, pow.binding)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    expiry < now ||
    expiry > now + pow.ttlHours * 3600 + 600 ||
    bits !== pow.baseBits
  ) {
    return null;
  }

  const expectedClient = await clientKey(secret, pow.binding, clientIp);
  if (!timingSafeEqualHex(client, expectedClient)) {
    return null;
  }

  const challenge = `1.${expiry}.${client}.${bits}.${salt}.`;
  const expectedMac = await macChallenge(secret, challenge);
  if (!timingSafeEqualHex(mac, expectedMac)) {
    return null;
  }

  const hash = await hash256String(challenge + nonce);
  if (zeroBits(hash) < bits) {
    return null;
  }

  return { expiry, salt };
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function getCookieValue(
  cookies: Record<string, string>,
): string | null {
  return cookies[COOKIE_NAME] ?? null;
}