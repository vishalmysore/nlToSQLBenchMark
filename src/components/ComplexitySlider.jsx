import React from "react";
import { COMPLEXITY_META } from "../lib/complexityEngine.js";

const TIER_EXPLAINER = [
  {
    what: "Clean prompt",
    how: "The AI sees your exact table/column names with full REFERENCES annotations. This is the ideal scenario.",
    example: 'Table "customers" (\n  id INTEGER,\n  email VARCHAR\n);',
    impact: "Best performance — baseline",
    impactColor: "text-emerald-600",
  },
  {
    what: "Context flooding",
    how: "10 fake, randomly named tables injected alongside your real schema. The AI must ignore the noise.",
    example: 'Table "tbl_audit_log_v3_0" (\n  col_a_0 INTEGER,\n  col_b_0 VARCHAR\n);\n... (×10 more)',
    impact: "Moderate drop",
    impactColor: "text-yellow-600",
  },
  {
    what: "Name obfuscation",
    how: '"customers" → "tbl_cus_mstr_v2", "email" → "tbl_ema_nrm". No descriptions provided.',
    example: 'Table "tbl_cus_mstr_v2" (\n  tbl_id_nrm INTEGER,\n  tbl_ema_nrm VARCHAR\n);',
    impact: "Large drop",
    impactColor: "text-orange-600",
  },
  {
    what: "Snowflake explosion",
    how: "Each flat table splits into fact + dim + sub-dim. Simple queries now require 3–5 nested JOINs.",
    example: 'customers → customers\n           + dim_customers\n           + subdim_customers',
    impact: "Severe drop",
    impactColor: "text-red-600",
  },
  {
    what: "Column collision",
    how: 'All columns renamed to generic: "id", "date", "value", "name". Every table looks the same.',
    example: 'Table "customers" (id, date, value, name)\nTable "orders"    (id, date, value, name)',
    impact: "Critical failure zone",
    impactColor: "text-purple-600",
  },
];

export default function ComplexitySlider({ level, onChange }) {
  const meta     = COMPLEXITY_META[level - 1];
  const explainer = TIER_EXPLAINER[level - 1];

  return (
    <div className="panel flex flex-col gap-4">
      <div className="panel-header">Complexity Tier</div>

      {/* Tier buttons */}
      <div className="flex gap-1.5">
        {COMPLEXITY_META.map((m) => (
          <button
            key={m.level}
            onClick={() => onChange(m.level)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold border-2 transition-all ${
              level === m.level
                ? `${m.bg} ${m.border} ${m.color}`
                : "border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600"
            }`}
          >
            {m.level}
          </button>
        ))}
      </div>

      {/* Active tier card */}
      <div className={`rounded-xl border-2 p-4 space-y-3 ${meta.bg} ${meta.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            <span className={`text-sm font-bold ${meta.color}`}>L{meta.level}: {meta.label}</span>
          </div>
          <span className={`text-xs font-semibold ${explainer.impactColor}`}>{explainer.impact}</span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">{explainer.how}</p>

        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Example prompt snippet</div>
          <pre className={`text-[10px] font-mono rounded-lg px-3 py-2.5 bg-white border ${meta.border} whitespace-pre-wrap leading-relaxed ${meta.color}`}>
            {explainer.example}
          </pre>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-0.5">
        {COMPLEXITY_META.map((m, i) => (
          <button
            key={m.level}
            onClick={() => onChange(m.level)}
            className={`w-full flex items-center gap-2.5 text-left text-xs rounded-lg px-2.5 py-2 transition-all ${
              level === m.level
                ? `${m.bg} ${m.border} border`
                : "hover:bg-gray-50 border border-transparent"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
            <span className={`font-semibold shrink-0 ${level === m.level ? m.color : "text-gray-500"}`}>L{m.level}</span>
            <span className={`font-medium ${level === m.level ? m.color : "text-gray-600"}`}>{m.label}</span>
            <span className="text-gray-400 text-[10px] ml-auto truncate">{TIER_EXPLAINER[i].what}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
