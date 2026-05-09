import path from "path";

export const WIKI_DIR = path.join(process.cwd(), "wiki");

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
