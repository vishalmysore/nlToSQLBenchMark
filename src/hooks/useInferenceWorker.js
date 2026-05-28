import { useRef, useState, useCallback, useEffect } from "react";

/**
 * modelState values:
 *   "idle"      — no model loaded yet
 *   "loading"   — downloading model weights
 *   "compiling" — weights done, compiling WebGPU shaders
 *   "ready"     — real LLM active
 *   "error"     — last load attempt failed
 */
export function useInferenceWorker() {
  const workerRef          = useRef(null);
  const [modelState,        setModelState]       = useState("idle");
  const [loadedModel,       setLoadedModel]       = useState(null);
  const [downloadProgress,  setDownloadProgress]  = useState({});
  const [device,            setDevice]            = useState(null);
  const [statusMsg,         setStatusMsg]         = useState("");
  const [loadError,         setLoadError]         = useState(null);
  const [generating,        setGenerating]        = useState(false);

  const genRef      = useRef(0);
  const resolveRef  = useRef(null);
  const rejectRef   = useRef(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e) => {
      const msg = e.data;

      if (msg.gen !== undefined && msg.gen !== genRef.current) return;

      switch (msg.status) {
        case "device_detected":
          setDevice(msg.device);
          setStatusMsg(`${msg.device === "webgpu" ? "⚡ WebGPU" : "🧵 WASM"} — starting download…`);
          break;

        case "phase":
          if (msg.phase === "compile") {
            setModelState("compiling");
            setDownloadProgress({});
            setStatusMsg(msg.note ?? "Compiling model…");
          }
          break;

        case "initiate":
          setDownloadProgress((p) => ({ ...p, [msg.file]: { loaded: 0, total: 0, progress: 0 } }));
          break;

        case "downloading":
          setDownloadProgress((p) => ({
            ...p,
            [msg.file]: { loaded: msg.loaded ?? 0, total: msg.total ?? 0, progress: msg.progress ?? 0 },
          }));
          break;

        case "chunk_done":
          setDownloadProgress((p) => ({
            ...p,
            [msg.file]: { ...(p[msg.file] ?? {}), progress: 100 },
          }));
          break;

        case "ready":
          setModelState("ready");
          setLoadedModel(msg.modelId);
          setLoadError(null);
          setDownloadProgress({});
          setStatusMsg("Model loaded ✓");
          resolveRef.current?.();
          resolveRef.current = null;
          break;

        case "success":
          setGenerating(false);
          resolveRef.current?.(msg);
          resolveRef.current = null;
          break;

        case "error":
          console.error("[worker→hook] error:", msg.error);
          if (rejectRef.current && !resolveRef.current) {
            // Generation error
            setGenerating(false);
            rejectRef.current(new Error(msg.error));
            rejectRef.current = null;
          } else {
            // Load failed
            setModelState("error");
            setLoadedModel(null);
            setLoadError(msg.error);
            setDownloadProgress({});
            setStatusMsg(`Load failed: ${msg.error}`);
            resolveRef.current?.();
            resolveRef.current = null;
            rejectRef.current = null;
          }
          break;

        case "cancelled":
        case "disposed":
          break;
      }
    };

    worker.onerror = (e) => {
      console.error("Worker error:", e);
      if (resolveRef.current) {
        setModelState("error");
        setLoadError(`Worker crashed: ${e.message ?? "unknown"}`);
        setStatusMsg("Worker crashed");
        resolveRef.current?.();
        resolveRef.current = null;
      }
    };

    workerRef.current = worker;
    return () => { worker.terminate(); };
  }, []);

  const loadModel = useCallback((modelId) => {
    const gen = ++genRef.current;

    setModelState("loading");
    setLoadedModel(null);
    setLoadError(null);
    setDownloadProgress({});
    setStatusMsg("Connecting to worker…");

    workerRef.current?.postMessage({ action: "load", modelId, gen });

    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current  = reject;
    });
  }, []);

  const cancelLoad = useCallback(() => {
    genRef.current++;
    workerRef.current?.postMessage({ action: "cancel" });
    setModelState("idle");
    setLoadedModel(null);
    setLoadError(null);
    setDownloadProgress({});
    setStatusMsg("");
    resolveRef.current?.();
    resolveRef.current = null;
  }, []);

  const dispose = useCallback(() => {
    genRef.current++;
    workerRef.current?.postMessage({ action: "dispose" });
    setModelState("idle");
    setLoadedModel(null);
    setLoadError(null);
    setStatusMsg("");
  }, []);

  const generate = useCallback((prompt, systemPrompt) => {
    if (modelState !== "ready") {
      return Promise.reject(new Error("No model loaded. Please load a model first."));
    }
    setGenerating(true);
    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current  = reject;
      workerRef.current?.postMessage({ action: "generate", prompt, systemPrompt });
    });
  }, [modelState]);

  return {
    modelState, loadedModel, downloadProgress, device, statusMsg, loadError, generating,
    loadModel, generate, dispose, cancelLoad,
  };
}
