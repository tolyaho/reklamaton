// The demo's workflow rules. Each function names the backend code it mirrors, so the demo follows
// the real product's behaviour instead of inventing its own.

import { composeDraft } from "./compose"
import type {
  Campaign,
  Customer,
  CustomerEvent,
  CustomerProfile,
  DemoState,
  EventType,
  FieldChange,
  LeadStage,
  OutboundMessage,
  ProfileField,
  ProfilePatch,
  Segment,
} from "./types"

export const DAY_MS = 24 * 60 * 60 * 1000

// ---------- formatting used in change records ----------

export function formatBudget(min: number | null, max: number | null): string {
  const eur = (n: number) => `€${n.toLocaleString("en-GB")}`
  if (min != null && max != null) return `${eur(min)}–${eur(max)}`
  if (max != null) return `up to ${eur(max)}`
  if (min != null) return `from ${eur(min)}`
  return "unknown"
}

const list = (xs: string[]) => (xs.length ? xs.join(", ") : "none")

// ---------- profile merge: store.apply_profile_patch ----------

/**
 * Port of `store.apply_profile_patch`: scalar fields are overwritten when present, interests and
 * objections only grow (no duplicates), the score moves by `lead_score_delta` and is clamped to
 * 0–100, and `notes_append` becomes a new timestamped note line.
 */
export function applyProfilePatch(
  profile: CustomerProfile,
  patch: ProfilePatch,
  at: string,
): { profile: CustomerProfile; changes: FieldChange[] } {
  const next: CustomerProfile = {
    ...profile,
    interests: [...profile.interests],
    objections: [...profile.objections],
    notes: [...profile.notes],
  }
  const changes: FieldChange[] = []
  const record = (field: ProfileField, before: string, after: string) => {
    if (before !== after) changes.push({ field, before, after })
  }

  if (patch.language !== undefined) {
    record("language", profile.language ?? "unknown", patch.language)
    next.language = patch.language
  }
  if (patch.tone !== undefined) {
    record("tone", profile.tone ?? "unknown", patch.tone)
    next.tone = patch.tone
  }
  if (patch.budget_min !== undefined) next.budget_min = patch.budget_min
  if (patch.budget_max !== undefined) next.budget_max = patch.budget_max
  record("budget", formatBudget(profile.budget_min, profile.budget_max), formatBudget(next.budget_min, next.budget_max))
  if (patch.location !== undefined) {
    record("location", profile.location ?? "unknown", patch.location)
    next.location = patch.location
  }
  if (patch.lead_stage) {
    record("lead_stage", profile.lead_stage, patch.lead_stage)
    next.lead_stage = patch.lead_stage
  }
  if (patch.interests) {
    for (const v of patch.interests) if (v && !next.interests.includes(v)) next.interests.push(v)
    record("interests", list(profile.interests), list(next.interests))
  }
  if (patch.objections) {
    for (const v of patch.objections) if (v && !next.objections.includes(v)) next.objections.push(v)
    record("objections", list(profile.objections), list(next.objections))
  }
  next.lead_score = Math.max(0, Math.min(100, profile.lead_score + (patch.lead_score_delta || 0)))
  record("lead_score", String(profile.lead_score), String(next.lead_score))
  if (patch.notes_append) {
    next.notes.push({ at, text: patch.notes_append })
    changes.push({ field: "notes", before: `${profile.notes.length} notes`, after: patch.notes_append })
  }
  next.updated_at = at
  return { profile: next, changes }
}

// ---------- segments: store.customer_matches_segment ----------

export interface SegmentCheck {
  matches: boolean
  reasons: string[]
}

/**
 * Port of `store.customer_matches_segment`, plus the opt-in check `generate_drafts` applies to every
 * customer. Returns every failed condition so the UI can explain exclusions.
 */
