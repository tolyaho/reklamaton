// The demo's single source of truth: a pure reducer over DemoState. Every screen reads from it, so
// a profile change shows up in the inbox, the CRM table, segment eligibility and new drafts at once.

import * as seed from "./data"
import {
  addEvent,
  advanceClock,
  approvalBlock,
  checkSegment,
  formatBudget,
  newDraft,
  applyProfilePatch,
  type ApprovalBlock,
} from "./engine"
import type { Business, DemoState, OutboundMessage, Segment } from "./types"

export const STATE_VERSION = 4

export type Action =
  | { type: "playTurn"; chatId: number }
  | { type: "generateDrafts"; campaignId: number }
  | { type: "regenerateDraft"; messageId: number }
  | { type: "approve"; messageId: number }
  | { type: "markSent"; messageId: number }
  | { type: "setConsent"; customerId: number; value: boolean }
  | { type: "updateSegment"; campaignId: number; segment: Segment }
  | { type: "updateBusiness"; patch: Partial<Pick<Business, "name" | "brand_voice">> }
  | { type: "reset" }

export type Result =
  | { ok: true; created?: number; skipped?: number }
  | { ok: false; error: string; block?: ApprovalBlock }

const ok = (extra: Partial<{ created: number; skipped: number }> = {}): Result => ({ ok: true, ...extra })
const fail = (error: string, block?: ApprovalBlock): Result => ({ ok: false, error, block })

export function initialState(): DemoState {
  const state: DemoState = {
    version: STATE_VERSION,
    now: seed.DEMO_START,
    business: structuredClone(seed.business),
    personas: structuredClone(seed.personas),
    customers: structuredClone(seed.customers),
    profiles: Object.fromEntries(seed.profiles.map((p) => [p.customer_id, structuredClone(p)])),
    chats: structuredClone(seed.chats),
    messages: structuredClone(seed.messages),
    campaigns: structuredClone(seed.campaigns),
    outbox: [],
    events: [],
    lastProfileChange: null,
    nextId: 1000,
  }

  for (const p of seed.profiles) {
    if (p.lead_stage !== "new" || p.interests.length) {
      const fromChat = seed.chats.some((c) => c.customer_id === p.customer_id)
      addEvent(state, p.customer_id, "profile_update", `Profile updated${fromChat ? " from chat" : ""} · stage ${p.lead_stage}`, p.updated_at)
    }
  }

  // Campaign 2 already ran before the demo starts: one draft, one approved, one approved and marked sent.
  const camp2 = state.campaigns.find((c) => c.id === 2)!
  for (const h of seed.campaign2History) {
    const customer = state.customers.find((c) => c.id === h.customer_id)!
    const msg = newDraft(state, camp2, customer, seed.minutesBefore(h.created * 60))
    if (h.approved != null) msg.approved_at = seed.minutesBefore(h.approved * 60)
    if (h.sent != null) msg.sent_at = seed.minutesBefore(h.sent * 60)
    msg.status = h.sent != null ? "sent" : h.approved != null ? "approved" : "draft"
    state.outbox.push(msg)
    addEvent(state, customer.id, "ad_generated", `Draft written for “${camp2.name}”`, msg.created_at)
    if (msg.approved_at) addEvent(state, customer.id, "ad_approved", `Draft approved for “${camp2.name}”`, msg.approved_at)
    if (msg.sent_at) addEvent(state, customer.id, "ad_marked_sent", `Marked as sent for “${camp2.name}”`, msg.sent_at)
  }
  state.events.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return state
}

function blockMessage(state: DemoState, block: ApprovalBlock): string {
  if (block.kind === "consent") return "Customer has not opted in for marketing"
  if (block.kind === "sent") return "Message is already marked as sent"
  const campaign = state.campaigns.find((c) => c.id === block.other.campaign_id)
  return `Rate limit: this customer already has an approved message from “${campaign?.name}” within 24 h`
}

