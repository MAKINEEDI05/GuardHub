import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GuardHub_Next dev server runs on 9003 to avoid clashing with the legacy
// frontend (9001) and the backend (9002). The API base URL is configured via
// VITE_API_BASE_URL (.env). Manual chunking keeps the vendor bundle small.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9003,
    host: true,
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          vendor: ["axios", "papaparse", "zustand"],
        },
      },
    },
  },
});
