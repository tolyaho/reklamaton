import { useReducedMotion } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useDemo } from "./context"
import { PlayerContext, type Playback } from "./playerContext"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Plays scripted chat turns in a readable order: the customer's message, then the persona's reply,
 * then the real state change (messages + profile patch). The pauses are pacing for the eye only;
 * there is no typing indicator or word-by-word streaming, because nothing is being generated.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useDemo()
  const reduced = useReducedMotion()
  const [playback, setPlayback] = useState<Playback | null>(null)
  const busy = useRef(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const play = useCallback(
    async (chatId: number, turns = 1) => {
      if (busy.current) return
      busy.current = true
      const t = reduced ? { reply: 0, commit: 120, gap: 120 } : { reply: 650, commit: 750, gap: 650 }
      try {
        for (let i = 0; i < turns; i++) {
          const chat = stateRef.current.chats.find((c) => c.id === chatId)
          if (!chat || chat.played >= chat.script.length) break
          const turn = chat.script[chat.played]
          setPlayback({ chatId, turn: chat.played, phase: "customer", customer: turn.customer, reply: turn.reply })
          await sleep(t.reply)
          setPlayback((p) => p && { ...p, phase: "reply" })
          await sleep(t.commit)
          dispatch({ type: "playTurn", chatId })
          setPlayback(null)
          if (i < turns - 1) await sleep(t.gap)
        }
      } finally {
        setPlayback(null)
        busy.current = false
      }
    },
    [dispatch, reduced],
  )

  const value = useMemo(() => ({ playback, play }), [playback, play])
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}
