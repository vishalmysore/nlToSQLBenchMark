import React, { useState, useMemo } from "react";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";

// ── Parse the full model registry into brand → [{ base, label, variants[] }] ─
const BRAND_CONFIG = [
  { key: "qwen",      label: "Qwen",      color: "text-purple-600",  bg: "bg-purple-50  border-purple-200", dot: "bg-purple-500",
    match: (id) => /qwen/i.test(id) },
  { key: "llama",     label: "Llama",     color: "text-blue-600",    bg: "bg-blue-50    border-blue-200",   dot: "bg-blue-500",
    match: (id) => /llama/i.test(id) && !/hermes/i.test(id) },
  { key: "deepseek",  label: "DeepSeek",  color: "text-teal-600",    bg: "bg-teal-50    border-teal-200",   dot: "bg-teal-500",
    match: (id) => /deepseek/i.test(id) },
  { key: "gemma",     label: "Gemma",     color: "text-red-600",     bg: "bg-red-50     border-red-200",    dot: "bg-red-500",
    match: (id) => /gemma/i.test(id) },
  { key: "phi",       label: "Phi",       color: "text-sky-600",     bg: "bg-sky-50     border-sky-200",    dot: "bg-sky-500",
    match: (id) => /phi/i.test(id) },
  { key: "mistral",   label: "Mistral",   color: "text-orange-600",  bg: "bg-orange-50  border-orange-200", dot: "bg-orange-500",
    match: (id) => /mistral|ministral/i.test(id) },
  { key: "smollm",    label: "SmolLM",    color: "text-green-600",   bg: "bg-green-50   border-green-200",  dot: "bg-green-500",
    match: (id) => /smollm/i.test(id) },
  { key: "other",     label: "Other",     color: "text-gray-600",    bg: "bg-gray-50    border-gray-200",   dot: "bg-gray-400",
    match: () => true },
];

function getBrand(modelId) {
  for (const b of BRAND_CONFIG) {
    if (b.key !== "other" && b.match(modelId)) return b.key;
  }
  return "other";
}

function stripBase(modelId) {
  return modelId
    .replace(/-q[0-9]f[0-9]+_[0-9]+-MLC.*/i, "")
    .replace(/-q0f[0-9]+-MLC.*/i, "")
    .replace(/-MLC$/i, "");
}

function getQuant(modelId) {
  const m = modelId.match(/-((q[0-9]f[0-9]+(?:_[0-9]+)?)|q0f[0-9]+)(-MLC|-1k-MLC)?/i);
  if (!m) return modelId;
  let q = m[1];
  if (modelId.includes("-1k")) q += " 1k";
  return q;
}

