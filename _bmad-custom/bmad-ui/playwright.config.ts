import { defineConfig, devices } from "@playwright/test"

const TEST_TIMEOUT_MS = 30_000
const WEB_SERVER_TIMEOUT_MS = 120_000
const WEB_SERVER_PORT = 5173

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: TEST_TIMEOUT_MS,
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${WEB_SERVER_PORT}`,
  },
  webServer: {
    command: "pnpm run dev",
    port: WEB_SERVER_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: WEB_SERVER_TIMEOUT_MS,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
