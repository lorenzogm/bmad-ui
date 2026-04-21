import type { Page } from "@playwright/test"

export async function mockApi(page: Page, url: string, fixture: unknown): Promise<void> {
	await page.route(url, async (route) => {
		await route.fulfill({ json: fixture })
	})
}

export async function abortRoute(page: Page, urlPattern: string): Promise<void> {
	await page.route(urlPattern, async (route) => {
		await route.abort()
	})
}

export async function mockApiWithStatus(
	page: Page,
	url: string,
	status: number,
	body?: string,
): Promise<void> {
	await page.route(url, async (route) => {
		await route.fulfill({ status, body: body ?? "" })
	})
}
