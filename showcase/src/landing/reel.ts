// The landing-page replay. Every frame is produced by the demo's own reducer from the starting
// workspace, so the hero shows exactly what the app does when you play Ines's conversation; it is
// a recording of the scripted demo, kept separate from the visitor's own workspace.

import { initialState, reduce } from "@/demo/state"
import type { DemoState, OutboundMessage } from "@/demo/types"
import type { Playback } from "@/demo/playerContext"

export type BeatKind = "customer" | "reply" | "learn" | "campaign" | "draft"

export interface Beat {
  kind: BeatKind
  /** Scripted turn this beat belongs to (0-based); the last turn for campaign and draft beats. */
  turn: number
  /** Workspace state shown during the beat. */
  state: DemoState
  /** The message being played, for customer and reply beats. */
  playback: Playback | null
  ms: number
}

export interface Reel {
  beats: Beat[]
  draft: OutboundMessage
}

const INES_CHAT = 1
const JANUARY = 1

export function buildReel(): Reel {
  let state = initialState()
  const chat = state.chats.find((c) => c.id === INES_CHAT)!
  const beats: Beat[] = []
  for (let turn = 0; turn < chat.script.length; turn++) {
    const t = chat.script[turn]
    const playback = (phase: Playback["phase"]): Playback => ({ chatId: INES_CHAT, turn, phase, customer: t.customer, reply: t.reply })
    beats.push({ kind: "customer", turn, state, playback: playback("customer"), ms: 800 })
    beats.push({ kind: "reply", turn, state, playback: playback("reply"), ms: 1100 })
    state = reduce(state, { type: "playTurn", chatId: INES_CHAT }).state
    beats.push({ kind: "learn", turn, state, playback: null, ms: turn === 0 ? 2600 : 2100 })
  }
  const last = chat.script.length - 1
  beats.push({ kind: "campaign", turn: last, state, playback: null, ms: 1500 })
  const drafted = reduce(state, { type: "generateDrafts", campaignId: JANUARY }).state
  const draft = drafted.outbox.find((m) => m.campaign_id === JANUARY && m.customer_id === 1)!
  beats.push({ kind: "draft", turn: last, state: drafted, playback: null, ms: 6000 })
  return { beats, draft }
}
