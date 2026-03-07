import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
      "@models": fileURLToPath(new URL("./src/models", import.meta.url)),
      "@hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),
      "@datasets": fileURLToPath(new URL("./src/datasets", import.meta.url)),
      "@scripts":  fileURLToPath(new URL("./scripts", import.meta.url)),
    },
  },
})
