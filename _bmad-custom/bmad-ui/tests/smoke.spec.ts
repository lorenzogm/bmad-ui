import { expect, test, type Page } from "@playwright/test"

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

test.describe("Home page", () => {
  test("loads without JavaScript errors", async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto("/")
    await expect(page).toHaveTitle(/bmad/i)
    expect(errors).toHaveLength(0)
  })

  test("main navigation links are present in the DOM", async ({ page }) => {
    await page.goto("/")
    for (const link of NAV_LINKS) {
      await expect(page.getByRole("link", { name: link.label }).first()).toBeVisible()
    }
  })
})

test.describe("Navigation smoke tests", () => {
  for (const link of NAV_LINKS) {
    test(`clicking "${link.label}" navigates to ${link.href} without errors`, async ({ page }) => {
      const errors = captureConsoleErrors(page)
      await page.goto("/")

      await page.getByRole("link", { name: link.label }).first().click()
      await expect(page).toHaveURL(new RegExp(`${link.href}.*`))

      // Verify at least one meaningful element is visible
      await expect(page.locator("#root")).toBeVisible()
      expect(errors).toHaveLength(0)
    })
  }
})
