# Reklamaton showcase

A static, interactive demo of Reklamaton's workflow:

1. a scripted conversation;
2. the customer profile it updates;
3. a campaign segment;
4. personalized drafts;
5. human approval;
6. CSV export.

It runs entirely in the browser, with a fictional studio and synthetic customers. It has no backend, no API keys and no model calls, and it sends nothing.

How each part relates to the real backend in `../reklamaton` is explained in [`../docs/demo.md`](../docs/demo.md).

## Run it

You need Node 20 or newer.

```bash
npm ci
npm run dev          # http://localhost:5180
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ on http://localhost:4180
```

## Test it

```bash
npm run lint
npm test             # Vitest: demo state, profile merge, segments, drafts, approval rules, CSV
npx playwright install chromium
npm run test:e2e     # Playwright against the production build
```

The browser tests fail on:
- any console error;
- any request that leaves the local server, which also means no backend and no OpenAI;
- horizontal overflow at 390, 768, 1024, 1280, 1440 and 1920 px;
- visible text smaller than 12 px.

## Layout

| Path | What it holds |
| --- | --- |
| `src/demo/` | Demo state and rules. `data.ts` is the synthetic workspace. `engine.ts` ports the backend's merge, segment and approval rules. `compose.ts` is the draft composer. `prompt.ts` ports `prompter.py`. `csv.ts` builds the export. `state.ts` is the reducer. `facts.ts` traces each fact from message to profile to draft. |
| `src/app/` | The workspace screens: Overview, Conversations, Customers, Campaigns and Business. |
| `src/landing/` | The landing page: the hero replay (`reel.ts`, `HeroReel.tsx`) and the three acts (`Acts.tsx`). |
| `src/tour/` | The guided tour. |
| `e2e/` | Playwright tests. |
| `scripts/record-demo.mjs` | The screen recording used for the README video. |

It deploys as a static site. `vercel.json` sets the SPA rewrite and the security headers, and its Content-Security-Policy allows connections to the site's own origin only.
