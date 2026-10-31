import { test as base, expect, type Page } from "@playwright/test"

/**
 * Every test fails if the page logs a console error, throws, or tries to reach any host other than
 * the local server: the demo must work with no backend, no OpenAI and no third-party requests.
 */
export const test = base.extend<{ guard: { external: string[]; errors: string[] } }>({
  guard: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL!).origin
      const external: string[] = []
      const errors: string[] = []
      await page.route("**/*", (route) => {
        const url = route.request().url()
        if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue()
        external.push(url)
        return route.abort()
      })
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()))
      page.on("pageerror", (e) => errors.push(String(e)))
      await use({ external, errors })
      expect(external, "requests to other hosts").toEqual([])
      expect(errors, "console errors").toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function fresh(page: Page, path = "/app/overview") {
  await page.goto(path)
  await page.evaluate(() => localStorage.clear())
  await page.goto(path)
}

/** Plays every remaining turn of Ines's scripted conversation and waits for the last profile update. */
export async function playInesConversation(page: Page) {
  await page.goto("/app/conversations/1")
  await page.getByTestId("play-all").click()
  await expect(page.getByText("Conversation complete.")).toBeVisible({ timeout: 40_000 })
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0)
}
