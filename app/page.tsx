"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchWithAdminToken } from "./admin-fetch";

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setAnswer(null);
    setError(null);
    setStatus("Starting query...");

    try {
      const res = await fetchWithAdminToken("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
            setAnswer(event.text);
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
        <p className="page-kicker mb-2">query</p>
        <h1 className="page-title">Knowledge Base</h1>
      </header>

      <form onSubmit={handleSubmit} className="panel flex gap-2 p-2">
        <input
          type="text"
          placeholder="Ask your knowledge base..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="terminal-input min-w-0 flex-1 px-3 py-2.5"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="terminal-button px-5 py-2.5"
        >
          {loading ? "..." : "Ask"}
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

      {answer && (
        <div className="panel mt-6">
          <div className="panel-header px-4 py-3 text-sm muted-text">
            result
          </div>
          <div className="markdown-body prose prose-invert prose-sm max-w-none p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
