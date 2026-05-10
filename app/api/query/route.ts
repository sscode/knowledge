import { streamQueryAgent } from "@/lib/agents";
import { agentStreamToSSE } from "@/lib/sse";

export async function POST(req: Request) {
  const { question } = await req.json();
  if (!question?.trim()) {
    return Response.json({ error: "Question required" }, { status: 400 });
  }

  return agentStreamToSSE(streamQueryAgent(question));
}
