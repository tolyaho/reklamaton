import { describe, expect, it } from "vitest"
import { channelLimit, composeDraft, fitToLimit } from "./compose"
import { buildOutboxCsv, csvSafeCell, exportRows } from "./csv"
import { applyProfilePatch, checkSegment, segmentJson } from "./engine"
import { buildChatInstructions } from "./prompt"
import { initialState, outboxForCampaign, reduce, type Action } from "./state"
import type { DemoState } from "./types"

const INES = 1
const THEO = 2
const LENA = 4
const RUBEN = 5
const SOFIA = 7
const JANUARY = 1
const LABELS = 2

function run(state: DemoState, ...actions: Action[]) {
  let s = state
  for (const a of actions) {
    const out = reduce(s, a)
    expect(out.result.ok, JSON.stringify(out.result)).toBe(true)
    s = out.state
  }
  return s
}

const playAll = (s: DemoState) => run(s, ...Array.from({ length: 4 }, () => ({ type: "playTurn", chatId: 1 }) as Action))
const recipients = (s: DemoState, campaignId: number) => {
  const campaign = s.campaigns.find((c) => c.id === campaignId)!
  return s.customers.filter((c) => checkSegment(c, s.profiles[c.id], campaign.segment, s.now).matches).map((c) => c.id)
}
const draftFor = (s: DemoState, campaignId: number, customerId: number) =>
  s.outbox.find((m) => m.campaign_id === campaignId && m.customer_id === customerId)!

describe("profile merge (port of store.apply_profile_patch)", () => {
  it("only grows lists, clamps the score and timestamps notes", () => {
    const base = initialState().profiles[INES]
    const { profile, changes } = applyProfilePatch(
      { ...base, interests: ["packaging"], lead_score: 95 },
      { interests: ["packaging", "labels"], lead_score_delta: 20, notes_append: "Wants a call." },
      "2026-10-26T10:00:00.000Z",
    )
    expect(profile.interests).toEqual(["packaging", "labels"])
    expect(profile.lead_score).toBe(100)
    expect(profile.notes.at(-1)).toEqual({ at: "2026-10-26T10:00:00.000Z", text: "Wants a call." })
    expect(changes.map((c) => c.field)).toEqual(["interests", "lead_score", "notes"])
    expect(applyProfilePatch(base, { lead_score_delta: -50 }, base.updated_at).profile.lead_score).toBe(0)
  })
})

describe("conversation → profile", () => {
  it("each scripted turn updates Ines's profile and nobody else's", () => {
    const s0 = initialState()
    const s1 = run(s0, { type: "playTurn", chatId: 1 })
    expect(s1.profiles[INES]).toMatchObject({ lead_stage: "qualified", lead_score: 13, location: "Porto", tone: "friendly" })
    expect(s1.profiles[INES].interests).toEqual(["packaging", "pastry boxes"])
    for (const c of s0.customers.filter((c) => c.id !== INES)) expect(s1.profiles[c.id]).toEqual(s0.profiles[c.id])

    const change = s1.lastProfileChange!
    expect(change.customer_id).toBe(INES)
    expect(change.changes.find((c) => c.field === "lead_stage")).toMatchObject({ before: "new", after: "qualified" })
    // Evidence quotes are real substrings of the message that caused them.
    const msg = s1.messages.find((m) => m.id === change.message_id)!
    for (const c of change.changes) if (c.evidence) expect(msg.content).toContain(c.evidence)

    const s4 = playAll(s0)
    expect(s4.profiles[INES]).toMatchObject({ lead_stage: "proposal", lead_score: 33, budget_max: 4000 })
    expect(s4.profiles[INES].objections).toEqual(["timeline: last studio took four months"])
    expect(s4.messages.filter((m) => m.chat_id === 1)).toHaveLength(8)
    expect(reduce(s4, { type: "playTurn", chatId: 1 }).result.ok).toBe(false)
  })

  it("never mutates the previous state", () => {
    const s0 = initialState()
    const snapshot = JSON.stringify(s0)
    playAll(s0)
    reduce(s0, { type: "generateDrafts", campaignId: JANUARY })
    expect(JSON.stringify(s0)).toBe(snapshot)
  })
})

