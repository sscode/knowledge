import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { WIKI_DIR } from "./wiki";

export type ManagedPage = {
  path: string;
  title: string;
  summary: string;
  sources: string[];
};

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
      return [];
    })
  );

  return files.flat();
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolvePagePath(pagePath: string): string {
  const fullPath = path.resolve(WIKI_DIR, pagePath);
  const pagesDir = path.resolve(WIKI_DIR, "pages");

  if (
    !pagePath.startsWith("pages/") ||
    !pagePath.endsWith(".md") ||
    !isInside(pagesDir, fullPath)
  ) {
    throw new Error("Invalid page path");
  }

  return fullPath;
}

export function resolveSourcePath(sourcePath: string): string {
  const normalizedPath = sourcePath.replace(/^wiki\//, "");
  const fullPath = path.resolve(WIKI_DIR, normalizedPath);
  const sourcesDir = path.resolve(WIKI_DIR, "sources");

  if (!normalizedPath.startsWith("sources/") || !isInside(sourcesDir, fullPath)) {
    throw new Error("Invalid source path");
  }

  return fullPath;
}

function getTitle(content: string, fallback: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function getSummary(content: string): string {
  const lines = content.split("\n").map((line) => line.trim());
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  return (
    lines.slice(titleIndex + 1).find((line) => line && !line.startsWith("#")) ||
    "No summary available."
  );
}

function getSources(content: string): string[] {
  const sources = new Set<string>();
  for (const match of content.matchAll(/`?(wiki\/sources\/[^`\s)]+|sources\/[^`\s)]+)`?/g)) {
    sources.add(match[1].replace(/^wiki\//, ""));
  }
  return [...sources].sort((a, b) => a.localeCompare(b));
}

export async function listManagedPages(): Promise<ManagedPage[]> {
  const pageFiles = await listMarkdownFiles(path.join(WIKI_DIR, "pages"));
  const pages = await Promise.all(
    pageFiles.map(async (pageFile) => {
      const content = await fs.readFile(pageFile, "utf8");
      const relativePath = path.relative(WIKI_DIR, pageFile);
      return {
        path: relativePath,
        title: getTitle(content, path.basename(pageFile, ".md")),
        summary: getSummary(content),
        sources: getSources(content),
      };
    })
  );

  return pages.sort((a, b) => a.title.localeCompare(b.title));
}

export async function readPage(pagePath: string) {
  const fullPath = resolvePagePath(pagePath);
  const content = await fs.readFile(fullPath, "utf8");
  const page = {
    path: path.relative(WIKI_DIR, fullPath),
    title: getTitle(content, path.basename(fullPath, ".md")),
    summary: getSummary(content),
    sources: getSources(content),
  };

  return { page, content };
}

export async function writePage(pagePath: string, content: string) {
  const fullPath = resolvePagePath(pagePath);
  await fs.writeFile(fullPath, content.trimEnd() + "\n");
}

export async function deletePage(pagePath: string) {
  const fullPath = resolvePagePath(pagePath);
  await fs.unlink(fullPath);
}

export async function readSource(sourcePath: string) {
  const fullPath = resolveSourcePath(sourcePath);
  const ext = path.extname(fullPath).slice(1).toLowerCase();

  if (ext === "docx") {
    const buffer = await fs.readFile(fullPath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (ext === "pdf") {
    const buffer = new Uint8Array(await fs.readFile(fullPath));
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  }

  if (["txt", "md", "csv", "json"].includes(ext)) {
    return fs.readFile(fullPath, "utf8");
  }

  throw new Error("Unsupported source type");
}
