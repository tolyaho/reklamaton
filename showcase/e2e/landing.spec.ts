import { readFile } from "node:fs/promises"
import { expect, fresh, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await fresh(page)
})

test("the landing leads with the product, says what the demo is, and opens the workspace", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every conversation becomes an opportunity.")
  await expect(page.getByTestId("hero-disclosure")).toContainText("Interactive demo")
  await expect(page.getByTestId("hero-disclosure")).toContainText("Synthetic data")
  await expect(page.getByTestId("hero-disclosure")).toContainText("No live AI calls")
  // The old landing's invented KPIs must not come back.
  for (const claim of ["12+", "50+", "80%", "Time saved"]) {
    await expect(page.locator("body")).not.toContainText(claim)
  }
  // The full explanation is one click away.
  await page.getByTestId("hero-disclosure").click()
  await expect(page.getByTestId("about-demo")).toContainText("Scripted conversation")
  await expect(page.getByTestId("about-demo")).toContainText("Not in Reklamaton at all")
  await page.keyboard.press("Escape")
  await page.getByTestId("hero-explore").click()
  await expect(page).toHaveURL(/\/app\/overview$/)
  await expect(page.getByTestId("pipeline")).toContainText("12 customers")
  await expect(page.getByTestId("attention")).toContainText("Ines Calder wrote in")
})

test("the hero replays the scripted conversation without touching the visitor's workspace", async ({ page }) => {
  await page.goto("/")
  const hero = page.getByTestId("hero-reel")
  await expect(hero).toContainText("Scripted demo replay")
  // It plays by itself: facts get marked in Ines's words and her memory fills in.
  await expect(hero.locator("mark.fact-budget")).toHaveText("around €4,000 all in", { timeout: 15_000 })
  await expect(hero).toContainText("up to €4,000")
  // Steps can be chosen directly; the last one shows the draft her profile produced.
  await hero.getByRole("button", { name: "Show the draft" }).click()
  await expect(hero.getByTestId("reel-draft")).toContainText("At €3,900, it fits the budget you mentioned.")
  await expect(hero).toContainText("In audience")
  await hero.getByRole("button", { name: "Show message 1" }).click()
  await expect(hero.getByTestId("reel-draft")).toHaveCount(0)
  // The replay is separate from the workspace: Ines's conversation there is still unread.
  await page.goto("/app/conversations/1")
  await expect(page.getByTestId("thread-intro")).toBeVisible()
})

test("the three acts run on the real workspace: conversation, memory, campaign, approval, export", async ({ page }) => {
  await page.goto("/")
  // Act I: the first message is read when the conversation comes into view.
  await page.locator("#conversation").scrollIntoViewIfNeeded()
  const heard = page.getByTestId("story-heard")
  await expect(heard).toContainText("pastry boxes", { timeout: 10_000 })
  await expect(page.getByTestId("story-thread").locator("mark.fact-interest")).toHaveText("our pastry boxes look tired")
  await page.getByTestId("story-play-all").click()
  await expect(heard).toContainText("up to €4,000", { timeout: 20_000 })
  await expect(heard).toContainText("timeline: last studio took four months")
  await expect(page.getByTestId("act-conversation")).toContainText("All 4 messages read.")

  // Act II: every field can be traced to the words it came from.
  await page.locator("#memory").scrollIntoViewIfNeeded()
  const timeline = page.getByTestId("story-timeline")
  await expect(timeline.getByTestId("timeline-4")).toBeVisible()
  await page
    .getByTestId("story-memory")
    .getByRole("button", { name: /Show where budget came from/ })
    .click()
  await expect(timeline.getByTestId("timeline-2").locator("mark[data-active=true]")).toHaveText("around €4,000 all in")

  // Act III: she is in the audience; her draft is written from her profile; a person approves it.
  await page.locator("#campaign").scrollIntoViewIfNeeded()
  await expect(page.getByTestId("story-recipients")).toContainText("Ines Calder")
  await expect(page.getByTestId("story-export")).toBeDisabled()
  await page.getByTestId("story-generate").click()
  const draft = page.getByTestId("draft-1")
  await expect(draft.locator("mark.fact-budget")).toHaveText("At €3,900, it fits the budget you mentioned.")
  await page.getByTestId("approve-1").click()
  await expect(draft.getByTestId("draft-status")).toHaveText("Approved")
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("story-export").click()])
  expect(download.suggestedFilename()).toBe("outbox_campaign_1.csv")
  const csv = await readFile((await download.path())!, "utf8")
  expect(csv).toContain("Ines Calder,ines.calder@example.com,email")
  expect(csv).not.toContain("Theo Marchetti")

  // The workspace continues from here.
  await page.goto("/app/campaigns/1")
  await expect(page.getByTestId("draft-1").getByTestId("draft-status")).toHaveText("Approved")
})

test("the landing's approval keeps the backend's 24-hour rule", async ({ page }) => {
  await page.goto("/")
  await page.locator("#campaign").scrollIntoViewIfNeeded()
  await page.getByTestId("story-generate").click()
  // Theo was approved for another campaign three hours before the demo starts.
  await page
    .getByTestId("story-recipients")
    .getByRole("button", { name: /Theo Marchetti/ })
    .click()
  await page.getByTestId("approve-2").click()
  await expect(page.getByTestId("block-2")).toContainText("Rate limit")
  await expect(page.getByTestId("story-export")).toBeDisabled()
})

test("reduced motion: nothing plays by itself and the hero opens on its last frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.getByTestId("reel-draft")).toBeVisible()
  await expect(page.getByTestId("reel-toggle")).toHaveCount(0)
  await page.locator("#conversation").scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await expect(page.getByTestId("story-play")).toContainText("Play the message")
  await page.getByTestId("story-play").click()
  await expect(page.getByTestId("story-heard")).toContainText("pastry boxes", { timeout: 2_500 })
})
