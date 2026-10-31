import { describe, expect, it } from "vitest"
import { buildReel } from "@/landing/reel"
import { checkSegment } from "./engine"
import { draftFacts, messageFacts, profileHistory } from "./facts"
import { audienceFunnel } from "./funnel"
import { initialState, reduce, type Action } from "./state"
import type { DemoState } from "./types"

const play = (s: DemoState, turns: number) =>
  Array.from({ length: turns }).reduce<DemoState>((acc) => reduce(acc, { type: "playTurn", chatId: 1 } as Action).state, s)

describe("facts in customer messages", () => {
  it("mark real, non-overlapping quotes in the colour of the field they filled", () => {
    const s = play(initialState(), 4)
    const ines = s.messages.filter((m) => m.chat_id === 1 && m.role === "user")
    expect(ines).toHaveLength(4)
    for (const m of ines) {
      const facts = messageFacts(s, m)
      const spans = facts.map((f) => [m.content.indexOf(f.text), m.content.indexOf(f.text) + f.text.length])
      for (const [start] of spans) expect(start).toBeGreaterThanOrEqual(0)
      for (let i = 0; i < spans.length; i++)
        for (let j = i + 1; j < spans.length; j++) expect(spans[i][0] < spans[j][1] && spans[j][0] < spans[i][1]).toBe(false)
    }
    const second = messageFacts(s, ines[1])
    expect(second.find((f) => f.kind === "budget")?.text).toBe("around €4,000 all in")
    expect(second.find((f) => f.kind === "interest")?.text).toBe("a couple of labels")
    expect(messageFacts(s, ines[2]).map((f) => f.kind)).toEqual(["concern", "concern"])
  })

  it("leave synthetic histories without a script unmarked", () => {
    const s = initialState()
    for (const m of s.messages) expect(messageFacts(s, m)).toEqual([])
  })
})

describe("profile history", () => {
  it("replays to exactly the stored profile, turn by turn", () => {
    for (let turns = 0; turns <= 4; turns++) {
      const s = play(initialState(), turns)
      const history = profileHistory(s, 1)
      expect(history).toHaveLength(turns)
      if (turns) expect(history.at(-1)!.changes).toEqual(s.lastProfileChange!.changes)
    }
    const s = play(initialState(), 4)
    expect(profileHistory(s, 1).map((r) => r.message.content)).toEqual(s.chats[0].script.map((t) => t.customer))
  })
})

describe("draft facts", () => {
  it("are the exact sentences each profile field produced", () => {
    const s = reduce(play(initialState(), 4), { type: "generateDrafts", campaignId: 1 }).state
    for (const m of s.outbox.filter((x) => x.campaign_id === 1)) {
      for (const f of m.factors) if (f.text) expect(m.content).toContain(f.text)
    }
    const ines = s.outbox.find((m) => m.campaign_id === 1 && m.customer_id === 1)!
    expect(draftFacts(ines).map((f) => [f.kind, f.text])).toEqual([
      ["interest", "Following up on your new pastry boxes."],
      ["budget", "At €3,900, it fits the budget you mentioned."],
      ["concern", "Review dates and the print date are fixed at kick-off, so the timeline is agreed before we start."],
      ["intent", "Shall I hold one of the slots while we set up a call?"],
    ])
  })
})

describe("audience funnel", () => {
  it("narrows step by step and ends on the segment's recipients", () => {
    for (const s of [initialState(), play(initialState(), 1)]) {
      const campaign = s.campaigns[0]
      const steps = audienceFunnel(s, campaign.segment)
      for (let i = 1; i < steps.length; i++) expect(steps[i].ids.every((id) => steps[i - 1].ids.includes(id))).toBe(true)
      const matches = s.customers.filter((c) => checkSegment(c, s.profiles[c.id], campaign.segment, s.now).matches).map((c) => c.id)
      expect(steps.at(-1)!.ids).toEqual(matches)
    }
  })
})

describe("landing replay", () => {
  it("is the reducer's own output: every frame matches playing the turns, and the draft matches generating drafts", () => {
    const reel = buildReel()
    const learned = reel.beats.filter((b) => b.kind === "learn")
    expect(learned).toHaveLength(4)
    learned.forEach((b, i) => expect(b.state.profiles[1]).toEqual(play(initialState(), i + 1).profiles[1]))
    const expected = reduce(play(initialState(), 4), { type: "generateDrafts", campaignId: 1 }).state
    expect(reel.draft.content).toBe(expected.outbox.find((m) => m.campaign_id === 1 && m.customer_id === 1)!.content)
    expect(reel.draft.status).toBe("draft")
  })
})
