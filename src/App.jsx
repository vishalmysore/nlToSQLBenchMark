import React, { useState, useCallback, useEffect } from "react";
import SchemaBuilder from "./components/SchemaBuilder.jsx";
import SchemaGraph from "./components/SchemaGraph.jsx";
import ComplexitySlider from "./components/ComplexitySlider.jsx";
import ModelSelector from "./components/ModelSelector.jsx";
import QueryPlayground from "./components/QueryPlayground.jsx";
import PromptViewer from "./components/PromptViewer.jsx";
import ExecutionLog from "./components/ExecutionLog.jsx";
import DegradationChart from "./components/DegradationChart.jsx";
import DataExplorer from "./components/DataExplorer.jsx";
import { useInferenceWorker } from "./hooks/useInferenceWorker.js";
import { generateSystemPrompt } from "./lib/complexityEngine.js";
import { initDuckDB, executeSQL, createTablesFromSchema } from "./lib/duckdb.js";
import { logQuery, getQueryLogs, clearLogs } from "./lib/storage.js";
import { DEMO_SCHEMAS, DOMAIN_QUERIES } from "./lib/demoSchemas.js";

const TABS = [
  { key: "build",     label: "Schema Builder" },
  { key: "bench",     label: "Benchmark" },
  { key: "analytics", label: "Analytics" },
];

function extractSQL(text) {
  if (!text) return "";

  // 1. Match ```<any-lang-tag or empty>\n...\n``` — handles ```sql, ```markdown, ```, etc.
  const fenceMatch = text.match(/```(?:\w+)?\s*\n([\s\S]+?)```/);
  if (fenceMatch) {
    let inner = fenceMatch[1].trim();
    // Strip a stray language word on the first line (e.g. model emits "markdown\nSELECT...")
    const lines = inner.split("\n");
    if (lines.length > 1 && /^[a-z]+$/i.test(lines[0].trim()) &&
        !/^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(lines[0].trim())) {
      inner = lines.slice(1).join("\n").trim();
    }
    return inner;
  }

  // 2. Find a bare SQL statement
  const sqlMatch = text.match(/((?:WITH|SELECT|INSERT|UPDATE|DELETE|CREATE)\b[\s\S]+?;)/i);
  if (sqlMatch) return sqlMatch[1].trim();

  return text.trim();
}

const DEFAULT_DOMAIN = "ecommerce";

