import path from "path";
import fs from "node:fs";

const bundledWikiDir = path.resolve(process.cwd(), "wiki");

export const WIKI_DIR = path.resolve(process.env.KB_WIKI_DIR || bundledWikiDir);

function copyDir(source: string, destination: string) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else if (!fs.existsSync(destinationPath)) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function ensureWikiDir() {
  fs.mkdirSync(WIKI_DIR, { recursive: true });

  const hasWikiFiles = fs
    .readdirSync(WIKI_DIR)
    .some((entry) => ![".DS_Store", ".gitkeep", "lost+found"].includes(entry));

  if (
    WIKI_DIR !== bundledWikiDir &&
    !hasWikiFiles &&
    fs.existsSync(bundledWikiDir)
  ) {
    copyDir(bundledWikiDir, WIKI_DIR);
  }

  fs.mkdirSync(path.join(WIKI_DIR, "pages"), { recursive: true });
  fs.mkdirSync(path.join(WIKI_DIR, "schema"), { recursive: true });
  fs.mkdirSync(path.join(WIKI_DIR, "sources"), { recursive: true });

  const indexPath = path.join(WIKI_DIR, "index.md");
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, "# Knowledge Base Index\n");
  }

  const logPath = path.join(WIKI_DIR, "log.md");
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "# Knowledge Base Log\n");
  }
}

ensureWikiDir();

// Simple promise-chain mutex to serialize write operations (ingest, lint).
// Queries are read-only and don't need the lock.
let writeLock = Promise.resolve();

export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeLock.then(fn);
  writeLock = result.then(
    () => {},
    () => {}
  );
  return result;
}

export async function* withWriteLockStream<T>(
  fn: () => AsyncGenerator<T>
): AsyncGenerator<T> {
  let release: () => void;
  const held = new Promise<void>((r) => (release = r));
  const ready = writeLock;
  writeLock = held;
  await ready;
  try {
    yield* fn();
  } finally {
    release!();
  }
}
