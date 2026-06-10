import React, { useState } from "react";

export default function SemanticLayerToggle({ enabled, onChange, semanticLayer }) {
  const [showDoc, setShowDoc] = useState(false);

  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="panel-header mb-0">Semantic Layer</div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? "bg-sky-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4.5" : "translate-x-1"
            }`}
            style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">
        Adds a short markdown document describing measure definitions, conventions, and
        disambiguation rules to the system prompt — supplementing the schema with the
        business semantics it doesn't encode (
        <a
          href="https://arxiv.org/abs/2604.25149"
          target="_blank"
          rel="noreferrer"
          className="text-sky-600 hover:underline"
        >
          arXiv:2604.25149
        </a>
        ).
      </p>

      {enabled && (
        <button
          onClick={() => setShowDoc((v) => !v)}
          className="text-xs text-sky-600 hover:underline self-start"
        >
          {showDoc ? "Hide" : "Show"} semantic layer document
        </button>
      )}

      {enabled && showDoc && (
        <pre className="text-[10px] font-mono rounded-lg px-3 py-2.5 bg-gray-50 border border-gray-200 whitespace-pre-wrap leading-relaxed text-gray-700 max-h-64 overflow-y-auto">
          {semanticLayer || "(no semantic layer defined for this domain)"}
        </pre>
      )}
    </div>
  );
}
