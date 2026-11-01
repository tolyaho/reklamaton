import { expect, fresh, playInesConversation, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await fresh(page)
})

const PAGES = ["/", "/app/overview", "/app/conversations/1", "/app/customers", "/app/campaigns/1", "/app/business"]

/** Font sizes of every visible text node's parent, below a threshold. */
async function smallText(page: import("@playwright/test").Page, min: number) {
  return page.evaluate((min) => {
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (!text || !el) continue
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (!r.width || !r.height || style.visibility === "hidden" || el.closest(".sr-only,[aria-hidden=true]")) continue
      const size = parseFloat(style.fontSize)
      if (size < min) out.push(`${size}px “${text.slice(0, 40)}”`)
    }
    return out
  }, min)
}

test("no visible text is smaller than 12px, on any page", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForTimeout(400)
    expect(await smallText(page, 12), `small text on ${path}`).toEqual([])
  }
})

test("the product uses Inter for its headings; Fraunces is kept for the landing page", async ({ page }) => {
  for (const path of PAGES.slice(1)) {
    await page.goto(path)
    const family = await page.getByRole("heading", { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily)
    expect(family, path).toContain("Inter")
  }
  await page.goto("/")
  const hero = await page.getByRole("heading", { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily)
  expect(hero).toContain("Fraunces")
})

test("pointing at a profile field explains it and marks the sentence it wrote", async ({ page }) => {
  await playInesConversation(page)
  await page.goto("/app/campaigns/1")
  await page.getByTestId("generate-drafts").click()
  const ines = page.getByTestId("draft-1")
  const budget = ines.getByTestId("draft-factors").getByRole("button", { name: /Budget/ })
  // The explanation is part of the button's name for screen readers, and shown on focus.
  await expect(budget).toHaveAccessibleName(/Says the €3,900 packaging system fits/)
  await budget.focus()
  await expect(ines).toContainText("Budget · up to €4,000: Says the €3,900 packaging system fits")
  await expect(ines.locator("mark.fact-budget")).toHaveAttribute("data-active", "true")
  await budget.blur()
  await expect(ines.locator("mark.fact-budget")).toHaveAttribute("data-active", "false")
})

for (const [width, height] of [
  [1024, 768],
  [1280, 800],
  [1440, 900],
]) {
  test(`the customer table fits its frame at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto("/app/customers")
    const table = page.getByTestId("customer-table")
    const [tableWidth, frameWidth] = await table.evaluate((t) => [t.scrollWidth, t.parentElement!.clientWidth])
    expect(tableWidth).toBeLessThanOrEqual(frameWidth)
  })
}
