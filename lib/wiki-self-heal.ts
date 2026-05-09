import fs from "node:fs/promises";
import path from "node:path";
import { WIKI_DIR } from "./wiki";

const REQUIRED_SECTIONS = ["Summary", "Details", "Related", "Sources"];

type SelfHealResult = {
  fixed: string[];
  needsReview: string[];
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

function titleFromSlug(slug: string): string {
  return slug
    .replace(/\.md$/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1].trim() || titleFromSlug(filename);
}

function getSummary(content: string): string {
  const lines = content.split("\n").map((line) => line.trim());
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  const firstBodyLine = lines
    .slice(titleIndex + 1)
    .find((line) => line && !line.startsWith("#"));

  if (firstBodyLine) return firstBodyLine;

  const summaryIndex = lines.findIndex((line) => line === "## Summary");
  const summaryLine = lines
    .slice(summaryIndex + 1)
    .find((line) => line && !line.startsWith("#"));

  return summaryLine || "No summary available.";
}

function getWikilinks(content: string): string[] {
  return [...content.matchAll(/\[\[([a-z0-9-]+)\]\]/g)].map(
    (match) => match[1]
  );
}

async function ensureIndexEntries(
  pageFiles: string[],
  pageContents: Map<string, string>,
  fixed: string[]
) {
  const indexPath = path.join(WIKI_DIR, "index.md");
  let index = (await fileExists(indexPath))
    ? await fs.readFile(indexPath, "utf8")
    : "# Knowledge Base Index\n\n";

  const pageRelPaths = new Set(
    pageFiles.map((file) => path.relative(WIKI_DIR, file))
  );
  const originalIndex = index;

  index = index
    .split("\n")
    .filter((line) => {
      const match = line.match(/\]\((pages\/[^)]+\.md)\)/);
      return !match || pageRelPaths.has(match[1]);
    })
    .join("\n");

  for (const pageFile of pageFiles) {
    const relPath = path.relative(WIKI_DIR, pageFile);
    if (index.includes(`](${relPath})`)) continue;

    const filename = path.basename(pageFile);
    const content = pageContents.get(relPath) || "";
    const title = getTitle(content, filename);
    const summary = getSummary(content);
    index = `${index.trimEnd()}\n- [${title}](${relPath}) - ${summary}\n`;
    fixed.push(`Added missing index entry for ${relPath}`);
  }

  if (index !== originalIndex) {
    await fs.writeFile(indexPath, `${index.trimEnd()}\n`);
  }
}

async function ensureRequiredSections(
  pageContents: Map<string, string>,
  fixed: string[]
) {
  for (const [relPath, content] of pageContents) {
    let nextContent = content.trimEnd();
    for (const section of REQUIRED_SECTIONS) {
      if (new RegExp(`^##\\s+${section}$`, "m").test(nextContent)) continue;
      nextContent += `\n\n## ${section}\n\nNeeds human review.`;
      fixed.push(`Added missing ${section} section to ${relPath}`);
    }

    if (nextContent !== content.trimEnd()) {
      await fs.writeFile(path.join(WIKI_DIR, relPath), `${nextContent}\n`);
    }
  }
}

function collectReviewItems(
  pageContents: Map<string, string>,
  needsReview: string[]
) {
  const pageSlugs = new Set(
    [...pageContents.keys()].map((relPath) =>
      path.basename(relPath, ".md")
    )
  );
  const incomingLinks = new Map<string, number>();

  for (const pageSlug of pageSlugs) incomingLinks.set(pageSlug, 0);

  for (const [relPath, content] of pageContents) {
    const sourceSlug = path.basename(relPath, ".md");
    for (const targetSlug of getWikilinks(content)) {
      if (!pageSlugs.has(targetSlug)) {
        needsReview.push(`Broken wikilink in ${relPath}: [[${targetSlug}]]`);
        continue;
      }

      if (targetSlug !== sourceSlug) {
        incomingLinks.set(targetSlug, (incomingLinks.get(targetSlug) || 0) + 1);
      }
    }
  }

  for (const [slug, count] of incomingLinks) {
    if (count === 0) {
      needsReview.push(`Orphan page has no incoming wikilinks: pages/${slug}.md`);
    }
  }
}

async function appendSelfHealLog(result: SelfHealResult) {
  if (result.fixed.length === 0 && result.needsReview.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const reviewSummary =
    result.needsReview.length === 0 ? "none" : result.needsReview.join("; ");
  const logEntry = `- **${today}** | self-heal | Fixed: ${result.fixed.length}. Needs human review: ${reviewSummary}\n`;

  await fs.appendFile(path.join(WIKI_DIR, "log.md"), logEntry);
}

export async function runWikiSelfHeal(): Promise<SelfHealResult> {
  const pagesDir = path.join(WIKI_DIR, "pages");
  const pageFiles = (await listMarkdownFiles(pagesDir)).sort((a, b) =>
    a.localeCompare(b)
  );
  const pageContents = new Map<string, string>();
  const fixed: string[] = [];
  const needsReview: string[] = [];

  for (const pageFile of pageFiles) {
    pageContents.set(
      path.relative(WIKI_DIR, pageFile),
      await fs.readFile(pageFile, "utf8")
    );
  }

  await ensureIndexEntries(pageFiles, pageContents, fixed);
  await ensureRequiredSections(pageContents, fixed);
  collectReviewItems(pageContents, needsReview);

  const result = { fixed, needsReview };
  await appendSelfHealLog(result);
  return result;
}

export function formatSelfHealResult(result: SelfHealResult): string {
  if (result.fixed.length === 0 && result.needsReview.length === 0) {
    return "Self-heal: wiki structure is healthy.";
  }

  const lines = [`Self-heal: fixed ${result.fixed.length} issue(s).`];
  if (result.needsReview.length > 0) {
    lines.push(
      `Needs human review: ${result.needsReview.length} issue(s).`,
      ...result.needsReview.map((issue) => `- ${issue}`)
    );
  }

  return lines.join("\n");
}
