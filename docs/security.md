# Security review

**Scope:** the FastAPI backend in `reklamaton/`, the original frontend in `my-app/`, and the public showcase in `showcase/`.

**Reviewed:** 2026-10-31.

**Bottom line:** the backend is a local, single-operator tool. It has **no authentication**, so it must not be exposed to the internet, especially with a real OpenAI key. The public demo is a separate static site that has no backend at all.

## Findings

Status key:
- **Fixed:** changed in code and covered by a test.
- **Mitigated:** reduced, not solved.
- **Open:** documented, not fixed.

| # | Area | Finding | Status |
| --- | --- | --- | --- |
| 1 | Authentication | The API identifies the caller by a `user_id` query parameter. `POST /users/` returns any existing account for a given username. Nothing proves who is calling. | **Open.** Two strict `xfail` tests record it: `test_knowing_a_username_does_not_give_access_to_the_account` and `test_a_forged_user_id_cannot_read_another_tenants_customers`. |
| 2 | Tenant isolation | Business, customer, campaign and outbox routes compare `business.owner_user_id` with the supplied `user_id`. Chat, message and WebSocket routes had **no** check at all. | **Fixed** for chats: `_assert_chat_owner` on `GET /chats/{id}/messages/`, `POST /api/assistant/{id}/` and `/ws/assistant/{id}` (closed with 4403). Tested. The checks still rely on the unauthenticated `user_id` (finding 1). |
| 3 | Consent | Drafts were already limited to opted-in customers. Approval and export did not re-check consent. | **Fixed.** Approval returns 409 for a customer without consent, and the CSV skips customers who withdrew it. Tested. |
| 4 | Outbox state | A draft could be marked as sent without approval, and a sent message could be approved again. | **Fixed:** both return 409. Tested. |
| 5 | Spreadsheet export | Message text (model output) went into the CSV unchanged, so a cell starting with `=`, `+`, `-` or `@` would run as a formula. | **Fixed.** `store.csv_safe_cell` prefixes such cells with `'`, and the showcase does the same. Tested. |
| 6 | Request size | Free-text fields had no limits, and all of them end up in prompts or the database. | **Fixed** with Pydantic limits: chat message 4,000 characters, brand voice 2,000, products JSON 20,000, segment JSON 2,000, plus names and contact fields. Tested for chat. |
| 7 | Model-call cost | Chat history was unbounded. One "generate drafts" request could call the model once per customer without limit. Portrait generation (a paid image call) could be triggered repeatedly. | **Mitigated:** history is capped at 20 messages (`CHAT_HISTORY_LIMIT`), drafts at 50 per request (`MAX_DRAFTS_PER_REQUEST`, 413), and pending portraits at 3 per user (429). There is **no** per-client request rate limiting; put the API behind a proxy that rate-limits if you share it. |
| 8 | Error disclosure | Model errors were returned to the browser verbatim, for example OpenAI's "Incorrect API key provided: sk-…" message. | **Fixed.** They are logged on the server. The client gets "LLM unavailable: the model call failed" (or "OPENAI_API_KEY is not set"). Tested. |
| 9 | Sensitive logging | `create_engine(echo=True)` logged every SQL statement with its parameters: names, emails, chat text. | **Fixed:** echo is off unless `SQL_ECHO=1`. |
| 10 | Prompt injection | Customer messages and the extracted notes flow into later system prompts. The persona prompt tells the model to ignore role changes. | **Mitigated:** the sales prompt now marks the customer data as information, not instructions. Profile fields come through a strict schema with fixed value sets for tone and stage. Free-text notes are still model-written text and can carry instructions; a person reviews every outbound message. |
| 11 | CORS | Configurable through `CORS_ORIGINS`, with credentials allowed. | **Fixed:** credentials are disabled if `*` is configured. The default is `localhost:5174` only. |
| 12 | Secrets in images | The Dockerfile copied `reklamaton/`, including a local `.env`, into the image. | **Fixed:** `.dockerignore` excludes `.env*`, databases and virtualenvs. |
| 13 | Dependencies | FastAPI 0.110 pinned Starlette 0.36.3. pip-audit flagged 9 advisories in it, and one in python-dotenv 1.0.1. | **Fixed:** FastAPI 0.162 / Starlette 1.10, python-dotenv 1.2.4. `pip-audit -r requirements.txt` finds no known vulnerabilities as of 2026-10-31. `my-app` and `showcase` have 0 production npm advisories. The remaining dev-only advisories (moderate: `minimatch` via ESLint; one high in `my-app`'s dev tooling) do not ship to browsers. |
| 14 | Storage | SQLite in the working directory, portraits on local disk, background threads for image generation. | **By design** for local use. This does not fit serverless hosting. |
| 15 | Frontend sign-in | `my-app` uses Google Identity Services only in the browser. The backend never verifies the Google token. | **Open** (part of finding 1). |

## What a public deployment would need

These are listed in rough order. None of them is done.

1. **Real authentication.** Sessions or JWTs verified on every route and on the WebSocket handshake, with the user id taken from the verified identity, never from the query.
2. **Per-user and per-IP rate limits and a spending cap** on the model calls.
3. **A managed database** instead of a local SQLite file, plus migrations (Alembic) instead of the startup `ALTER TABLE`.
4. **Object storage** for portraits, and a job queue instead of in-process threads.
5. **Abuse handling** for user-created personas, and output moderation.
6. **An audit of the `CustomerEvent` log** and a retention policy for chat transcripts.

## The public showcase

`showcase/` is static: HTML, JS and CSS with synthetic data.
- It needs no environment variables and holds no secrets.
- **Content-Security-Policy** (in `vercel.json`, also applied by `vite preview` in the tests):
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
  frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'
  ```
  `style-src 'unsafe-inline'` is there for the animation library's inline styles. No inline scripts are allowed.
- The Playwright suite fails if the page requests any host other than its own.

## Repository history

Earlier commits tracked a Python virtualenv, a Vite cache and generated portrait images; the current tree no longer does. Older commits still contain them, and cleaning the history is handled separately from this code.

gitleaks found no API keys or other credentials in any commit.
