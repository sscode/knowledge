import { AgentMailClient } from "agentmail";

let client: AgentMailClient | null = null;

export function getAgentMailClient(): AgentMailClient {
  if (!client) {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) throw new Error("AGENTMAIL_API_KEY not set");
    client = new AgentMailClient({ apiKey });
  }
  return client;
}

export async function setupInbox(): Promise<{
  inboxId: string;
  email: string;
}> {
  const mail = getAgentMailClient();
  const { inboxes } = await mail.inboxes.list();
  const existing = inboxes?.find((i) =>
    i.displayName === "Knowledge Base"
  );
  if (existing) {
    return { inboxId: existing.inboxId, email: existing.email };
  }
  const inbox = await mail.inboxes.create({
    displayName: "Knowledge Base",
  });
  return { inboxId: inbox.inboxId, email: inbox.email };
}
