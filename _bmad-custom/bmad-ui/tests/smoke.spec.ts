import { test, expect, type Page } from "@playwright/test"

function captureConsoleErrors(page: Page): string[] {
const errors: string[] = []
page.on("pageerror", (error) => errors.push(error.message))
return errors
}

test.describe("Home page smoke tests", () => {
test("home page renders without JavaScript errors", async ({ page }) => {
const errors = captureConsoleErrors(page)
await page.goto("/")
expect(errors).toHaveLength(0)
})

test("main navigation links are present", async ({ page }) => {
const errors = captureConsoleErrors(page)
await page.goto("/")

// Brand link navigates to home
await expect(page.getByRole("link", { name: "BMAD UI" })).toBeVisible()
await expect(page.getByRole("link", { name: "Workflow" })).toBeVisible()
// Use main nav Sessions link (class-based to avoid ambiguity with analytics submenu)
await expect(page.locator(".sidebar-link-section", { hasText: "Sessions" })).toBeVisible()
await expect(page.locator(".sidebar-link-section", { hasText: "Analytics" })).toBeVisible()

expect(errors).toHaveLength(0)
})
})

test.describe("Navigation smoke tests", () => {
test("workflow route renders without errors", async ({ page }) => {
const errors = captureConsoleErrors(page)
await page.goto("/")
await page.getByRole("link", { name: "Workflow" }).click()
await expect(page).toHaveURL(/\/workflow/)
expect(errors).toHaveLength(0)
})

test("sessions route renders without errors", async ({ page }) => {
const errors = captureConsoleErrors(page)
await page.goto("/")
// Click the main nav Sessions link (not the analytics submenu)
await page.locator(".sidebar-link-section", { hasText: "Sessions" }).click()
await expect(page).toHaveURL(/\/sessions/)
expect(errors).toHaveLength(0)
})

test("analytics route renders without errors", async ({ page }) => {
const errors = captureConsoleErrors(page)
await page.goto("/")
await page.locator(".sidebar-link-section", { hasText: "Analytics" }).click()
await expect(page).toHaveURL(/\/analytics/)
expect(errors).toHaveLength(0)
})
})
