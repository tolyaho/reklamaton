import { AnimatePresence, motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Fragment, useEffect, useState } from "react"
import { useDemo } from "@/demo/context"
import { messageFacts } from "@/demo/facts"
import { usePlayer } from "@/demo/playerContext"
import { messagesForChat } from "@/demo/state"
import type { Chat, Message, ProfileField } from "@/demo/types"
import { clockTime, shortDate } from "@/lib/format"
import { cx } from "@/lib/styles"
import { FactText } from "./facts"

/** True one frame after mount, so CSS transitions (the highlighter sweep) play on new content. */
function useRevealed() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return on
}

/**
 * The messages of one chat, with the facts the profile took from each customer message marked in
 * their colour, plus the turn that is currently being played.
 */
export function Thread({
  chat,
  flash,
  size = "md",
  days = true,
  compactReplies = false,
}: {
  chat: Chat
  /** A message to point at, and optionally which of its facts. */
  flash?: { messageId: number; field?: ProfileField | null; n: number } | null
  size?: "md" | "lg"
  days?: boolean
  /** Clamp the persona's replies to a few lines so the customer's words stay in view. */
  compactReplies?: boolean
}) {
  const { state } = useDemo()
  const { playback } = usePlayer()
  const persona = state.personas.find((p) => p.id === chat.persona_id)!
  const messages = messagesForChat(state, chat.id)
  const pending = playback?.chatId === chat.id ? playback : null

  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const showDay = days && (!prev || shortDate(prev.created_at) !== shortDate(m.created_at))
        return (
          <Fragment key={m.id}>
            {showDay && (
              <li className="my-1 flex justify-center" aria-hidden>
                <span className="text-[11px] font-medium text-ink-3">
                  {shortDate(m.created_at) === shortDate(state.now) ? "Today" : shortDate(m.created_at)}
                </span>
              </li>
            )}
            <Bubble
              message={m}
              persona={persona.name}
              size={size}
              compact={compactReplies}
              firstInGroup={!prev || prev.role !== m.role}
              flash={flash?.messageId === m.id ? flash : null}
            />
          </Fragment>
        )
      })}
      {pending && (
        <>
          <motion.li
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-start"
          >
            <div className={cx(bubbleClass("user", size))}>{pending.customer}</div>
            <span className="mt-1 px-1 text-[11px] text-ink-3">just now</span>
          </motion.li>
          <AnimatePresence>
            {pending.phase === "reply" && (
              <motion.li
                key="reply"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-end"
              >
                <PersonaLabel name={persona.name} />
                <div className={bubbleClass("assistant", size)}>
                  <span className={cx(compactReplies && "line-clamp-3")}>{pending.reply}</span>
                </div>
              </motion.li>
            )}
          </AnimatePresence>
        </>
      )}
    </ol>
  )
}

function bubbleClass(role: Message["role"], size: "md" | "lg") {
  return cx(
    "max-w-[88%] rounded-[18px] px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap @lg:max-w-[80%]",
    size === "lg" ? "text-[15px]" : "text-[14px]",
    role === "assistant"
      ? "on-ink rounded-br-md bg-ink text-paper"
      : "rounded-bl-md border border-line bg-surface text-ink shadow-[0_1px_0_rgb(31_28_23/0.03)]",
  )
}

function PersonaLabel({ name }: { name: string }) {
  return (
    <span className="mb-1 inline-flex items-center gap-1.5 pr-1 text-[11.5px] font-medium text-ink-3">
      <Sparkles className="size-3 text-coral" aria-hidden /> {name}
    </span>
  )
}

function Bubble({
  message,
  persona,
  size,
  compact,
  firstInGroup,
  flash,
}: {
  message: Message
  persona: string
  size: "md" | "lg"
  compact?: boolean
  firstInGroup: boolean
  flash: { field?: ProfileField | null; n: number } | null
}) {
  const { state } = useDemo()
  const revealed = useRevealed()
  const mine = message.role === "assistant"
  const facts = mine ? [] : messageFacts(state, message)
  return (
    <li id={`msg-${message.id}`} className={cx("flex flex-col", mine ? "items-end" : "items-start")} data-has-facts={facts.length ? "true" : undefined}>
      {mine && firstInGroup && <PersonaLabel name={persona} />}
      <div key={flash ? `flash-${flash.n}` : "still"} className={cx(bubbleClass(message.role, size), flash && "flash-ring")}>
        {mine ? (
          <span className={cx(compact && "line-clamp-3")}>{message.content}</span>
        ) : (
          <FactText text={message.content} facts={facts} reveal={revealed} active={flash?.field ?? null} />
        )}
      </div>
      <span className="mt-1 px-1 text-[11px] text-ink-3">
        <span className="sr-only">{mine ? `${persona}, ` : "Customer, "}</span>
        {clockTime(message.created_at)}
      </span>
    </li>
  )
}
