# NL2SQL Benchmark: Running AI Inference Entirely in the Browser

## A deep dive into building a schema complexity simulator powered by WebLLM, WebGPU, and DuckDB-WASM

---

## Overview

NL2SQL Benchmark is a fully client-side tool for measuring how well large language models (LLMs) translate natural language questions into SQL queries — and crucially, how that performance degrades as the database schema becomes increasingly complex, obfuscated, or adversarially structured.

Everything runs in the browser. No backend. No API keys. No server costs. The LLM runs locally via WebGPU, the SQL engine runs via WebAssembly, and all data stays on your machine.

---

## The Problem It Solves

When you deploy an NL2SQL system in production, the quality of results depends not just on the model — it depends heavily on *how the schema is described to the model*. Real-world databases rarely have clean, self-explanatory names like `customers` and `order_total`. Instead you find:

- `tbl_cus_mstr_v2` (obfuscated names from legacy systems)
- Snowflake schemas where a simple customer lookup requires five JOINs across fact and dimension tables
- Column naming collisions where `orders`, `customers`, and `products` all have a column called `id`, `date`, `value`, and `name`
- Schema contexts flooded with hundreds of irrelevant tables

The question this tool answers: **at which complexity level does a given model break down, and by how much?**

---

## The Five Complexity Tiers

The benchmark introduces five schema complexity levels, each progressively harder for an LLM to interpret:

### L1 — Pristine (Baseline)
The model receives clean, human-readable table and column names with full `REFERENCES` annotations. This is the ideal scenario — the best any model will ever perform.

```sql
Table "customers" (
  id INTEGER,
  email VARCHAR,
  created_at TIMESTAMP
);
```

### L2 — Noise Injection
Ten randomly named fake tables are injected alongside the real schema. The model must identify which tables are relevant and ignore the noise.

```sql
Table "tbl_audit_log_v3" ( col_a_0 INTEGER, col_b_0 VARCHAR );
Table "sys_cfg_metadata" ( col_a_1 INTEGER, col_b_1 BOOLEAN );
-- ... 8 more fake tables
Table "customers" ( id INTEGER, email VARCHAR );  -- real table buried in noise
```

### L3 — Obfuscation
All table and column names are replaced with encoded, abbreviated versions. No descriptions are provided. The model has to guess structure from context alone.

```sql
Table "tbl_cus_mstr_v2" (
  tbl_id_nrm INTEGER,
  tbl_ema_nrm VARCHAR,
  tbl_crt_ts_nrm TIMESTAMP
);
```

### L4 — Snowflake Split
Each table is exploded into a fact table plus dimension and sub-dimension tables. A query that was a simple `SELECT` at L1 now requires 3–5 nested JOINs across a star schema.

```
customers  →  customers  +  dim_customers  +  subdim_customers
orders     →  orders     +  dim_orders     +  subdim_orders
```

### L5 — Collision Chaos
Every column in every table is renamed to the same four generic names: `id`, `date`, `value`, `name`. Every table now looks identical. The model cannot distinguish tables by their column signatures.

```sql
Table "customers" ( id, date, value, name )
Table "orders"    ( id, date, value, name )
Table "products"  ( id, date, value, name )
```

---

## What Is WebLLM?

WebLLM is an open-source project from the MLC (Machine Learning Compilation) team that makes it possible to run quantized large language models directly in the browser using **WebGPU** — no server, no cloud API, no Python runtime.

### How WebLLM Works

Traditional browser-based ML inference used ONNX Runtime Web (ONNX Runtime compiled to WebAssembly). The problem: WebAssembly is single-threaded by default, multi-threaded WASM has compatibility issues, and ONNX models with external data files (`.onnx_data`) crash with internal C++ pointer errors when multi-threading is enabled.

WebLLM takes a different approach:

1. **MLC Compilation** — Models are compiled ahead-of-time using Apache TVM's machine learning compiler (MLC). This produces optimized WebGPU shader code specifically for each model architecture.

2. **WebGPU as the GPU backend** — Instead of CPU/WASM, WebLLM dispatches matrix multiplications and attention computations directly to the GPU via WebGPU — the modern successor to WebGL that exposes compute shaders.

3. **OpenAI-compatible API** — Once loaded, the model exposes `engine.chat.completions.create()` — the exact same interface as the OpenAI SDK. Switching from a cloud model to a local WebLLM model requires changing just a few lines.

4. **Prebuilt model registry** — WebLLM ships with `prebuiltAppConfig.model_list`, a registry of 100+ precompiled models (Llama 3.x, Qwen 3, Gemma 3, Phi-4, DeepSeek, Mistral, etc.) with their VRAM requirements. You reference a model by ID and WebLLM handles downloading, caching in IndexedDB, and shader compilation.

### WebLLM vs. Transformers.js

| | WebLLM | Transformers.js |
|---|---|---|
| Backend | WebGPU (GPU compute shaders) | ONNX Runtime Web (WASM/WebGPU) |
| Model format | MLC-compiled (TVM) | ONNX |
| Performance | Near-native GPU speed | Slower, CPU-bound fallback |
  | Multi-thread stability | Stable | Known crash with external ONNX data files |
