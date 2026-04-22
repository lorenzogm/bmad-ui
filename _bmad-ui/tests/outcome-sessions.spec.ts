import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import analyticsWithOutcomeFixture from "./fixtures/analytics-with-outcome-sessions.json" with {
	type: "json",
};
import sessionWithLogsFixture from "./fixtures/session-with-logs.json" with {
	type: "json",
};
import { abortRoute, mockApi } from "./helpers/mock-api";

function captureConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return errors;
}

test.describe("Sessions list — new outcome schema fields", () => {
	test("sessions list renders all rows without JS errors", async ({ page }) => {
		const errors = captureConsoleErrors(page);
		await mockApi(page, "**/api/analytics", analyticsWithOutcomeFixture);
		await page.goto("/sessions");

		// Fixture has 3 sessions
		const rows = page.locator("table tbody tr");
		await expect(rows).toHaveCount(3);
		expect(errors).toHaveLength(0);
	});

	test("outcome values appear in session rows", async ({ page }) => {
		const errors = captureConsoleErrors(page);
		await mockApi(page, "**/api/analytics", analyticsWithOutcomeFixture);
		await page.goto("/sessions");

		// Check that each outcome value is visible in the table
		await expect(page.locator("table").getByText("pushed")).toBeVisible();
		await expect(page.locator("table").getByText("delivered")).toBeVisible();
		await expect(page.locator("table").getByText("aborted")).toBeVisible();
		expect(errors).toHaveLength(0);
	});

	test("clicking session row icon navigates to detail page and detail renders without JS errors", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page);
		const sessionId = analyticsWithOutcomeFixture.sessions[0].sessionId;

		await mockApi(page, "**/api/analytics", analyticsWithOutcomeFixture);
		await mockApi(page, `**/api/session/${sessionId}`, sessionWithLogsFixture);
		await abortRoute(page, "**/api/events/**");

		await page.goto("/sessions");

		const sessionLinkIcon = page.locator(".session-link-icon").first();
		await expect(sessionLinkIcon).toBeVisible();
		await sessionLinkIcon.click();

		await expect(page).toHaveURL(/\/session\//);
		await expect(page.locator(".app-content")).toBeVisible();
		expect(errors).toHaveLength(0);
	});

	test("session detail page shows agent_active_minutes when present in session", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page);
		const { session } = sessionWithLogsFixture;

		await mockApi(page, `**/api/session/${session.id}`, sessionWithLogsFixture);
		await abortRoute(page, "**/api/events/**");

		await page.goto(`/session/${session.id}`);

		// Session detail page should render without errors
		await expect(page.locator(".app-content")).toBeVisible();

		// Click "Details" toggle to reveal the collapsible metadata panel
		const detailsButton = page.locator("button", { hasText: "Details" });
		await expect(detailsButton).toBeVisible();
		await detailsButton.click();

		// agent_active_minutes row should be visible (42.5m from fixture)
		const activeTimeCell = page.locator(".agent-active-minutes");
		await expect(activeTimeCell).toBeVisible();
		expect(errors).toHaveLength(0);
	});

	test("session detail page shows outcome when present in session", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page);
		const { session } = sessionWithLogsFixture;

		await mockApi(page, `**/api/session/${session.id}`, sessionWithLogsFixture);
		await abortRoute(page, "**/api/events/**");

		await page.goto(`/session/${session.id}`);

		// Click "Details" toggle to reveal the collapsible metadata panel
		const detailsButton2 = page.locator("button", { hasText: "Details" });
		await expect(detailsButton2).toBeVisible();
		await detailsButton2.click();

		const outcomeCell = page.locator(".session-outcome");
		await expect(outcomeCell).toBeVisible();
		await expect(outcomeCell).toContainText("pushed");
		expect(errors).toHaveLength(0);
	});
});
