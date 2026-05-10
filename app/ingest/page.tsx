"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchWithAdminToken } from "../admin-fetch";

type Mode = "text" | "url" | "file";

const ACCEPTED_FILE_TYPES = ".txt,.md,.csv,.json,.docx,.pdf";
const ACCEPTED_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "docx",
  "pdf",
]);

export default function IngestPage() {
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function isAcceptedFile(nextFile: File): boolean {
    const ext = nextFile.name.split(".").pop()?.toLowerCase();
    return !!ext && ACCEPTED_EXTENSIONS.has(ext);
  }

  function selectFile(nextFile: File | null) {
    if (nextFile && !isAcceptedFile(nextFile)) {
      setFile(null);
      setError("Unsupported file type");
      return;
    }

    setFile(nextFile);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files[0] || null);
  }

  function clearFile() {
    selectFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setStatus("Starting ingest...");

    const formData = new FormData();
    if (mode === "text") {
      formData.append("title", title);
      formData.append("text", text);
    } else if (mode === "url") {
      formData.append("url", url);
    } else if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetchWithAdminToken("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "progress") {
            setStatus(event.text);
          } else if (event.type === "result") {
            setResult(event.text);
            setTitle("");
            setText("");
            setUrl("");
            setFile(null);
          } else if (event.type === "error") {
            setError(event.text);
          }
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <div className="narrow-wrap">
      <header className="mb-6">
        <p className="page-kicker mb-2">ingest</p>
        <h1 className="page-title">Ingest Knowledge</h1>
      </header>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setMode("text")}
          type="button"
          className="ghost-button px-4 py-2 text-sm"
          data-active={mode === "text"}
        >
          Paste Text
        </button>
        <button
          onClick={() => setMode("url")}
          type="button"
          className="ghost-button px-4 py-2 text-sm"
          data-active={mode === "url"}
        >
          URL
        </button>
        <button
          onClick={() => setMode("file")}
          type="button"
          className="ghost-button px-4 py-2 text-sm"
          data-active={mode === "file"}
        >
          Upload File
        </button>
      </div>

      <form onSubmit={handleSubmit} className="panel space-y-4 p-4">
        {mode === "text" ? (
          <>
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="terminal-input w-full px-3 py-2.5"
            />
            <textarea
              placeholder="Paste your content here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              required
              className="terminal-input w-full resize-y px-3 py-2.5"
            />
          </>
        ) : mode === "url" ? (
          <input
            type="url"
            placeholder="https://example.com/page"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="terminal-input w-full px-3 py-2.5"
          />
        ) : (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              id="source-file"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={(e) => selectFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="source-file"
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`block cursor-pointer rounded border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? "border-white bg-neutral-900"
                  : "border-neutral-700 bg-black hover:border-neutral-500 hover:bg-neutral-950"
              }`}
            >
              <span className="block font-medium text-white">
                Drop a file here or click to browse
              </span>
              <span className="muted-text mt-2 block text-sm">
                Supports TXT, Markdown, CSV, JSON, DOCX, and PDF
              </span>
            </label>
            {file && (
              <div className="flex items-center justify-between gap-3 rounded border border-neutral-800 bg-black px-3 py-2">
                <p className="muted-text min-w-0 truncate text-sm">
                  Selected: {file.name}
                </p>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ghost-button shrink-0 px-2 py-1 text-sm"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            (mode === "text" ? !text : mode === "url" ? !url : !file)
          }
          className="terminal-button w-full py-3"
        >
          {loading ? "Ingesting..." : "Ingest"}
        </button>
      </form>

      {loading && status && (
        <div className="muted-text mt-4 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-neutral-500 animate-pulse" />
          <span className="text-sm">{status}</span>
        </div>
      )}

      {error && (
        <div className="danger-panel mt-6 p-4">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="panel mt-6">
          <div className="panel-header px-4 py-3 text-sm muted-text">
            ingest result
          </div>
          <div className="markdown-body prose prose-invert prose-sm max-w-none p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
