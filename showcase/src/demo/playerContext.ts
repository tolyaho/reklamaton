import { createContext, useContext } from "react"

export interface Playback {
  chatId: number
  turn: number
  /** "customer": the customer's message is shown; "reply": the persona's scripted reply is shown too. */
  phase: "customer" | "reply"
  customer: string
  reply: string
}

export interface PlayerContextValue {
  playback: Playback | null
  play: (chatId: number, turns?: number) => Promise<void>
}

export const PlayerContext = createContext<PlayerContextValue | null>(null)

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error("usePlayer outside PlayerProvider")
  return ctx
}
