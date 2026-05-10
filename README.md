# Knowledge

A local/team knowledge-base app built with Next.js. It stores raw source material in `wiki/sources/`, asks Claude Agent SDK workers to maintain generated wiki pages in `wiki/pages/`, and lets users query the wiki from the browser.

## What It Does

- Query the wiki from `/`
- Ingest pasted text, public URLs, or uploaded `.txt`, `.md`, `.csv`, `.json`, `.docx`, and `.pdf` files from `/ingest`
- Ingest AgentMail messages through `/api/webhook`
- View generated wiki pages from `/wiki`
- Manage page Markdown and inspect original source text from `/manage`
- Use the same knowledge-base capabilities from Discord through `/api/discord`
- Automatically self-heal safe structural wiki issues after ingest
- Run a deeper AI wiki repair from the top navigation

The wiki conventions live in `wiki/schema/AGENTS.md`.

## Self-Healing

After every ingest, page edit, and page delete, the app runs a deterministic self-heal pass. This pass is deliberately conservative: it only fixes structural issues that can be repaired without interpretation.

Self-heal automatically:

- Adds missing `index.md` entries for pages in `wiki/pages/`
- Removes stale `index.md` entries for pages that no longer exist
- Adds missing required page sections: `Summary`, `Details`, `Related`, and `Sources`
- Appends a `self-heal` entry to `wiki/log.md` when it fixes something or finds review items

Self-heal reports, but does not automatically fix:

- Broken wikilinks, such as `[[missing-page]]`
- Orphan pages with no incoming wikilinks

Those review items are listed in the ingest result and in `wiki/log.md` so a human can inspect them.

## Deep Repair

Deep Repair is the AI-assisted wiki audit and repair path. It is available from the top navigation, through `/api/lint`, and from Discord with `/kb-admin deep-repair`.

Use Deep Repair when the issue needs judgment rather than a mechanical fix, for example:

- Contradictions between pages
- Stale content or old dates that may need updating
- Broken wikilinks that need the right target page chosen or created
- Orphan pages that may need cross-links, merging, or deletion
- Index entries, summaries, or required sections that need a better human-readable rewrite

Deep Repair reads `wiki/schema/AGENTS.md`, `index.md`, and the pages in `wiki/pages/`, then edits wiki files directly. It appends a `lint` report to `wiki/log.md` with what it found, what it fixed, and anything still needing human review.

Because Deep Repair uses the Claude Agent SDK, it requires `ANTHROPIC_API_KEY`, can take longer than self-heal, and has a higher budget limit. Use self-heal for routine structural cleanup; use Deep Repair when the wiki content itself needs an editorial pass.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000.

Required environment variables:

- `ANTHROPIC_API_KEY`: used by the Claude Agent SDK
- `KB_WIKI_DIR`: optional absolute wiki storage path, useful for a Railway volume
- `AGENTMAIL_API_KEY`: used for email ingestion
- `KB_ADMIN_TOKEN`: required in production to protect wiki management and repair endpoints
- `AGENTMAIL_WEBHOOK_SECRET`: required in production to protect the webhook endpoint
- `DISCORD_PUBLIC_KEY`: required for Discord interaction verification
- `DISCORD_APP_ID`: required for registering Discord slash commands
- `DISCORD_BOT_TOKEN`: required for registering Discord slash commands
- `DISCORD_GUILD_ID`: optional Discord guild for faster development command registration
- `DISCORD_ALLOWED_GUILD_IDS`: optional comma-separated Discord guild allow-list
- `DISCORD_ALLOWED_USER_IDS`: optional comma-separated Discord user allow-list

In development, missing `KB_ADMIN_TOKEN` and `AGENTMAIL_WEBHOOK_SECRET` are allowed so local work stays simple. In production, management and repair endpoints return an error if `KB_ADMIN_TOKEN` is missing, and the AgentMail webhook returns an error if `AGENTMAIL_WEBHOOK_SECRET` is missing.

## Railway Deployment

1. Push the repository to GitHub.
2. Create a new Railway project.
3. Choose **Deploy from GitHub repo** and select this repository.
4. Let Railway create the app service from the repository. The checked-in `package.json` and `next.config.ts` are already configured for a standalone Next.js deployment.
5. Open the service's **Variables** tab and set the required production variables:

```text
ANTHROPIC_API_KEY=...
KB_ADMIN_TOKEN=...
AGENTMAIL_API_KEY=...
AGENTMAIL_WEBHOOK_SECRET=...
DISCORD_PUBLIC_KEY=...
```

6. Add the Discord command-registration variables if you will register commands from Railway or a production shell:

