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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Knowledge Base</h1>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Ask your knowledge base..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 p-3 bg-neutral-900 border border-neutral-700 rounded"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-6 py-3 bg-white text-black font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Ask"}
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

      {answer && (
        <div className="mt-6 p-4 bg-neutral-900 border border-neutral-700 rounded prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
