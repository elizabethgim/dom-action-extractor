import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/chat": {
        target: "http://0.0.0.0:3000",
        changeOrigin: true,
      },
      "/keywords": {
        target: "http://localhost:5001",
        changeOrigin: true
      },
      "/rank-actions": {
        target: "http://localhost:5002",
        changeOrigin: true
      },
    },
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
      "@models": fileURLToPath(new URL("./src/models", import.meta.url)),
      "@hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),

      "@datasets": fileURLToPath(new URL("./datasets", import.meta.url)),
      "@scripts":  fileURLToPath(new URL("./scripts", import.meta.url)),
      "@debug":  fileURLToPath(new URL("./src/debug", import.meta.url)),  
    },
  },
})
