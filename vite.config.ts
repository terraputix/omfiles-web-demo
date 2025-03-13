import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const copyWasmPlugin = () => {
  return {
    name: "copy-wasm-files",
    async writeBundle() {
      const wasmSource = path.resolve(
        "node_modules/omfiles-js/dist/wasm/om_reader_wasm.wasm",
      );
      const outDir = path.resolve("dist");

      await fs.mkdir(path.join(outDir, "wasm"), { recursive: true });
      await fs.copyFile(
        wasmSource,
        path.join(outDir, "wasm", "om_reader_wasm.wasm"),
      );

      console.log("✓ WASM file copied to output directory");
    },
  };
};

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), copyWasmPlugin()],
  server: {
    port: 3000,
  },
  // Ensure the WASM file is accessible during development
  optimizeDeps: {
    exclude: ["omfiles-js"],
  },
  build: {
    // Prevent Vite from mangling paths to WASM files
    assetsInlineLimit: 0,
  },
});
