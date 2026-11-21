# Bitcap

Edge proof-of-work gate for HTTP sites — **GPL-2.0-or-later**.

Challenge UI and browser miner are **derived from [PoWned](https://github.com/gobrrrme/PoWned)** by [GoBrrr](https://www.gobrrr.me). Thank you for publishing PoWned as open source.

Bitcap runs on **Cloudflare Workers** first, but crypto and routing live in `src/core/` for other adapters later.

## Features

- HMAC-signed challenges + double SHA-256 PoW (longer client key / challenge MAC than early PoWned-derived builds)
- PoWned-style mining splash (`assets/`, port of challenge page)
- Per-host config: **`probe`** or **`allowlist`** mode
- **Paid tier:** KV block counter + per-IP challenge rate limit. **Free tier:** no KV; splash shows **Block #N**; no app rate limit
- HttpOnly `bitcap` cookie via `POST /.bitcap/verify` after mining
- Cookie name: `bitcap`
- Challenge scripts at `/.bitcap/bitcap_wor.js` and `bitcap_min.js` (neutral names to reduce adblock false positives)

## Threat model

- **Friction, not authentication.** Anyone who solves the PoW (or holds a valid cookie) can read gated **GET/HEAD** paths.
- **POST, PUT, PATCH, DELETE** are **not** gated and always reach the origin.
- Hostnames must appear in `config/hosts.yaml`; unknown hosts get **404** from the Worker.
- `enabled: false` returns **503** unless `whenDisabled: pass` (origin only, no PoW).
- Client binding uses **`CF-Connecting-IP`**; `ip` / `network` binding requires a valid connecting IP.
- Secret compromise allows forging cookies until you rotate `BITCAP_SECRET` and redeploy.
- Optional: add Cloudflare **Rate Limiting** rules on the zone for coarse abuse control.

## Quick start (free tier, default)

1. `npm install`
2. `npm run sync-config` — builds `config/hosts.json` from `config/hosts.yaml`
3. `npx wrangler secret put BITCAP_SECRET` — use `openssl rand -hex 32`
4. `npm run deploy` — `[vars] CF_TIER = "free"` in `wrangler.toml` (no KV binding)
5. Cloudflare → **Workers & Pages** → **bitcap** → attach routes per zone (or use `[[routes]]` in `wrangler.toml`)

## Cloudflare tier (`CF_TIER`)

Set in `wrangler.toml` under `[vars]`. Missing or invalid values default to **free** (safe).

| | `CF_TIER = free` | `CF_TIER = paid` |
|--|------------------|------------------|
| Workers KV | Not used | Required (`BITCAP_KV` in `wrangler.toml`) |
| Per-IP rate limit (`rateLimit` in hosts.yaml) | Ignored; no 429 from Bitcap | Enforced (default 5/min) |
| Mining splash block line | **Block #N** (placeholder) | **Block #** + incrementing count |
| PoW, cookies, allowlist/probe | Same | Same |

### Upgrade to paid

1. `npx wrangler kv namespace create BITCAP_KV` — set `id` in `wrangler.toml`
2. Uncomment `[[kv_namespaces]]` for `BITCAP_KV`
3. Set `CF_TIER = "paid"` in `[vars]`
4. `npm run deploy`

### Workers daily request limit (free account)

Free accounts share **100,000 Worker requests/day** (UTC). Over limit, behavior is set per route: **fail open** (bypass worker → origin, no PoW) or **fail closed** (Error 1027). Configure on each route under **Workers & Pages** → **bitcap** → **Domains & Routes** — not in Bitcap code.

## Modes

| `mode` | Behavior |
|--------|----------|
| `probe` | Challenge only when `probePatterns` match. Safe default; add patterns from CF analytics. |
| `allowlist` | Challenge when path is **not** in `allow` (+ optional `allowExtensions`). |

Switch: edit `config/hosts.yaml` → `npm run deploy`. Changing `baseBits` or rotating the secret invalidates existing cookies.

After security-hardening deploys, cookie MAC length and issuance path change; users re-mine once.

## Config

See [config/hosts.yaml](config/hosts.yaml) and [config/hosts.example.yaml](config/hosts.example.yaml).

Deploy-time only (no admin UI in v1).

| Field | Purpose |
|-------|---------|
| `whenDisabled: pass` | Skip PoW when `enabled: false` instead of 503 |
| `rateLimit.maxPerMinute` | **Paid tier only:** cap new challenges + verify POSTs per IP (default 5/min) |
| `rateLimit.windowSec` | **Paid tier only:** KV window for rate limit (default 60) |

## Operations

Every request on a Workers route runs the Worker once (allowlisted paths included). Probe mode keeps most real traffic on cheap pass-through logic; monitor **Workers analytics**. Other Workers on the account share the same daily request pool when on Cloudflare’s free Workers plan.

## Discovering allowlist paths

Chrome DevTools → Network → filter your host; or console unique top-level prefixes after load. For bitcoinpunchup.com: `/`, `/assets/`, `/mobile/`, favicons, `site.webmanifest`, etc.

## Tests

```bash
npm test
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).