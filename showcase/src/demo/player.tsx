import { useReducedMotion } from "framer-motion"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useDemo } from "./context"
import { PlayerContext, type Playback } from "./playerContext"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Plays scripted chat turns with presentation timing: the customer message, a typing indicator,
 * the reply revealed word by word, a short "extracting" step, then the real state change
 * (messages + profile patch) is committed. The timing is presentation only; nothing is generated.
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
      const t = reduced ? { customer: 0, typing: 200, word: 0, extract: 200, gap: 150 } : { customer: 650, typing: 950, word: 34, extract: 700, gap: 900 }
      try {
        for (let i = 0; i < turns; i++) {
          const chat = stateRef.current.chats.find((c) => c.id === chatId)
          if (!chat || chat.played >= chat.script.length) break
          const turn = chat.script[chat.played]
          setPlayback({ chatId, turn: chat.played, phase: "customer", customer: turn.customer, reply: "" })
          await sleep(t.customer)
          setPlayback((p) => p && { ...p, phase: "typing" })
          await sleep(t.typing)
          if (t.word > 0) {
            const words = turn.reply.split(" ")
            for (let w = 1; w <= words.length; w++) {
              setPlayback((p) => p && { ...p, phase: "streaming", reply: words.slice(0, w).join(" ") })
              await sleep(t.word)
            }
          }
          setPlayback((p) => p && { ...p, phase: "extracting", reply: turn.reply })
          await sleep(t.extract)
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
