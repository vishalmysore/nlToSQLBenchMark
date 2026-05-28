import React, { useState } from "react";

function extractSQL(text) {
  if (!text) return "";
  const fenceMatch = text.match(/```(?:\w+)?\s*\n([\s\S]+?)```/);
  if (fenceMatch) {
    let inner = fenceMatch[1].trim();
    const lines = inner.split("\n");
    if (lines.length > 1 && /^[a-z]+$/i.test(lines[0].trim()) &&
        !/^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(lines[0].trim())) {
      inner = lines.slice(1).join("\n").trim();
    }
    return inner;
  }
  const sqlMatch = text.match(/((?:WITH|SELECT|INSERT|UPDATE|DELETE|CREATE)\b[\s\S]+?;)/i);
  if (sqlMatch) return sqlMatch[1].trim();
  return text.trim();
}

export default function QueryPlayground({
  onRun, generating, modelState, lastResult,
  exampleQueries = [], domainLabel = "",
}) {
  const [query, setQuery] = useState("");

  const isReady = modelState === "ready";
  const isBusy  = modelState === "loading" || modelState === "compiling";
  const canRun  = isReady && !generating && query.trim().length > 0;
  const sql     = lastResult?.generatedText ? extractSQL(lastResult.generatedText) : null;

  return (
    <div className="panel flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="panel-header mb-0">Query Playground</span>
        {domainLabel && (
          <span className="text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
            {domainLabel}
          </span>
        )}
      </div>

      {/* Example query chips */}
      <div className="flex flex-wrap gap-1.5">
        {exampleQueries.map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              query === q
                ? "border-sky-400 bg-sky-50 text-sky-700 font-medium"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder={isReady ? "Ask a question about your data…" : "Load a model to start querying…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canRun && onRun(query)}
          disabled={!isReady}
        />
        <button
          className="btn-primary px-6 shrink-0 flex items-center gap-2"
          onClick={() => onRun(query)}
          disabled={!canRun}
        >
          {generating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Running</span>
            </>
          ) : "Run →"}
        </button>
      </div>

      {/* No model notice */}
      {!isReady && !isBusy && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-base">🤖</span>
          <span>Load a model from the <strong className="text-gray-700">Inference Engine</strong> panel to run queries.</span>
        </div>
      )}

      {/* Loading notice */}
      {isBusy && (
        <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
          <span>Model {modelState === "compiling" ? "compiling shaders" : "downloading"} — queries will be available once ready.</span>
        </div>
      )}

      {/* Generated SQL */}
      {sql && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated SQL</span>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
              {lastResult?.elapsedMs > 0 && <span>{lastResult.elapsedMs.toFixed(0)}ms</span>}
              {lastResult?.tokensPerSec > 0 && <span>{lastResult.tokensPerSec.toFixed(1)} tok/s</span>}
            </div>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-sky-700 whitespace-pre-wrap overflow-x-auto leading-relaxed">
            {sql}
          </pre>
        </div>
      )}

      {/* DuckDB result */}
      {lastResult?.execution && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution</span>
            {lastResult.execution.success
              ? <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">✓ {lastResult.execution.rowCount} rows</span>
              : <span className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">✗ Error</span>
            }
          </div>
          {!lastResult.execution.success && lastResult.execution.error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-mono">
              {lastResult.execution.error.slice(0, 200)}
            </p>
          )}
          {lastResult.execution.success && lastResult.execution.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 max-h-48">
              <table className="text-xs font-mono w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {lastResult.execution.schema.map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lastResult.execution.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      {lastResult.execution.schema.map((col) => (
                        <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                          {row[col] === null ? <span className="text-gray-300">null</span> : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
