import path from "path";
import fs from "fs";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { WIKI_DIR } from "@/lib/wiki";
import { streamIngestAgent } from "@/lib/agents";
import { requireAdmin } from "@/lib/auth";
import { agentStreamToSSE } from "@/lib/sse";

export const runtime = "nodejs";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("PDF has no extractable text");
  }

  return `# ${file.name}\n\n_PDF text extracted from ${totalPages} page${
    totalPages === 1 ? "" : "s"
  }._\n\n${trimmedText}`;
}

export async function POST(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const formData = await req.formData();
    const text = formData.get("text") as string | null;
    const title = formData.get("title") as string | null;
    const file = formData.get("file") as File | null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let sourcePath: string;
    let description: string;

    if (file) {
      const safeName = slugify(file.name.replace(/\.[^.]+$/, ""));
      const ext = file.name.split(".").pop()?.toLowerCase() || "txt";

      let content: string;
      if (ext === "docx") {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else if (ext === "pdf") {
        content = await extractPdfText(file);
      } else if (["txt", "md", "csv", "json"].includes(ext)) {
        content = await file.text();
      } else {
        return Response.json(
          { error: "Unsupported file type" },
          { status: 400 }
        );
      }

      // Save extracted text as .md so the ingest agent can read it
      const saveExt = ["docx", "pdf"].includes(ext) ? "md" : ext;
      sourcePath = path.join(
        WIKI_DIR,
        "sources",
        `${timestamp}-${safeName}.${saveExt}`
      );
      fs.writeFileSync(sourcePath, content);
      description = `Uploaded file: ${file.name}`;
    } else if (text) {
      sourcePath = path.join(
        WIKI_DIR,
        "sources",
        `${timestamp}-${slugify(title || "untitled")}.md`
      );
      fs.writeFileSync(sourcePath, `# ${title || "Untitled"}\n\n${text}`);
      description = title || "Text paste";
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
