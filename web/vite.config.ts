import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Important for Electron (file://) builds:
  // ensures assets resolve relatively instead of from "/" (which breaks in production).
  base: "./",
  resolve: {
    alias: { buffer: "buffer" },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  server: {
    proxy: {
      // Deezer API has no CORS; proxy so fetch works from renderer (dev and Electron dev).
      "/api/deezer": {
        target: "https://api.deezer.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deezer/, ""),
      },
    },
  },
});
