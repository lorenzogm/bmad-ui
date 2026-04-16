import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { attachApi } from "./scripts/agent-server"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "bmad-ui-api",
      configureServer(server) {
        attachApi(server)
      },
    },
  ],
  resolve: {
    alias: {
      "@": "/src/",
    },
  },
  server: {
    fs: {
      allow: ["..", "../.."],
    },
  },
})
