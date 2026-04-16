import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { attachApi } from "./scripts/agent-server"
import { staticDataPlugin } from "./scripts/vite-plugin-static-data"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    staticDataPlugin(),
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
