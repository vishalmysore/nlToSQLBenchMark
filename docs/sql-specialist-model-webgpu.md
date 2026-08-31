# Running a Real Text-to-SQL Specialist Model in the Browser with WebGPU

## How I added a fine-tuned small language model from the SLM-SQL paper to my NL2SQL Benchmark — real weights, real WebGPU inference, no server, no mocking

*By Vishal Mysore*

---

## Why I Went Looking for a SQL-Specialist Model

When I built [NL2SQL Benchmark](https://vishalmysore.github.io/nlToSQLBenchMark/), every model in the picker was a general-purpose chat model — Llama, Qwen, Phi, Mistral, and the rest — repurposed for text-to-SQL through prompting alone. That's the normal way most people use LLMs for SQL generation, and it's a fair baseline. But it left an obvious question sitting there: what happens if the model itself was actually *trained* for this task, instead of just prompted into it?

I went looking for recent research on small text-to-SQL models — small specifically, because my whole benchmark exists to run entirely client-side on WebGPU, and that only works if the model fits comfortably in a browser tab's GPU memory. That search led me to a paper published in July 2025:

> Lei Sheng & Shuai-Shuai Xu, **"SLM-SQL: An Exploration of Small Language Models for Text-to-SQL"**, [arXiv:2507.22478](https://arxiv.org/abs/2507.22478). [Code & released checkpoints](https://github.com/CycloneBoy/slm_sql).

The paper's whole premise lines up with what I was trying to prove with the complexity-tier benchmark in the first place: model *specialization*, not just model *size*, matters for text-to-SQL accuracy. The authors released real fine-tuned checkpoints on Hugging Face, built on top of Qwen2.5-Coder at 0.5B and 1.5B parameters — exactly the size class that's actually usable in a browser.

So I decided to add one of those checkpoints to the model picker as a real, selectable option — not a mockup, not a "coming soon" badge, an actual model you can load and run.

---

## The Constraint I Set For Myself: No Mocking, Ever

If you've read my other write-up on this project, you know the whole point of NL2SQL Benchmark is that everything runs as genuine, verifiable inference — no canned responses, no simulated progress bars. That constraint made this a harder job than just editing a dropdown list. There was no shortcut where I could fake a "SQL specialist" badge without either lying about what the app does or shipping something that silently doesn't work.

So doing this properly meant taking the actual released checkpoint — [cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct](https://huggingface.co/cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct), a full fine-tune of Qwen2.5-Coder-0.5B-Instruct on text-to-SQL data — and converting its real weights into the format [WebLLM](https://webllm.mlc.ai) needs to run a model on WebGPU.

### Reusing an existing shader library

WebLLM doesn't compile a fresh WebGPU shader for every model — it compiles one per *base architecture and quantization scheme*, and reuses it across any fine-tune of that architecture. Since CscSQL-Merge is a full fine-tune of the exact Qwen2.5-Coder-0.5B architecture WebLLM already ships a compiled shader library for, I only needed to convert the *weights*, not build a new WebGPU compile pipeline from scratch. That's what made this tractable without a full emscripten/wasm toolchain.

### The quantization detour I didn't expect

The plan was to convert at `q4f16_1` — 4-bit group-quantization, the scheme most of WebLLM's prebuilt models use, since it gives the smallest download. Instead, `mlc_llm convert_weight --quantization q4f16_1` segfaulted, consistently, deep inside the MLC/TVM compiler's group-quantization kernel. A GDB backtrace traced it into TVM's `IndexDataTypeNormalizer::Rewrite()`, and it matches a confirmed, still-open upstream bug: [mlc-ai/mlc-llm#3283](https://github.com/mlc-ai/mlc-llm/issues/3283).

Rather than fight an unresolved compiler bug, I switched to `q0f16` — a plain fp16 cast with no grouped-quantization kernel involved at all. It converted cleanly on the first try, and it's arguably a better outcome anyway: it's strictly more faithful to the original trained weights than 4-bit would have been. The tradeoff is a larger download — about 1.4 GB instead of the smaller size 4-bit would have produced. I've written up the full, reproducible conversion steps (including the workaround) in [`tools/convert-cscsql-to-mlc.md`](https://github.com/vishalmysore/nlToSQLBenchMark/blob/main/tools/convert-cscsql-to-mlc.md) if you want to reproduce it or convert the 1.5B variant yourself.

The converted weights are hosted publicly on Hugging Face: [VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC](https://huggingface.co/VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC).

---

## Walking Through It in the App

Here's what it actually looks like end to end, straight from the [live app](https://vishalmysore.github.io/nlToSQLBenchMark/).

### Schema Builder, unchanged

The Schema Builder and ER diagram views work exactly as before — this update is purely about adding an inference option, not touching the schema-complexity engine.

![NL2SQL Benchmark Schema Builder showing an ER diagram with customers, products, orders, and order_items tables](./images/01-schema-builder-er-diagram.jpg)

### The Benchmark tab, before a model is loaded

The Prompt Payload Inspector shows the clean vs. obfuscated schema the model will actually receive — this is what feeds into the SQL specialist too, since the complexity tiers apply to every model in the picker equally.

![Benchmark tab showing the Prompt Payload Inspector with clean and obfuscated schema side by side](./images/02-benchmark-prompt-inspector.jpg)

### Finding it in the model picker

Open the model selector and the new option sits right at the top of the grid, tagged with a **🗄️ SQL specialist** badge that links straight to the SLM-SQL paper.

![Model Selection modal with the CscSQL-Merge model card showing a purple SQL specialist badge](./images/03-model-picker-sql-specialist-badge.jpg)

Expand the card and you can see exactly which quantization build you're loading — `q0f16`, 1.4 GB — no hidden variants, no ambiguity about what's about to hit your GPU.

![Expanded CscSQL-Merge model card showing the q0f16 quantization and 1.4 GB download size](./images/04-model-card-expanded-q0f16.jpg)

### Loading real weights over the network

Hitting **Load Model** does exactly what it says — it fetches the real `.bin` shards from the Hugging Face repo I converted and uploaded, live, in front of you.

![Inference Engine panel showing Downloading model, Fetching model weights, with a progress bar](./images/05-model-downloading-real-weights.jpg)

A minute or so later, depending on your connection and GPU, it reports **WebGPU accelerated** and you're ready to query.

![Inference Engine panel showing CscSQL-Merge loaded and WebGPU accelerated with an Unload model option](./images/06-model-loaded-webgpu-accelerated.jpg)

### Real inference, real DuckDB execution

I ran a query against the loaded model and let it generate SQL on its own — no scripted output. Here's exactly what came back: the generated SQL, the elapsed time and tokens/sec, and the actual result set from executing that SQL against the in-browser DuckDB instance.

![Query Playground showing real generated SQL and live DuckDB execution results from the SQL-specialist model](./images/07-live-inference-generated-sql.png)

That's a genuine round trip: natural language question → SQL-specialist model inference on your GPU → generated SQL → real execution against real (synthetic demo) data, entirely inside the browser tab, with nothing simulated along the way.

---

## What Changed Under the Hood

Three source files carry this whole feature:

| File | What it does |
|---|---|
| `src/lib/customModels.js` | Registers the CscSQL-Merge model — its Hugging Face URL, quantization, VRAM footprint, and which existing WebGPU shader library it reuses |
| `src/worker.js` | Merges that custom entry into WebLLM's `appConfig` alongside the 100+ prebuilt models, so the loading/generation code path is identical for every model |
| `src/components/ModelSelector.jsx` | Adds the **SQL specialist** badge and links it to the paper, without touching the existing brand-filtering or search logic |

Nothing about the app's architecture changed — the SQL specialist model rides the exact same WebLLM engine, the same Web Worker isolation, and the same DuckDB-WASM execution path as every other model in the picker.

---

## Try It

```bash
git clone https://github.com/vishalmysore/nlToSQLBenchMark.git
cd nlToSQLBenchMark
npm install
npm run dev
```

Or just open the [live demo](https://vishalmysore.github.io/nlToSQLBenchMark/) — Chrome 113+ with a GPU, no install needed. Open the model picker, look for the 🗄️ SQL specialist badge, load it, and run a query yourself against any of the five complexity tiers.

---

## Citation

```bibtex
@article{sheng2025slmsql,
  title   = {SLM-SQL: An Exploration of Small Language Models for Text-to-SQL},
  author  = {Sheng, Lei and Xu, Shuai-Shuai},
  journal = {arXiv preprint arXiv:2507.22478},
  year    = {2025}
}
```

Base checkpoint: [cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct](https://huggingface.co/cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct) · Converted weights: [VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC](https://huggingface.co/VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC)

---

## Conclusion

Adding this model was never really about the badge in the picker — it was a test of whether a purpose-built text-to-SQL model behaves differently from a general-purpose model prompted into the same job, and whether I could prove that difference honestly, with real weights and real execution, inside the exact same benchmark harness I built to measure schema-complexity degradation.

It also reinforced something I already believed about this whole project: running everything client-side isn't just a privacy or cost choice, it's what makes this kind of experiment possible to ship in the first place. I could download a paper's real released checkpoint, convert it myself, host it, and have it running against a live SQL engine in a stranger's browser tab within a day — no infrastructure, no API keys, no approval process. That's a genuinely different way of working with research models than most people are used to.

---

*Built with WebLLM, MLC, DuckDB-WASM, React, and Tailwind CSS. Runs entirely in your browser.*
*— Vishal Mysore*
