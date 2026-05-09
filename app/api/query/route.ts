import { streamQueryAgent } from "@/lib/agents";
import { requireAdmin } from "@/lib/auth";
import { agentStreamToSSE } from "@/lib/sse";

export async function POST(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const { question } = await req.json();
  if (!question?.trim()) {
    return Response.json({ error: "Question required" }, { status: 400 });
  }

  return agentStreamToSSE(streamQueryAgent(question));
}