function friendlyLabel(base) {
  return base
    .replace(/-Instruct$/i, " Instruct")
    .replace(/-instruct$/i, " Instruct")
    .replace(/-chat-hf$/i, "")
    .replace(/-it$/i, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vramColor(mb) {
  if (!mb) return "text-gray-400";
  if (mb < 2000)  return "text-emerald-600";
  if (mb < 5000)  return "text-amber-600";
  if (mb < 10000) return "text-orange-600";
  return "text-red-600";
}

function buildRegistry() {
  const raw = prebuiltAppConfig.model_list;
  // base → { label, brand, variants: [{id, quant, vramMB}] }
  const map = new Map();

  raw.forEach((m) => {
    if (/embed|arctic/i.test(m.model_id)) return;
    const base  = stripBase(m.model_id);
    const quant = getQuant(m.model_id);
    const brand = getBrand(m.model_id);

    if (!map.has(base)) {
      map.set(base, { base, label: friendlyLabel(base), brand, variants: [] });
    }
    map.get(base).variants.push({
      id:     m.model_id,
      quant,
      vramMB: m.vram_required_MB ?? 0,
      vramGB: m.vram_required_MB ? (m.vram_required_MB / 1024).toFixed(1) : "?",
    });
  });

  // Sort variants: q4f16_1 first, then q4f32_1, then others; 1k last
  map.forEach((entry) => {
    entry.variants.sort((a, b) => {
      const score = (id) => {
        if (id.includes("1k")) return 99;
        if (id.includes("q4f16_1")) return 0;
        if (id.includes("q4f32_1")) return 1;
        if (id.includes("q4f16")) return 2;
        if (id.includes("q4f32")) return 3;
        return 10;
      };
      return score(a.id) - score(b.id);
    });
  });

  return Array.from(map.values());
}

const REGISTRY = buildRegistry();

const PHASES = {
  idle:     { icon: "○", color: "text-gray-400"   },
  download: { icon: "⬇", color: "text-sky-500"    },
  compile:  { icon: "⚙", color: "text-amber-500"  },
  ready:    { icon: "●", color: "text-emerald-500" },
  error:    { icon: "✕", color: "text-red-500"     },
};

function ProgressBar({ pct, shimmer = false }) {
  if (shimmer) return <div className="shimmer h-1.5 rounded-full w-full" />;
  return (
    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function ModelSelector({
  selectedModel, onSelectModel,
  modelState, loadedModel,
  downloadProgress, statusMsg, loadError,
  onLoad, onDispose, onCancelLoad,
}) {
  const [search,      setSearch]      = useState("");
  const [activeBrand, setActiveBrand] = useState("all");
  const [expanded,    setExpanded]    = useState({});   // base → bool
  const [showPicker,  setShowPicker]  = useState(false);

  const isBusy  = modelState === "loading" || modelState === "compiling";
  const isReady = modelState === "ready";
  const isError = modelState === "error";
  const isIdle  = !isBusy && !isReady && !isError;

  const step = isReady ? "ready" : modelState === "compiling" ? "compile" : modelState === "loading" ? "download" : "idle";
  const ph   = PHASES[step];

  // Progress
  const progFiles   = Object.values(downloadProgress);
  const totalLoaded = progFiles.reduce((s, f) => s + (f.loaded ?? 0), 0);
  const totalBytes  = progFiles.reduce((s, f) => s + (f.total  ?? 0), 0);
  const textPcts    = progFiles.map((f) => f.progress ?? 0);
  const displayPct  = totalBytes > 0
    ? Math.round((totalLoaded / totalBytes) * 100)
    : textPcts.length ? Math.round(textPcts.reduce((a, b) => a + b, 0) / textPcts.length) : 0;

  // Selected info
  const selectedEntry   = REGISTRY.find((e) => e.variants.some((v) => v.id === selectedModel));
  const selectedVariant = selectedEntry?.variants.find((v) => v.id === selectedModel);

  // Filtered registry
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REGISTRY.filter((e) => {
      if (activeBrand !== "all" && e.brand !== activeBrand) return false;
      if (q && !e.label.toLowerCase().includes(q) && !e.brand.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, activeBrand]);

  // Brands that actually have models after search
  const presentBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    const s = new Set(REGISTRY
      .filter((e) => !q || e.label.toLowerCase().includes(q) || e.brand.toLowerCase().includes(q))
      .map((e) => e.brand)
    );
    return BRAND_CONFIG.filter((b) => s.has(b.key));
  }, [search]);

  function toggleExpand(base) {
    setExpanded((p) => ({ ...p, [base]: !p[base] }));
  }

  function selectVariant(variantId) {
    onSelectModel(variantId);
    setShowPicker(false);
  }

  return (
    <div className="panel flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="panel-header mb-0">Inference Engine</span>
        {isReady && (
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">live</span>
        )}
        {isIdle && (
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">idle</span>
        )}
      </div>

      {/* Status banner */}
      <div className={`rounded-xl border px-3 py-2.5 space-y-2 transition-colors ${
        isReady ? "border-emerald-200 bg-emerald-50" :
        isBusy  ? "border-sky-200 bg-sky-50"         :
        isError ? "border-red-200 bg-red-50"          :
                  "border-gray-200 bg-gray-50"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-base leading-none ${ph.color} ${isBusy ? "animate-pulse" : ""}`}>{ph.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-800 truncate">
              {isReady ? loadedModel?.replace(/-q[0-9]f.*/, "").replace(/-/g, " ") :
               isBusy  ? `${modelState === "compiling" ? "Compiling" : "Downloading"} model…` :
               isError ? "Load failed — try again" :
                         "No model loaded"}
            </div>
            {isReady && <div className="text-[10px] text-gray-400 mt-0.5">⚡ WebGPU accelerated</div>}
            {isIdle && (
              <div className="text-[10px] text-gray-400 mt-0.5">Select and load a model to start</div>
            )}
          </div>
        </div>

        {isError && loadError && (
          <div className="text-[10px] text-red-600 bg-red-50 rounded-lg px-2.5 py-2 border border-red-200 font-mono break-all">{loadError}</div>
        )}

        {modelState === "loading" && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Fetching model weights…</span>
              {displayPct > 0 && <span className="font-mono">{displayPct}%</span>}
            </div>
            <ProgressBar pct={displayPct} shimmer={displayPct === 0} />
          </div>
        )}

        {modelState === "compiling" && (
          <div className="space-y-1.5">
            <ProgressBar shimmer />
            <p className="text-[10px] text-amber-600">⚡ Compiling WebGPU shaders (1–5 min first load, cached after)</p>
          </div>
        )}
      </div>

      {/* Unload */}
      {isReady && (
        <button className="btn-danger w-full text-xs" onClick={onDispose}>Unload model</button>
      )}

      {/* Model picker trigger */}
      {!isReady && !isBusy && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white hover:border-sky-300 hover:bg-sky-50/50 transition-all text-left"
          >
            <div className="flex-1 min-w-0">
              {selectedEntry ? (
                <>
                  <div className="text-xs font-semibold text-gray-800 truncate">{selectedEntry.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                    <span className="capitalize">{selectedEntry.brand}</span>
                    {selectedVariant && (
                      <span className={`font-mono font-medium ${vramColor(selectedVariant.vramMB)}`}>
                        {selectedVariant.quant} · {selectedVariant.vramGB} GB
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400">Select a model…</div>
              )}
            </div>
            <span className="text-gray-400 text-sm">⌄</span>
          </button>

          <button
            className="btn-primary w-full text-sm"
            onClick={() => selectedModel && onLoad(selectedModel)}
            disabled={!selectedModel}
          >
            Load Model
          </button>

          <p className="text-[9px] text-gray-400 text-center">
            Powered by <strong className="text-gray-500">WebLLM</strong> · 100% in browser via WebGPU · no server needed
          </p>
        </div>
      )}

      {/* Cancel during busy */}
      {isBusy && (
        <button onClick={onCancelLoad} className="btn-ghost w-full text-xs">Cancel load</button>
      )}

      {/* ── Model Picker Modal ─────────────────────────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Model Selection</h2>
              <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1">×</button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 space-y-2.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
                <input
                  className="input text-sm pl-8"
                  placeholder="Search model…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Brand chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveBrand("all")}
                  className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-all ${
                    activeBrand === "all"
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  All
                </button>
                {presentBrands.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => setActiveBrand(activeBrand === b.key ? "all" : b.key)}
                    className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                      activeBrand === b.key
                        ? `${b.bg} border-current`
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    } ${activeBrand === b.key ? b.color : ""}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model grid */}
            <div className="overflow-y-auto flex-1 p-4">
              <div className="grid grid-cols-3 gap-2.5">
                {filtered.map((entry) => {
                  const isOpen   = !!expanded[entry.base];
                  const isActive = selectedEntry?.base === entry.base;
                  return (
                    <div
                      key={entry.base}
                      className={`rounded-xl border transition-all ${
                        isActive ? "border-sky-400 ring-2 ring-sky-100" : "border-gray-200 hover:border-gray-300"
                      } bg-white`}
                    >
                      {/* Card header */}
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        onClick={() => toggleExpand(entry.base)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${BRAND_CONFIG.find((b) => b.key === entry.brand)?.dot ?? "bg-gray-400"}`} />
                          <span className="text-xs font-semibold text-gray-800 truncate leading-tight">{entry.label}</span>
                        </div>
                        <span className="text-gray-400 text-xs shrink-0 ml-1">{isOpen ? "∧" : "∨"}</span>
                      </button>

                      {/* Variants */}
                      {isOpen && (
                        <div className="border-t border-gray-100 px-2 pb-2 pt-1 space-y-0.5">
                          {entry.variants.map((v) => {
                            const sel = selectedModel === v.id;
                            return (
                              <button
                                key={v.id}
                                onClick={() => selectVariant(v.id)}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                                  sel
                                    ? "bg-sky-50 border border-sky-300"
                                    : "hover:bg-gray-50 border border-transparent"
                                }`}
                              >
                                <span className={`text-[11px] font-mono font-medium ${sel ? "text-sky-700" : "text-gray-700"}`}>
                                  {v.quant}
                                </span>
                                <span className={`text-[10px] font-mono ${vramColor(v.vramMB)}`}>{v.vramGB} GB</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-12">No models match your search.</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &lt;2 GB — fast</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 2–5 GB — medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;5 GB — large</span>
              </div>
              <span>{REGISTRY.length} models · {REGISTRY.reduce((s, e) => s + e.variants.length, 0)} variants</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
