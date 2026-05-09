"use client";

import { useState } from "react";
import { fetchWithAdminToken } from "./admin-fetch";

export function LintButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleLint() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetchWithAdminToken("/api/lint", { method: "POST" });
      const data = await res.json();
      setResult(res.ok ? data.result : data.error);
    } catch {
      setResult("Failed to connect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleLint}
        disabled={loading}
        className="ml-auto text-neutral-400 hover:text-white disabled:opacity-50"
      >
        {loading ? "Linting..." : "Run Lint"}
      </button>
      {result && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">Lint Report</h2>
              <button
                onClick={() => setResult(null)}
                className="text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-neutral-300">
              {result}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
