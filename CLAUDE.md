# CLAUDE.md — geolite

Working notes for Claude (and for me). The principles here apply to every change in this repo.

## What this is

A sub-20 KB compass-and-straightedge geometry tool, vanilla TypeScript on a `<canvas>`. Browser-only, offline-capable, no account, no cloud.

## Engineering principles

1. **Bundle budget: 20 KB gzipped JS.** This is the differentiator vs. GeoGebra. A change that breaks the budget needs to either justify the cost or shave equivalent weight elsewhere.
2. **No frameworks.** Vanilla TS, Canvas 2D, hand-rolled state. No React, no SVG library, no Three.js.
3. **Geometry primitives are the API.** Point, Segment, Line, Circle, Intersection — these are the contract. New tools compose existing primitives; they don't reach into private state.
4. **Determinism.** A construction is fully described by its JSON. Loading the JSON twice produces identical pixels. No floating-point drift across reloads.
5. **Touch is a first-class input.** Two-finger pinch-zoom and pan must keep working on mobile. Don't break this when adding pointer handling.
6. **Type-checked.** `npm run typecheck` must pass. CI enforces this.

## Security principles

1. **Imported JSON is untrusted.** A construction file from disk could come from anywhere. Validate schema, bound coordinate magnitudes, cap point/segment count, reject non-finite numbers. Never `eval` or `Function` a payload.
2. **CSP is the second line.** `vercel.json` enforces `script-src 'self'` with no `unsafe-eval`. Adding an external script origin is almost always the wrong move — copy the code instead.
3. **Dependency review before install.** Before `npm install X`, check weekly downloads, last publish date, and transitive depth. Prefer copying ~30 lines over adding a 50-package tree.
4. **No secrets in the repo.** This app is client-side by design.

## CI

`.github/workflows/ci.yml` runs typecheck + build on every push and PR. Audit job runs `npm audit --audit-level=high` informationally.

## Deploys

Vercel auto-deploys from `main`. Preview deploys on every PR. `main` is production.
