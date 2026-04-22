import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"
import analyticsFixture from "./fixtures/analytics-with-sessions.json" with { type: "json" }
import epicFixture from "./fixtures/epic-with-mixed-stories.json" with { type: "json" }
import overviewFixture from "./fixtures/overview-known-counts.json" with { type: "json" }
import { abortRoute, mockApi } from "./helpers/mock-api"

function captureConsoleErrors(page: Page): string[] {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

async function setupHomePage(page: Page): Promise<void> {
	await mockApi(page, "**/api/overview", overviewFixture)
	await mockApi(page, "**/api/analytics", analyticsFixture)
}

async function setupEpicDetailPage(page: Page): Promise<void> {
	await mockApi(page, "**/api/epic/epic-7", epicFixture)
	await mockApi(page, "**/api/overview", overviewFixture)
	await abortRoute(page, "**/api/events/**")
}

test.describe("Artifact consistency — home page counts", () => {
	test("home page renders without JS errors when both overview and analytics are provided", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		await setupHomePage(page)
		await page.goto("/")
		await expect(page.locator(".app-content")).toBeVisible()
		expect(errors).toHaveLength(0)
	})

	test("home page At a Glance section shows stat cards from mocked data", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		await setupHomePage(page)
		await page.goto("/")

		// At a Glance section must be visible — confirms overview + analytics loaded
		await expect(page.getByRole("heading", { name: "At a Glance" })).toBeVisible()

		// Epics stat card: overview fixture has 2 epics.
		// Outer sections use <section>, inner stat cards use <div class="panel">.
		// This narrows to only the inner stat cards.
		const epicsCard = page.locator("div.panel").filter({ has: page.locator("h3:text('Epics')") }).first()
		await expect(epicsCard).toBeVisible()
		await expect(epicsCard.locator("p").first()).toHaveText("2")

		// Sessions stat card: analytics fixture has 1 session
		const sessionsCard = page
			.locator("div.panel")
			.filter({ has: page.locator("h3:text('Agent Sessions')") })
			.first()
		await expect(sessionsCard).toBeVisible()
		await expect(sessionsCard.locator("p").first()).toHaveText("1")

		expect(errors).toHaveLength(0)
	})

	test("home page stories stat card shows story count from overview fixture", async ({ page }) => {
		await setupHomePage(page)
		await page.goto("/")

		// Stories stat card: overview fixture has 3 stories in sprintOverview.stories
		const storiesCard = page
			.locator("div.panel")
			.filter({ has: page.locator("h3:text('Stories')") })
			.first()
		await expect(storiesCard).toBeVisible()
		await expect(storiesCard.locator("p").first()).toHaveText("3")
	})
})

test.describe("Artifact consistency — epic detail story table", () => {
	test("story table renders rows for all stories including planned-only entries", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)
		await setupEpicDetailPage(page)
		await page.goto("/epic/epic-7")

		// Epic fixture has 3 stories in stories array PLUS 1 planned-only entry (7-6-planned-only)
		// filteredStories = 3 + 1 = 4 rows
		const rows = page.locator("table tbody tr")
		await expect(rows).toHaveCount(4)
		expect(errors).toHaveLength(0)
	})

	test("done story shows .step-badge.step-done badge", async ({ page }) => {
		await setupEpicDetailPage(page)
		await page.goto("/epic/epic-7")

		// 7-1-done-story has status "done" → step-badge step-done in Status column
		await expect(page.locator(".step-badge.step-done").first()).toBeVisible()
	})

	test("backlog story shows step-not-started badge", async ({ page }) => {
		await setupEpicDetailPage(page)
		await page.goto("/epic/epic-7")

		// 7-3-backlog-story has status "backlog" → badge class maps to "not-started"
		await expect(page.locator(".step-badge.step-not-started").first()).toBeVisible()
	})

	test("story status badges render without JS errors", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		await setupEpicDetailPage(page)
		await page.goto("/epic/epic-7")

		// Both done and not-started badges must be present
		await expect(page.locator(".step-badge.step-done").first()).toBeVisible()
		await expect(page.locator(".step-badge.step-not-started").first()).toBeVisible()
		expect(errors).toHaveLength(0)
	})

	test("mismatched storyCount vs stories array renders gracefully with no JS crash", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page)

		// epic.storyCount says 3, but stories array has 4 — should render all gracefully.
		// filteredStories = 4 stories + 1 planned-only entry (7-6-planned-only) = 5 rows
		const mismatchedEpic = {
			...epicFixture,
			epic: { ...epicFixture.epic, storyCount: 3 },
			stories: [
				...epicFixture.stories,
				{
					id: "7-extra-story",
					status: "backlog" as const,
					steps: {
						"bmad-create-story": "not-started" as const,
						"bmad-dev-story": "not-started" as const,
						"bmad-code-review": "not-started" as const,
					},
				},
			],
		}
		await mockApi(page, "**/api/epic/epic-7", mismatchedEpic)
		await mockApi(page, "**/api/overview", overviewFixture)
		await abortRoute(page, "**/api/events/**")
		await page.goto("/epic/epic-7")

		// All rows (4 stories + 1 planned-only) must render without a crash
		const rows = page.locator("table tbody tr")
		await expect(rows).toHaveCount(5)
		expect(errors).toHaveLength(0)
	})
})

test.describe("Artifact consistency — story detail navigation", () => {
	test("clicking story row link navigates to story detail without JS errors", async ({ page }) => {
		const errors = captureConsoleErrors(page)
		await setupEpicDetailPage(page)
		await page.goto("/epic/epic-7")

		// Click the first story link in the table
		const storyLink = page.locator("table tbody tr").first().locator("a").first()
		await expect(storyLink).toBeVisible()
		await storyLink.click()

		// Should navigate to /story/:storyId
		await expect(page).toHaveURL(/\/story\//)
		await expect(page.locator(".app-content")).toBeVisible()
		expect(errors).toHaveLength(0)
	})
})
