*Drafted with [Cursor](https://cursor.com) AI from a static review of `main` (~v0.1.0).*

**Scope:** Not a CVE. No unauthenticated bypass found without solving PoW or knowing `powned_secret`.

**Looks sound:** `valid_cookie()` (expiry, `client_key`, `hash_equals` MAC, server double SHA-256); challenge `no-store` / `noindex`; admin paths forced into excludes; early loader removed on deactivate.

**By design:** Friction not auth; GET/HEAD only (POST not gated); one cookie covers all protected GET/HEAD until TTL; binding `none` / same /24; `WP_CLI` + cron skip gate; old cookies keep lower `bits` until expiry. `REMOTE_ADDR` only (no trusted-proxy / XFF list) fits a self-hosted, no-third-party model.

**Recommendations:**
1. **Reverse proxy (generic):** If TLS or HTTP terminates on your **own** nginx/Apache/haproxy, document that binding uses `REMOTE_ADDR` and the origin must see the real client (e.g. correct `real_ip` / forwarded setup)—**without** relying on third-party edge services.
2. Optional rate limit on challenge issuance (bandwidth / abuse).
3. Document secret compromise = forge cookies; optional secret rotation.
4. Cookie set in JS → not `HttpOnly`; XSS elsewhere = replay within binding.
5. Note `status` 200 vs 403 for operators.
6. Low priority: longer MAC, `HEAD` challenge body, `powned_strings` filter trust.

**Not found:** Forge valid cookie without secret/PoW; unauth settings change; RCE in reviewed code.