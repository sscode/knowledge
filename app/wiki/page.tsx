import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WIKI_DIR } from "@/lib/wiki";

type WikiFile = {
  label: string;
  path: string;
};

const VIEWABLE_DIRS = ["pages", "schema"];

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectMarkdownFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
      return [];
    })
  );

  return files.flat();
}

async function getWikiFiles(): Promise<WikiFile[]> {
  const rootFiles = ["index.md", "log.md"].map((file) =>
    path.join(WIKI_DIR, file)
  );
  const nestedFiles = (
    await Promise.all(
      VIEWABLE_DIRS.map((dir) => collectMarkdownFiles(path.join(WIKI_DIR, dir)))
    )
  ).flat();

  return [...rootFiles, ...nestedFiles]
    .map((file) => path.relative(WIKI_DIR, file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      label: file,
      path: file,
    }));
}

function renderWikilinks(markdown: string, files: WikiFile[]): string {
  const pagePaths = new Set(files.map((file) => file.path));

  return markdown.replace(/\[\[([a-z0-9-]+)\]\]/g, (match, pageName) => {
    const pagePath = `pages/${pageName}.md`;
    if (!pagePaths.has(pagePath)) return match;
    return `[${pageName}](/wiki?file=${encodeURIComponent(pagePath)})`;
  });
}

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string }>;
}) {
  const files = await getWikiFiles();
  const params = await searchParams;
  const selectedPath = files.some((file) => file.path === params.file)
    ? params.file
    : files[0]?.path;
  const selectedFile = files.find((file) => file.path === selectedPath);
  const markdown = selectedFile
    ? await fs.readFile(path.join(WIKI_DIR, selectedFile.path), "utf8")
    : "";
  const renderedMarkdown = renderWikilinks(markdown, files);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="border border-neutral-800 rounded bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h1 className="text-lg font-bold">Wiki</h1>
        </div>
        <nav className="p-2">
          {files.map((file) => (
            <Link
              key={file.path}
              href={`/wiki?file=${encodeURIComponent(file.path)}`}
              className={`block rounded px-3 py-2 text-sm ${
                file.path === selectedPath
                  ? "bg-white text-black"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              {file.label}
            </Link>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 border border-neutral-800 rounded bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3 text-sm text-neutral-400">
          {selectedFile?.path || "No wiki files found"}
        </div>
        <div className="prose prose-invert prose-sm max-w-none p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {renderedMarkdown}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
