import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import epicFixture from "./fixtures/epic-with-mixed-stories.json" with { type: "json" }
import overviewFixture from "./fixtures/overview-known-counts.json" with { type: "json" }
import { abortRoute, mockApi, mockApiWithStatus } from "./helpers/mock-api"

const EPIC_PATH = "/epic/epic-7"
const RUN_SKILL_URL = "**/api/workflow/run-skill"

function captureConsoleErrors(page: Page): string[] {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

async function setupEpicPage(page: Page): Promise<void> {
	await mockApi(page, "**/api/epic/epic-7", epicFixture)
	await mockApi(page, "**/api/overview", overviewFixture)
	await abortRoute(page, "**/api/events/**")
}

test.describe("Workflow actions — Plan all stories", () => {
	test("Plan all stories button renders with eligible story count", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		// storiesNeedingPlan = ["7-6-planned-only", "7-3-backlog-story"] → count 2
		const planButton = page.locator('button.cta:has-text("Plan all stories (2)")')
		await expect(planButton).toBeVisible()
		expect(errors).toHaveLength(0)
	})

	test("Plan all stories button is enabled in local dev mode", async ({ page }) => {
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		const planButton = page.locator('button.cta:has-text("Plan all stories")')
		await expect(planButton).toBeVisible()
		await expect(planButton).not.toBeDisabled()
	})

	test("already-done stories are excluded from Plan all stories count", async ({ page }) => {
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		// 7-1-done-story has bmad-create-story=completed → NOT in storiesNeedingPlan
		// Only 7-6-planned-only and 7-3-backlog-story → count 2 (not 3)
		const planButton = page.locator('button.cta:has-text("Plan all stories (2)")')
		await expect(planButton).toBeVisible()

		const wrongCountButton = page.locator('button.cta:has-text("Plan all stories (3)")')
		await expect(wrongCountButton).not.toBeVisible()
	})

	test("Plan all stories posts correct story IDs — no duplicates, no done stories", async ({
		page,
	}) => {
		await setupEpicPage(page)

		const requestBodies: Array<{ skill: string; storyId: string }> = []
		await page.route(RUN_SKILL_URL, async (route) => {
			const body = JSON.parse(route.request().postData() ?? "{}") as {
				skill: string
				storyId: string
			}
			requestBodies.push(body)
			await route.fulfill({ status: 200, json: { ok: true } })
		})

		await page.goto(EPIC_PATH)
		const planButton = page.locator('button.cta:has-text("Plan all stories")')
		await expect(planButton).toBeVisible()

		// Capture both POSTs before they complete
		await Promise.all([
			planButton.click(),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
		])

		expect(requestBodies).toHaveLength(2)
		const storyIds = requestBodies.map((b) => b.storyId).sort()
		expect(storyIds).toEqual(["7-3-backlog-story", "7-6-planned-only"])

		// All requests target the correct skill
		for (const body of requestBodies) {
			expect(body.skill).toBe("bmad-create-story")
		}

		// Done story must NOT appear
		expect(storyIds).not.toContain("7-1-done-story")
	})

	test("bulkError banner appears when a Plan all POST returns a non-409 error", async ({
		page,
	}) => {
		await setupEpicPage(page)

		let callCount = 0
		await page.route(RUN_SKILL_URL, async (route) => {
			callCount++
			if (callCount === 1) {
				await route.fulfill({ status: 200, json: { ok: true } })
			} else {
				await route.fulfill({ status: 500, body: "Internal Server Error" })
			}
		})

		await page.goto(EPIC_PATH)
		const planButton = page.locator('button.cta:has-text("Plan all stories")')
		await expect(planButton).toBeVisible()

		await Promise.all([
			planButton.click(),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
		])

		// Error banner must show for non-409 failure
		await expect(page.locator(".error-banner")).toBeVisible()
	})

	test("409 response for Plan all is silently skipped — no error banner", async ({ page }) => {
		await setupEpicPage(page)
		await mockApiWithStatus(page, RUN_SKILL_URL, 409)

		await page.goto(EPIC_PATH)
		const planButton = page.locator('button.cta:has-text("Plan all stories")')
		await expect(planButton).toBeVisible()

		await Promise.all([
			planButton.click(),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
			page.waitForResponse((r) => r.url().includes("/api/workflow/run-skill")),
		])

		// No error banner for 409 (silently skipped)
		await expect(page.locator(".error-banner")).not.toBeVisible()
	})
})

test.describe("Workflow actions — Develop all stories", () => {
	test("Develop all stories button renders when there are ready-for-dev stories", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		// showDevelopAllButton: 7-2-ready-story has create-story=completed and status != done
		await expect(page.locator('button:has-text("Develop all stories")')).toBeVisible()
		expect(errors).toHaveLength(0)
	})

	test("Stop orchestration button appears after Develop all stories is clicked", async ({
		page,
	}) => {
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		const developButton = page.locator('button:has-text("Develop all stories")')
		await expect(developButton).toBeVisible()
		await developButton.click()

		// Stop button must appear while orchestrating
		await expect(page.locator('button.ghost:has-text("Stop")')).toBeVisible()
	})

	test("clicking Stop clears orchestration — Stop button disappears", async ({ page }) => {
		await setupEpicPage(page)
		await mockApi(page, RUN_SKILL_URL, { ok: true })
		await page.goto(EPIC_PATH)

		const developButton = page.locator('button:has-text("Develop all stories")')
		await expect(developButton).toBeVisible()
		await developButton.click()

		const stopButton = page.locator('button.ghost:has-text("Stop")')
		await expect(stopButton).toBeVisible()
		await stopButton.click()

		// After stopping, Stop button should be gone
		await expect(stopButton).not.toBeVisible()
	})

	test("bulkError banner appears when Develop all POST returns a non-409 error", async ({
		page,
	}) => {
		await setupEpicPage(page)
		await page.route(RUN_SKILL_URL, async (route) => {
			await route.fulfill({ status: 500, body: "Internal Server Error" })
		})

		await page.goto(EPIC_PATH)
		const developButton = page.locator('button:has-text("Develop all stories")'	)
		await expect(developButton).toBeVisible()
		await developButton.click()

		// Error banner must appear for non-409 dev-story failures
		await expect(page.locator(".error-banner")).toBeVisible({ timeout: 5000 })
	})
})
