# Evaluation and limitations

## What is tested

| Suite | Command | What it checks |
| --- | --- | --- |
| Backend, offline | `cd reklamaton && pytest` | 32 tests, plus 2 expected failures (below). |
| Showcase unit tests | `cd showcase && npm test` | 24 Vitest tests on the demo state. |
| Showcase browser tests | `cd showcase && npm run test:e2e` | 24 Playwright tests against the production build, under the production Content-Security-Policy. |
| Original frontend | `cd my-app && npm run lint && npm run build` | ESLint and the TypeScript build. |

**Backend tests** cover:
- customer de-duplication and the profile merge;
- segments, draft language, channel limits and the opt-in refusal;
- the 24-hour approval rule;
- the outbox life cycle, consent on approval and on export, and the CSV columns with the formula guard;
- request-size limits and the draft cap;
- chat ownership on REST and WebSocket;
- a full chat turn that replies, updates the profile and sends the earlier turn as history.

**Showcase unit tests** cover:
- the ported profile merge;
- that each scripted turn changes only Ines, and that evidence quotes are real substrings;
- that segments use profile fields and never include customers without consent;
- drafts: one per recipient, personalized, within the limit, deterministic;
- the approval rules across campaigns;
- CSV contents and escaping;
- that reset restores the starting state, that the reducer never mutates its input, and the prompt port;
- that the facts marked in a message are exact, non-overlapping quotes, and that the per-turn profile history replays to the stored profile;
- that each marked draft sentence is the one its profile field produced;
- that the audience funnel ends on the segment's recipients;
- that every frame of the landing-page replay equals the reducer's own output.

**Showcase browser tests** cover:
- the landing page: the disclosure and About this demo, the hero replay (and that it leaves your workspace untouched), the three acts on the real workspace through to approval and CSV export, and the 24-hour rule there;
- a chat turn updating the profile, with evidence;
- propagation to the CRM table and segments;
- the segment controls and `segment_json`;
- consent;
- drafts, the rate-limit refusal, the CSV download and its contents, and mark-as-sent;
- reset and persistence, deep links and the 404 page;
- the full guided tour, and skipping it or closing it with Escape;
- keyboard-only use, and reduced motion in the workspace and on the landing page (nothing plays by itself);
- no horizontal overflow at 390, 768, 1024, 1280×640, 1440 and 1920 px;
- mobile navigation.

Every browser test also fails on a console error or on any request to another host.

CI (`.github/workflows/ci.yml`) runs all of these, plus a gitleaks scan of the tree and an informational `pip-audit`. CI never needs an OpenAI key.

## What is not tested, and why

- **The live OpenAI calls.** No test or session spent money on inference. The chat, extraction and draft tests send their requests to fake clients. That checks the request shape the code builds (instructions, history, `store=False`, the JSON schema) and how it handles replies, errors and streaming events.

  It does **not** show that OpenAI accepts those requests today, or how good the replies are. The move of chat from the retired Assistants API to the Responses API has not been run against the live API.
- **Extraction quality.** There is no labelled set of conversations, so there is no accuracy figure for the profile extractor, and none is claimed. Building one would mean collecting realistic chats, annotating the expected patch, and scoring field by field: stage, budget, interests, objections.
- **Draft quality.** The same applies to drafts: no human ratings and no A/B results. The demo's drafts come from templates, so they say nothing about the model's writing.
- **Business outcomes.** Reklamaton has no users, customers, conversion data or time-saving measurements. The old landing page showed "12+ profiles per chat", "50+ drafts" and "80% time saved". Those were hard-coded placeholders and have been removed. The showcase only shows counts of its own synthetic data.

## Limitations

- **Local only.** The backend has no authentication (see [security.md](security.md)), so it should run on your machine, not on a public server.
- **No sending.** No SMS, WhatsApp, Telegram or email integration exists. Approved messages are exported as CSV or copied, and "mark as sent" is a record only.
- **Single process, local files.** The backend runs as a single process on SQLite, with local files for portraits and in-process threads for image generation. It is not designed for serverless platforms such as Vercel Functions: a local database file and background threads do not survive there.
- **Original frontend sign-in.** Sign-in is Google, handled in the browser only. The backend never verifies the token.
- **Showcase text.** The showcase's chat and drafts are scripted and template-based by design. The rules around them (merge, segments, consent, approval limits, export) are ported from the backend.
- **History.** Each chat turn sends at most the last 20 messages, so very long chats lose early context unless it was captured in the profile. That trade-off is intentional: the profile is the long-term memory.
