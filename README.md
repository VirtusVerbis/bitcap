# Bitcap

Edge proof-of-work gate for HTTP sites — **GPL-2.0-or-later**.

Challenge UI and browser miner are **derived from [PoWned](https://github.com/gobrrrme/PoWned)** (GoBrrr / Druck Hoch Drei e.U.). Thank you for publishing PoWned as open source.

Bitcap runs on **Cloudflare Workers** first, but crypto and routing live in `src/core/` for other adapters later.

## Features

- HMAC-signed challenges + double SHA-256 PoW (longer client key / challenge MAC than early PoWned-derived builds)
- PoWned-style mining splash (`assets/`, port of challenge page)
- Per-host config: **`probe`** or **`allowlist`** mode
- KV **Block #N** counter + per-IP challenge rate limit
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

## Quick start (bitcoinpunchup.com)

1. `npm install`
2. `npm run sync-config` — builds `config/hosts.json` from `config/hosts.yaml`
3. Create KV: `npx wrangler kv namespace create BITCAP_KV` — set `id` in `wrangler.toml`
4. `npx wrangler secret put BITCAP_SECRET` — use `openssl rand -hex 32`
5. `npm run deploy`
6. Cloudflare dashboard → **Workers** → route `bitcoinpunchup.com/*` to `bitcap`

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
| `rateLimit.maxPerMinute` | Cap new challenges + verify POSTs per IP (default 5/min) |
| `rateLimit.windowSec` | KV window for rate limit (default 60) |

## Free tier

The Worker runs on `*domain.com/*`; every request is one invocation. Probe mode keeps most real traffic on pass-through logic; monitor **Workers analytics**.

Other Workers on the same account share the daily request pool.

## Discovering allowlist paths

Chrome DevTools → Network → filter your host; or console unique top-level prefixes after load. For bitcoinpunchup.com: `/`, `/assets/`, `/mobile/`, favicons, `site.webmanifest`, etc.

## Tests

```bash
npm test
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).