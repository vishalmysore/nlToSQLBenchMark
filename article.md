# NL2SQL Benchmark: Why Text-to-SQL Is Harder Than It Looks

## My experiment in exposing the hidden complexity of natural language to SQL conversion — running entirely in the browser

*By Vishal Mysore*

---

## Why I Built This

I've been fascinated by NL2SQL for a while. The promise is compelling: ask a question in plain English, get back a SQL query, done. No SQL expertise required. But the more I worked with real enterprise databases, the more I noticed a pattern — these systems work beautifully in demos and fall apart in production. Not because the models are bad, but because the *schemas* are.

Real databases don't look like tutorial databases. They've been through mergers, migrations, and years of organic growth. Column names are cryptic abbreviations from systems built in the 1990s. Tables are split into snowflake schemas by DBAs optimizing for OLAP. Hundreds of legacy staging tables sit alongside the actual business tables with no obvious way to tell them apart.

I wanted to quantify exactly how much each of these real-world conditions degrades NL2SQL accuracy. And I wanted to do it without spinning up cloud infrastructure or paying for API calls — so I built the entire benchmark to run in the browser.

This is what I learned.

---

## The Core Question

When an LLM converts natural language to SQL, it has two jobs:

1. Understand what the user is asking
2. Map that intent to the correct tables and columns in the schema

Most benchmarks test job #1 exhaustively. They use clean, well-named schemas and vary the question complexity. What they rarely test is job #2 under adverse conditions — which is almost always the situation in real enterprise deployments.

**My hypothesis:** schema quality matters at least as much as model capability for NL2SQL accuracy. A mediocre model on a clean schema will outperform a strong model on an obfuscated one.

To test this, I designed five schema complexity tiers that progressively degrade the schema while keeping the underlying questions identical.

---

## The Five Complexity Tiers

### L1 — Pristine (Baseline)

The model receives clean, human-readable table and column names with full `REFERENCES` annotations. This is what tutorial examples look like and what almost no production database looks like.

```sql
Table "customers" (
  id INTEGER,
  email VARCHAR,
  created_at TIMESTAMP
);
```

This sets the ceiling — the best accuracy any model can achieve on this question set.

### L2 — Noise Injection

Ten randomly named fake tables are injected alongside the real schema. The model must identify which tables are relevant and ignore the noise. This simulates the reality of pointing an NL2SQL system at a database with hundreds of tables — staging tables, archive tables, temporary tables — alongside the ones that actually matter.

```sql
Table "tbl_audit_log_v3" ( col_a_0 INTEGER, col_b_0 VARCHAR );
Table "sys_cfg_metadata" ( col_a_1 INTEGER, col_b_1 BOOLEAN );
-- ... 8 more decoy tables
Table "customers" ( id INTEGER, email VARCHAR );  -- real table buried in noise
```

### L3 — Obfuscation

All table and column names are replaced with encoded, abbreviated versions. No descriptions are provided. The model has to infer structure from type signatures and relationships alone. This mirrors legacy systems where naming conventions were optimised for character limits rather than readability.

```sql
Table "tbl_cus_mstr_v2" (
  tbl_id_nrm INTEGER,
  tbl_ema_nrm VARCHAR,
  tbl_crt_ts_nrm TIMESTAMP
);
```

`tbl_ema_nrm` is an email field. There is no way to know that without external documentation.

### L4 — Snowflake Split

Each table is exploded into a fact table plus dimension and sub-dimension tables — a common pattern in data warehouses. A query that was a single-table `SELECT` at L1 now requires 3–5 nested JOINs across a star schema. Most small models have never seen schemas this deeply normalised during fine-tuning.

```
customers  →  customers  +  dim_customers  +  subdim_customers
orders     →  orders     +  dim_orders     +  subdim_orders
```

### L5 — Collision Chaos

Every column in every table is renamed to the same four generic names: `id`, `date`, `value`, `name`. Every table looks identical by column signature. The model must rely entirely on table names — which in a real collision scenario are also often ambiguous.

```sql
Table "customers" ( id, date, value, name )
Table "orders"    ( id, date, value, name )
Table "products"  ( id, date, value, name )
```

This is an extreme synthetic case, but I've seen real schemas that get frighteningly close to this through years of "temporary" column renames that became permanent.

---

## Why Run It in the Browser?

The decision to run everything — LLM inference and SQL execution — client-side was deliberate.

First, I wanted anyone to be able to run the benchmark on their own hardware against their own schemas without sending data to a third party. If you're testing against a proprietary enterprise schema, you probably don't want it leaving your machine.

Second, I wanted the benchmark itself to be a demonstration of what's possible with modern browser capabilities. WebGPU and WebAssembly have matured to the point where running a 1–7B parameter model locally at useful speeds is genuinely feasible. The tooling to do this didn't exist two years ago.

The two key technologies that make this possible are **WebLLM** and **DuckDB-WASM**.

---

## WebLLM: Running LLMs on the GPU in Your Browser

