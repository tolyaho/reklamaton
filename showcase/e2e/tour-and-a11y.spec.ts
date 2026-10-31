import { readFile } from "node:fs/promises"
import { expect, fresh, noHorizontalOverflow, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await fresh(page, "/")
})

test("the guided tour walks the whole loop on the real demo state", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("hero-tour").click()
  const panel = page.getByTestId("tour-panel")
  await expect(panel).toContainText("1 / 10")
  await expect(page).toHaveURL(/\/app\/overview$/)

  const next = () => panel.getByTestId("tour-next").click()
  const act = () => panel.getByTestId("tour-action").click()

  await next() // conversation
  await expect(page).toHaveURL(/\/app\/conversations\/1$/)
  await act() // plays turn 1, then the tour moves on by itself
  await expect(panel).toContainText("Her profile updated itself", { timeout: 20_000 })
  await expect(page.getByTestId("profile-updated")).toBeVisible()
  await next()
  await act() // remaining turns
  await expect(panel).toContainText("Done", { timeout: 40_000 })
  await next() // segment
  await expect(page).toHaveURL(/\/app\/campaigns\/1$/)
  await expect(page.getByTestId("recipients")).toContainText("Ines Calder")
  await next()
  await act() // generate drafts → auto-advance to the draft step
  await expect(panel).toContainText("Personalized from her profile", { timeout: 10_000 })
  await next()
  await act() // approve → auto-advance to export
  await expect(panel).toContainText("Export the approved messages", { timeout: 10_000 })
  const [download] = await Promise.all([page.waitForEvent("download"), act()])
  const csv = await readFile((await download.path())!, "utf8")
  expect(csv).toContain("Ines Calder")
  await next()
  await expect(panel).toContainText("10 / 10")
  await panel.getByTestId("tour-finish").click()
  await expect(panel).toHaveCount(0)
})

test("the tour can be skipped, closed with Escape and navigated back", async ({ page }) => {
  await page.goto("/app/overview")
  await page.getByTestId("start-tour").click()
  const panel = page.getByTestId("tour-panel")
  await panel.getByTestId("tour-next").click()
  await expect(panel).toContainText("2 / 10")
  await panel.getByRole("button", { name: "Back" }).click()
  await expect(panel).toContainText("1 / 10")
  await page.keyboard.press("Escape")
  await expect(panel).toHaveCount(0)
  await page.getByTestId("start-tour").click()
  await page.getByRole("button", { name: "Close the tour" }).click()
  await expect(panel).toHaveCount(0)
})

test("keyboard only: reach the demo, play a turn, open and close a drawer", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("Tab") // skip link
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "Reklamaton home" })).toBeFocused()
  await page.getByTestId("hero-explore").focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/app\/overview$/)
  await page.goto("/app/conversations/1")
  await page.getByTestId("play-turn").focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("profile-updated")).toBeVisible({ timeout: 15_000 })
  await page.goto("/app/customers")
  const link = page.getByRole("link", { name: "Amara Okafor" })
  await link.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByTestId("customer-drawer")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("customer-drawer")).toHaveCount(0)
})

test("reduced motion plays a turn almost instantly", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/app/conversations/1")
  const started = Date.now()
  await page.getByTestId("play-turn").click()
  await expect(page.getByTestId("profile-updated")).toBeVisible()
  expect(Date.now() - started).toBeLessThan(2500)
})

const PAGES = ["/", "/app/overview", "/app/conversations/1", "/app/customers", "/app/campaigns/1", "/app/business"]
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [1280, 640],
]) {
  test(`no horizontal overflow at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForTimeout(300)
      await noHorizontalOverflow(page)
    }
  })
}

test("mobile: navigation sheet and stacked profile work at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/app/overview")
  await page.getByTestId("open-nav").click()
  await page.getByRole("link", { name: /Conversations/ }).click()
  await expect(page).toHaveURL(/\/app\/conversations\/1$/)
  await page.getByTestId("play-turn").click()
  await expect(page.getByTestId("profile-updated")).toBeAttached({ timeout: 15_000 })
  await page.goto("/app/customers")
  await expect(page.getByTestId("customer-cards").locator("li")).toHaveCount(12)
  await expect(page.getByTestId("customer-table")).toBeHidden()
})
