import type { Action } from "@/demo/state"
import type { DemoState } from "@/demo/types"

export interface TourStep {
  id: string
  route: string
  /** `data-tour` value of the element to highlight. */
  target?: string
  title: string
  body: string
  /** An action the visitor can take, or let the tour take for them. It dispatches real demo actions. */
  action?: { label: string; run?: (state: DemoState) => Action[]; clickTarget?: boolean }
  /** True once the step's action has happened (by the visitor or the tour). */
  complete?: (state: DemoState) => boolean
  /** Move on by itself shortly after `complete` turns true. */
  autoAdvance?: boolean
}

const INES = 1
const INES_CHAT = 1
const JANUARY = 1

const inesDraft = (s: DemoState) => s.outbox.find((m) => m.campaign_id === JANUARY && m.customer_id === INES)

export const TOUR_STEPS: TourStep[] = [
  {
    id: "workspace",
    route: "/app/overview",
    target: "kpis",
    title: "A fictional studio's workspace",
    body: "Studio Halden sells brand and packaging design. Its customers, chats and campaigns are synthetic, and every number on this page is counted from them.",
  },
  {
    id: "conversation",
    route: "/app/conversations/1",
    target: "play",
    title: "Ines writes in",
    body: "This conversation is scripted for the demo. Play the first turn: Ines asks about packaging, and the persona answers from the studio's catalog.",
    action: { label: "Play turn 1", run: () => [{ type: "playTurn", chatId: INES_CHAT }] },
    complete: (s) => (s.chats.find((c) => c.id === INES_CHAT)?.played ?? 0) >= 1,
    autoAdvance: true,
  },
  {
    id: "profile",
    route: "/app/conversations/1",
    target: "profile",
    title: "Her profile updated itself",
    body: "After each turn the backend extracts a structured patch and merges it into the CRM profile. Changed fields are marked, and each quote links back to the words it came from.",
  },
  {
    id: "more-turns",
    route: "/app/conversations/1",
    target: "play",
    title: "Budget, an objection, a request",
    body: "The next turns add a budget (up to €4,000), a timeline objection and a request for a proposal. The score moves with each turn and is clamped to 0–100.",
    action: {
      label: "Play the remaining turns",
      run: (s) => {
        const chat = s.chats.find((c) => c.id === INES_CHAT)!
        return Array.from({ length: chat.script.length - chat.played }, () => ({ type: "playTurn", chatId: INES_CHAT }) as Action)
      },
    },
    complete: (s) => {
      const chat = s.chats.find((c) => c.id === INES_CHAT)!
      return chat.played >= chat.script.length
    },
  },
  {
    id: "segment",
    route: "/app/campaigns/1",
    target: "segment",
    title: "Now she qualifies for a campaign",
    body: "The segment uses the backend's rules: marketing consent, stage qualified or proposal, interested in packaging or labels. Before the chat, Ines was excluded. Now she's in.",
  },
  {
    id: "generate",
    route: "/app/campaigns/1",
    target: "generate",
    title: "Write a draft for each recipient",
    body: "In the real app this is one model call per customer with their profile in the prompt. Here a deterministic composer builds the text from the same fields, so no model is called.",
    action: { label: "Generate drafts", run: () => [{ type: "generateDrafts", campaignId: JANUARY }] },
    complete: (s) => Boolean(inesDraft(s)),
    autoAdvance: true,
  },
  {
    id: "draft",
    route: "/app/campaigns/1",
    target: "draft-ines",
    title: "Personalized from her profile",
    body: "The chips show which profile field shaped which sentence: her pastry boxes, the €3,900 system that fits her budget, the timeline objection, and her proposal stage.",
  },
  {
    id: "approve",
    route: "/app/campaigns/1",
    target: "approve-ines",
    title: "A person approves",
    body: "Nothing leaves without approval. The backend also refuses customers without consent and allows one approved message per customer per 24 hours.",
    action: {
      label: "Approve Ines's draft",
      run: (s) => {
        const d = inesDraft(s)
        return d ? [{ type: "approve", messageId: d.id }] : []
      },
    },
    complete: (s) => inesDraft(s)?.status === "approved" || inesDraft(s)?.status === "sent",
    autoAdvance: true,
  },
  {
    id: "export",
    route: "/app/campaigns/1",
    target: "export",
    title: "Export the approved messages",
    body: "The CSV contains exactly the approved messages, with the same columns as the backend export. Reklamaton does not send anything: you send with your own tools, then mark messages as sent.",
    action: { label: "Download the CSV", clickTarget: true },
  },
  {
    id: "done",
    route: "/app/campaigns/1",
    title: "That's the whole loop",
    body: "Conversation → profile → segment → draft → approval → export. Explore freely: change the segment, toggle consent on a customer, or reset the demo at any time.",
  },
]
