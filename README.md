# Knowledge

A local/team knowledge-base app built with Next.js. It stores raw source material in `wiki/sources/`, asks Claude Agent SDK workers to maintain generated wiki pages in `wiki/pages/`, and lets users query the wiki from the browser.

## What It Does

- Query the wiki from `/`
- Ingest pasted text or uploaded `.txt`, `.md`, `.csv`, `.json`, and `.docx` files from `/ingest`
- Ingest AgentMail messages through `/api/webhook`
- Run a wiki lint/repair agent from the top navigation

The wiki conventions live in `wiki/schema/AGENTS.md`.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000.

Required environment variables:

- `ANTHROPIC_API_KEY`: used by the Claude Agent SDK
- `AGENTMAIL_API_KEY`: used for email ingestion
- `KB_ADMIN_TOKEN`: required in production to protect query, ingest, and lint endpoints
- `AGENTMAIL_WEBHOOK_SECRET`: required in production to protect the webhook endpoint

In development, missing `KB_ADMIN_TOKEN` and `AGENTMAIL_WEBHOOK_SECRET` are allowed so local work stays simple. In production, the app returns an error if either secret is missing.

## Production Notes

Set `KB_ADMIN_TOKEN` to a strong random value. The browser UI prompts for it after a `401` response and stores it in `localStorage` for future requests.

Configure AgentMail to call:

```text
https://your-domain.example/api/webhook?secret=YOUR_AGENTMAIL_WEBHOOK_SECRET
```

You can also send the webhook secret in either `x-agentmail-webhook-secret` or `x-kb-webhook-secret`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
