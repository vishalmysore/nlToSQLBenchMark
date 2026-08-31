// Real MLC-converted weights for a text-to-SQL fine-tuned checkpoint from the
// SLM-SQL paper's public release. Reuses WebLLM's existing Qwen2 0.5B q0f16
// WebGPU shader library as-is (CscSQL-Merge is a full fine-tune of the exact
// same base architecture — Qwen2.5-Coder-0.5B-Instruct — so no custom shader
// compile is needed, only the weight conversion).
//
// Paper:      Lei Sheng & Shuai-Shuai Xu, "SLM-SQL: An Exploration of Small
//             Language Models for Text-to-SQL" (Jul 2025)
//             https://arxiv.org/abs/2507.22478
// Base model: cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct
//             https://huggingface.co/cycloneboy/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct
// Conversion: q0f16 (fp16, no 4-bit group-quant — the group-quant kernel hits
//             an unresolved upstream TVM compiler segfault as of this writing;
//             see tools/convert-cscsql-to-mlc.md for the full story). This is
//             strictly more faithful to the trained weights than 4-bit would
//             have been, at the cost of a larger download.
// Hosted at:  https://huggingface.co/VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC

const MODEL_LIB_PREFIX =
  "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/";

export const SQL_SPECIALIST_MODELS = [
  {
    model: "https://huggingface.co/VishalMysore/CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC",
    model_id: "CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct-q0f16-MLC",
    model_lib: MODEL_LIB_PREFIX + "Qwen2-0.5B-Instruct-q0f16_cs1k-webgpu.wasm",
    low_resource_required: true,
    vram_required_MB: 1624.12,
    overrides: { context_window_size: 4096 },
  },
];

// Keyed by model_id with the quantization suffix stripped (matches
// ModelSelector's `stripBase()` output), so the UI can badge these cards
// without hardcoding brand logic for a one-off model.
export const SQL_SPECIALIST_INFO = {
  "CscSQL-Merge-Qwen2.5-Coder-0.5B-Instruct": {
    label: "SQL specialist",
    paperHref: "https://arxiv.org/abs/2507.22478",
    paperLabel: "SLM-SQL (Sheng & Xu, 2025)",
  },
};
