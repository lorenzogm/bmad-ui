import type { Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

const HOME_LINK_LABEL = "BMAD UI"
const HOME_ENTRY_PATH = "/"
const HOME_REDIRECT_PATH_REGEX = /\/workflow/
const NAV_LINKS = [
  { label: "Workflow", href: "/workflow" },
  { label: "Sessions", href: "/sessions" },
  { label: "Analytics", href: "/analytics" },
] as const

function captureJavaScriptErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })
  return errors
}

test.describe("Home page smoke", () => {
  test("home entry route loads without JavaScript errors", async ({ page }) => {
    const errors = captureJavaScriptErrors(page)
    await page.goto(HOME_ENTRY_PATH)
    await expect(page).toHaveURL(HOME_REDIRECT_PATH_REGEX)
    await expect(page.locator(".app-content")).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test("main navigation links are present in the DOM", async ({ page }) => {
    await page.goto(HOME_ENTRY_PATH)
    await expect(page.getByRole("link", { name: HOME_LINK_LABEL })).toBeVisible()
    for (const link of NAV_LINKS) {
      await expect(page.getByRole("link", { name: link.label }).first()).toBeVisible()
    }
  })
})

test.describe("Navigation smoke", () => {
  for (const link of NAV_LINKS) {
    test(`${link.label} route renders without errors`, async ({ page }) => {
      const errors = captureJavaScriptErrors(page)
      await page.goto(link.href)
      await expect(page).toHaveURL(new RegExp(link.href))
      await expect(page.locator(".app-content")).toBeVisible()
      expect(errors).toHaveLength(0)
    })
  }

  test("clicking each nav link navigates to the correct route", async ({ page }) => {
    const errors = captureJavaScriptErrors(page)
    await page.goto(HOME_ENTRY_PATH)
    await page.getByRole("link", { name: HOME_LINK_LABEL }).click()
    await expect(page).toHaveURL(HOME_REDIRECT_PATH_REGEX)
    await expect(page.locator(".app-content")).toBeVisible()
    for (const link of NAV_LINKS) {
      await page.getByRole("link", { name: link.label }).first().click()
      await expect(page).toHaveURL(new RegExp(link.href))
      await expect(page.locator(".app-content")).toBeVisible()
    }
    expect(errors).toHaveLength(0)
  })
})
