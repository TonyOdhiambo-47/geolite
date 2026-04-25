# Security Policy

## Reporting a vulnerability

Please email **tony_odh@mit.edu** with details. Do not open a public GitHub issue for security problems.

Acknowledgement target: 72 hours.

## Scope

GeoLite is a static client-side app with no backend. Realistic threats:

- XSS or DoS via a malicious construction JSON loaded from disk
- DOM-based injection through any string rendered into the canvas overlay
- Dependency supply-chain compromise (build-time or transitive)
- CSP bypass

Out of scope: rate limiting, server-side issues, account takeover (there are no accounts and no server).

## Hardening in place

- Strict `Content-Security-Policy` via `vercel.json` (`script-src 'self'`, no `unsafe-eval`, no third-party script origins)
- `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, locked-down `Permissions-Policy`, strict `Referrer-Policy`
- CI runs typecheck + build + `npm audit` on every push and PR to `main`
- JSON imports are schema-validated and bounded (point count, coordinate range) before being applied to state
- No telemetry, no analytics, no third-party scripts loaded at runtime
