"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

export function ManageClient() {
  const searchParams = useSearchParams();
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
      if (!firstPagePath) {
        const source = searchParams.get("source");
        if (source) await loadSource(source);
        return;
      }

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

      const source = searchParams.get("source");
      if (source) await loadSource(source);
    }

    void loadInitialPages();
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  return (
    <div className="page-wrap">
      <header className="mb-6">
        <p className="page-kicker mb-2">admin</p>
        <h1 className="page-title">Manage Pages</h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-[18rem_1fr_22rem]">
      <aside className="panel">
        <div className="panel-header px-4 py-3">
          <h2 className="text-sm font-bold">Pages</h2>
        </div>
        <nav className="p-2">
          {pages.map((page) => (
            <button
              key={page.path}
              type="button"
              onClick={() => loadPage(page.path)}
              className="list-item block w-full px-3 py-2 text-left text-sm"
              data-active={page.path === selectedPath}
            >
              <span className="block truncate font-medium">{page.title}</span>
              <span className="block truncate text-xs opacity-70">
                {page.path}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="panel min-w-0 overflow-hidden">
        <div className="panel-header flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-bold">
              {selectedPath || "No page selected"}
            </h2>
            {status && <p className="muted-text text-sm">{status}</p>}
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={savePage}
              disabled={!selectedPath}
              className="terminal-button px-3 py-2 text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={deleteSelectedPage}
              disabled={!selectedPath}
              className="rounded border border-red-700 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950 disabled:opacity-50"
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

      <aside className="panel">
        <div className="panel-header px-4 py-3">
          <h2 className="text-sm font-bold">Original Sources</h2>
        </div>
        <div className="space-y-2 p-3">
          {sources.length === 0 && (
            <p className="dim-text text-sm">No sources listed.</p>
          )}
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => loadSource(source)}
              className="list-item block w-full px-3 py-2 text-left text-sm"
              data-active={source === sourcePath}
            >
              {source}
            </button>
          ))}
        </div>
        <div className="border-t border-neutral-800 p-3">
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded border border-neutral-900 bg-black p-3 text-xs text-neutral-300">
            {sourceContent || "Select a source to view extracted text."}
          </pre>
        </div>
      </aside>
      </div>
    </div>
  );
}