[WebLLM](https://webllm.mlc.ai) is an open-source project that compiles large language models to run directly on the browser's GPU using **WebGPU** — the modern successor to WebGL that exposes compute shader capabilities.

Before settling on WebLLM, I tried the more obvious approach: [Transformers.js](https://huggingface.co/docs/transformers.js) with ONNX Runtime Web. It failed in a frustrating way. The ONNX Runtime crashes with a raw C++ pointer (`3841743504`) when loading models with external data files and multi-threading enabled — a [known bug](https://github.com/microsoft/onnxruntime/issues/26858) that affects quantized models large enough to be useful for SQL generation. Disabling multi-threading makes it technically not crash, but inference on a 1.5B model becomes too slow to be usable.

WebLLM sidesteps this entirely by using a different approach:

**MLC Compilation** — Models are compiled ahead-of-time using Apache TVM's machine learning compiler. This produces WebGPU shader code optimised specifically for each model architecture rather than a generic ONNX graph.

**OpenAI-compatible API** — Once loaded, inference looks like this:

```javascript
const reply = await engine.chat.completions.create({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user",   content: naturalLanguageQuery },
  ],
  temperature: 0,
  max_tokens: 256,
});
const sql = reply.choices[0].message.content;
```

The same interface as the OpenAI SDK. Switching from cloud to local is a one-line change.

**Non-blocking inference** — The LLM runs in a Web Worker, keeping the UI responsive during the 3–10 second generation time for a SQL query.

### The First-Load Friction

The one real friction point is the first load. WebGPU requires compiling shader programs from the MLC-compiled model, which takes 1–5 minutes for a 1B model and up to 8 minutes for 7B+. The compiled shaders are then cached in the browser's GPU shader cache, so subsequent loads of the same model are near-instant.

I implemented a "Cancel load" button so users aren't stuck if compilation runs longer than expected. In practice, the 1–3B models — which are sufficient for L1/L2 complexity — compile in a reasonable time on modern hardware.

### Choosing the Right Model Size

WebLLM's prebuilt registry covers 100+ models across Llama, Qwen, Gemma, Phi, DeepSeek, Mistral, and others. For NL2SQL specifically, I found the sweet spot to be the **Qwen2.5 Coder** and **Qwen3** families — they've seen more SQL during training than general-purpose models.

| Model size | q4f16_1 VRAM | NL2SQL suitability |
|---|---|---|
| 0.5B–1B | < 1 GB | L1 only, struggles with joins |
| 1.5B–3B | 1–2.5 GB | Good L1–L2, adequate L3 |
| 7B | 4–5 GB | Solid L1–L3, reasonable L4 |
| 14B | 8–10 GB | Best in-browser option |
| 32B+ | 18+ GB | Overkill for most schemas |

---

## DuckDB-WASM: Real SQL in the Browser

The other half of the stack is [DuckDB-WASM](https://duckdb.org/docs/api/wasm), which runs the full DuckDB analytical SQL engine compiled to WebAssembly. This is not a SQL simulator — it's the actual DuckDB engine.

This distinction matters for the benchmark. When a model generates `SELECT SUM(id) FROM cus WHERE ...`, I need to know whether that fails because `cus` doesn't exist, or because `SUM(id)` is semantically wrong but syntactically valid. DuckDB gives real execution errors with real semantics.

The schema is recreated with generated sample data every time it changes, so queries like `SELECT * FROM orders WHERE total_amount > 50` actually return rows.

---

## The Complexity Engine

The five tiers are implemented as a pure transformation function that takes the same schema definition and produces a different text representation for the model's system prompt:

```javascript
// L1: clean pass-through
// L2: append 10 noise tables
// L3: obfuscate all names with tbl_xxx_nrm pattern
// L4: expand each table into fact + dim + subdim
// L5: rename all columns to id, date, value, name
function generateSystemPrompt(schema, complexityLevel) {
  const schemaDescription = transformSchema(schema, complexityLevel);
  return `You are an expert SQL translator. Output ONLY a \`\`\`sql code block.
Database schema:
${schemaDescription}`;
}
```

The UI always shows and edits the original clean schema. The complexity tier is applied only at prompt-generation time. This means switching from L1 to L5 is instantaneous — the same underlying tables, just described differently to the model.

---

## What I Found

After running the benchmark across three domains (E-Commerce, Healthcare, HR & Payroll) with Llama 3.2 1B and Qwen3 1.7B:

**L1 → L2 (Noise):** Mild drop, 5–15%. Capable models filter out irrelevant tables well. Smaller models are more easily distracted.

**L2 → L3 (Obfuscation):** The largest single drop — consistently 30–50%. This confirmed my original intuition. Models lean heavily on column names as semantic anchors. `tbl_ema_nrm` destroys that signal completely. Even a model that "knows" SQL struggles to map `get me customer emails` to a column named `tbl_ema_nrm`.

**L3 → L4 (Snowflake):** Highly variable by model. Models with strong JOIN training hold up; those without start generating single-table queries against whichever table name sounds closest to the question. A model that answers "find customer orders" with `SELECT * FROM customers` isn't wrong about the table — it's just ignoring the three JOINs required to actually answer the question.

**L4 → L5 (Collision):** Near-universal breakdown. When every table has the same column names, model output becomes essentially random — syntactically valid SQL that queries whichever table the model happens to pattern-match against the question.

**The key takeaway:** The headline accuracy numbers you see in NL2SQL leaderboards are almost all measured on clean schemas. They overstate real-world performance by a significant margin for any organisation with legacy naming conventions. My rough observation is that obfuscation (L3) alone accounts for as much accuracy loss as going from a 1B model to a 7B model — which means schema documentation may have a better ROI than model upgrades for many organisations.

---

## SQL Parsing Robustness

One practical discovery: even when explicitly instructed to output ` ```sql `, models frequently output ` ```markdown ` or include `<think>` reasoning blocks before the answer. I had to build a cascading extraction pipeline:

```javascript
function extractSQL(text) {
  // Match any fence tag: ```sql, ```markdown, ```, etc.
  const fenceMatch = text.match(/```(?:\w+)?\s*\n([\s\S]+?)```/);
  if (fenceMatch) {
    let inner = fenceMatch[1].trim();
    // Strip stray language word the model leaked into the output
    const lines = inner.split("\n");
    if (lines.length > 1
        && /^[a-z]+$/i.test(lines[0].trim())
        && !/^(SELECT|WITH|INSERT|UPDATE|DELETE)\b/i.test(lines[0])) {
      inner = lines.slice(1).join("\n").trim();
    }
    return inner;
  }
  // Fallback: find bare SQL by keyword
  const sqlMatch = text.match(/((?:WITH|SELECT|INSERT|UPDATE|DELETE)\b[\s\S]+?;)/i);
  if (sqlMatch) return sqlMatch[1].trim();
  return text.trim();
}
```

The **Raw Response** tab in the tool shows the model's exact output alongside a parse annotation — whether SQL was extracted cleanly, rescued from a wrong tag, or failed entirely. This visibility was useful for understanding model behaviour patterns across tiers.

---

## Evaluation: Execution vs. Semantic Accuracy

I track two separate accuracy signals, and the gap between them is instructive:

**Execution accuracy** — did the SQL run without errors? This is easy to measure automatically. A model can score 90% execution accuracy by generating `SELECT * FROM [table]` for every query.

**Semantic accuracy** — did the SQL actually answer the question? This requires human judgement. I implemented 👍/👎 feedback buttons on each query result. The semantic accuracy score is calculated only over rated entries.

The gap between the two metrics is itself diagnostic. A large gap (high exec, low semantic) at L3 tells you the model is generating syntactically plausible but semantically wrong SQL — it's producing table and column names that exist in the obfuscated schema but don't correspond to what was asked.

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

---

## Technology Stack

| Component | Technology |
|---|---|
| UI Framework | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 |
| LLM Inference | WebLLM (`@mlc-ai/web-llm`) |
| GPU Backend | WebGPU |
| SQL Engine | DuckDB-WASM |
| ER Diagram | Cytoscape.js |
| Analytics | Recharts |
| Persistent Storage | Dexie.js (IndexedDB) |
| Worker | Web Workers + postMessage |

---

## Running It Yourself

```bash
git clone https://github.com/vishalmysore/nlToSQLBenchMark.git
cd nlToSQLBenchMark
npm install
npm run dev
```

Open **http://localhost:5174** in Chrome 113+. You'll need a GPU for useful inference speed — integrated graphics works for the smaller models (< 2 GB VRAM).

The benchmark ships with six domain schemas: E-Commerce, Healthcare, Insurance, Manufacturing, Logistics, and HR & Payroll. You can also build your own schema in the Schema Builder tab, or import CSV data through the Data Explorer.

---

## What's Next

A few directions I want to explore further:

- **Automated batch runs** — run all 5 tiers × full query set automatically, export an accuracy report
- **Side-by-side model comparison** — run the same query through two models simultaneously to compare degradation curves
- **Schema documentation injection** — test whether adding column descriptions to obfuscated schemas recovers accuracy (my hypothesis: yes, dramatically)
- **Domain-specific fine-tuning** — does a model fine-tuned on healthcare SQL degrade less on healthcare obfuscation?

---

## Conclusion

The main thing I set out to prove was that schema quality matters more than most NL2SQL discussions acknowledge. Having built and run this benchmark, I'm more convinced of that than when I started.

The L3 obfuscation results in particular were striking. A model that performs confidently on L1 schemas — the kind you'd use in a demo — can drop 40+ points in semantic accuracy when the same questions are asked against a schema where the column names give no semantic hint. That's not a model problem; it's a documentation problem.

The practical implication for anyone deploying NL2SQL in production: before upgrading your model, invest in schema documentation. Column descriptions, aliases, and business glossaries are likely to buy you more accuracy improvement than going from a 3B to a 7B model.

The browser-native architecture turned out to be a genuine advantage beyond just privacy. Running entirely locally means I can test against schemas I wouldn't upload to a cloud API, iterate on prompts without per-call costs, and share the tool with anyone who has Chrome and a GPU — no accounts, no setup, no data leaving the machine.

---

*Built with WebLLM, DuckDB-WASM, React, and Tailwind CSS. Runs entirely in your browser.*
*— Vishal Mysore*
