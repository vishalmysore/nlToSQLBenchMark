import React, { useState } from "react";
import { DEMO_SCHEMAS } from "../lib/demoSchemas.js";

const DEFAULT_TYPES = ["INTEGER","VARCHAR","TEXT","BOOLEAN","FLOAT","DECIMAL","TIMESTAMP","DATE","BIGINT"];

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function SchemaBuilder({ schema, onChange, onHighlight, highlightedTable, activeDomain, onDomainChange }) {
  const [expandedTable, setExpandedTable] = useState(null);
  const tables = schema?.tables ?? [];

  function updateTable(tableId, updates) {
    onChange({ ...schema, tables: tables.map((t) => (t.id === tableId ? { ...t, ...updates } : t)) });
  }
  function addTable() {
    const t = { id: uid(), name: `table_${tables.length + 1}`, columns: [{ id: uid(), name: "id", type: "INTEGER", isForeignKey: false, refTable: "", refColumn: "" }] };
    onChange({ ...schema, tables: [...tables, t] });
    setExpandedTable(t.id);
  }
  function removeTable(tableId) {
    onChange({ ...schema, tables: tables.filter((t) => t.id !== tableId) });
  }
  function addColumn(tableId) {
    const table = tables.find((t) => t.id === tableId);
    const c = { id: uid(), name: `col_${table.columns.length + 1}`, type: "VARCHAR", isForeignKey: false, refTable: "", refColumn: "" };
    updateTable(tableId, { columns: [...table.columns, c] });
  }
  function updateColumn(tableId, colId, updates) {
    const table = tables.find((t) => t.id === tableId);
    updateTable(tableId, { columns: table.columns.map((c) => (c.id === colId ? { ...c, ...updates } : c)) });
  }
  function removeColumn(tableId, colId) {
    const table = tables.find((t) => t.id === tableId);
    updateTable(tableId, { columns: table.columns.filter((c) => c.id !== colId) });
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Domain selector */}
      <div>
        <div className="panel-header">Schema Builder</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {Object.entries(DEMO_SCHEMAS).map(([key, def]) => (
            <button
              key={key}
              onClick={() => onDomainChange(key)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                activeDomain === key
                  ? "border-sky-400 bg-sky-50 text-sky-700 font-medium"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
        {activeDomain && DEMO_SCHEMAS[activeDomain] && (
          <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">{DEMO_SCHEMAS[activeDomain].description}</p>
        )}
        <div className="flex justify-end">
          <button className="btn-primary text-xs" onClick={addTable}>+ Table</button>
        </div>
      </div>

      {tables.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Select a domain above or click <strong className="text-gray-600">+ Table</strong>.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tables.map((table) => {
          const isExpanded    = expandedTable === table.id;
          const isHighlighted = highlightedTable === table.id || highlightedTable === table.name;
          return (
            <div
              key={table.id}
              className={`rounded-xl border transition-all ${
                isHighlighted
                  ? "border-sky-400 bg-sky-50/60 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div
                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                onClick={() => setExpandedTable(isExpanded ? null : table.id)}
                onMouseEnter={() => onHighlight?.(table.name)}
                onMouseLeave={() => onHighlight?.(null)}
              >
                <span className="text-gray-400 text-xs w-3">{isExpanded ? "▾" : "▸"}</span>
                <input
                  className="input flex-1 text-sm font-mono py-0.5 h-7 bg-transparent border-0 focus:ring-1 focus:ring-sky-300 rounded px-1"
                  value={table.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateTable(table.id, { name: e.target.value })}
                />
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                  {table.columns.length} cols
                </span>
                <button
                  className="text-gray-300 hover:text-red-400 text-xs px-1 transition-colors"
                  onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
                >✕</button>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 px-3 py-2.5 space-y-2">
                  {table.columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-1.5">
                      <input
                        className="input flex-1 text-xs font-mono py-1 h-7"
                        value={col.name}
                        placeholder="column"
                        onChange={(e) => updateColumn(table.id, col.id, { name: e.target.value })}
                      />
                      <select
                        className="select text-xs py-1 h-7 w-28"
                        value={col.type}
                        onChange={(e) => updateColumn(table.id, col.id, { type: e.target.value })}
                      >
                        {DEFAULT_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                      <button
                        title="Toggle FK"
                        className={`text-xs px-1.5 h-7 rounded-lg border font-medium transition-colors ${
                          col.isForeignKey
                            ? "border-sky-300 bg-sky-50 text-sky-600"
                            : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                        }`}
                        onClick={() => updateColumn(table.id, col.id, { isForeignKey: !col.isForeignKey })}
                      >
                        FK
                      </button>
                      {col.isForeignKey && (
                        <>
                          <select
                            className="select text-xs py-1 h-7 w-24"
                            value={col.refTable}
                            onChange={(e) => updateColumn(table.id, col.id, { refTable: e.target.value })}
                          >
                            <option value="">→ table</option>
                            {tables.filter((t) => t.id !== table.id).map((t) => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          <input
                            className="input text-xs py-1 h-7 w-16"
                            placeholder="col"
                            value={col.refColumn}
                            onChange={(e) => updateColumn(table.id, col.id, { refColumn: e.target.value })}
                          />
                        </>
                      )}
                      <button
                        className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                        onClick={() => removeColumn(table.id, col.id)}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    className="btn-ghost text-xs w-full mt-1 h-7"
                    onClick={() => addColumn(table.id)}
                  >
                    + Column
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
