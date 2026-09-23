# Jugaad tools

Six working, non-AI utilities: CSV diagnostics, a temporary commitment ledger, manual A/B evaluation, exact bill splitting, Unicode-aware text cleanup, and timezone meeting planning.

Built by Saran Vashisht. A clean source snapshot of newly developed modules; no private repository history is included.

## Run locally

Use Node.js 24.

```sh
npm ci
npm run dev
```

## Verify

```sh
npm run qa
```

This runs strict Astro/TypeScript checks, behavioral unit tests, and a static production build. Host the generated `dist` directory on any static host.

## Privacy

Inputs and progress remain in browser memory and clear on refresh. No server, tracking, accounts, API keys or paid AI service. Clipboard access occurs only when a visitor chooses Copy. External links have their own privacy policies.

## Demo

[Open the working hosted tools](https://jugaad-best-preview.pages.dev)

This repository contains the same interactive modules in a minimal standalone shell. The linked deployment provides the full visitor experience.