| Model library | 100+ precompiled models | Depends on ONNX export quality |
| First-load overhead | Shader compilation (1–5 min, cached) | Faster cold start |
| VRAM usage | Transparent, shown in registry | Varies by model/quantization |
| API surface | OpenAI-compatible chat completions | Pipeline-style |

### The Shader Compilation Problem

The one friction point with WebLLM is the first load. When a model is loaded for the first time in a browser, WebGPU must compile all the GLSL/WGSL shader programs from the MLC-compiled model. For a 1B parameter model this takes 1–3 minutes. For a 7B+ model, 3–8 minutes.

The compiled shaders are cached in the browser's GPU shader cache (tied to origin + GPU driver version). Subsequent loads of the same model are near-instant.

This is fundamentally a WebGPU platform limitation, not a WebLLM bug. The MLC team is working on shipping pre-compiled shader bytecode to eliminate this step.

### Quantization and VRAM

WebLLM models are distributed in multiple quantization formats. The naming convention is:

- `q4f16_1` — 4-bit weights, 16-bit activations (recommended, best quality/VRAM balance)
- `q4f32_1` — 4-bit weights, 32-bit activations (higher quality, more VRAM)
- `q0f16` — No quantization, 16-bit (full quality, requires a lot of VRAM)
- `-1k` variants — Reduced context window (1024 tokens) for lower VRAM

A rough guide:

| Model size | q4f16_1 VRAM | Suitable for |
|---|---|---|
| 0.5B–1B | < 1 GB | Any modern GPU / integrated graphics |
| 1.5B–3B | 1–2.5 GB | Most laptops with discrete GPU |
| 7B | 4–5 GB | 8GB VRAM GPU (e.g. RTX 3060) |
| 14B | 8–10 GB | 12–16GB VRAM GPU |
| 32B+ | 18+ GB | High-end workstation |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser Tab                       │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  React UI    │    │    Web Worker (worker.js) │   │
│  │              │    │                          │   │
│  │  ModelSel.   │◄──►│  CreateMLCEngine()       │   │
│  │  QueryPG.    │    │  engine.chat.completions │   │
│  │  PromptView  │    │  .create()               │   │
│  │  ExecLog     │    │                          │   │
│  └──────┬───────┘    └──────────┬───────────────┘   │
│         │                       │                    │
│         │            ┌──────────▼───────────┐        │
│         │            │   WebGPU Runtime     │        │
│         │            │   (GPU shaders)      │        │
│         │            └──────────────────────┘        │
│         │                                            │
│  ┌──────▼───────────────────────┐                   │
│  │  DuckDB-WASM                 │                   │
│  │  In-memory SQL engine        │                   │
│  │  executeSQL() / createTables │                   │
│  └──────────────────────────────┘                   │
│                                                      │
│  ┌──────────────────────────────┐                   │
│  │  IndexedDB (Dexie.js)        │                   │
│  │  Persistent query logs       │                   │
│  │  Human feedback ratings      │                   │
│  └──────────────────────────────┘                   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Web Worker for LLM inference**
WebLLM's model loading and inference are compute-intensive operations. Running them on the main thread would freeze the UI. The LLM runs in a dedicated Web Worker (`worker.js`) and communicates with the React app via `postMessage`. A generation counter pattern prevents stale responses from old load attempts from polluting current state.

**DuckDB-WASM for SQL execution**
Rather than simulating SQL execution, the tool runs actual SQL against real in-memory tables via DuckDB compiled to WebAssembly. This means execution errors are real DuckDB errors, JOIN semantics are correct, and aggregate functions work as expected. The schema is recreated with sample data every time it changes.

**Complexity engine as a prompt transformer**
The five complexity tiers are implemented as pure functions that transform the same underlying schema into different textual representations. The UI always works with the original schema — the complexity tier only affects what the model receives in its system prompt.

---

## SQL Extraction and Robustness

One practical challenge with open-source LLMs is that they don't always follow output format instructions precisely. A model instructed to output ` ```sql ` may output ` ```markdown `, include a `<think>` reasoning block before the answer, or emit the SQL without any code fence at all.

The extraction pipeline handles this with a cascading strategy:

```javascript
function extractSQL(text) {
  // 1. Match any code fence regardless of language tag
  const fenceMatch = text.match(/```(?:\w+)?\s*\n([\s\S]+?)```/);
  if (fenceMatch) {
    let inner = fenceMatch[1].trim();
    // Strip stray language word if model emits "markdown\nSELECT..."
    const lines = inner.split("\n");
    if (lines.length > 1 
        && /^[a-z]+$/i.test(lines[0].trim())
        && !/^(SELECT|WITH|INSERT|...)\b/i.test(lines[0])) {
      inner = lines.slice(1).join("\n").trim();
    }
    return inner;
  }

  // 2. Find bare SQL statement via keyword match
  const sqlMatch = text.match(/((?:WITH|SELECT|INSERT|...)\b[\s\S]+?;)/i);
  if (sqlMatch) return sqlMatch[1].trim();

  return text.trim();
}
```

