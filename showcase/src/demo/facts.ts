// The demo's visual language for customer facts. A fact keeps one colour from the words a customer
// wrote, through the profile field it filled, to the draft sentence it shaped, so the path of one
// piece of information can be followed across screens.

import * as seed from "./data"
import { applyProfilePatch } from "./engine"
import type { DemoState, DraftFactor, FieldChange, Message, OutboundMessage, ProfileField, ProfilePatch } from "./types"

export type FactKind = "interest" | "budget" | "concern" | "intent" | "context"

export const FACT_KINDS: FactKind[] = ["interest", "budget", "concern", "intent"]

export const FACT_LABEL: Record<FactKind, string> = {
  interest: "Interest",
  budget: "Budget",
  concern: "Concern",
  intent: "Intent",
  context: "Context",
}

export function kindOf(field: ProfileField | DraftFactor["field"], patch?: ProfilePatch): FactKind {
  switch (field) {
    case "interests":
      return "interest"
    case "budget":
      return "budget"
    case "objections":
      return "concern"
    case "lead_stage":
      return "intent"
    case "lead_score":
      return (patch?.lead_score_delta ?? 0) < 0 ? "concern" : "intent"
    default:
      return "context"
  }
}

export interface Fact {
  field: ProfileField | DraftFactor["field"]
  kind: FactKind
  text: string
}

// When two quotes overlap, the more specific fact wins.
const MESSAGE_PRIORITY: ProfileField[] = ["budget", "objections", "interests", "lead_stage", "location", "lead_score", "notes"]

/** Non-overlapping facts to mark in a customer message, taken from the scripted turn's evidence. */
export function messageFacts(state: DemoState, message: Message): Fact[] {
  if (message.role !== "user" || message.turn == null) return []
  const chat = state.chats.find((c) => c.id === message.chat_id)
  const turn = chat?.script[message.turn]
  if (!turn) return []
  const taken: [number, number][] = []
  const facts: Fact[] = []
  for (const field of MESSAGE_PRIORITY) {
    const text = turn.evidence[field]
    if (!text) continue
    const start = message.content.indexOf(text)
    if (start < 0) continue
    const end = start + text.length
    if (taken.some(([a, b]) => start < b && end > a)) continue
    taken.push([start, end])
    facts.push({ field, kind: kindOf(field, turn.patch), text })
  }
  return facts
}

/** The sentences of a draft that came from profile fields. */
export function draftFacts(message: OutboundMessage): Fact[] {
  return message.factors
    .filter((f) => f.text && kindOf(f.field) !== "context" && message.content.includes(f.text))
    .map((f) => ({ field: f.field, kind: kindOf(f.field), text: f.text! }))
}

export interface TurnRecord {
  turn: number
  /** The customer message of this turn. */
  message: Message
  changes: FieldChange[]
  patch: ProfilePatch
}

/**
 * What each processed turn changed, rebuilt by replaying the scripted patches on the starting
 * profile with the engine's merge rules. Only chat turns change a profile, so this matches the
 * stored profile exactly.
 */
export function profileHistory(state: DemoState, customerId: number): TurnRecord[] {
  const chat = state.chats.find((c) => c.customer_id === customerId)
  const start = seed.profiles.find((p) => p.customer_id === customerId)
  if (!chat || !start || !chat.played) return []
  let profile = structuredClone(start)
  const out: TurnRecord[] = []
  for (let t = 0; t < chat.played; t++) {
    const message = state.messages.find((m) => m.chat_id === chat.id && m.role === "user" && m.turn === t)
    if (!message) break
    const turn = chat.script[t]
    const applied = applyProfilePatch(profile, turn.patch, message.created_at)
    for (const change of applied.changes) change.evidence = turn.evidence[change.field]
    profile = applied.profile
    out.push({ turn: t, message, changes: applied.changes, patch: turn.patch })
  }
  return out
}

/** The turn that last changed a field, if a chat turn did. */
export function lastTurnFor(history: TurnRecord[], field: ProfileField): TurnRecord | undefined {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].changes.some((c) => c.field === field)) return history[i]
  return undefined
}
