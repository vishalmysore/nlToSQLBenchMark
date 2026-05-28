import React, { useState, useCallback, useRef } from "react";
import { executeSQL, createTablesFromSchema } from "../lib/duckdb.js";

// ── CSV helpers ────────────────────────────────────────────────────────────────
function rowsToCSV(schema, rows) {
  const header = schema.join(",");
  const lines  = rows.map((row) =>
    schema.map((col) => {
      const v = row[col];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

function csvToRows(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
  return { headers, rows };
}

// ── Table result component ─────────────────────────────────────────────────────
function ResultTable({ schema, rows, maxRows = 200 }) {
  if (!schema?.length) return null;
  const display = rows.slice(0, maxRows);
  return (
    <div className="overflow-auto rounded-xl border border-gray-200 max-h-64">
      <table className="text-xs font-mono w-full min-w-max">
        <thead className="sticky top-0">
          <tr className="bg-gray-50 border-b border-gray-200">
            {schema.map((col) => (
              <th key={col} className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
              {schema.map((col) => (
                <td key={col} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                  {row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="text-[10px] text-gray-400 px-3 py-1.5 border-t border-gray-100 bg-gray-50">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DataExplorer({ schema, duckdbReady, onSchemaReload }) {
  const [sql,       setSql]       = useState("SELECT * FROM customers LIMIT 10;");
  const [result,    setResult]    = useState(null);
  const [running,   setRunning]   = useState(false);
  const [activeTab, setActiveTab] = useState("query");   // "query" | "upload"
  const [uploadMsg, setUploadMsg] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  const tables = schema?.tables ?? [];

  // ── Run query ─────────────────────────────────────────────────────────────
  async function runQuery() {
    if (!duckdbReady || !sql.trim()) return;
    setRunning(true);
    setResult(null);
    const r = await executeSQL(sql);
    setResult(r);
    setRunning(false);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runQuery();
  }

  // ── Quick query helpers ────────────────────────────────────────────────────
  function quickSelect(tableName) {
    setSql(`SELECT * FROM "${tableName}" LIMIT 20;`);
    setActiveTab("query");
  }

  // ── Download sample CSV for a table ──────────────────────────────────────
  async function downloadCSV(tableName) {
    const r = await executeSQL(`SELECT * FROM "${tableName}";`);
    if (!r.success || !r.rows.length) return;
    const csv  = rowsToCSV(r.schema, r.rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${tableName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAllCSV() {
    for (const t of tables) await downloadCSV(t.name);
  }

  // ── Upload CSV ────────────────────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg(null);
    setUploadErr(null);

    const tableName = file.name.replace(/\.csv$/i, "").replace(/[^a-zA-Z0-9_]/g, "_");
    const text = await file.text();
    const { headers, rows } = csvToRows(text);
    if (!headers.length) { setUploadErr("Could not parse CSV — check the file format."); return; }

    // Drop & recreate table
    await executeSQL(`DROP TABLE IF EXISTS "${tableName}";`);
    const colDefs = headers.map((h) => `"${h}" VARCHAR`).join(", ");
    const createRes = await executeSQL(`CREATE TABLE "${tableName}" (${colDefs});`);
    if (!createRes.success) { setUploadErr(`Create failed: ${createRes.error}`); return; }

    // Insert rows in batches
    let inserted = 0;
    for (const row of rows) {
      const vals = headers.map((h) => {
        const v = row[h];
        return v === "" || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
      }).join(", ");
      const r = await executeSQL(`INSERT INTO "${tableName}" VALUES (${vals});`);
      if (r.success) inserted++;
    }

    setUploadMsg(`✓ Loaded "${tableName}" — ${inserted}/${rows.length} rows inserted. Run: SELECT * FROM "${tableName}";`);
    setSql(`SELECT * FROM "${tableName}" LIMIT 20;`);
    setActiveTab("query");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-200 px-4 pt-3 shrink-0 bg-white rounded-t-xl">
        {[
          { key: "query",  label: "SQL Query" },
          { key: "tables", label: "Tables" },
          { key: "upload", label: "Import / Export" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`text-xs font-medium px-4 py-2 border-b-2 transition-all -mb-px ${
              activeTab === t.key
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 pb-2">
          <span className={`w-1.5 h-1.5 rounded-full ${duckdbReady ? "bg-emerald-500" : "bg-amber-400 animate-pulse"}`} />
          <span className="text-[10px] text-gray-400">DuckDB {duckdbReady ? "ready" : "loading"}</span>
        </div>
      </div>

      {/* ── SQL Query tab ─────────────────────────────────────────────────── */}
      {activeTab === "query" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 p-4">
          {/* Quick table buttons */}
          {tables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => quickSelect(t.name)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition-all font-mono"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* Editor */}
          <div className="relative shrink-0">
            <textarea
              className="w-full font-mono text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 leading-relaxed"
              rows={5}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SELECT * FROM customers LIMIT 10;"
              spellCheck={false}
            />
            <div className="absolute bottom-2.5 right-3 text-[10px] text-gray-300 pointer-events-none">
              Ctrl+Enter to run
            </div>
          </div>

          {/* Run button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn-primary text-sm px-5 flex items-center gap-2"
              onClick={runQuery}
              disabled={!duckdbReady || running || !sql.trim()}
            >
              {running ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Running…</span></>
              ) : "▶ Run"}
            </button>
            {result && (
              <span className="text-xs text-gray-400">
                {result.success
                  ? <span className="text-emerald-600 font-medium">✓ {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}</span>
                  : <span className="text-red-500 font-medium">✗ Error</span>
                }
              </span>
            )}
            {result?.success && result.rows.length > 0 && (
              <button
                onClick={() => {
                  const csv  = rowsToCSV(result.schema, result.rows);
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a");
                  a.href = url; a.download = "query_result.csv"; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="ml-auto text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-1.5"
              >
                ⬇ Export CSV
              </button>
            )}
          </div>

          {/* Error */}
          {result && !result.success && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-mono shrink-0">
              {result.error}
            </div>
          )}

          {/* Results */}
          {result?.success && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {result.rows.length === 0 ? (
                <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-6 text-center">
                  Query executed successfully — no rows returned.
                </div>
              ) : (
                <ResultTable schema={result.schema} rows={result.rows} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tables tab ────────────────────────────────────────────────────── */}
      {activeTab === "tables" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tables.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-10">No tables defined. Build a schema first.</div>
          ) : tables.map((table) => (
            <TableCard key={table.name} table={table} onQuery={quickSelect} onDownload={downloadCSV} />
          ))}
        </div>
      )}

      {/* ── Import / Export tab ───────────────────────────────────────────── */}
      {activeTab === "upload" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Export section */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">Export Sample Data</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Download current table data as CSV files</div>
              </div>
              <button
                onClick={downloadAllCSV}
                disabled={tables.length === 0}
                className="text-xs btn-primary px-3 py-1.5 flex items-center gap-1.5"
              >
                ⬇ Download All
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {tables.length === 0 ? (
                <div className="text-xs text-gray-400 px-4 py-6 text-center">No tables to export.</div>
              ) : tables.map((t) => (
                <div key={t.name} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-xs font-mono font-semibold text-gray-700">{t.name}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{t.columns.length} columns</span>
                  </div>
                  <button
                    onClick={() => downloadCSV(t.name)}
                    className="text-[11px] text-sky-600 border border-sky-200 bg-sky-50 rounded-lg px-2.5 py-1 hover:bg-sky-100 transition-all flex items-center gap-1"
                  >
                    ⬇ CSV
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Import section */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="text-sm font-semibold text-gray-800">Import CSV</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Upload a CSV file — first row must be column headers. Table name will match the file name.
              </div>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl px-6 py-8 cursor-pointer hover:border-sky-300 hover:bg-sky-50/30 transition-all group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📂</span>
                <span className="text-sm font-medium text-gray-600 group-hover:text-sky-700">Click to choose a CSV file</span>
                <span className="text-[11px] text-gray-400 mt-1">or drag and drop</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {uploadMsg && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  {uploadMsg}
                </div>
              )}
              {uploadErr && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-mono">
                  {uploadErr}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1">
                <div className="text-[11px] font-semibold text-amber-700">CSV format requirements</div>
                <ul className="text-[11px] text-amber-600 space-y-0.5 list-disc list-inside">
                  <li>First row = column headers</li>
                  <li>Comma separated, UTF-8 encoded</li>
                  <li>File name becomes the table name (e.g. <code className="font-mono">orders.csv</code> → <code className="font-mono">orders</code> table)</li>
                  <li>All columns imported as VARCHAR — use SQL CAST to convert types</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table card (Tables tab) ────────────────────────────────────────────────────
function TableCard({ table, onQuery, onDownload }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  async function loadPreview() {
    if (preview) { setOpen(!open); return; }
    setLoading(true);
    const r = await executeSQL(`SELECT * FROM "${table.name}" LIMIT 5;`);
    setPreview(r);
    setLoading(false);
    setOpen(true);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-gray-800">{table.name}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 border border-gray-200">
            {table.columns.length} cols
          </span>
          <div className="flex gap-1 flex-wrap">
            {table.columns.map((c) => (
              <span key={c.name} className="text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                {c.name} <span className="text-gray-300">{c.type}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={loadPreview}
            className="text-[11px] text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-all"
          >
            {loading ? "…" : open ? "Hide" : "Preview"}
          </button>
          <button
            onClick={() => onQuery(table.name)}
            className="text-[11px] text-sky-600 border border-sky-200 bg-sky-50 rounded-lg px-2.5 py-1 hover:bg-sky-100 transition-all"
          >
            Query
          </button>
          <button
            onClick={() => onDownload(table.name)}
            className="text-[11px] text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 transition-all"
          >
            ⬇
          </button>
        </div>
      </div>
      {open && preview && (
        <div className="border-t border-gray-100 px-4 pb-3">
          {preview.success && preview.rows.length > 0
            ? <ResultTable schema={preview.schema} rows={preview.rows} maxRows={5} />
            : <div className="text-xs text-gray-400 py-2 text-center">{preview.success ? "No rows yet." : preview.error}</div>
          }
        </div>
      )}
    </div>
  );
}
