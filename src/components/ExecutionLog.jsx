import React, { useState } from "react";
import { COMPLEXITY_META } from "../lib/complexityEngine.js";
import { setFeedback } from "../lib/storage.js";

function LevelBadge({ level }) {
  const m = COMPLEXITY_META[level - 1];
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${m?.bg ?? ""} ${m?.border ?? ""} ${m?.color ?? ""}`}>
      L{level}
    </span>
  );
}

function StatusBadge({ log }) {
  if (!log.genSuccess)  return <span className="inline-flex text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Parse fail</span>;
  if (!log.execSuccess) return <span className="inline-flex text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Exec error</span>;
  return <span className="inline-flex text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ OK</span>;
}

function ThumbButtons({ logId, current, onChange }) {
  return (
    <div className="flex gap-1.5 items-center">
      <span className="text-[10px] text-gray-400 mr-0.5">Correct?</span>
      <button
        title="SQL matched the question intent"
        onClick={() => onChange(logId, current === "correct" ? null : "correct")}
        className={`rounded-lg px-2 py-1 text-xs border transition-all ${
          current === "correct"
            ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold"
            : "border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50"
        }`}
      >👍</button>
      <button
        title="SQL ran but answered wrong"
        onClick={() => onChange(logId, current === "incorrect" ? null : "incorrect")}
        className={`rounded-lg px-2 py-1 text-xs border transition-all ${
          current === "incorrect"
            ? "bg-red-50 border-red-300 text-red-700 font-semibold"
            : "border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
        }`}
      >👎</button>
    </div>
  );
}

export default function ExecutionLog({ logs, onLogsChange, onClear }) {
  const [filter,   setFilter]   = useState("all");
  const [expanded, setExpanded] = useState(null);

  async function handleFeedback(logId, feedback) {
    await setFeedback(logId, feedback);
    onLogsChange((prev) => prev.map((l) => (l.id === logId ? { ...l, humanFeedback: feedback } : l)));
  }

  const filtered = logs.filter((l) => {
    if (filter === "success")   return l.genSuccess && l.execSuccess;
    if (filter === "fail")      return !l.genSuccess || !l.execSuccess;
    if (filter === "correct")   return l.humanFeedback === "correct";
    if (filter === "incorrect") return l.humanFeedback === "incorrect";
    if (filter === "unrated")   return l.humanFeedback == null;
    return true;
  });

  const total       = logs.length;
  const execOk      = logs.filter((l) => l.genSuccess && l.execSuccess).length;
  const rated       = logs.filter((l) => l.humanFeedback != null).length;
  const correct     = logs.filter((l) => l.humanFeedback === "correct").length;
  const incorrect   = logs.filter((l) => l.humanFeedback === "incorrect").length;
  const semanticPct = rated > 0 ? Math.round((correct / rated) * 100) : null;

  return (
    <div className="panel flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <span className="panel-header mb-0">Execution Log</span>
        <div className="flex items-center gap-1.5">
          <select
            className="text-[10px] border border-gray-200 rounded-lg h-7 px-2 bg-white text-gray-600 focus:outline-none focus:border-sky-400 cursor-pointer"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="success">✓ Exec OK</option>
            <option value="fail">✗ Failed</option>
            <option value="correct">👍 Correct</option>
            <option value="incorrect">👎 Wrong</option>
            <option value="unrated">Unrated</option>
          </select>
          {total > 0 && (
            <button
              onClick={onClear}
              className="text-[10px] text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg h-7 px-2.5 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Semantic accuracy bar */}
      {rated > 0 && (
        <div className="shrink-0 bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Semantic Accuracy</span>
            <span className={`text-sm font-bold font-mono ${semanticPct >= 70 ? "text-emerald-600" : semanticPct >= 40 ? "text-amber-600" : "text-red-600"}`}>
              {semanticPct}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(correct / rated) * 100}%` }} />
            <div className="bg-red-400 h-full transition-all"     style={{ width: `${(incorrect / rated) * 100}%` }} />
          </div>
          <div className="text-[10px] text-gray-400">
            👍 {correct} correct · 👎 {incorrect} wrong · {total - rated} unrated
          </div>
        </div>
      )}

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-0.5">
        {filtered.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-10">
            {total === 0 ? "Run some queries to see results." : "No entries match this filter."}
          </div>
        ) : filtered.slice(0, 100).map((log) => {
          const isExpanded = expanded === (log.id ?? log.timestamp);
          const rowBg = log.humanFeedback === "correct"   ? "border-emerald-200 bg-emerald-50/60" :
                        log.humanFeedback === "incorrect" ? "border-red-200 bg-red-50/60"         :
                                                            "border-gray-200 bg-white";
          return (
            <div key={log.id ?? log.timestamp} className={`rounded-xl border transition-all ${rowBg}`}>
              <div
                className="flex items-start gap-2 p-2.5 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : (log.id ?? log.timestamp))}
              >
                <div className="flex items-center gap-1 mt-0.5 shrink-0 flex-wrap">
                  <StatusBadge log={log} />
                  <LevelBadge level={log.complexityLevel} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 truncate font-medium leading-tight">{log.query}</div>
                  <div className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                    {log.sql?.replace(/\s+/g, " ").slice(0, 80)}
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 shrink-0 text-right leading-tight ml-1">
                  <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                  <div className="text-gray-300 font-mono">{log.modelId}</div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-200 px-3 py-3 space-y-3">
                  <pre className="text-xs font-mono text-sky-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 whitespace-pre-wrap overflow-x-auto">
                    {log.sql || "— no SQL generated —"}
                  </pre>

                  {!log.execSuccess && log.error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-mono">
                      {log.error}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-gray-400 font-mono">
                    {log.elapsedMs > 0    && <span>{log.elapsedMs.toFixed(0)}ms</span>}
                    {log.tokensPerSec > 0 && <span>{log.tokensPerSec.toFixed(1)} tok/s</span>}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Did the SQL answer the question?<br/>
                      <span className="text-gray-300">Execution pass ≠ semantic correctness</span>
                    </p>
                    <ThumbButtons logId={log.id ?? log.timestamp} current={log.humanFeedback} onChange={handleFeedback} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      {total > 0 && (
        <div className="border-t border-gray-100 pt-3 grid grid-cols-4 gap-1 text-center shrink-0">
          {[
            { val: total,    label: "Total",    color: "text-gray-700" },
            { val: execOk,   label: "Exec OK",  color: "text-emerald-600" },
            { val: correct,  label: "👍 Right",  color: "text-sky-600" },
            { val: incorrect,label: "👎 Wrong",  color: "text-red-500" },
          ].map(({ val, label, color }) => (
            <div key={label}>
              <div className={`text-lg font-bold ${color}`}>{val}</div>
              <div className="text-[9px] text-gray-400 font-medium">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
