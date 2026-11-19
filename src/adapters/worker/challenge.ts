import type { BrandingConfig, PowConfig } from "../../core/types.ts";
import { stringsForHost } from "../../core/strings.ts";
import { VERSION } from "../../core/types.ts";

export interface ChallengePageParams {
  challenge: string;
  mac: string;
  bits: number;
  blockHeight: number;
  secure: boolean;
  pow: PowConfig;
  branding: BrandingConfig;
  backUrl: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function renderChallengeHtml(p: ChallengePageParams): string {
  const t = stringsForHost(p.branding, p.pow.ttlHours);
  const title = p.branding.title.trim() || t.title;
  const text = p.branding.text.trim() || t.text;
  const brand = /^#[0-9a-f]{3,8}$/i.test(p.branding.brandColor)
    ? p.branding.brandColor
    : "#f7931a";
  const blockLine = t.block.replace("%s", String(p.blockHeight));
  const logo = p.branding.logoUrl.trim()
    ? `<img src="${esc(p.branding.logoUrl)}" alt="" width="16" height="16">`
    : "";

  const dataAttrs = [
    `data-challenge="${esc(p.challenge)}"`,
    `data-mac="${esc(p.mac)}"`,
    `data-bits="${p.bits}"`,
    `data-cookie="bitcap"`,
    `data-ttl="${p.pow.ttlHours * 3600}"`,
    `data-secure="${p.secure ? "1" : "0"}"`,
    `data-worker="/.bitcap/bitcap_wor.js?ver=${VERSION}"`,
    `data-brand="${esc(brand)}"`,
    `data-found="${esc(t.found)}"`,
    `data-nocookie="${esc(t.nocook)}"`,
    `data-preview="0"`,
    `data-verify="/.bitcap/verify"`,
  ].join(" ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/.bitcap/challenge.css?ver=${VERSION}">
</head>
<body>
<main id="bitcap" ${dataAttrs}>
  <div class="pw-block" id="pw-block" aria-hidden="true">
    ${'<i></i>'.repeat(64)}
    <svg class="pw-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
  </div>
  <h1>${esc(title)}</h1>
  <p class="pw-height">${esc(blockLine)}</p>
  <p class="pw-status" id="pw-status" role="status" aria-live="polite">${esc(t.mining)}</p>
  <div class="pw-details">
    <span>${p.bits} bits</span>
    <span id="pw-rate">– kH/s</span>
    <span>${esc(t.nonce)} <b id="pw-nonce">0</b></span>
    <span class="pw-hash" id="pw-hash">&nbsp;</span>
  </div>
  <noscript><p class="pw-status err">${esc(t.nojs)}</p></noscript>
  <footer class="pw-foot">
    <p class="pw-foot-text">${esc(text)} ${logo}</p>
    <p class="pw-foot-back"><a href="${esc(p.backUrl)}">${esc(t.back)}</a></p>
  </footer>
</main>
<script src="/.bitcap/bitcap_wor.js?ver=${VERSION}"></script>
<script src="/.bitcap/bitcap_min.js?ver=${VERSION}"></script>
</body>
</html>`;
}