export function checkSegment(customer: Customer, profile: CustomerProfile, segment: Segment, now: string): SegmentCheck {
  const reasons: string[] = []
  if (!customer.marketing_opt_in) reasons.push("No marketing consent")
  if (segment.lead_stage_in.length && !segment.lead_stage_in.includes(profile.lead_stage)) {
    reasons.push(`Stage is ${profile.lead_stage}`)
  }
  if (segment.interests_any.length && !segment.interests_any.some((i) => profile.interests.includes(i))) {
    reasons.push(profile.interests.length ? "No matching interest" : "No interests known yet")
  }
  if (segment.last_seen_older_than_days != null && customer.last_seen_at) {
    const cutoff = Date.parse(now) - segment.last_seen_older_than_days * DAY_MS
    if (Date.parse(customer.last_seen_at) > cutoff) reasons.push(`Seen in the last ${segment.last_seen_older_than_days} days`)
  }
  return { matches: reasons.length === 0, reasons }
}

export function segmentRecipients(state: DemoState, campaign: Campaign) {
  return state.customers.map((customer) => ({
    customer,
    profile: state.profiles[customer.id],
    check: checkSegment(customer, state.profiles[customer.id], campaign.segment, state.now),
  }))
}

/** The `segment_json` the backend stores for this segment. */
export function segmentJson(segment: Segment): string {
  const out: Record<string, unknown> = { marketing_opt_in: true }
  if (segment.lead_stage_in.length) out.lead_stage_in = segment.lead_stage_in
  if (segment.interests_any.length) out.interests_any = segment.interests_any
  if (segment.last_seen_older_than_days != null) out.last_seen_older_than_days = segment.last_seen_older_than_days
  return JSON.stringify(out, null, 2)
}

// ---------- outbox rules: main.py approve / mark_sent, store.is_rate_limited_approval ----------

/** Port of `store.is_rate_limited_approval`: one approved message per customer per 24 h, across campaigns. */
export function recentApproval(state: DemoState, customerId: number): OutboundMessage | undefined {
  const cutoff = Date.parse(state.now) - DAY_MS
  return state.outbox.find(
    (m) => m.customer_id === customerId && m.approved_at != null && Date.parse(m.approved_at) >= cutoff,
  )
}

export type ApprovalBlock =
  | { kind: "consent" }
  | { kind: "sent" }
  | { kind: "rate_limit"; other: OutboundMessage }

/** Why `POST /outbox/{id}/approve` would refuse this message, if it would. */
export function approvalBlock(state: DemoState, message: OutboundMessage): ApprovalBlock | null {
  const customer = state.customers.find((c) => c.id === message.customer_id)
  if (!customer?.marketing_opt_in) return { kind: "consent" }
  if (message.status === "sent") return { kind: "sent" }
  if (message.status === "approved") return null
  const other = recentApproval(state, message.customer_id)
  return other ? { kind: "rate_limit", other } : null
}

// ---------- state helpers ----------

export function advanceClock(state: DemoState, minutes = 1): string {
  return new Date(Date.parse(state.now) + minutes * 60_000).toISOString()
}

export function addEvent(state: DemoState, customerId: number, type: EventType, summary: string, at: string): CustomerEvent {
  const event = { id: state.nextId++, customer_id: customerId, type, summary, created_at: at }
  state.events.push(event)
  return event
}

export function stageCounts(state: DemoState): Record<LeadStage, number> {
  const counts: Record<LeadStage, number> = { new: 0, qualified: 0, proposal: 0, won: 0, lost: 0 }
  for (const c of state.customers) counts[state.profiles[c.id].lead_stage]++
  return counts
}

export function newDraft(state: DemoState, campaign: Campaign, customer: Customer, at: string): OutboundMessage {
  const draft = composeDraft(state.business, campaign, customer, state.profiles[customer.id], state.personas[0])
  return {
    id: state.nextId++,
    campaign_id: campaign.id,
    customer_id: customer.id,
    channel: campaign.channel,
    content: draft.content,
    status: "draft",
    created_at: at,
    approved_at: null,
    sent_at: null,
    factors: draft.factors,
    language: draft.language,
  }
}
