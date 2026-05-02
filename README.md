# Reklamaton

**Reklamaton** is a full-stack sales automation MVP: AI avatars for customer chat, lightweight CRM (customers and profiles), campaigns with LLM-generated outbound drafts, human approval before send, and CSV export for your messaging tools.

## What it does

- **Business profile** — Brand voice, products, and timezone in one place.
- **Customers** — Store contacts, preferences, and an evolving **customer profile** (language, budget, stage, notes) updated from conversations.
- **Campaigns** — Define an offer and segment; the backend drafts personalized outbound messages per customer.
- **Outbox** — Review, approve, mark sent, or export drafts as CSV (no live SMS/email integration in this repo).
- **Chat** — Talk to customers through persona avatars backed by OpenAI; optional avatar image generation when `OPENAI_API_KEY` is set.

## Stack

| Part | Tech |
|------|------|
| **API** | Python 3, FastAPI, SQLModel, SQLite |
| **Web app** | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI |

Monorepo layout: `reklamaton/` (backend), `my-app/` (frontend).

## Prerequisites

- **Node.js** 20+ and npm  
- **Python** 3.11+ with pip  
- **OpenAI API key** — Required for LLM chat and profile extraction; image generation for avatars is optional and uses the same key when enabled.

## Local development

### Backend (`reklamaton/`)

```bash
cd reklamaton
cp .env.example .env   # add OPENAI_API_KEY and adjust if needed
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

SQLite database file is created on first run (`database.db`).

### Frontend (`my-app/`)

```bash
cd my-app
cp .env.example .env   # optional: set VITE_API_BASE if API is not localhost:8000
npm install
npm run dev
```

The dev server uses port **5174** by default (`strictPort: true` in Vite). The API allows CORS from that origin; for other origins, set `CORS_ORIGINS` in the backend `.env` (comma-separated URLs).

## Environment variables

**Backend** (`reklamaton/.env` — see `reklamaton/.env.example`):

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | LLM, assistants, profile extraction, optional avatar images |
| `CORS_ORIGINS` | Optional. Comma-separated allowed browser origins (defaults include `http://localhost:5174` and `http://127.0.0.1:5174`) |

**Frontend** (`my-app/.env`):

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | Optional. API base URL (default `http://127.0.0.1:8000`) |

## Docker

A single image installs backend and frontend dependencies and runs **uvicorn** and **Vite dev** together (handy for local demos, not a hardened production image):

```bash
docker build -t reklamaton .
docker run -p 8000:8000 -p 5174:5174 reklamaton
```

For real deployments, build the static frontend (`npm run build`), serve it from a CDN or reverse proxy, and run the API with a process manager and proper `CORS_ORIGINS`.

## License

See [LICENSE](LICENSE).
