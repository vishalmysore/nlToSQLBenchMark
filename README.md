# NL2SQL Benchmark

**A browser-based schema complexity simulator for evaluating NL2SQL model performance — no server, no API keys, no cost.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WebGPU](https://img.shields.io/badge/inference-WebGPU-orange.svg)](https://developer.chrome.com/docs/web-platform/webgpu)
[![WebLLM](https://img.shields.io/badge/powered%20by-WebLLM-purple.svg)](https://webllm.mlc.ai)
[![DuckDB](https://img.shields.io/badge/SQL-DuckDB--WASM-yellow.svg)](https://duckdb.org/docs/api/wasm)

---

## What Is This?

NL2SQL Benchmark measures how accurately large language models translate natural language questions into SQL — and how that accuracy degrades as the database schema becomes more complex, obfuscated, or adversarially structured.

Everything runs **100% in your browser**:
- 🧠 **LLM inference** via [WebLLM](https://webllm.mlc.ai) on your GPU (WebGPU)
- 🦆 **SQL execution** via [DuckDB-WASM](https://duckdb.org/docs/api/wasm) in-memory
- 💾 **Query log persistence** via IndexedDB — survives page reloads
- 📊 **Analytics** with degradation charts across all 5 complexity tiers

No backend. No cloud API. No data leaves your machine.

---

## Live Demo

🌐 **[https://vishalmysore.github.io/nlToSQLBenchMark/](https://vishalmysore.github.io/nlToSQLBenchMark/)**

> Requires Chrome 113+ with a GPU (WebGPU). Firefox / Safari not supported yet.

**Or run locally:**

```bash
git clone https://github.com/vishalmysore/nlToSQLBenchMark.git
cd nlToSQLBenchMark
npm install
npm run dev
```

Open **http://localhost:5174** in Chrome.

---

## Screenshots

### Schema Builder + ER Diagram
Build or customize a schema across 6 demo domains. The ER diagram updates live as you add tables and foreign keys.

### Benchmark Tab
Load any of 100+ WebLLM models, select a complexity tier, and run natural language queries. See the generated SQL, execution result, and the exact prompt the model received.

### Data Explorer
Write SQL directly against the in-memory DuckDB instance. Preview table data, download CSVs, and import your own data files.

### Analytics
Degradation chart showing how model accuracy drops across complexity tiers L1 → L5.

---

## The 5 Complexity Tiers

The core idea: the same schema is presented to the model in progressively harder ways.

| Tier | Name | What the model sees |
|------|------|---------------------|
| **L1** | Pristine | Clean names, full `REFERENCES` annotations — ideal baseline |
| **L2** | Noise Injection | Real schema + 10 randomly named fake tables injected as noise |
| **L3** | Obfuscation | `customers` → `tbl_cus_mstr_v2`, `email` → `tbl_ema_nrm` |
| **L4** | Snowflake Split | Each table explodes into fact + dim + sub-dim (3–5 JOINs required) |
| **L5** | Collision Chaos | Every table's columns renamed to `id`, `date`, `value`, `name` |

Switch tiers with one click. The **Prompt Payload Inspector** shows you the exact system prompt sent to the model at each level.

---

## Features

### 🤖 Model Selection
- **100+ prebuilt models** from the WebLLM registry
- Families: Llama 3.x, Qwen 3 / 2.5 / 2.5 Coder, Gemma 3, Phi-4, DeepSeek, Mistral, SmolLM, and more
- Filter by brand, search by name
- VRAM requirements color-coded (green < 2 GB, amber 2–5 GB, red > 5 GB)
- All quantization variants exposed per model (q4f16_1, q4f32_1, q0f16, 1k context)

### 📋 Query Playground
- Natural language input with example query chips per domain
- Generated SQL displayed with syntax highlighting
- DuckDB execution with row count and result table
- Elapsed time and tokens/sec metrics

### 🔍 Prompt Payload Inspector
- **Clean vs Obfuscated** — side-by-side diff of what L1 vs current tier sends
- **Full Prompt** — complete system prompt with schema injected
- **Raw Response** — exact model output with parse annotation (✅ clean, ⚠️ wrong tag, ❌ no SQL found)

### 📊 Execution Log
- Every query logged with complexity level, model, SQL, execution status
- Human feedback (👍 correct / 👎 wrong) for semantic accuracy rating
- Filter by status: All / Exec OK / Failed / Correct / Wrong / Unrated
- Semantic accuracy bar auto-calculated from rated entries

### 🗄 Data Explorer
- SQL editor with Ctrl+Enter shortcut and quick table buttons
- Table browser with inline row preview
- Export any table or query result as CSV
- Import CSV files — first row becomes column headers, filename becomes table name

### 📈 Analytics
- Degradation chart (Recharts) showing accuracy by complexity tier
- Execution success vs semantic correctness breakdown
- Per-tier sample counts

---

## Domain Schemas

Six built-in demo schemas, each with domain-appropriate example queries:

| Domain | Tables | Example Query |
|--------|--------|---------------|
| 🛒 E-Commerce | customers, products, orders, order_items | "Find orders with total over $50" |
| 🏥 Healthcare | patients, doctors, appointments, diagnoses, prescriptions | "Show prescriptions with dosage over 100mg" |
| 🛡 Insurance | policyholders, policies, claims, payments | "List all active policies expiring this year" |
| 🏭 Manufacturing | products, components, suppliers, work_orders | "Find components with stock below reorder point" |
| 🚢 Logistics | shipments, carriers, routes, tracking_events | "Show delayed shipments by carrier" |
| 👥 HR & Payroll | employees, departments, salaries, performance_reviews | "List employees with salary above department average" |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 |
| LLM Inference | [WebLLM](https://webllm.mlc.ai) `@mlc-ai/web-llm` v0.2.83 |
| GPU Backend | WebGPU (via WebLLM / MLC compiled models) |
| SQL Engine | [DuckDB-WASM](https://duckdb.org/docs/api/wasm) |
| ER Diagram | [Cytoscape.js](https://cytoscape.org) |
| Charts | [Recharts](https://recharts.org) |
| Storage | [Dexie.js](https://dexie.org) (IndexedDB) |
| Worker | Web Worker (non-blocking LLM inference) |

---

## How WebLLM Works

[WebLLM](https://webllm.mlc.ai) runs LLMs directly in the browser using **WebGPU compute shaders** — no server, no Python runtime.

```
User Query
    │
    ▼
React UI  ──postMessage──►  Web Worker
                                │
                                ▼
                         CreateMLCEngine()
                                │
                         WebGPU (GPU shaders)
                                │
                         engine.chat.completions.create()
                                │
                         ◄── generated SQL ──
```

Models are compiled ahead-of-time with [Apache TVM / MLC](https://mlc.ai), producing optimized WebGPU shader code. The first load compiles shaders (1–5 min, cached after). Subsequent loads are near-instant.

The API is OpenAI-compatible:
```js
const reply = await engine.chat.completions.create({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userQuery },
  ],
  temperature: 0,
  max_tokens: 256,
});
```

### VRAM Guide

| Model size | q4f16_1 VRAM | Hardware |
|-----------|-------------|----------|
| 0.5B–1B | < 1 GB | Any GPU, integrated graphics |
| 1.5B–3B | 1–2.5 GB | Most laptops |
| 7B | 4–5 GB | RTX 3060 / RX 6700 |
| 14B | 8–10 GB | RTX 3080 / RX 6800 XT |
| 32B+ | 18+ GB | High-end workstation |

---

## Requirements

- **Chrome 113+** (WebGPU support required)
- **A GPU** — integrated graphics works for small models (< 2 GB)
- **Internet connection** for first model download (weights cached in browser after)
- No Node.js required at runtime — just a static web server

> Firefox and Safari have limited/experimental WebGPU support as of 2025. Chrome is recommended.

---

## Project Structure

```
src/
├── App.jsx                    # Root layout, tab routing, query orchestration
├── worker.js                  # Web Worker — WebLLM engine (load + generate)
├── components/
│   ├── ModelSelector.jsx      # Brand-filtered model picker modal
│   ├── ComplexitySlider.jsx   # L1–L5 tier selector with explainer
│   ├── SchemaBuilder.jsx      # Table/column editor with domain switcher
│   ├── SchemaGraph.jsx        # Cytoscape.js ER diagram (light theme)
│   ├── DataExplorer.jsx       # SQL editor, table browser, CSV import/export
│   ├── QueryPlayground.jsx    # NL input, SQL output, DuckDB results
│   ├── PromptViewer.jsx       # Prompt inspector + raw response tab
│   ├── ExecutionLog.jsx       # Query history with human feedback
│   └── DegradationChart.jsx   # Recharts accuracy degradation chart
├── hooks/
│   └── useInferenceWorker.js  # Worker lifecycle, load/generate/dispose
└── lib/
    ├── complexityEngine.js    # Schema → prompt transformer (5 tiers)
    ├── duckdb.js              # DuckDB-WASM init, executeSQL, sample data
    ├── demoSchemas.js         # 6 domain schemas + example queries
    └── storage.js             # Dexie.js query log persistence
```

---

## Read More

See [article.md](article.md) for a detailed technical write-up covering:
- The five complexity tiers in depth
- WebLLM internals (MLC compilation, WebGPU shaders, quantization)
- Architecture decisions (Web Worker isolation, DuckDB-WASM, SQL extraction)
- Benchmark observations across model sizes and complexity tiers

---

## Contributing

Contributions welcome! Some ideas:

- [ ] Automated batch benchmarking (run all tiers × all queries, export report)
- [ ] Side-by-side model comparison mode
- [ ] Custom system prompt editor
- [ ] Additional domain schemas
- [ ] Export benchmark results as PDF/CSV report
- [ ] Support for user-uploaded schema files (DDL SQL → parsed schema)

Please open an issue before submitting large PRs.

---

## License

[MIT](LICENSE) © 2025 Vishal Mysore
