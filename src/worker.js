import { CreateMLCEngine } from "@mlc-ai/web-llm";

// WebLLM: MLC-compiled models running on WebGPU in the browser.
// No ONNX Runtime, no WASM file serving, no external-data bugs.
// Requires WebGPU. If unavailable, load will fail with an error message.

let engine        = null;
let currentModelId = null;
let loadAborted    = false;
let currentGen     = -1;  // echoed on every outbound message so the hook can filter stale ones

function post(msg) {
  self.postMessage({ gen: currentGen, ...msg });
}

async function disposeCurrent() {
  if (engine) {
    try { await engine.unload(); } catch (_) {}
    engine         = null;
    currentModelId = null;
  }
}

self.onmessage = async (e) => {
  const { action, modelId: mlcModelId, prompt, systemPrompt, gen } = e.data;

  // ── Load ──────────────────────────────────────────────────────────────
  if (action === "load") {
    loadAborted = false;
    currentGen  = gen ?? 0;

    await disposeCurrent();

    if (!mlcModelId) {
      post({ status: "error", error: "No model ID provided." });
      return;
    }

    // Check WebGPU availability
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        post({ status: "error", error: "WebGPU not available in this browser. Use Chrome 113+ on a machine with a GPU." });
        return;
      }
      post({ status: "device_detected", device: "webgpu" });
    } catch (err) {
      post({ status: "error", error: `WebGPU check failed: ${err?.message ?? err}` });
      return;
    }

    console.log(`[worker] Loading ${mlcModelId} via WebLLM`);
    post({ status: "phase", phase: "download", device: "webgpu" });

    try {
      engine = await CreateMLCEngine(mlcModelId, {
        initProgressCallback: (progress) => {
          if (loadAborted) return;
          const text = progress.text ?? "";
          const pct  = Math.round((progress.progress ?? 0) * 100);

          if (text.toLowerCase().includes("fetching") || text.toLowerCase().includes("loading")) {
            // Download phase
            post({
              status:   "downloading",
              file:     text,
              progress: pct,
              loaded:   0,
              total:    0,
            });
          } else if (text.toLowerCase().includes("compil") || pct > 50) {
            // Shader compilation / model init phase
            if (!engine) {  // don't re-fire once ready
              post({
                status: "phase",
                phase:  "compile",
                device: "webgpu",
                note:   `${text} — WebGPU shader compilation. Typically 1–5 min on first load, cached after.`,
              });
            }
          }
        },
      });

      if (loadAborted) { await disposeCurrent(); return; }

      currentModelId = mlcModelId;
      console.log(`[worker] Ready: ${mlcModelId}`);
      post({ status: "ready", modelId: mlcModelId, device: "webgpu" });

    } catch (err) {
      if (loadAborted) return;
      const msg = err?.message ?? String(err);
      console.error("[worker] Load failed:", err);
      post({ status: "error", error: msg });
    }

  // ── Generate ───────────────────────────────────────────────────────────
  } else if (action === "generate") {
    if (!engine) {
      post({ status: "error", error: "No model loaded." });
      return;
    }
    try {
      const t0 = performance.now();
      const reply = await engine.chat.completions.create({
        messages: [
          { role: "system",  content: systemPrompt },
          { role: "user",    content: prompt },
        ],
        max_tokens:         256,
        temperature:        0,
        repetition_penalty: 1.1,
      });
      const elapsed   = performance.now() - t0;
      const generated = reply.choices[0]?.message?.content ?? "";
      post({
        status:        "success",
        generatedText: generated,
        elapsedMs:     elapsed,
        tokensPerSec:  (reply.usage?.completion_tokens ?? generated.trim().split(/\s+/).length) / (elapsed / 1000),
        modelId:       currentModelId,
      });
    } catch (err) {
      post({ status: "error", error: err?.message ?? String(err) });
    }

  // ── Cancel / Dispose ───────────────────────────────────────────────────
  } else if (action === "cancel") {
    loadAborted = true;
    await disposeCurrent();
    self.postMessage({ status: "cancelled" });

  } else if (action === "dispose") {
    loadAborted = true;
    await disposeCurrent();
    self.postMessage({ status: "disposed" });
  }
};
