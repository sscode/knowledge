"use client";

import { useEffect, useState } from "react";
import { fetchWithAdminToken } from "../admin-fetch";

type ManagedPage = {
  path: string;
  title: string;
  summary: string;
  sources: string[];
};

type PageDetail = {
  page: ManagedPage;
  content: string;
};

export default function ManagePage() {
  const [pages, setPages] = useState<ManagedPage[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourceContent, setSourceContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPages(nextSelectedPath?: string) {
    setError(null);
    const res = await fetchWithAdminToken("/api/wiki/pages", { method: "GET" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    setPages(data.pages);
    const nextPath = nextSelectedPath || selectedPath || data.pages[0]?.path;
    if (nextPath) await loadPage(nextPath);
  }

  async function loadPage(pagePath: string) {
    setStatus(null);
    setError(null);
    setSourcePath(null);
    setSourceContent("");

    const res = await fetchWithAdminToken(
      `/api/wiki/pages?file=${encodeURIComponent(pagePath)}`,
      { method: "GET" }
    );
    const data: PageDetail | { error: string } = await res.json();
    if (!res.ok) {
      setError("error" in data ? data.error : "Failed to load page");
      return;
    }

    const detail = data as PageDetail;
    setSelectedPath(detail.page.path);
    setContent(detail.content);
    setSources(detail.page.sources);
  }

  async function savePage() {
    if (!selectedPath) return;

    setStatus("Saving...");
    setError(null);
    const res = await fetchWithAdminToken("/api/wiki/pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: selectedPath, content }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setStatus(null);
      return;
    }

    setStatus("Saved and self-healed.");
    await loadPages(selectedPath);
  }

  async function deleteSelectedPage() {
    if (!selectedPath) return;
    if (!window.confirm(`Delete ${selectedPath}?`)) return;

    setStatus("Deleting...");
    setError(null);
    const res = await fetchWithAdminToken(
      `/api/wiki/pages?file=${encodeURIComponent(selectedPath)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setStatus(null);
      return;
    }

    setSelectedPath(null);
    setContent("");
    setSources([]);
    setSourcePath(null);
    setSourceContent("");
    setStatus("Deleted and self-healed.");
    await loadPages();
  }

  async function loadSource(nextSourcePath: string) {
    setStatus(null);
    setError(null);
    setSourcePath(nextSourcePath);
    setSourceContent("Loading source...");

    const res = await fetchWithAdminToken(
      `/api/wiki/sources?file=${encodeURIComponent(nextSourcePath)}`,
      { method: "GET" }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setSourceContent("");
      return;
    }

    setSourceContent(data.content || "(empty source)");
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialPages() {
      const res = await fetchWithAdminToken("/api/wiki/pages", {
        method: "GET",
      });
      const data = await res.json();
      if (ignore) return;

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setPages(data.pages);
      const firstPagePath = data.pages[0]?.path;
      if (!firstPagePath) return;

      const detailRes = await fetchWithAdminToken(
        `/api/wiki/pages?file=${encodeURIComponent(firstPagePath)}`,
        { method: "GET" }
      );
      const detailData: PageDetail | { error: string } =
        await detailRes.json();
      if (ignore) return;

      if (!detailRes.ok) {
        setError(
          "error" in detailData ? detailData.error : "Failed to load page"
        );
        return;
      }

      const detail = detailData as PageDetail;
      setSelectedPath(detail.page.path);
      setContent(detail.content);
      setSources(detail.page.sources);
    }

    void loadInitialPages();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[18rem_1fr_22rem]">
      <aside className="border border-neutral-800 rounded bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h1 className="text-lg font-bold">Manage Pages</h1>
        </div>
        <nav className="p-2">
          {pages.map((page) => (
            <button
              key={page.path}
              type="button"
              onClick={() => loadPage(page.path)}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${
                page.path === selectedPath
                  ? "bg-white text-black"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              <span className="block truncate font-medium">{page.title}</span>
              <span className="block truncate text-xs opacity-70">
                {page.path}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 border border-neutral-800 rounded bg-neutral-950">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-bold">
              {selectedPath || "No page selected"}
            </h2>
            {status && <p className="text-sm text-neutral-400">{status}</p>}
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={savePage}
              disabled={!selectedPath}
              className="rounded bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={deleteSelectedPage}
              disabled={!selectedPath}
              className="rounded border border-red-700 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!selectedPath}
          className="min-h-[70vh] w-full resize-y bg-black p-4 font-mono text-sm text-neutral-100 outline-none disabled:opacity-50"
        />
      </section>

      <aside className="border border-neutral-800 rounded bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h2 className="font-bold">Original Sources</h2>
        </div>
        <div className="space-y-2 p-3">
          {sources.length === 0 && (
            <p className="text-sm text-neutral-500">No sources listed.</p>
          )}
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => loadSource(source)}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${
                source === sourcePath
                  ? "bg-white text-black"
                  : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
              }`}
            >
              {source}
            </button>
          ))}
        </div>
        <div className="border-t border-neutral-800 p-3">
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded bg-black p-3 text-xs text-neutral-300">
            {sourceContent || "Select a source to view extracted text."}
          </pre>
        </div>
      </aside>
    </div>
  );
}
