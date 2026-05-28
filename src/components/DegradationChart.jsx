import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { COMPLEXITY_META } from "../lib/complexityEngine.js";

const MODEL_COLORS = {
  tinyllama:  "#f59e0b",
  qwen_coder: "#10b981",
  phi3_mini:  "#a78bfa",
  mock:       "#64748b",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs shadow-xl">
      <div className="font-semibold text-gray-200 mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-400 truncate max-w-[140px]">{p.name}:</span>
          <span className="font-mono text-gray-100 ml-auto">{p.value != null ? `${p.value}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
};

export default function DegradationChart({ logs }) {
  const allModels = useMemo(() => [...new Set(logs.map((l) => l.modelId))], [logs]);

  // Per-level, per-model: execution success % and semantic (human) accuracy %
  const chartData = useMemo(() => {
    return COMPLEXITY_META.map((m) => {
      const levelLogs = logs.filter((l) => l.complexityLevel === m.level);
      const entry = { level: `L${m.level}`, label: m.label };

      for (const model of allModels) {
        const ml = levelLogs.filter((l) => l.modelId === model);
        if (ml.length === 0) continue;

        const execOk = ml.filter((l) => l.genSuccess && l.execSuccess).length;
        entry[`${model}_exec`] = Math.round((execOk / ml.length) * 100);

        const rated   = ml.filter((l) => l.humanFeedback != null);
        const correct = rated.filter((l) => l.humanFeedback === "correct").length;
        entry[`${model}_semantic`] = rated.length > 0
          ? Math.round((correct / rated.length) * 100)
          : null;
      }
      return entry;
    });
  }, [logs, allModels]);

  // Latency per level
  const latencyData = useMemo(() => {
    return COMPLEXITY_META.map((m) => {
      const ll = logs.filter((l) => l.complexityLevel === m.level && l.elapsedMs > 0);
      return {
        level: `L${m.level}`,
        avgMs: ll.length > 0 ? Math.round(ll.reduce((s, l) => s + l.elapsedMs, 0) / ll.length) : null,
      };
    });
  }, [logs]);

  // Semantic vs execution accuracy totals across all levels
  const totalRated   = logs.filter((l) => l.humanFeedback != null).length;
  const totalCorrect = logs.filter((l) => l.humanFeedback === "correct").length;
  const totalExecOk  = logs.filter((l) => l.genSuccess && l.execSuccess).length;

  if (logs.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">Degradation Curve</div>
        <div className="text-center py-16 text-gray-600 text-sm space-y-2">
          <div className="text-3xl">📈</div>
          <div>Run queries across different complexity levels to build the curve.</div>
          <div className="text-xs text-gray-700">Switch tiers with the slider, run the same question at each level, then check here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="panel-header mb-0">Degradation Curve</span>
        {/* Gap between exec and semantic accuracy */}
        {totalRated > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-sky-400 inline-block" />
              <span className="text-gray-500">Execution pass rate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-emerald-400 inline-block" />
              <span className="text-gray-500">Semantic accuracy (human)</span>
            </div>
          </div>
        )}
      </div>

      {/* Accuracy gap summary */}
      {totalRated > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-700/50">
            <div className="text-2xl font-bold text-emerald-400">
              {logs.length > 0 ? Math.round((totalExecOk / logs.length) * 100) : 0}%
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Execution pass rate</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-700/50">
            <div className="text-2xl font-bold text-sky-400">
              {totalRated > 0 ? Math.round((totalCorrect / totalRated) * 100) : "—"}%
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Semantic accuracy (👍/{totalRated} rated)</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-red-900/30">
            <div className="text-2xl font-bold text-red-400">
              {totalRated > 0
                ? Math.round(((totalExecOk / logs.length) - (totalCorrect / totalRated)) * 100)
                : "—"}%
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">Accuracy gap (exec − semantic)</div>
          </div>
        </div>
      )}

      {/* Main degradation chart */}
      <div>
        <div className="text-xs text-gray-500 mb-2">Success Rate (%) by Complexity Level</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} tickFormatter={(v) => `${v}%`} width={38} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }} />
            {allModels.map((model) => (
              <React.Fragment key={model}>
                {/* Solid line = execution success */}
                <Line
                  type="monotone"
                  dataKey={`${model}_exec`}
                  name={`${model} exec`}
                  stroke={MODEL_COLORS[model] ?? "#94a3b8"}
                  strokeWidth={2}
                  dot={{ r: 4, fill: MODEL_COLORS[model] ?? "#94a3b8" }}
                  connectNulls
                />
                {/* Dashed line = semantic accuracy */}
                <Line
                  type="monotone"
                  dataKey={`${model}_semantic`}
                  name={`${model} semantic`}
                  stroke={MODEL_COLORS[model] ?? "#94a3b8"}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={{ r: 3, fill: MODEL_COLORS[model] ?? "#94a3b8" }}
                  connectNulls
                />
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Latency chart */}
      <div>
        <div className="text-xs text-gray-500 mb-2">Avg Generation Latency (ms)</div>
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={latencyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={{ stroke: "#334155" }} tickLine={false} width={48} tickFormatter={(v) => `${v}ms`} />
            <Tooltip formatter={(v) => [`${v}ms`, "Avg latency"]} contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "8px", fontSize: "11px" }} />
            <Line type="monotone" dataKey="avgMs" name="latency" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: "#0ea5e9" }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-model breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-600 pb-1.5 pr-3 font-normal">Level</th>
              {allModels.map((m) => (
                <React.Fragment key={m}>
                  <th className="text-left pb-1.5 pr-2 font-normal" style={{ color: MODEL_COLORS[m] }}>{m} exec</th>
                  <th className="text-left pb-1.5 pr-3 font-normal" style={{ color: MODEL_COLORS[m], opacity: 0.6 }}>{m} sem</th>
                </React.Fragment>
              ))}
              <th className="text-left text-gray-600 pb-1.5 font-normal">n</th>
            </tr>
          </thead>
          <tbody>
            {COMPLEXITY_META.map((m) => {
              const row   = chartData[m.level - 1];
              const count = logs.filter((l) => l.complexityLevel === m.level).length;
              return (
                <tr key={m.level} className="border-b border-gray-900">
                  <td className={`py-1 pr-3 ${m.color}`}>{row.level} {m.label}</td>
                  {allModels.map((model) => (
                    <React.Fragment key={model}>
                      <td className="py-1 pr-2 text-gray-300">{row[`${model}_exec`] != null ? `${row[`${model}_exec`]}%` : "—"}</td>
                      <td className="py-1 pr-3 text-gray-500">{row[`${model}_semantic`] != null ? `${row[`${model}_semantic`]}%` : "—"}</td>
                    </React.Fragment>
                  ))}
                  <td className="py-1 text-gray-700">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
