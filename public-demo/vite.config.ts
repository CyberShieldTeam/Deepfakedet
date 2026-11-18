import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
  },
});