// ── Tabbed ER Diagram + Data Explorer panel ───────────────────────────────────
function BuildCenterPanel({ schema, highlightedTable, duckdbReady }) {
  const [tab, setTab] = useState("er");
  return (
    <div className="panel flex flex-col h-full min-h-0 p-0 overflow-hidden">
      {/* Tab strip */}
      <div className="flex items-center border-b border-gray-200 px-4 pt-3 shrink-0">
        {[
          { key: "er",   label: "ER Diagram" },
          { key: "data", label: "Data Explorer" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-4 py-2 border-b-2 transition-all -mb-px ${
              tab === t.key
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "er" ? (
          <div className="p-4 h-full flex flex-col">
            <SchemaGraph schema={schema} highlightedTable={highlightedTable} />
          </div>
        ) : (
          <DataExplorer schema={schema} duckdbReady={duckdbReady} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab,       setActiveTab]       = useState("build");
  const [activeDomain,    setActiveDomain]    = useState(DEFAULT_DOMAIN);
  const [schema,          setSchema]          = useState(DEMO_SCHEMAS[DEFAULT_DOMAIN]);
  const [complexityLevel, setComplexityLevel] = useState(1);
  const [highlightedTable,setHighlightedTable]= useState(null);
  const [selectedModel,   setSelectedModel]   = useState(null);
  const [promptData,      setPromptData]      = useState({ systemPrompt: "", cleanDescription: "", obfuscatedDescription: "" });
  const [lastResult,      setLastResult]      = useState(null);
  const [logs,            setLogs]            = useState([]);
  const [duckdbReady,     setDuckdbReady]     = useState(false);
  const [duckdbError,     setDuckdbError]     = useState(null);

  const {
    modelState, loadedModel, downloadProgress, device, statusMsg, loadError, generating,
    loadModel, generate, dispose, cancelLoad,
  } = useInferenceWorker();

  // Init DuckDB
  useEffect(() => {
    initDuckDB()
      .then(() => setDuckdbReady(true))
      .catch((e) => setDuckdbError(e.message));
  }, []);

  // Recreate tables when schema changes
  useEffect(() => {
    if (!duckdbReady) return;
    createTablesFromSchema(schema).catch(() => {});
  }, [schema, duckdbReady]);

  // Recompute prompt whenever schema or complexity changes
  useEffect(() => {
    setPromptData(generateSystemPrompt(schema, complexityLevel));
  }, [schema, complexityLevel]);

  // Load persisted logs on mount
  useEffect(() => {
    getQueryLogs().then(setLogs).catch(() => {});
  }, []);

  // Switch domain → load that schema
  function handleDomainChange(key) {
    setActiveDomain(key);
    setSchema(DEMO_SCHEMAS[key]);
    setLastResult(null);
  }

  const handleRun = useCallback(async (query) => {
    const { systemPrompt } = generateSystemPrompt(schema, complexityLevel);
    let genResult;
    try {
      genResult = await generate(query, systemPrompt);
    } catch (err) {
      const entry = {
        query, complexityLevel, modelId: loadedModel ?? "none",
        genSuccess: false, execSuccess: false, error: err.message,
        sql: null, elapsedMs: 0, tokensPerSec: 0, timestamp: Date.now(),
      };
      setLogs((prev) => [entry, ...prev]);
      await logQuery(entry);
      setLastResult({ generatedText: null, error: err.message });
      return;
    }

    const rawSQL     = extractSQL(genResult.generatedText);
    const genSuccess = /SELECT|WITH/i.test(rawSQL);

    let execution = { success: false, error: "No valid SQL generated", rows: [], schema: [] };
    if (duckdbReady && genSuccess) {
      execution = await executeSQL(rawSQL);
    }

    const entry = {
      query, complexityLevel,
      modelId: genResult.modelId ?? loadedModel,
      genSuccess, execSuccess: execution.success,
      sql: rawSQL, error: execution.error,
      elapsedMs: genResult.elapsedMs ?? 0,
      tokensPerSec: genResult.tokensPerSec ?? 0,
      timestamp: Date.now(),
    };
    setLastResult({ ...genResult, execution });
    setLogs((prev) => [entry, ...prev]);
    await logQuery(entry);
  }, [schema, complexityLevel, generate, loadedModel, selectedModel, duckdbReady]);

  async function handleClearLogs() {
    await clearLogs();
    setLogs([]);
  }

  const domainQueries = DOMAIN_QUERIES[activeDomain] ?? DOMAIN_QUERIES.ecommerce;

  // Shared sidebar panels
  const leftSidebar = (
    <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
      <ComplexitySlider level={complexityLevel} onChange={setComplexityLevel} />
      <ModelSelector
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        modelState={modelState}
        loadedModel={loadedModel}
        downloadProgress={downloadProgress}
        device={device}
        statusMsg={statusMsg}
        loadError={loadError}
        onLoad={(key) => loadModel(key)}
        onDispose={dispose}
        onCancelLoad={cancelLoad}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-sm">N</div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-none">NL2SQL Benchmark</h1>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Schema Complexity Simulator</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${duckdbReady ? "bg-emerald-500" : duckdbError ? "bg-red-500" : "bg-yellow-400 animate-pulse"}`} />
              <span className="text-gray-500">DuckDB {duckdbReady ? "ready" : duckdbError ? "error" : "loading"}</span>
            </div>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                  activeTab === tab.key ? "bg-white text-gray-900 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden p-3">

        {/* Schema Builder tab */}
        {activeTab === "build" && (
          <div className="flex gap-3 h-full">
            <div className="w-72 shrink-0 overflow-y-auto">
              <div className="panel h-full">
                <SchemaBuilder
                  schema={schema}
                  onChange={setSchema}
                  onHighlight={setHighlightedTable}
                  highlightedTable={highlightedTable}
                  activeDomain={activeDomain}
                  onDomainChange={handleDomainChange}
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <BuildCenterPanel
                schema={schema}
                highlightedTable={highlightedTable}
                duckdbReady={duckdbReady}
              />
            </div>
            <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
              <ComplexitySlider level={complexityLevel} onChange={setComplexityLevel} />
            </div>
          </div>
        )}

        {/* Benchmark tab */}
        {activeTab === "bench" && (
          <div className="flex gap-3 h-full">
            {leftSidebar}
            <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto">
              <QueryPlayground
                onRun={handleRun}
                generating={generating}
                modelState={modelState}
                lastResult={lastResult}
                exampleQueries={domainQueries}
                domainLabel={DEMO_SCHEMAS[activeDomain]?.label ?? ""}
              />
              <div className="flex-1 min-h-[280px]">
                <PromptViewer
                  cleanDescription={promptData.cleanDescription}
                  obfuscatedDescription={promptData.obfuscatedDescription}
                  systemPrompt={promptData.systemPrompt}
                  rawResponse={lastResult?.generatedText ?? null}
                />
              </div>
            </div>
            <div className="w-80 shrink-0 overflow-hidden">
              <ExecutionLog logs={logs} onLogsChange={setLogs} onClear={handleClearLogs} />
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {activeTab === "analytics" && (
          <div className="flex gap-3 h-full overflow-y-auto">
            <div className="flex-1 flex flex-col gap-3">
              <DegradationChart logs={logs} />
            </div>
            <div className="w-80 shrink-0">
              <ExecutionLog logs={logs} onLogsChange={setLogs} onClear={handleClearLogs} />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
