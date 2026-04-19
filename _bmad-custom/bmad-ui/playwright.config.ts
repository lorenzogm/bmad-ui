import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	testMatch: "**/*.spec.ts",
	timeout: 30_000,
	outputDir: "test-results",
	use: {
		baseURL: "http://localhost:5173",
	},
	webServer: {
		command: "pnpm run dev",
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
