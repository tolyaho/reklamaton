import { readFile } from "node:fs/promises"
import { expect, fresh, playInesConversation, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await fresh(page)
})

test("a chat turn updates the right customer's profile, with evidence", async ({ page }) => {
  await page.goto("/app/conversations/1")
  await expect(page.getByTestId("thread-intro")).toBeVisible()
  const profile = page.getByTestId("profile-panel")
  await expect(profile).toContainText("New")
  await page.getByTestId("play-turn").click()
  // The customer's message shows first; the profile only changes once the turn is committed.
  await expect(page.getByTestId("thread")).toContainText("Do you do packaging?")
  await expect(profile.getByTestId("profile-updated")).toContainText("Profile updated · 7 fields")
  await expect(profile).toContainText("Qualified")
  await expect(profile).toContainText("pastry boxes")
  await expect(profile).toContainText("Porto")
  // Facts are marked in her message in their colour.
  await expect(page.locator("[data-testid=thread] mark.fact-interest")).toHaveText("our pastry boxes look tired")
  // Following an evidence quote lands on the customer's message and lights up that fact.
  await profile.getByRole("button", { name: /Do you do packaging\?/ }).first().click()
  const mark = page.locator("[data-testid=thread] mark", { hasText: "Do you do packaging?" }).first()
  await expect(mark).toBeInViewport()
  await expect(mark).toHaveAttribute("data-active", "true")
  // Nobody else changed.
  await page.goto("/app/customers")
  await expect(page.getByTestId("customer-row-3")).toContainText("Qualified")
  await expect(page.getByTestId("customer-row-3")).toContainText("48")
})

test("profile changes reach the CRM table and campaign eligibility", async ({ page }) => {
  await page.goto("/app/campaigns/1")
  await expect(page.getByTestId("recipients")).not.toContainText("Ines Calder")
  await page.getByTestId("toggle-excluded").click()
  await expect(page.getByTestId("excluded")).toContainText("Stage is new · No interests known yet")
  await expect(page.getByTestId("excluded")).toContainText("No marketing consent")

  await playInesConversation(page)

  await page.goto("/app/customers")
  const row = page.getByTestId("customer-row-1")
  await expect(row).toContainText("Proposal")
  await expect(row).toContainText("33")
  await expect(row).toContainText("up to €4,000")
  await page.getByTestId("stage-proposal").click()
  await expect(page.getByTestId("customer-count")).toHaveText("Showing 3 of 12")
  await page.getByTestId("customer-search").fill("calder")
  await expect(page.getByTestId("customer-count")).toHaveText("Showing 1 of 12")

  await page.goto("/app/campaigns/1")
  await expect(page.getByTestId("recipients")).toContainText("Ines Calder")
  await expect(page.getByTestId("recipients")).toContainText("updated from chat")
})

test("segment controls filter on real profile fields and show the backend JSON", async ({ page }) => {
  await page.goto("/app/campaigns/1")
  const recipients = page.getByTestId("recipients")
  await expect(recipients.locator("li")).toHaveCount(5)
  await page.getByTestId("seg-stage-qualified").click() // now: proposal only
  await expect(recipients.locator("li")).toHaveCount(1)
  await expect(recipients).toContainText("Theo Marchetti")
  await page.getByTestId("seg-stage-qualified").click()
  await page.getByTestId("seg-last-seen").selectOption("30")
  await expect(recipients.locator("li")).toHaveCount(1)
  await expect(recipients).toContainText("Camille Roux")
  await page.getByRole("button", { name: /Stored as segment_json/ }).click()
  await expect(page.getByTestId("segment-json")).toContainText('"last_seen_older_than_days": 30')
  await expect(page.getByTestId("segment-json")).toContainText('"marketing_opt_in": true')
})

test("customers without consent are never selected, and withdrawing consent removes them", async ({ page }) => {
  await page.goto("/app/customers/7")
  const drawer = page.getByTestId("customer-drawer")
  await expect(drawer).toContainText("No consent")
  await expect(drawer).toContainText("January packaging slots")
  await page.goto("/app/customers/5")
  await page.getByTestId("consent-switch").click()
  await expect(page.getByTestId("consent-switch")).toHaveAttribute("aria-checked", "false")
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/\/app\/customers$/)
  await page.goto("/app/campaigns/1")
  await expect(page.getByTestId("recipients")).not.toContainText("Ruben de Vries")
})