```text
DISCORD_APP_ID=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_ALLOWED_GUILD_IDS=...
DISCORD_ALLOWED_USER_IDS=...
```

7. Add a Railway volume to the app service.
8. Set the volume mount path to:

```text
/app/wiki-data
```

9. In the service variables, set:

```text
KB_WIKI_DIR=/app/wiki-data
```

10. Do not mount the volume at `/app/wiki`. That path contains the clean starter wiki bundled with the app, and mounting over it can hide those seed files.
11. Deploy or redeploy the service.
12. Open the deployment logs and confirm the service starts cleanly.
13. In the service **Networking** settings, generate a Railway domain.
14. Open the generated domain and test `/wiki` and `/ingest`.
15. Use the generated domain for integrations:

```text
Discord interactions endpoint:
https://your-domain.up.railway.app/api/discord

AgentMail webhook:
https://your-domain.up.railway.app/api/webhook?secret=YOUR_AGENTMAIL_WEBHOOK_SECRET
```

16. After the first deploy, confirm the volume has been seeded by ingesting a small test item and checking `/manage` or `/wiki`.

## Discord Bot

1. Create a Discord application in the Discord Developer Portal.
2. Open the application's **General Information** page and copy the public key.
3. Set `DISCORD_PUBLIC_KEY` in your local `.env` file and in production.
4. Open the application's **Bot** page, create a bot if it does not exist, and reset/copy the bot token.
5. Set `DISCORD_APP_ID` to the application ID and `DISCORD_BOT_TOKEN` to the bot token. These are only needed when registering slash commands.
6. If you want fast development updates in one server, set `DISCORD_GUILD_ID` to that Discord server ID. Leave it empty to register global commands.
7. In production, optionally set `DISCORD_ALLOWED_GUILD_IDS` and `DISCORD_ALLOWED_USER_IDS` to comma-separated allow-lists.
8. Deploy the app first so Discord can reach the interaction endpoint.
9. In the Discord application's **General Information** page, set the interactions endpoint URL to:

```text
https://your-domain.example/api/discord
```

10. Save the endpoint. Discord will verify it by sending a signed ping request.
11. Register the slash commands:

```bash
npm run discord:commands
```

12. Install the app into your Discord server from the Developer Portal's install or OAuth2 page. The app needs the `applications.commands` scope. If you also add the bot scope, no special gateway intents are required for the slash-command flow.
13. In Discord, test the bot with:

```text
/kb request: what does this knowledge base know?
```

The endpoint verifies Discord signatures using `DISCORD_PUBLIC_KEY`. Commands are handled as ephemeral responses. Guild-scoped command updates are usually visible quickly; global command updates can take longer to appear.

Natural-language command:

- `/kb`

Exact admin commands:

- `/kb-admin ask`
- `/kb-admin do`
- `/kb-admin ingest`
- `/kb-admin ingest-file`
- `/kb-admin pages`
- `/kb-admin page`
- `/kb-admin source`
- `/kb-admin save-page`
- `/kb-admin delete-page`
- `/kb-admin self-heal`
- `/kb-admin deep-repair`

`/kb` accepts natural language and uses an AI intent router to choose the matching knowledge-base action. True non-command channel chat, where the bot responds to ordinary messages or mentions, requires a Discord Gateway worker with message-content intent; the same intent router can be reused there.

## AgentMail Ingestion

1. Create or open an AgentMail account.
2. Create an AgentMail API key.
3. Set `AGENTMAIL_API_KEY` in your local `.env` file and in production.
4. Choose a strong random webhook secret and set it as `AGENTMAIL_WEBHOOK_SECRET`.
5. Create or choose the AgentMail inbox that should feed this knowledge base.
6. Configure the inbox webhook for the `message.received` event.
7. Set the webhook URL to:

```text
https://your-domain.example/api/webhook?secret=YOUR_AGENTMAIL_WEBHOOK_SECRET
```

8. If AgentMail lets you configure headers instead of query parameters, use either header:

```text
x-agentmail-webhook-secret: YOUR_AGENTMAIL_WEBHOOK_SECRET
x-kb-webhook-secret: YOUR_AGENTMAIL_WEBHOOK_SECRET
```

9. Send a test email to the AgentMail inbox.
10. Confirm the app created a new source file under `wiki/sources/` or your `KB_WIKI_DIR/sources/` volume path.
11. Check `/wiki`, `/manage`, or the deployment logs to confirm the ingest agent updated the wiki.

## Production Notes

Set `KB_ADMIN_TOKEN` to a strong random value. Public query and ingest do not require it. Management and repair screens prompt for it after a `401` response and store it in `localStorage` for future requests.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
