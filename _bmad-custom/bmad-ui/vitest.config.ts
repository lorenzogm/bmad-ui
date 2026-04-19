import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only run unit tests from src/ — Playwright handles the tests/ directory
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
