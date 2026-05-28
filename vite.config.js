import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Ensure .wasm and .mjs files in /public are served with correct MIME types
// and the required COOP/COEP headers on every response.
const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    react(),
    // Force correct Content-Type for ONNX WASM assets
    {
      name: "wasm-content-type",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          if (req.url?.endsWith(".mjs")) {
            res.setHeader("Content-Type", "application/javascript");
          }
          // COOP/COEP on every request (needed for SharedArrayBuffer in workers)
          for (const [k, v] of Object.entries(securityHeaders)) {
            res.setHeader(k, v);
          }
          next();
        });
      },
    },
  ],
  // Use repo-name base when deploying to GitHub Pages, "./" for local dev
  base: process.env.VITE_BASE_URL ?? "./",
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          recharts: ["recharts"],
          cytoscape: ["cytoscape"],
          dexie: ["dexie"],
        },
      },
    },
  },
  // Don't try to process .wasm files through Rollup — serve them as static assets
  assetsInclude: ["**/*.wasm"],
});