test("drafts, approval rules and CSV export use the current state", async ({ page }) => {
  await playInesConversation(page)
  await page.goto("/app/campaigns/1")
  await expect(page.getByTestId("export-csv")).toBeDisabled()
  await expect(page.getByTestId("stepper")).toContainText("6 customers")
  await page.getByTestId("generate-drafts").click()
  await expect(page.getByTestId("draft-list").getByRole("button")).toHaveCount(6)

  // Ines's draft opens first; each sentence a profile field produced is marked in that field's colour.
  const ines = page.getByTestId("draft-1")
  await expect(ines).toContainText("Hi Ines,")
  await expect(ines.locator("mark.fact-budget")).toHaveText("At €3,900, it fits the budget you mentioned.")
  await expect(ines.locator("mark.fact-interest")).toHaveText("Following up on your new pastry boxes.")
  await expect(ines.getByTestId("draft-factors")).toContainText("Objection · timeline")
  await page.getByTestId("queue-4").click()
  await expect(page.getByTestId("draft-4")).toContainText("Guten Tag Lena Brandt,")
  await page.getByTestId("queue-1").click()

  // Marking as sent needs approval first; there is no button for it on a draft.
  await expect(page.getByTestId("mark-sent-1")).toHaveCount(0)
  await page.getByTestId("approve-1").click()
  await expect(ines.getByTestId("draft-status")).toHaveText("Approved")
  await expect(page.getByTestId("stepper")).toContainText("1 of 6")

  // Theo already has an approved message from another campaign within 24 h.
  await page.getByTestId("queue-2").click()
  await page.getByTestId("approve-2").click()
  await expect(page.getByTestId("block-2")).toContainText("Rate limit")
  await expect(page.getByTestId("draft-2").getByTestId("draft-status")).toHaveText("Draft")

  await page.getByTestId("preview-csv").click()
  await expect(page.getByTestId("csv-preview")).toContainText("ines.calder@example.com")
  await expect(page.getByTestId("csv-preview")).not.toContainText("Theo Marchetti")
  await page.keyboard.press("Escape")

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()])
  expect(download.suggestedFilename()).toBe("outbox_campaign_1.csv")
  const csv = await readFile((await download.path())!, "utf8")
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  const lines = csv.slice(1).split("\r\n")
  expect(lines[0]).toBe("id,campaign_id,customer_id,customer_name,contact,channel,content,status,approved_at")
  expect(csv).toContain("Ines Calder,ines.calder@example.com,email,\"Hi Ines,")
  expect(csv).not.toContain("Theo Marchetti")
  expect(csv).not.toContain("Amara")
  await expect(page.getByTestId("export-status")).toContainText("1 message")

  // After marking as sent, nothing is left to export.
  await page.getByTestId("queue-1").click()
  await page.getByTestId("mark-sent-1").click()
  await expect(ines.getByTestId("draft-status")).toHaveText("Marked as sent")
  await expect(page.getByTestId("export-csv")).toBeDisabled()
})

test("reset restores the starting workspace and state survives a reload", async ({ page }) => {
  await page.goto("/app/conversations/1")
  await page.getByTestId("play-turn").click()
  await expect(page.getByTestId("profile-updated")).toBeVisible()
  await page.reload()
  await expect(page.getByTestId("profile-panel")).toContainText("Qualified")
  await page.getByTestId("reset-demo").click()
  await page.getByTestId("confirm-reset").click()
  await expect(page.getByTestId("thread-intro")).toBeVisible()
  await expect(page.getByTestId("profile-panel")).toContainText("New")
})

test("deep links work and unknown routes get a page", async ({ page }) => {
  await page.goto("/app/customers/3")
  await expect(page.getByTestId("customer-drawer")).toContainText("Amara Okafor")
  await page.goto("/app/campaigns/2")
  await expect(page.getByTestId("outbox")).toContainText("1 draft · 1 approved · 1 marked as sent")
  await page.goto("/app/conversations/4")
  await expect(page.getByTestId("thread")).toContainText("Guten Tag")
  await page.goto("/nope")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("isn't part of the demo")
})

test("the business drawer shows where the prompt comes from", async ({ page }) => {
  await page.goto("/app/business")
  await page.getByTestId("edit-business").click()
  const drawer = page.getByTestId("business-settings")
  await drawer.getByTestId("brand-voice").fill("Dry, precise, a little funny.")
  await expect(drawer).toContainText("- Brand voice: Dry, precise, a little funny.")
  await drawer.getByRole("button", { name: "Save" }).click()
  await page.goto("/app/conversations/1")
  await page.getByTestId("view-prompt").click()
  await expect(page.getByTestId("prompt-sheet")).toContainText("- Brand voice: Dry, precise, a little funny.")
  await expect(page.getByTestId("prompt-sheet")).toContainText("You are Mira, a sales assistant persona.")
})
