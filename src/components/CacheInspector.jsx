import React, { useState, useEffect, useCallback } from "react";

const MODEL_KEYS = {
  tinyllama:  "onnx-community/TinyLlama-1.1B-Chat-v1.0",
  qwen_coder: "onnx-community/Qwen2.5-Coder-1.5B-Instruct",
  phi3_mini:  "onnx-community/Phi-3-mini-4k-instruct",
};

function fmt(bytes) {
  if (bytes == null) return "—";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

async function scanCaches() {
  if (!("caches" in window)) return null;

  const results = {};
  for (const [key, modelId] of Object.entries(MODEL_KEYS)) {
    results[key] = { files: [], totalBytes: 0 };
  }

  let cacheNames = [];
  try { cacheNames = await caches.keys(); } catch (_) { return null; }

  for (const name of cacheNames) {
    try {
      const cache  = await caches.open(name);
      const reqs   = await cache.keys();

      for (const req of reqs) {
        const url = req.url;
        for (const [key, modelId] of Object.entries(MODEL_KEYS)) {
          if (url.includes(modelId) || url.includes(modelId.split("/")[1])) {
            const res  = await cache.match(req);
            let size   = null;
            if (res) {
              const cl = res.headers.get("content-length");
              if (cl) {
                size = parseInt(cl, 10);
              } else {
                // Clone and count bytes
                try {
                  const buf = await res.clone().arrayBuffer();
                  size = buf.byteLength;
                } catch (_) {}
              }
            }
            const filename = url.split("/").at(-1).split("?")[0];
            results[key].files.push({ filename, url, size, cacheName: name });
            if (size) results[key].totalBytes += size;
            break;
          }
        }
      }
    } catch (_) {}
  }

  return results;
}

async function deleteModelCache(modelId) {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    const reqs  = await cache.keys();
    for (const req of reqs) {
      if (req.url.includes(modelId) || req.url.includes(modelId.split("/")[1])) {
        await cache.delete(req);
      }
    }
  }
}

const MODEL_SIZES = {
  tinyllama:  650 * 1e6,
  qwen_coder: 950 * 1e6,
  phi3_mini:  2300 * 1e6,
};

const MODEL_LABELS = {
  tinyllama:  "TinyLlama 1.1B",
  qwen_coder: "Qwen2.5-Coder 1.5B",
  phi3_mini:  "Phi-3 Mini 3.8B",
};

export default function CacheInspector({ onClose }) {
  const [cacheData,  setCacheData]  = useState(null);   // null = loading
  const [scanning,   setScanning]   = useState(true);
  const [clearing,   setClearing]   = useState(null);   // modelKey being cleared
  const [supported,  setSupported]  = useState(true);

  const scan = useCallback(async () => {
    setScanning(true);
    const data = await scanCaches();
    if (data === null) setSupported(false);
    setCacheData(data);
    setScanning(false);
  }, []);

  useEffect(() => { scan(); }, []);

  async function handleClear(key) {
    setClearing(key);
    await deleteModelCache(MODEL_KEYS[key]);
    await scan();
    setClearing(null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Model Cache Inspector</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Browser Cache Storage — models persist across page reloads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scan} className="btn-ghost text-xs h-7 px-2.5" disabled={scanning}>
              {scanning ? "Scanning…" : "↻ Refresh"}
            </button>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-lg leading-none px-1">×</button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!supported && (
            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 text-xs text-yellow-400">
              Cache Storage API not available in this browser/context.
              Models are re-downloaded on each session.
            </div>
          )}

          {scanning && (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="shimmer h-16 rounded-lg" />
              ))}
            </div>
          )}

          {!scanning && cacheData && Object.entries(MODEL_LABELS).map(([key, label]) => {
            const info       = cacheData[key];
            const fileCount  = info.files.length;
            const cached     = fileCount > 0;
            const approxSize = MODEL_SIZES[key];
            const pct        = info.totalBytes > 0
              ? Math.min(100, Math.round((info.totalBytes / approxSize) * 100))
              : 0;

            return (
              <div
                key={key}
                className={`rounded-lg border p-3.5 space-y-2 ${
                  cached
                    ? "border-emerald-800/60 bg-emerald-950/20"
                    : "border-gray-700 bg-gray-800/30"
                }`}
              >
                {/* Model header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cached ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <span className="text-sm font-medium text-gray-100">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cached && (
                      <span className="tag tag-green text-[10px]">
                        {fmt(info.totalBytes)} cached
                      </span>
                    )}
                    {!cached && (
                      <span className="tag tag-gray text-[10px]">not cached</span>
                    )}
                  </div>
                </div>

                {/* Progress bar toward expected size */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                    <span>{fmt(info.totalBytes)} / ~{fmt(approxSize)} expected</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cached ? "bg-emerald-500" : "bg-gray-700"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* File list */}
                {cached && (
                  <div className="space-y-0.5 pt-0.5">
                    {info.files.map((f, i) => (
                      <div key={i} className="flex justify-between text-[10px] font-mono text-gray-600">
                        <span className="truncate max-w-[72%]">{f.filename}</span>
                        <span className="text-gray-700">{fmt(f.size)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clear button */}
                {cached && (
                  <button
                    onClick={() => handleClear(key)}
                    disabled={clearing === key}
                    className="w-full text-[10px] text-red-500 hover:text-red-300 border border-red-900/40 hover:border-red-800 rounded py-1.5 transition-colors disabled:opacity-50"
                  >
                    {clearing === key ? "Clearing…" : `Clear ${label} from cache`}
                  </button>
                )}

                {!cached && (
                  <p className="text-[10px] text-gray-600">
                    Click "Load {label}" in the panel to download (~{fmt(approxSize)}).
                    Will be cached here for future sessions.
                  </p>
                )}
              </div>
            );
          })}

          {/* How-to note */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-[10px] text-gray-600 leading-relaxed border border-gray-700/50">
            <div className="text-gray-400 font-semibold mb-1">How model caching works</div>
            Models are stored in the browser's <strong className="text-gray-300">Cache Storage API</strong> (visible in DevTools → Application → Cache Storage).
            Once cached, the model loads without any network traffic — even offline.
            Clearing browser site data or using private/incognito mode will remove the cache.
          </div>
        </div>
      </div>
    </div>
  );
}
