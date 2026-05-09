import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { WIKI_DIR } from "./wiki";

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);

type SourceFile = {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text?: () => Promise<string>;
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function extractPdfText(file: SourceFile): Promise<string> {
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

async function extractFileContent(file: SourceFile, ext: string): Promise<string> {
  if (ext === "docx") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "pdf") {
    return extractPdfText(file);
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    if (file.text) return file.text();
    return new TextDecoder().decode(await file.arrayBuffer());
  }

  throw new Error("Unsupported file type");
}

export async function saveUploadedSource(file: SourceFile): Promise<{
  sourcePath: string;
  description: string;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = slugify(file.name.replace(/\.[^.]+$/, ""));
  const ext = file.name.split(".").pop()?.toLowerCase() || "txt";
  const content = await extractFileContent(file, ext);
  const saveExt = ["docx", "pdf"].includes(ext) ? "md" : ext;
  const sourcePath = path.join(
    WIKI_DIR,
    "sources",
    `${timestamp}-${safeName}.${saveExt}`
  );

  fs.writeFileSync(sourcePath, content);
  return { sourcePath, description: `Uploaded file: ${file.name}` };
}

export function saveTextSource(
  title: string | null,
  text: string
): {
  sourcePath: string;
  description: string;
} {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sourcePath = path.join(
    WIKI_DIR,
    "sources",
    `${timestamp}-${slugify(title || "untitled")}.md`
  );

  fs.writeFileSync(sourcePath, `# ${title || "Untitled"}\n\n${text}`);
  return { sourcePath, description: title || "Text paste" };
}
