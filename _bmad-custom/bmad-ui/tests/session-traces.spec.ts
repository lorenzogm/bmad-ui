import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import analyticsFixture from "./fixtures/analytics-with-sessions.json" with { type: "json" }
import sessionNoLogFixture from "./fixtures/session-no-log.json" with { type: "json" }
import sessionRunningFixture from "./fixtures/session-running.json" with { type: "json" }
import sessionWithLogsFixture from "./fixtures/session-with-logs.json" with { type: "json" }
import { abortRoute, mockApi } from "./helpers/mock-api"

function captureConsoleErrors(page: Page): string[] {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

async function setupSessionPage(page: Page, sessionId: string, fixture: unknown): Promise<void> {
	await mockApi(page, `**/api/session/${sessionId}`, fixture)
	await abortRoute(page, "**/api/events/**")
}

test.describe("Session traces — populated log", () => {
	test("session with logContent renders .chat-log-collapse with entries", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		const { session } = sessionWithLogsFixture
		await setupSessionPage(page, session.id, sessionWithLogsFixture)
		await page.goto(`/session/${session.id}`)

		await expect(page.locator(".chat-log-collapse")).toBeVisible()
		expect(errors).toHaveLength(0)
	})

	test("session with summary shows .chat-session-summary section", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		const { session } = sessionWithLogsFixture
		await setupSessionPage(page, session.id, sessionWithLogsFixture)
		await page.goto(`/session/${session.id}`)

		await expect(page.locator(".chat-session-summary")).toBeVisible()
		expect(errors).toHaveLength(0)
	})
})

test.describe("Session traces — no log file", () => {
	test("session with logExists=false shows .chat-empty-state with 'No log output'", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		const { session } = sessionNoLogFixture
		await setupSessionPage(page, session.id, sessionNoLogFixture)
		await page.goto(`/session/${session.id}`)

		const emptyState = page.locator(".chat-empty-state")
		await expect(emptyState).toBeVisible()
		await expect(emptyState).toContainText("No log output")
		expect(errors).toHaveLength(0)
	})

	test("session with logExists=false shows muted log path hint", async ({ page }) => {
		const { session } = sessionNoLogFixture
		await setupSessionPage(page, session.id, sessionNoLogFixture)
		await page.goto(`/session/${session.id}`)

		// muted path hint appears when logExists is false
		await expect(page.locator(".chat-empty-state .muted")).toBeVisible()
	})

	test("session with no log does not render .chat-log-collapse", async ({ page }) => {
		const { session } = sessionNoLogFixture
		await setupSessionPage(page, session.id, sessionNoLogFixture)
		await page.goto(`/session/${session.id}`)

		await expect(page.locator(".chat-log-collapse")).not.toBeVisible()
	})
})

test.describe("Session traces — running session", () => {
	test("running session with no logContent shows 'Waiting for agent output…'", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		const { session } = sessionRunningFixture
		await setupSessionPage(page, session.id, sessionRunningFixture)
		await page.goto(`/session/${session.id}`)

		const emptyState = page.locator(".chat-empty-state")
		await expect(emptyState).toBeVisible()
		await expect(emptyState).toContainText("Waiting for agent output")
		expect(errors).toHaveLength(0)
	})

	test("running session shows .chat-typing-indicator", async ({ page }) => {
		const { session } = sessionRunningFixture
		await setupSessionPage(page, session.id, sessionRunningFixture)
		await page.goto(`/session/${session.id}`)

		await expect(page.locator(".chat-typing-indicator")).toBeVisible()
	})

	test("running session does not show .chat-session-summary", async ({ page }) => {
		const { session } = sessionRunningFixture
		await setupSessionPage(page, session.id, sessionRunningFixture)
		await page.goto(`/session/${session.id}`)

		await expect(page.locator(".chat-session-summary")).not.toBeVisible()
	})
})

test.describe("Session traces — sessions list page", () => {
	test("sessions list shows table row when /api/analytics returns session data", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		await mockApi(page, "**/api/analytics", analyticsFixture)
		await page.goto("/sessions")

		// analytics fixture has 1 session → table should have 1 data row
		const rows = page.locator("table tbody tr")
		await expect(rows).toHaveCount(1)
		expect(errors).toHaveLength(0)
	})

	test("clicking session row icon navigates to /session/:sessionId detail page", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		await mockApi(page, "**/api/analytics", analyticsFixture)

		// Pre-mock the session detail so the detail page can load
		await mockApi(page, "**/api/session/session-test-123", sessionWithLogsFixture)
		await abortRoute(page, "**/api/events/**")

		await page.goto("/sessions")

		// Click the session link icon (◉) in the table row
		const sessionLinkIcon = page.locator(".session-link-icon").first()
		await expect(sessionLinkIcon).toBeVisible()
		await sessionLinkIcon.click()

		await expect(page).toHaveURL(/\/session\/session-test-123/)
		await expect(page.locator(".app-content")).toBeVisible()
		expect(errors).toHaveLength(0)
	})
})
