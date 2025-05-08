import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: "/omfiles-web-demo/",
  plugins: [wasm(), topLevelAwait()],
  // Ensure the WASM file is accessible during development
  optimizeDeps: {
    exclude: ["@openmeteo/file-reader"],
  },
  build: {
    // Prevent Vite from mangling paths to WASM files
    assetsInlineLimit: 0,
  },
});
