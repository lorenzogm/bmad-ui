import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const HOME_LINK_LABEL = "BMAD UI";
const HOME_ENTRY_PATH = "/";
const NAV_LINKS = [
	{ label: "Workflow", href: "/workflow" },
	{ label: "Sessions", href: "/sessions" },
	{ label: "Analytics", href: "/analytics" },
] as const;

const WORKFLOW_STEP_DETAIL_ROUTES = [
	{ label: "PRD detail", href: "/workflow/planning/prd" },
	{ label: "UX Design detail", href: "/workflow/planning/ux" },
	{ label: "Architecture detail", href: "/workflow/solutioning/architecture" },
] as const;

function captureConsoleErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return errors;
}

test.describe("Home page smoke", () => {
	test("home page loads without JavaScript errors", async ({ page }) => {
		const errors = captureConsoleErrors(page);
		await page.goto(HOME_ENTRY_PATH);
		await expect(page).toHaveURL(HOME_ENTRY_PATH);
		await expect(page.locator(".app-content")).toBeVisible();
		expect(errors).toHaveLength(0);
	});

	test("main navigation links are present in the DOM", async ({ page }) => {
		await page.goto(HOME_ENTRY_PATH);
		await expect(
			page.getByRole("link", { name: HOME_LINK_LABEL }),
		).toBeVisible();
		for (const link of NAV_LINKS) {
			await expect(
				page.getByRole("link", { name: link.label }).first(),
			).toBeVisible();
		}
	});
});

test.describe("Navigation smoke", () => {
	for (const link of NAV_LINKS) {
		test(`${link.label} route renders without errors`, async ({ page }) => {
			const errors = captureConsoleErrors(page);
			await page.goto(link.href);
			await expect(page).toHaveURL(new RegExp(link.href));
			await expect(page.locator(".app-content")).toBeVisible();
			expect(errors).toHaveLength(0);
		});
	}

	test("clicking each nav link navigates to the correct route", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page);
		await page.goto(HOME_ENTRY_PATH);
		await expect(page.locator(".app-content")).toBeVisible();
		for (const link of NAV_LINKS) {
			await page.getByRole("link", { name: link.label }).first().click();
			await expect(page).toHaveURL(new RegExp(link.href));
			await expect(page.locator(".app-content")).toBeVisible();
		}
		expect(errors).toHaveLength(0);
	});
});

test.describe("Workflow phase pages smoke", () => {
	test("planning phase renders without JavaScript errors", async ({ page }) => {
		const errors = captureConsoleErrors(page);
		await page.goto("/workflow/planning");
		await expect(page.locator(".app-content")).toBeVisible();
		expect(errors).toHaveLength(0);
	});

	test("solutioning phase renders without JavaScript errors", async ({
		page,
	}) => {
		const errors = captureConsoleErrors(page);
		await page.goto("/workflow/solutioning");
		await expect(page.locator(".app-content")).toBeVisible();
		expect(errors).toHaveLength(0);
	});
});

test.describe("Workflow step detail pages smoke", () => {
	for (const route of WORKFLOW_STEP_DETAIL_ROUTES) {
		test(`${route.label} renders without JavaScript errors`, async ({
			page,
		}) => {
			const errors = captureConsoleErrors(page);
			await page.goto(route.href);
			await expect(page).toHaveURL(route.href);
			await expect(page.locator(".app-content")).toBeVisible();
			expect(errors).toHaveLength(0);
		});
	}

	test("step detail pages include a back link to parent phase", async ({
		page,
	}) => {
		for (const route of WORKFLOW_STEP_DETAIL_ROUTES) {
			await page.goto(route.href);
			await expect(page.locator(".app-content")).toBeVisible();
			const backLink = page.locator(".epic-back-link");
			await expect(backLink).toBeVisible();
		}
	});
});
