# Jugaad tools

Six browser tools: inspect a CSV, keep track of commitments, compare drafts against source notes, split a bill, clean text, and plan a meeting across time zones.

Built by Saran Vashisht. A clean source snapshot of newly developed modules; no private repository history is included.

## Run locally

Use Node.js 24.

```sh
npm ci
npx playwright install chromium
npm run dev
```

## Verify

```sh
npm run qa
```

This runs strict Astro/TypeScript checks, behavioral unit tests, a static production build, and desktop/mobile browser tests. The build generates hashes for its exact inline scripts; browser tests enforce that built content security policy. Host `dist` on a static host, applying `dist/_headers` on hosts that support it.

Read [the evidence-review decisions and limits](docs/EVIDENCE_REVIEW.md) before treating a comparison as a factual judgment. You make the judgments; the tool keeps the reason attached to the text you reviewed.

## Privacy

Inputs and progress remain in browser memory and clear on refresh. No server, tracking, accounts, API keys or paid AI service. Clipboard access occurs only when a visitor chooses Copy. External links have their own privacy policies.

## Demo

[Open the working hosted tools](https://jugaad.best)

This repository contains the same interactive modules in a minimal standalone shell. The linked deployment provides the full visitor experience.
