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
        className="nav-link ml-auto rounded px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {loading ? "Repairing..." : "Deep Repair"}
      </button>
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6">
          <div className="panel max-h-[80vh] w-full max-w-2xl overflow-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">Deep Repair Report</h2>
              <button
                onClick={() => setResult(null)}
                className="ghost-button px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            <pre className="muted-text whitespace-pre-wrap text-sm">
              {result}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
