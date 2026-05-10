import fs from "node:fs";
import { lookup } from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { WIKI_DIR } from "./wiki";

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);
const MAX_URL_BYTES = 8 * 1024 * 1024;

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

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use http or https");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local URLs are not allowed");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("URL host could not be resolved");

  for (const { address } of addresses) {
    const family = net.isIP(address);
    if (
      (family === 4 && isPrivateIpv4(address)) ||
      (family === 6 && isPrivateIpv6(address))
    ) {
      throw new Error("Private network URLs are not allowed");
    }
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeHtmlEntities(title ? `# ${title}\n\n${text}` : text);
}

async function readResponseBody(res: Response): Promise<ArrayBuffer> {
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_URL_BYTES) {
    throw new Error("URL response is too large");
  }

  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_URL_BYTES) {
      throw new Error("URL response is too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer;
}

async function fetchPublicUrl(url: URL): Promise<Response> {
  let currentUrl = url;

  for (let redirects = 0; redirects < 5; redirects += 1) {
    await assertPublicUrl(currentUrl);

    const res = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "text/html,text/plain,text/markdown,application/pdf,*/*;q=0.8",
        "User-Agent": "KnowledgeIngest/1.0",
      },
    });

    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    const location = res.headers.get("location");
    if (!location) throw new Error("URL redirected without a location");
    currentUrl = new URL(location, currentUrl);
  }

  throw new Error("URL redirected too many times");
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

export async function saveUrlSource(urlText: string): Promise<{
  sourcePath: string;
  description: string;
}> {
  let url: URL;
  try {
    url = new URL(urlText.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  const res = await fetchPublicUrl(url);

  if (!res.ok) {
    throw new Error(`URL fetch failed with status ${res.status}`);
  }

  const contentType = res.headers.get("content-type")?.toLowerCase() || "";
  const body = await readResponseBody(res);
  const finalUrl = res.url || url.toString();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = slugify(url.hostname + url.pathname) || "url";
  const sourcePath = path.join(WIKI_DIR, "sources", `${timestamp}-${safeName}.md`);

  let content: string;
  if (contentType.includes("application/pdf")) {
    content = await extractPdfText({
      name: path.basename(url.pathname) || "URL document.pdf",
      arrayBuffer: async () => body,
    });
  } else {
    const text = new TextDecoder().decode(body);
    content = contentType.includes("text/html") ? htmlToText(text) : text;
  }

  if (!content.trim()) {
    throw new Error("URL had no extractable text");
  }

  fs.writeFileSync(
    sourcePath,
    `# URL: ${finalUrl}\n\n_Source URL_: ${finalUrl}\n\n${content.trim()}\n`
  );
  return { sourcePath, description: `URL: ${finalUrl}` };
}
