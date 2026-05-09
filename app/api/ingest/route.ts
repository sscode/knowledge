import { streamIngestAgent } from "@/lib/agents";
import { requireAdmin } from "@/lib/auth";
import { agentStreamToSSE } from "@/lib/sse";
import { saveTextSource, saveUploadedSource } from "@/lib/source-ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const formData = await req.formData();
    const text = formData.get("text") as string | null;
    const title = formData.get("title") as string | null;
    const file = formData.get("file") as File | null;

    let sourcePath: string;
    let description: string;

    if (file) {
      const savedSource = await saveUploadedSource(file);
      sourcePath = savedSource.sourcePath;
      description = savedSource.description;
    } else if (text) {
      const savedSource = saveTextSource(title, text);
      sourcePath = savedSource.sourcePath;
      description = savedSource.description;
    } else {
      return Response.json({ error: "No content provided" }, { status: 400 });
    }

    return agentStreamToSSE(streamIngestAgent(sourcePath, description));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingest failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
