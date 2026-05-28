import React, { useState } from "react";

export default function PromptViewer({ cleanDescription, obfuscatedDescription, systemPrompt, rawResponse }) {
  const [tab, setTab] = useState("diff");

  const tabs = [
    { key: "diff",     label: "Clean vs Obfuscated" },
    { key: "full",     label: "Full Prompt" },
    { key: "response", label: "Raw Response" },
  ];

  return (
    <div className="panel flex flex-col gap-0 h-full p-0 overflow-hidden">
      {/* Tab strip */}
      <div className="flex items-center justify-between px-4 pt-3 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Prompt Payload Inspector</span>
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-2 border-b-2 transition-all -mb-px flex items-center gap-1.5 ${
                tab === t.key
                  ? "border-sky-500 text-sky-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.key === "response" && rawResponse && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">

        {/* Clean vs Obfuscated */}
        {tab === "diff" && (
          <div className="flex gap-3 h-full">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Clean Schema</span>
              </div>
              <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[11px] font-mono text-emerald-700 whitespace-pre-wrap leading-relaxed min-h-0">
                {cleanDescription || "— no schema —"}
              </pre>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-1.5 mb-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Injected Payload</span>
              </div>
              <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[11px] font-mono text-red-600 whitespace-pre-wrap leading-relaxed min-h-0">
                {obfuscatedDescription || "— no schema —"}
              </pre>
            </div>
          </div>
        )}

        {/* Full Prompt */}
        {tab === "full" && (
          <pre className="h-full overflow-auto bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[11px] font-mono text-gray-600 whitespace-pre-wrap leading-relaxed min-h-0">
            {systemPrompt || "— load a model and select a schema —"}
          </pre>
        )}

        {/* Raw Response */}
        {tab === "response" && (
          <div className="flex flex-col h-full gap-3">
            {rawResponse ? (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Last model output</span>
                </div>
                <pre className="flex-1 overflow-auto bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[11px] font-mono text-gray-700 whitespace-pre-wrap leading-relaxed min-h-0">
                  {rawResponse}
                </pre>

                {/* Parse annotation */}
                <RawResponseAnnotation raw={rawResponse} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <span className="text-2xl">🤖</span>
                <div className="text-xs text-gray-400">Run a query to see the model's raw output here.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shows how the raw response was parsed
function RawResponseAnnotation({ raw }) {
  const fenceMatch = raw.match(/```(\w+)?\s*\n([\s\S]+?)```/);
  const sqlMatch   = !fenceMatch && raw.match(/((?:WITH|SELECT|INSERT|UPDATE|DELETE|CREATE)\b[\s\S]+?;)/i);

  if (fenceMatch) {
    const lang  = fenceMatch[1] ?? "(none)";
    const inner = fenceMatch[2].trim().slice(0, 80);
    const isWrong = lang && lang.toLowerCase() !== "sql";
    return (
      <div className={`shrink-0 rounded-xl border px-3 py-2 flex items-start gap-2 ${isWrong ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <span className="text-base mt-0.5">{isWrong ? "⚠️" : "✅"}</span>
        <div>
          <div className={`text-xs font-semibold ${isWrong ? "text-amber-700" : "text-emerald-700"}`}>
            {isWrong
              ? `Code fence found but language tag is "${lang}" — expected "sql". SQL was extracted successfully.`
              : `Parsed from \`\`\`sql code fence.`}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">Extracted: {inner}…</div>
        </div>
      </div>
    );
  }

  if (sqlMatch) {
    return (
      <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
        <span className="text-base mt-0.5">⚠️</span>
        <div>
          <div className="text-xs font-semibold text-amber-700">No code fence found — SQL extracted via regex fallback.</div>
          <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">Extracted: {sqlMatch[1].trim().slice(0, 80)}…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2">
      <span className="text-base mt-0.5">❌</span>
      <div className="text-xs font-semibold text-red-700">Could not extract SQL — no code fence or SELECT statement found in response.</div>
    </div>
  );
}