describe("segments (port of store.customer_matches_segment)", () => {
  it("use the stored profile fields, so Ines joins the segment once the chat qualifies her", () => {
    const s0 = initialState()
    expect(recipients(s0, JANUARY)).toEqual([2, 3, 4, 5, 6])
    const ines = checkSegment(s0.customers[0], s0.profiles[INES], s0.campaigns[0].segment, s0.now)
    expect(ines.reasons).toEqual(["Stage is new", "No interests known yet"])
    const s1 = run(s0, { type: "playTurn", chatId: 1 })
    expect(recipients(s1, JANUARY)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it("never include customers without marketing consent", () => {
    const s0 = initialState()
    const sofia = s0.customers.find((c) => c.id === SOFIA)!
    // Sofía matches stage and interests, but has not opted in.
    expect(checkSegment(sofia, s0.profiles[SOFIA], s0.campaigns[0].segment, s0.now).reasons).toEqual(["No marketing consent"])
    const s1 = run(s0, { type: "updateSegment", campaignId: JANUARY, segment: { ...s0.campaigns[0].segment, marketing_opt_in: false } })
    expect(s1.campaigns[0].segment.marketing_opt_in).toBe(true)
    expect(recipients(s1, JANUARY)).not.toContain(SOFIA)
  })

  it("filter on stage, interests and last-seen age", () => {
    const s0 = initialState()
    const seg = (patch: object) => ({ ...s0.campaigns[0].segment, ...patch })
    let s = run(s0, { type: "updateSegment", campaignId: JANUARY, segment: seg({ lead_stage_in: ["proposal"] }) })
    expect(recipients(s, JANUARY)).toEqual([THEO])
    s = run(s0, { type: "updateSegment", campaignId: JANUARY, segment: seg({ interests_any: ["gift boxes"] }) })
    expect(recipients(s, JANUARY)).toEqual([RUBEN, 6])
    s = run(s0, { type: "updateSegment", campaignId: JANUARY, segment: seg({ last_seen_older_than_days: 30 }) })
    expect(recipients(s, JANUARY)).toEqual([6])
    expect(JSON.parse(segmentJson(s.campaigns[0].segment))).toEqual({
      marketing_opt_in: true, lead_stage_in: ["qualified", "proposal"], interests_any: ["packaging", "labels"],
      last_seen_older_than_days: 30,
    })
  })
})

describe("drafts", () => {
  it("are written once per matching customer and personalised from that customer's profile", () => {
    const s = run(playAll(initialState()), { type: "generateDrafts", campaignId: JANUARY })
    const drafts = outboxForCampaign(s, JANUARY)
    expect(drafts.map((d) => d.customer_id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6])
    for (const d of drafts) {
      const customer = s.customers.find((c) => c.id === d.customer_id)!
      expect(d.content).toContain(customer.name.split(" ")[0])
      expect(d.content.length).toBeLessThanOrEqual(channelLimit("email"))
      expect(d.status).toBe("draft")
    }
    const ines = draftFor(s, JANUARY, INES)
    expect(ines.content).toContain("pastry boxes")
    expect(ines.content).toContain("fits the budget")
    expect(ines.content).toContain("timeline is agreed")
    expect(ines.factors.map((f) => f.field)).toEqual(["tone", "interests", "budget", "objections", "lead_stage", "channel"])
    expect(draftFor(s, JANUARY, LENA)).toMatchObject({ language: "de" })
    expect(draftFor(s, JANUARY, LENA).content).toMatch(/^Guten Tag Lena Brandt,/)
    expect(draftFor(s, JANUARY, THEO).content).toContain("label refresh (€1,600)")

    const again = reduce(s, { type: "generateDrafts", campaignId: JANUARY })
    expect(again.result).toEqual({ ok: true, created: 0, skipped: 6 })
  })

  it("truncate at a word boundary like ad_gen", () => {
    expect(fitToLimit("one two three four five six", 12)).toBe("one two…")
    expect(fitToLimit("short", 160)).toBe("short")
  })

  it("compose deterministically", () => {
    const s = initialState()
    const args = [s.business, s.campaigns[0], s.customers[2], s.profiles[3], s.personas[0]] as const
    expect(composeDraft(...args)).toEqual(composeDraft(...args))
  })
})

describe("approval and sending", () => {
  it("moves draft → approved → sent, and only approved messages can be marked as sent", () => {
    const s0 = run(initialState(), { type: "generateDrafts", campaignId: JANUARY })
    const id = draftFor(s0, JANUARY, RUBEN).id
    expect(reduce(s0, { type: "markSent", messageId: id }).result.ok).toBe(false)
    const s1 = run(s0, { type: "approve", messageId: id })
    expect(draftFor(s1, JANUARY, RUBEN)).toMatchObject({ status: "approved", approved_at: s1.now })
    const s2 = run(s1, { type: "markSent", messageId: id })
    expect(draftFor(s2, JANUARY, RUBEN)).toMatchObject({ status: "sent", sent_at: s2.now })
    expect(reduce(s2, { type: "approve", messageId: id }).result.ok).toBe(false)
  })

  it("enforces one approved message per customer per 24 h across campaigns", () => {
    const s0 = run(initialState(), { type: "generateDrafts", campaignId: JANUARY })
    // Theo's label-refresh message was approved 3 h before the demo starts.
    const theo = reduce(s0, { type: "approve", messageId: draftFor(s0, JANUARY, THEO).id })
    expect(theo.result).toMatchObject({ ok: false, block: { kind: "rate_limit" } })
    // Lena's was approved 27 h ago, so she can be approved again.
    expect(reduce(s0, { type: "approve", messageId: draftFor(s0, JANUARY, LENA).id }).result.ok).toBe(true)
    // Approving Ruben in one campaign blocks him in the other.
    const s1 = run(s0, { type: "approve", messageId: draftFor(s0, LABELS, RUBEN).id })
    expect(reduce(s1, { type: "approve", messageId: draftFor(s1, JANUARY, RUBEN).id }).result.ok).toBe(false)
  })

  it("refuses approval after consent is withdrawn", () => {
    const s0 = run(initialState(), { type: "generateDrafts", campaignId: JANUARY }, { type: "setConsent", customerId: RUBEN, value: false })
    expect(reduce(s0, { type: "approve", messageId: draftFor(s0, JANUARY, RUBEN).id }).result).toMatchObject({
      ok: false, block: { kind: "consent" },
    })
  })
})

describe("CSV export", () => {
  it("contains exactly the currently approved messages, nothing unapproved", () => {
    const s0 = run(playAll(initialState()), { type: "generateDrafts", campaignId: JANUARY })
    expect(buildOutboxCsv(s0, JANUARY).trim().split("\r\n")).toHaveLength(1)
    const s1 = run(s0, { type: "approve", messageId: draftFor(s0, JANUARY, INES).id })
    const csv = buildOutboxCsv(s1, JANUARY)
    expect(csv.startsWith("id,campaign_id,customer_id,customer_name,contact,channel,content,status,approved_at\r\n")).toBe(true)
    expect(exportRows(s1, JANUARY).map((m) => m.customer_id)).toEqual([INES])
    expect(csv).toContain("Ines Calder,ines.calder@example.com,email,\"Hi Ines,")
    expect(csv).not.toContain("Ruben")
    const s2 = run(s1, { type: "markSent", messageId: draftFor(s1, JANUARY, INES).id })
    expect(exportRows(s2, JANUARY)).toHaveLength(0)
  })

  it("leaves out customers who withdrew consent after approval", () => {
    const s0 = run(initialState(), { type: "generateDrafts", campaignId: JANUARY })
    const s1 = run(s0, { type: "approve", messageId: draftFor(s0, JANUARY, RUBEN).id }, { type: "setConsent", customerId: RUBEN, value: false })
    expect(exportRows(s1, JANUARY)).toHaveLength(0)
  })

  it("neutralises formulas and quotes per RFC 4180", () => {
    expect(csvSafeCell("=1+1")).toBe("'=1+1")
    expect(csvSafeCell("+44 7700 900105")).toBe("'+44 7700 900105")
    expect(csvSafeCell("Hi")).toBe("Hi")
    const s0 = run(initialState(), { type: "generateDrafts", campaignId: JANUARY })
    const id = draftFor(s0, JANUARY, RUBEN).id
    const hacked = structuredClone(s0)
    hacked.outbox.find((m) => m.id === id)!.content = '=HYPERLINK("http://x","say ""hi""")'
    const csv = buildOutboxCsv(run(hacked, { type: "approve", messageId: id }), JANUARY)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""say """"hi"""""")"`)
  })
})

describe("workspace", () => {
  it("reset restores the initial workspace", () => {
    const changed = run(playAll(initialState()), { type: "generateDrafts", campaignId: JANUARY }, { type: "setConsent", customerId: SOFIA, value: true })
    expect(reduce(changed, { type: "reset" }).state).toEqual(initialState())
  })

  it("keeps ids unique and every message linked to an existing customer and campaign", () => {
    let s = playAll(initialState())
    s = run(s, { type: "generateDrafts", campaignId: JANUARY }, { type: "generateDrafts", campaignId: LABELS })
    const ids = s.outbox.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of s.outbox) {
      expect(s.customers.some((c) => c.id === m.customer_id)).toBe(true)
      expect(s.campaigns.some((c) => c.id === m.campaign_id)).toBe(true)
      expect(s.customers.find((c) => c.id === m.customer_id)!.marketing_opt_in).toBe(true)
    }
    const pairs = s.outbox.map((m) => `${m.campaign_id}:${m.customer_id}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it("the chat instructions carry the business context and the latest profile", () => {
    const s = playAll(initialState())
    const prompt = buildChatInstructions(s.personas[0], s.business, s.customers[0], s.profiles[INES])
    expect(prompt).toContain("You are Mira, a sales assistant persona.")
    expect(prompt).toContain("- Company: Studio Halden")
    expect(prompt).toContain("- Lead stage: proposal (score: 33)")
    expect(prompt).toContain("['timeline: last studio took four months']")
    expect(prompt).toContain("Customer has opted in for marketing")
  })
})
