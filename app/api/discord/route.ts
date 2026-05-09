import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { after, NextResponse } from "next/server";
import { runIngestAgent, runLintAgent, runQueryAgent } from "@/lib/agents";
import {
  deletePage,
  listManagedPages,
  readPage,
  readSource,
  writePage,
} from "@/lib/wiki-admin";
import { formatSelfHealResult, runWikiSelfHeal } from "@/lib/wiki-self-heal";
import { saveTextSource, saveUploadedSource } from "@/lib/source-ingest";
import { KbIntent, routeKbIntent } from "@/lib/intent-router";

export const runtime = "nodejs";

type DiscordOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordOption[];
};

type DiscordAttachment = {
  id: string;
  filename: string;
  url: string;
};

type DiscordInteraction = {
  id: string;
  application_id: string;
  token: string;
  type: number;
  guild_id?: string;
  user?: { id: string };
  member?: { user?: { id: string } };
  data?: {
    name?: string;
    options?: DiscordOption[];
    resolved?: {
      attachments?: Record<string, DiscordAttachment>;
    };
  };
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function parseAllowList(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function getUserId(interaction: DiscordInteraction): string | undefined {
  return interaction.member?.user?.id || interaction.user?.id;
}

function isAllowed(interaction: DiscordInteraction): boolean {
  const allowedGuilds = parseAllowList(process.env.DISCORD_ALLOWED_GUILD_IDS);
  const allowedUsers = parseAllowList(process.env.DISCORD_ALLOWED_USER_IDS);
  const userId = getUserId(interaction);

  if (allowedGuilds.size > 0 && !allowedGuilds.has(interaction.guild_id || "")) {
    return false;
  }

  if (allowedUsers.size > 0 && !allowedUsers.has(userId || "")) {
    return false;
  }

  return true;
}

function getSubcommand(interaction: DiscordInteraction) {
  return interaction.data?.options?.[0];
}

function getOption(options: DiscordOption[] | undefined, name: string) {
  return options?.find((option) => option.name === name);
}

function getString(options: DiscordOption[] | undefined, name: string) {
  const value = getOption(options, name)?.value;
  return typeof value === "string" ? value : undefined;
}

function getAttachment(
  interaction: DiscordInteraction,
  options: DiscordOption[] | undefined,
  name: string
) {
  const attachmentId = getString(options, name);
  if (!attachmentId) return null;
  return interaction.data?.resolved?.attachments?.[attachmentId] || null;
}

function truncate(content: string, maxLength = 1850): string {
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength - 40).trimEnd()}\n\n...truncated`;
}

async function sendFollowup(
  interaction: DiscordInteraction,
  content: string,
  ephemeral = true
) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: truncate(content),
        flags: ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Discord follow-up failed: ${res.status}`);
  }
}

async function saveDiscordAttachment(attachment: DiscordAttachment) {
  const res = await fetch(attachment.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch attachment: ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  return saveUploadedSource({
    name: attachment.filename,
    arrayBuffer: async () => buffer,
  });
}

async function runIntent(intent: KbIntent): Promise<string> {
  if (intent.action === "ask") {
    return runQueryAgent(intent.question);
  }

  if (intent.action === "ingest_text") {
    const { sourcePath, description } = saveTextSource(
      intent.title || null,
      intent.text
    );
    return runIngestAgent(sourcePath, description);
  }

  if (intent.action === "list_pages") {
    return formatPageList(await listManagedPages());
  }

  if (intent.action === "read_page") {
    const { content } = await readPage(intent.file);
    return `\`${intent.file}\`\n\n${content}`;
  }

  if (intent.action === "read_source") {
    return `\`${intent.file}\`\n\n${await readSource(intent.file)}`;
  }

  if (intent.action === "save_page") {
    await writePage(intent.file, intent.content);
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (intent.action === "delete_page") {
    await deletePage(intent.file);
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (intent.action === "self_heal") {
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (intent.action === "deep_repair") {
    return runLintAgent();
  }

  return intent.message;
}

function formatPageList(
  pages: Awaited<ReturnType<typeof listManagedPages>>
): string {
  if (pages.length === 0) return "No wiki pages found.";
  return pages
    .map((page) => `- ${page.title} \`${page.path}\``)
    .join("\n");
}

async function runCommand(interaction: DiscordInteraction): Promise<string> {
  const commandName = interaction.data?.name;
  const subcommand = getSubcommand(interaction);
  const name = subcommand?.name;
  const options = subcommand?.options;

  if (commandName === "kb") {
    const request = getString(interaction.data?.options, "request");
    if (!request && name !== "do") return "Request required.";
    const intent = await routeKbIntent(
      request || getString(options, "request") || ""
    );
    return runIntent(intent);
  }

  if (commandName !== "kb-admin" || !name) {
    return "Unknown command. Use `/kb` or `/kb-admin`.";
  }

  if (name === "do") {
    const request = getString(options, "request");
    if (!request) return "Request required.";
    const intent = await routeKbIntent(request);
    return runIntent(intent);
  }

  if (name === "ask") {
    const question = getString(options, "question");
    if (!question) return "Question required.";
    return runQueryAgent(question);
  }

  if (name === "ingest") {
    const text = getString(options, "text");
    const title = getString(options, "title") || null;
    if (!text) return "Text required.";
    const { sourcePath, description } = saveTextSource(title, text);
    return runIngestAgent(sourcePath, description);
  }

  if (name === "ingest-file") {
    const attachment = getAttachment(interaction, options, "file");
    if (!attachment) return "File attachment required.";
    const { sourcePath, description } = await saveDiscordAttachment(attachment);
    return runIngestAgent(sourcePath, description);
  }

  if (name === "pages") {
    return formatPageList(await listManagedPages());
  }

  if (name === "page") {
    const file = getString(options, "file");
    if (!file) return "File path required.";
    const { content } = await readPage(file);
    return `\`${file}\`\n\n${content}`;
  }

  if (name === "source") {
    const file = getString(options, "file");
    if (!file) return "Source path required.";
    return `\`${file}\`\n\n${await readSource(file)}`;
  }

  if (name === "save-page") {
    const file = getString(options, "file");
    const content = getString(options, "content");
    if (!file || !content) return "File path and content required.";
    await writePage(file, content);
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (name === "delete-page") {
    const file = getString(options, "file");
    if (!file) return "File path required.";
    await deletePage(file);
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (name === "self-heal") {
    return formatSelfHealResult(await runWikiSelfHeal());
  }

  if (name === "deep-repair") {
    return runLintAgent();
  }

  return `Unknown /kb-admin subcommand: ${name}`;
}

async function handleCommand(interaction: DiscordInteraction) {
  try {
    const result = await runCommand(interaction);
    await sendFollowup(interaction, result || "Done.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command failed";
    await sendFollowup(interaction, `Error: ${message}`);
  }
}

export async function POST(req: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return jsonResponse({ error: "DISCORD_PUBLIC_KEY is not configured" }, 500);
  }

  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";
  const rawBody = await req.text();
  const valid = await verifyKey(rawBody, signature, timestamp, publicKey);

  if (!valid) {
    return jsonResponse({ error: "Invalid Discord signature" }, 401);
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "Unsupported interaction type.",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  if (!isAllowed(interaction)) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "You are not allowed to use this knowledge base.",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  after(() => handleCommand(interaction));

  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });
}
