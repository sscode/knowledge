"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchWithAdminToken } from "../admin-fetch";

type Mode = "text" | "file";

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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Ingest Knowledge</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("text")}
          className={`px-4 py-2 rounded ${
            mode === "text"
              ? "bg-white text-black"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          Paste Text
        </button>
        <button
          onClick={() => setMode("file")}
          className={`px-4 py-2 rounded ${
            mode === "file"
              ? "bg-white text-black"
              : "bg-neutral-800 text-neutral-400"
          }`}
        >
          Upload File
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "text" ? (
          <>
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded"
            />
            <textarea
              placeholder="Paste your content here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              required
              className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded resize-y"
            />
          </>
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
                  : "border-neutral-700 bg-neutral-950 hover:border-neutral-500 hover:bg-neutral-900"
              }`}
            >
              <span className="block font-medium text-white">
                Drop a file here or click to browse
              </span>
              <span className="mt-2 block text-sm text-neutral-400">
                Supports TXT, Markdown, CSV, JSON, DOCX, and PDF
              </span>
            </label>
            {file && (
              <div className="flex items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-2">
                <p className="min-w-0 truncate text-sm text-neutral-300">
                  Selected: {file.name}
                </p>
                <button
                  type="button"
                  onClick={clearFile}
                  className="shrink-0 text-sm text-neutral-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (mode === "text" ? !text : !file)}
          className="w-full py-3 bg-white text-black font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Ingesting..." : "Ingest"}
        </button>
      </form>

      {loading && status && (
        <div className="mt-4 flex items-center gap-2 text-neutral-400">
          <span className="inline-block h-3 w-3 rounded-full bg-neutral-500 animate-pulse" />
          <span className="text-sm">{status}</span>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 p-4 bg-neutral-900 border border-neutral-700 rounded">
          <h2 className="font-medium mb-2">Ingest Result</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
