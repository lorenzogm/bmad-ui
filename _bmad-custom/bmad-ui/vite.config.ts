import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { type ChildProcess, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { defineConfig } from "vite"
import { attachApi } from "./scripts/agent-server"
import { staticDataPlugin } from "./scripts/vite-plugin-static-data"

const __viteConfigDir = path.dirname(fileURLToPath(import.meta.url))

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
    {
      name: "sync-sessions",
      configureServer(server) {
        const scriptPath = path.resolve(__viteConfigDir, "scripts", "sync-sessions.mjs")
        let child: ChildProcess | null = null

        child = spawn("node", [scriptPath], { stdio: "inherit" })
        child.on("error", (err) => {
          console.error("[sync-sessions] Failed to start:", err.message)
        })

        const cleanup = () => {
          if (child && !child.killed) child.kill()
        }
        server.httpServer?.on("close", cleanup)
        process.on("exit", cleanup)
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
