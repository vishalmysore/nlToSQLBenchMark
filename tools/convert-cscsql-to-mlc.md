# Converting CscSQL-Merge-Qwen2.5-Coder to WebLLM (MLC) format

This produces real MLC-converted weights for the SLM-SQL / CSC-SQL paper's released
checkpoint, hosted on Hugging Face, ready to drop into `nl2sqlBenchMark`'s model
registry. No GPU needed for this step — weight conversion is CPU-only; only
*running* the model in the browser needs WebGPU.

Paper: [SLM-SQL: An Exploration of Small Language Models for Text-to-SQL](https://arxiv.org/abs/2507.22478) (Sheng & Xu, Jul 2025)
Model: [cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct](https://huggingface.co/cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct) — a full fine-tune of Qwen2.5-Coder-0.5B-Instruct

The final, working checkpoint actually shipped in this app is hosted at
[VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC](https://huggingface.co/VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC)
and wired in via `src/lib/customModels.js`. **It uses `q0f16` quantization, not
`q4f16_1`** — see "Why q0f16 instead of q4f16_1" below before you copy these
commands verbatim.

## Why this works without recompiling any WebGPU shaders

Since CscSQL-Merge is a full fine-tune of the Qwen2.5-Coder-0.5B-Instruct
architecture, and WebLLM already ships a precompiled WebGPU shader library for
Qwen2 0.5B at `q0f16`, we only need to convert the checkpoint's *weights* to
MLC's format — the existing `.wasm` shader library
(`Qwen2-0.5B-Instruct-q0f16_cs1k-webgpu.wasm`) is reused as-is, with zero
shader/wasm compilation.

## Why q0f16 instead of q4f16_1

The original plan was `q4f16_1` (4-bit group-quantization), matching what most
of WebLLM's prebuilt general-purpose models use. In practice, `mlc_llm
convert_weight --quantization q4f16_1` on the current `mlc-ai-nightly-cpu` /
`mlc-llm-nightly-cpu` wheels segfaults inside `libtvm_ffi.so` while compiling
the group-quantization kernel, on both Windows and Linux. A GDB backtrace
traced the crash into `tvm::tir::IndexDataTypeNormalizer::Rewrite()`, matching
the confirmed, unresolved upstream bug
[mlc-ai/mlc-llm#3283](https://github.com/mlc-ai/mlc-llm/issues/3283). Neither
pinning `numpy<2`, pinning `ml_dtypes<0.4`, forcing single-threaded compilation,
nor switching to `q4f32_1` avoided it.

`q0f16` (plain fp16 cast, no grouped-quantization kernel) sidesteps the buggy
code path entirely and converts cleanly. It's also strictly more faithful to
the trained weights than 4-bit would have been — the tradeoff is a larger
download (~960 MB vs. an unmeasured, never-produced 4-bit size). WebLLM already
ships a matching `q0f16` shader library for Qwen2 0.5B, so this didn't cost a
shader recompile either.

If a future `mlc-ai`/`mlc-llm` nightly fixes #3283, redoing this conversion at
`q4f16_1` would roughly quarter the download size — worth revisiting then.

## 1. Set up the conversion environment

```bash
python -m venv mlc-convert-env

# Windows (PowerShell):
mlc-convert-env\Scripts\Activate.ps1
# macOS / Linux:
source mlc-convert-env/bin/activate

pip install --pre -U -f https://mlc.ai/wheels mlc-ai-nightly-cpu mlc-llm-nightly-cpu
pip install psutil "numpy<2" "huggingface_hub[cli]"  # `hf` CLI (formerly huggingface-cli)
```

## 2. Download the real checkpoint

```bash
hf download cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct \
  --local-dir ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct
```

## 3. Convert to MLC format (q0f16 — see rationale above)

```bash
python -m mlc_llm gen_config ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct \
  --quantization q0f16 \
  --conv-template qwen2 \
  --context-window-size 4096 \
  -o ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC

python -m mlc_llm convert_weight ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct \
  --quantization q0f16 \
  -o ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC
```

This produces `mlc-chat-config.json`, tokenizer files, `tensor-cache.json`, and
`params_shard_*.bin` in the output folder — the exact layout WebLLM fetches at
runtime.

## 4. Push it to your Hugging Face account

Get a **write** access token from https://huggingface.co/settings/tokens, then:

```bash
hf auth login
hf upload <YOUR_HF_USERNAME>/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC \
  ./CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC . --repo-type model
```

If the upload times out repeatedly against `cas-server.xethub.hf.co`, set
`HF_HUB_DISABLE_XET=1` in your environment first to force plain HTTP/LFS
transfer instead of Hugging Face's newer Xet protocol.

## 5. (Optional) Repeat for the 1.5B variant

Not yet done for this app, but the same steps apply, swapping every `0.5B`
above for `1.5B` — the 1.5B `q0f16` wasm lib
(`Qwen2-1.5B-Instruct-q0f16_cs1k-webgpu.wasm`) is also already in WebLLM's
prebuilt registry.

```bash
hf download cycloneboy/CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct \
  --local-dir ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct

python -m mlc_llm gen_config ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct \
  --quantization q0f16 --conv-template qwen2 --context-window-size 4096 \
  -o ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct-q0f16-MLC

python -m mlc_llm convert_weight ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct \
  --quantization q0f16 \
  -o ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct-q0f16-MLC

hf upload <YOUR_HF_USERNAME>/CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct-q0f16-MLC \
  ./CscSQL-Merge-Qwen2.5-Coder-1.5B-Instruct-q0f16-MLC . --repo-type model
```

## 6. Wire a new URL into the app

Once uploaded, the model will live at:

```
https://huggingface.co/<YOUR_HF_USERNAME>/<repo-name>
```

Update `model` and `model_id` in `src/lib/customModels.js` to point at it (and
`model_lib` if you change quantization or base size) — that's the only file
that needs to change for the registry, badge, and README to pick it up.
