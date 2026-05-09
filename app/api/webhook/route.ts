import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { WIKI_DIR } from "@/lib/wiki";
import { getAgentMailClient } from "@/lib/agentmail";
import { runIngestAgent } from "@/lib/agents";
import { requireWebhookSecret } from "@/lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  try {
    const authError = requireWebhookSecret(req);
    if (authError) return authError;

    const payload = await req.json();

    if (payload.event_type !== "message.received") {
      return NextResponse.json({ ok: true });
    }

    const { inbox_id, message_id } = payload.data;
    const mail = getAgentMailClient();
    const message = await mail.inboxes.messages.get(inbox_id, message_id);

    const subject = message.subject || "(no subject)";
    const body = message.extractedText || message.text || "";
    const from = message.from;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    const sourcePath = path.join(
      WIKI_DIR,
      "sources",
      `${timestamp}-email-${slugify(subject)}.md`
    );
    const sourceContent = `# Email: ${subject}\n\n**From**: ${from}\n**Date**: ${message.timestamp}\n\n${body}`;
    fs.writeFileSync(sourcePath, sourceContent);

    const result = await runIngestAgent(
      sourcePath,
      `Email from ${from}: ${subject}`
    );
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Webhook failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
