import { defineConfig } from "vite";
import { resolve } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: "/omfiles-web-demo/",
  plugins: [wasm(), topLevelAwait()],
  server: {
    port: 3000,
  },
  // Ensure the WASM file is accessible during development
  optimizeDeps: {
    exclude: ["@openmeteo/file-reader"],
  },
  build: {
    // Prevent Vite from mangling paths to WASM files
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});
