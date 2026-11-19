export function unavailableResponse(): Response {
  return new Response("Unavailable", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function unknownHostResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export function disabledHostResponse(): Response {
  return new Response("Unavailable", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function bindingDeniedResponse(): Response {
  return new Response("Forbidden", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}

export function challengeHeaders(secure: boolean): HeadersInit {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": csp,
  };
  if (secure) {
    headers["Strict-Transport-Security"] = "max-age=31536000";
  }
  return headers;
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfterSec),
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}