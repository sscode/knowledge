# Knowledge

A local/team knowledge-base app built with Next.js. It stores raw source material in `wiki/sources/`, asks Claude Agent SDK workers to maintain generated wiki pages in `wiki/pages/`, and lets users query the wiki from the browser.

## What It Does

- Query the wiki from `/`
- Ingest pasted text or uploaded `.txt`, `.md`, `.csv`, `.json`, `.docx`, and `.pdf` files from `/ingest`
- Ingest AgentMail messages through `/api/webhook`
- View generated wiki pages from `/wiki`
- Manage page Markdown and inspect original source text from `/manage`
- Use the same knowledge-base capabilities from Discord through `/api/discord`
- Automatically self-heal safe structural wiki issues after ingest
- Run a deeper AI wiki repair from the top navigation

The wiki conventions live in `wiki/schema/AGENTS.md`.

## Self-Healing

After every ingest, the app runs a deterministic self-heal pass. It safely repairs structural drift such as missing index entries, stale index entries, and missing required section headings. It logs unresolved issues such as broken wikilinks and orphan pages to `wiki/log.md` for human review.

The `Deep Repair` button still exists for ambiguous repairs that need the AI agent, such as contradictions or stale content.

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
- `DISCORD_PUBLIC_KEY`: required for Discord interaction verification
- `DISCORD_ALLOWED_GUILD_IDS`: optional comma-separated Discord guild allow-list
- `DISCORD_ALLOWED_USER_IDS`: optional comma-separated Discord user allow-list

In development, missing `KB_ADMIN_TOKEN` and `AGENTMAIL_WEBHOOK_SECRET` are allowed so local work stays simple. In production, the app returns an error if either secret is missing.

## Discord Bot

Set the Discord interaction endpoint URL to:

```text
https://your-domain.example/api/discord
```

The endpoint verifies Discord signatures using `DISCORD_PUBLIC_KEY`. Commands are handled as ephemeral responses.

Natural-language command:

- `/kb`

Exact admin commands:

- `/kb-admin ask`
- `/kb-admin ingest`
- `/kb-admin ingest-file`
- `/kb-admin pages`
- `/kb-admin page`
- `/kb-admin source`
- `/kb-admin save-page`
- `/kb-admin delete-page`
- `/kb-admin self-heal`
- `/kb-admin deep-repair`

To register the slash command, set `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN`, optionally set `DISCORD_GUILD_ID` for guild-scoped development commands, then run:

```bash
npm run discord:commands
```

`/kb` accepts natural language and uses an AI intent router to choose the matching knowledge-base action. True non-command channel chat, where the bot responds to ordinary messages or mentions, requires a Discord Gateway worker with message-content intent; the same intent router can be reused there.

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
