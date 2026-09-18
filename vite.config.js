import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "./",
  server: { proxy: { "/api": "http://127.0.0.1:5174" } },
  build: {
    rollupOptions: {
      input: {
        museum: fileURLToPath(new URL("./index.html", import.meta.url)),
        editor: fileURLToPath(new URL("./editor.html", import.meta.url)),
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
