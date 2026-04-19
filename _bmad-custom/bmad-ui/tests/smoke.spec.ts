import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

const NAV_LINKS = [
  { label: "Workflow", href: "/workflow" },
  { label: "Sessions", href: "/sessions" },
  { label: "Analytics", href: "/analytics" },
] as const

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  return errors
}

test.describe("Home page smoke", () => {
  test("home page loads without JavaScript errors", async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto("/")
    // index route redirects to /workflow
    await expect(page).toHaveURL(/\/workflow/)
    await expect(page.locator(".app-content")).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test("main navigation links are present in the DOM", async ({ page }) => {
    await page.goto("/")
    // brand / home link
    await expect(page.getByRole("link", { name: "BMAD UI" })).toBeVisible()
    for (const link of NAV_LINKS) {
      await expect(page.getByRole("link", { name: link.label }).first()).toBeVisible()
    }
  })
})

test.describe("Navigation smoke", () => {
  for (const link of NAV_LINKS) {
    test(`${link.label} route renders without errors`, async ({ page }) => {
      const errors = captureConsoleErrors(page)
      await page.goto(link.href)
      await expect(page).toHaveURL(new RegExp(link.href))
      await expect(page.locator(".app-content")).toBeVisible()
      expect(errors).toHaveLength(0)
    })
  }

  test("clicking each nav link navigates to the correct route", async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto("/")
    for (const link of NAV_LINKS) {
      await page.getByRole("link", { name: link.label }).first().click()
      await expect(page).toHaveURL(new RegExp(link.href))
      await expect(page.locator(".app-content")).toBeVisible()
    }
    expect(errors).toHaveLength(0)
  })
})