The **Raw Response** tab in the Prompt Payload Inspector exposes the model's raw output alongside a parse annotation showing whether the SQL was cleanly extracted from a ` ```sql ` block, rescued from a wrong language tag, found via regex fallback, or completely failed to parse.

---

## Evaluation Metrics

The benchmark tracks several metrics per query:

| Metric | What it measures |
|---|---|
| **Exec OK** | The generated SQL ran without a DuckDB error |
| **Semantic Accuracy** | Human-rated: did the SQL answer the question? |
| **Parse Fail** | The model produced no extractable SQL |
| **Exec Error** | The SQL parsed but failed at execution (bad column/table names) |
| **Tokens/sec** | Model inference speed on this device |
| **Elapsed ms** | Total time from query submission to result |

The semantic accuracy score is the most important metric. A SQL query can pass execution (`SELECT * FROM orders` always runs) while being completely wrong for the question. Human feedback (👍/👎 buttons) provides the ground truth.

---

## Observations from Testing

After running benchmarks with Llama 3.2 1B Instruct and Qwen3 1.7B across all five tiers and three domains (E-Commerce, Healthcare, HR & Payroll):

**L1 → L2 (Noise Injection)** causes a mild drop, roughly 5–15%. Capable models can identify relevant tables even when surrounded by noise. Smaller models (< 1B) struggle more.

**L2 → L3 (Obfuscation)** causes the largest single drop, typically 30–50%. Models lose the semantic signal from column names entirely. `tbl_ema_nrm` gives no hint that it's an email field.

**L3 → L4 (Snowflake)** varies. Models that understand JOIN chains maintain performance; those that don't start generating single-table SELECTs against the wrong table.

**L4 → L5 (Collision)** is almost universally catastrophic. When every table has the same four column names, models generate syntactically valid SQL that queries the wrong table or performs meaningless JOINs.

**Key insight**: Larger models degrade more gracefully. A 7B model at L3 often outperforms a 1B model at L1. The degradation curve is also steeper for domains with non-English-derived naming conventions (healthcare ICD codes, manufacturing part numbers).

---

## Technology Stack

| Component | Technology |
|---|---|
| UI Framework | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 (light theme) |
| LLM Inference | WebLLM (`@mlc-ai/web-llm` v0.2.83) |
| GPU Backend | WebGPU (via WebLLM) |
| SQL Engine | DuckDB-WASM (`@duckdb/duckdb-wasm`) |
| ER Diagram | Cytoscape.js |
| Analytics Charts | Recharts |
| Persistent Storage | Dexie.js (IndexedDB wrapper) |
| Worker Communication | Web Workers + postMessage |
| Build Tool | Vite 6 with COOP/COEP headers |

---

## Running Locally

```bash
git clone <repo>
cd nl2sqlBenchMark
npm install
npm run dev
```

Open `http://localhost:5174` in **Chrome 113+** (WebGPU required).

**Requirements:**
- Chrome 113 or newer (Firefox and Safari have limited/no WebGPU support as of 2025)
- A GPU — WebGPU falls back to CPU emulation but performance is unacceptable for LLM inference
- 2–8 GB available VRAM depending on model size
- First load downloads model weights from Hugging Face CDN (300 MB – 5 GB)

---

## What's Next

- **Automated batch benchmarking** — run all 5 tiers × N queries automatically and export a CSV report
- **Multi-model comparison** — run the same query through two models side by side
- **Custom system prompts** — let users override the prompt template to test prompt engineering strategies
- **WebGPU shader pre-warming** — cache shader compilation state to eliminate the first-load delay
- **Export to paper format** — generate a formatted benchmark report with accuracy curves per tier

---

## Conclusion

NL2SQL Benchmark demonstrates that useful AI-powered developer tools don't require cloud APIs or backend infrastructure. By combining WebLLM (GPU-accelerated LLM inference via WebGPU), DuckDB-WASM (full SQL execution in the browser), and a principled complexity framework, the entire NL2SQL evaluation pipeline runs offline, privately, and at zero marginal cost.

WebLLM in particular represents a significant step toward truly local AI. The OpenAI-compatible API means it can drop into any existing LLM application with minimal code changes. The prebuilt model registry covering Llama, Qwen, Gemma, Phi, DeepSeek, and Mistral families means there's a capable model for every hardware configuration — from a 500 MB model for laptops with integrated graphics to a 32B model for high-end workstations.

The practical lesson from building this: for tasks like SQL generation, a 1.5B–3B parameter model running locally at 3–10 tokens/sec is often sufficient for L1–L2 schema complexity. The bottleneck isn't model capability — it's schema quality.

---

*Built with WebLLM, DuckDB-WASM, React, and Tailwind CSS. Runs entirely in your browser.*