/** Pure: returns a new state and the outcome. The input state is never mutated. */
export function reduce(prev: DemoState, action: Action): { state: DemoState; result: Result } {
  if (action.type === "reset") return { state: initialState(), result: ok() }
  const state = structuredClone(prev)

  switch (action.type) {
    case "playTurn": {
      const chat = state.chats.find((c) => c.id === action.chatId)
      if (!chat || chat.played >= chat.script.length) return { state: prev, result: fail("No scripted turn left") }
      const turn = chat.script[chat.played]
      const turnIndex = chat.played
      const userAt = advanceClock(state)
      const replyAt = advanceClock({ ...state, now: userAt })
      const userMsg = { id: state.nextId++, chat_id: chat.id, role: "user" as const, content: turn.customer, created_at: userAt, turn: turnIndex }
      state.messages.push(userMsg)
      state.messages.push({ id: state.nextId++, chat_id: chat.id, role: "assistant", content: turn.reply, created_at: replyAt, turn: turnIndex })

      const before = state.profiles[chat.customer_id]
      const { profile, changes } = applyProfilePatch(before, turn.patch, replyAt)
      for (const change of changes) change.evidence = turn.evidence[change.field]
      state.profiles[chat.customer_id] = profile
      const customer = state.customers.find((c) => c.id === chat.customer_id)!
      customer.last_seen_at = replyAt
      const stage = changes.find((c) => c.field === "lead_stage")
      addEvent(
        state,
        customer.id,
        "profile_update",
        `Profile updated from chat · ${changes.length} field${changes.length === 1 ? "" : "s"}${stage ? ` · stage ${stage.before} → ${stage.after}` : ""}`,
        replyAt,
      )
      state.lastProfileChange = {
        customer_id: customer.id,
        chat_id: chat.id,
        turn: turnIndex,
        message_id: userMsg.id,
        patch: turn.patch,
        changes,
        at: replyAt,
      }
      chat.played += 1
      state.now = replyAt
      return { state, result: ok() }
    }

    case "generateDrafts": {
      const campaign = state.campaigns.find((c) => c.id === action.campaignId)
      if (!campaign) return { state: prev, result: fail("Campaign not found") }
      state.now = advanceClock(state)
      let created = 0
      let skipped = 0
      for (const customer of state.customers) {
        if (!checkSegment(customer, state.profiles[customer.id], campaign.segment, state.now).matches) continue
        if (state.outbox.some((m) => m.campaign_id === campaign.id && m.customer_id === customer.id)) {
          skipped++
          continue
        }
        state.outbox.push(newDraft(state, campaign, customer, state.now))
        addEvent(state, customer.id, "ad_generated", `Draft written for “${campaign.name}”`, state.now)
        created++
      }
      return { state, result: ok({ created, skipped }) }
    }

    case "regenerateDraft": {
      const i = state.outbox.findIndex((m) => m.id === action.messageId)
      const old = state.outbox[i]
      if (!old || old.status !== "draft") return { state: prev, result: fail("Only drafts can be rewritten") }
      const campaign = state.campaigns.find((c) => c.id === old.campaign_id)!
      const customer = state.customers.find((c) => c.id === old.customer_id)!
      state.now = advanceClock(state)
      state.outbox[i] = { ...newDraft(state, campaign, customer, state.now), id: old.id }
      addEvent(state, customer.id, "ad_generated", `Draft rewritten for “${campaign.name}”`, state.now)
      return { state, result: ok() }
    }

    case "approve": {
      const msg = state.outbox.find((m) => m.id === action.messageId)
      if (!msg) return { state: prev, result: fail("Outbox message not found") }
      const block = approvalBlock(state, msg)
      if (block) return { state: prev, result: fail(blockMessage(state, block), block) }
      if (msg.status === "approved") return { state: prev, result: ok() }
      state.now = advanceClock(state)
      msg.status = "approved"
      msg.approved_at = state.now
      const campaign = state.campaigns.find((c) => c.id === msg.campaign_id)
      addEvent(state, msg.customer_id, "ad_approved", `Draft approved for “${campaign?.name}”`, state.now)
      return { state, result: ok() }
    }

    case "markSent": {
      const msg = state.outbox.find((m) => m.id === action.messageId)
      if (!msg) return { state: prev, result: fail("Outbox message not found") }
      if (msg.status !== "approved") return { state: prev, result: fail("Only approved messages can be marked as sent") }
      state.now = advanceClock(state)
      msg.status = "sent"
      msg.sent_at = state.now
      const campaign = state.campaigns.find((c) => c.id === msg.campaign_id)
      addEvent(state, msg.customer_id, "ad_marked_sent", `Marked as sent for “${campaign?.name}” (bookkeeping only)`, state.now)
      return { state, result: ok() }
    }

    case "setConsent": {
      const customer = state.customers.find((c) => c.id === action.customerId)
      if (!customer) return { state: prev, result: fail("Customer not found") }
      if (customer.marketing_opt_in === action.value) return { state: prev, result: ok() }
      state.now = advanceClock(state)
      customer.marketing_opt_in = action.value
      customer.marketing_opt_in_at = action.value ? state.now : null
      addEvent(state, customer.id, "consent_changed", action.value ? "Marketing consent recorded" : "Marketing consent withdrawn", state.now)
      return { state, result: ok() }
    }

    case "updateSegment": {
      const campaign = state.campaigns.find((c) => c.id === action.campaignId)
      if (!campaign) return { state: prev, result: fail("Campaign not found") }
      // Consent is not optional: drafts are only ever written for opted-in customers.
      campaign.segment = { ...action.segment, marketing_opt_in: true }
      return { state, result: ok() }
    }

    case "updateBusiness": {
      state.business = { ...state.business, ...action.patch }
      return { state, result: ok() }
    }
  }
}

// ---------- selectors ----------

export const customerById = (s: DemoState, id: number) => s.customers.find((c) => c.id === id)!
export const chatForCustomer = (s: DemoState, id: number) => s.chats.find((c) => c.customer_id === id)
export const messagesForChat = (s: DemoState, chatId: number) =>
  s.messages.filter((m) => m.chat_id === chatId).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
export const outboxForCampaign = (s: DemoState, id: number): OutboundMessage[] =>
  s.outbox.filter((m) => m.campaign_id === id).sort((a, b) => a.id - b.id)
export const budgetLabel = (s: DemoState, id: number) => formatBudget(s.profiles[id].budget_min, s.profiles[id].budget_max)
