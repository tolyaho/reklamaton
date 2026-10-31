import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Cpu, FileCode2, Lock, MessagesSquare, Play, PlayCircle, Sparkles } from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { ProfileCard } from "@/components/ProfileCard"
import { PromptView } from "@/components/PromptView"
import { Sheet } from "@/components/Sheet"
import { Avatar, Button, EmptyState, PageHeader, PersonaMark, Provenance, StageBadge } from "@/components/ui"
import { buttonClass, cx } from "@/lib/styles"
import { useDemo } from "@/demo/context"
import { usePlayer } from "@/demo/playerContext"
import { buildChatInstructions } from "@/demo/prompt"
import { messagesForChat } from "@/demo/state"
import type { Chat, Message } from "@/demo/types"
import { CHANNEL_LABEL, clockTime, relativeTime, shortDate } from "@/lib/format"

export function Conversations() {
  const { customerId } = useParams()
  const { state } = useDemo()
  const chats = useMemo(() => {
    const last = (c: Chat) => messagesForChat(state, c.id).at(-1)?.created_at ?? c.created_at
    return [...state.chats].sort((a, b) => {
      const aNew = a.played < a.script.length ? 1 : 0
      const bNew = b.played < b.script.length ? 1 : 0
      return bNew - aNew || last(b).localeCompare(last(a))
    })
  }, [state])
  if (!customerId) return <Navigate to={`/app/conversations/${chats[0].customer_id}`} replace />
  const chat = state.chats.find((c) => c.customer_id === Number(customerId))
  if (!chat) {
    return (
      <PageFade>
        <PageHeader title="Conversations" />
        <div className="surface mt-6">
          <EmptyState icon={MessagesSquare} title="No conversation with this customer">
            Only customers who wrote in have a chat. <Link to="/app/conversations" className="text-coral-ink underline">Back to the inbox</Link>
          </EmptyState>
        </div>
      </PageFade>
    )
  }
  return <ConversationView chat={chat} chats={chats} />
}

function ConversationView({ chat, chats }: { chat: Chat; chats: Chat[] }) {
  const { state } = useDemo()
  const { playback, play } = usePlayer()
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const customer = state.customers.find((c) => c.id === chat.customer_id)!
  const persona = state.personas.find((p) => p.id === chat.persona_id)!
  const messages = messagesForChat(state, chat.id)
  const pending = playback?.chatId === chat.id ? playback : null
  const remaining = chat.script.length - chat.played
  const [promptOpen, setPromptOpen] = useState(false)
  const [flashId, setFlashId] = useState<number | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const change = state.lastProfileChange?.chat_id === chat.id ? state.lastProfileChange : null

  // Keep the newest message in view.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" })
  }, [messages.length, pending?.phase, pending?.reply, chat.id, reduced])

  // On narrow screens the profile sits below the thread: point to it after an update.
  const lastSeenChange = useRef(change?.at)
  useEffect(() => {
    if (change && change.at !== lastSeenChange.current) {
      lastSeenChange.current = change.at
      if (window.innerWidth < 768) {
        toast(`${customer.name.split(" ")[0]}'s profile updated`, {
          description: `${change.changes.length} fields changed`,
          action: { label: "View", onClick: () => document.getElementById("profile-panel")?.scrollIntoView({ behavior: "smooth" }) },
        })
      }
    }
  }, [change, customer.name])

  const showEvidence = (messageId: number) => {
    const el = document.getElementById(`msg-${messageId}`)
    el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" })
    setFlashId(null)
    requestAnimationFrame(() => setFlashId(messageId))
  }

  const highlights = change ? change.changes.map((c) => c.evidence).filter((e): e is string => Boolean(e)) : []

  return (
    <PageFade>
      <PageHeader
        title="Conversations"
        description="Customer chats with an AI persona. After every turn the backend extracts what the customer said into their CRM profile."
      />

      {/* Customer switcher below xl, where the inbox column is hidden. */}
      <nav aria-label="Conversations" className="scroll-thin -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 xl:hidden">
        {chats.map((c) => {
          const cu = state.customers.find((x) => x.id === c.customer_id)!
          const active = c.id === chat.id
          return (
            <Link
              key={c.id}
              to={`/app/conversations/${cu.id}`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1 text-[13px] font-medium transition-colors",
                active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              <Avatar id={cu.id} name={cu.name} size={30} />
              {cu.name.split(" ")[0]}
              {c.played < c.script.length && <span className="size-2 rounded-full bg-coral" aria-label="new message" />}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_320px] xl:mt-6 xl:grid-cols-[264px_minmax(0,1fr)_340px]">
        {/* Inbox */}
        <aside className="surface hidden min-h-0 flex-col overflow-hidden xl:flex xl:h-[calc(100dvh-232px)] xl:min-h-[540px]" aria-label="Inbox">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Inbox</p>
            <p className="text-[12px] text-ink-3">{chats.length} conversations</p>
          </div>
          <ul className="scroll-thin flex-1 overflow-y-auto">
            {chats.map((c) => {
              const cu = state.customers.find((x) => x.id === c.customer_id)!
              const last = messagesForChat(state, c.id).at(-1)
              const isNew = c.played < c.script.length
              const active = c.id === chat.id
              return (
                <li key={c.id}>
                  <Link
                    to={`/app/conversations/${cu.id}`}
                    aria-current={active ? "page" : undefined}
                    data-tour={cu.id === 1 ? "inbox-ines" : undefined}
                    className={cx(
                      "relative flex gap-3 border-b border-line/70 px-4 py-3 transition-colors",
                      active ? "bg-paper-2/80" : "hover:bg-surface-2",
                    )}
                  >
                    {active && <motion.span layoutId="inbox-active" className="absolute inset-y-0 left-0 w-[3px] bg-coral" />}
                    <Avatar id={cu.id} name={cu.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cx("truncate text-[13.5px]", isNew ? "font-semibold text-ink" : "font-medium text-ink")}>{cu.name}</span>
                        <span className="shrink-0 text-[11px] text-ink-3">
                          {isNew ? "new" : last ? shortDate(last.created_at) : ""}
                        </span>
                      </div>
                      <p className="truncate text-[12.5px] text-ink-3">
                        {isNew ? c.script[c.played].customer : last?.content}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <StageBadge stage={state.profiles[cu.id].lead_stage} className="!text-[11px] !py-0" />
                        <span className="text-[11px] text-ink-3">{CHANNEL_LABEL[c.source_channel]}</span>
                        {isNew && <span className="ml-auto size-2 rounded-full bg-coral" aria-label="new message" />}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Thread */}
        <section
          data-tour="thread"
          aria-label={`Conversation with ${customer.name}`}
          className="surface flex min-h-[520px] min-w-0 flex-col overflow-hidden md:h-[calc(100dvh-248px)] xl:h-[calc(100dvh-232px)] xl:min-h-[540px]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar id={customer.id} name={customer.name} size={38} />
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold text-ink">{customer.name}</p>
                <p className="truncate text-[12.5px] text-ink-3">
                  {customer.company} · {CHANNEL_LABEL[chat.source_channel]}
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  <Sparkles className="mr-1 inline size-3 -translate-y-px text-coral" aria-hidden />
                  Replies by {persona.name} · AI persona
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setPromptOpen(true)} data-testid="view-prompt">
                <FileCode2 aria-hidden /> Prompt
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/app/customers/${customer.id}`)} className="hidden sm:inline-flex">
                CRM <ArrowRight aria-hidden />
              </Button>
            </div>
          </header>

          <div ref={threadRef} className="scroll-thin relative flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-testid="thread">
            <div className="mb-5 flex justify-center">
              {chat.script.length ? (
                <Provenance kind="scripted">Scripted demo conversation · replies are not live model output</Provenance>
              ) : (
                <Provenance kind="synthetic">Synthetic conversation history</Provenance>
              )}
            </div>
            {!messages.length && !pending && (
              <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 text-center" data-testid="thread-intro">
                <Avatar id={customer.id} name={customer.name} size={52} />
                <p className="text-[14.5px] font-semibold text-ink">
                  {customer.name.split(" ")[0]} wrote in on {CHANNEL_LABEL[chat.source_channel]} {relativeTime(chat.created_at, state.now)}
                </p>
                <p className="text-[13px] leading-relaxed text-ink-3">
                  Play the conversation turn by turn. After each reply, watch her customer profile change: stage, interests,
                  budget, objections and notes, each linked to the words they came from.
                </p>
              </div>
            )}
            <ol className="flex flex-col gap-3">
              {messages.map((m, i) => {
                const prev = messages[i - 1]
                const showDay = !prev || shortDate(prev.created_at) !== shortDate(m.created_at)
                return (
                  <Fragment key={m.id}>
                    {showDay && (
                      <li className="my-1 flex justify-center" aria-hidden>
                        <span className="text-[11px] font-medium text-ink-3">{relativeTime(m.created_at, state.now) === "just now" ? "Today" : shortDate(m.created_at)}</span>
                      </li>
                    )}
                    <MessageBubble
                      message={m}
                      persona={persona.name}
                      firstInGroup={!prev || prev.role !== m.role}
                      flash={flashId === m.id}
                      highlights={change?.message_id === m.id ? highlights : []}
                    />
                  </Fragment>
                )
              })}
              {pending && <PendingTurn phase={pending.phase} customer={pending.customer} reply={pending.reply} persona={persona.name} />}
            </ol>
          </div>

          <footer className="border-t border-line bg-surface-2/70 px-4 py-3 sm:px-5">
            {chat.script.length > 0 && remaining > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
                    Next from {customer.name.split(" ")[0]} · turn {chat.played + 1} of {chat.script.length}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2 sm:line-clamp-1">“{chat.script[chat.played].customer}”</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="accent"
                    data-tour="play"
                    data-testid="play-turn"
                    disabled={Boolean(playback)}
                    onClick={() => play(chat.id, 1)}
                  >
                    <Play aria-hidden /> {playback ? "Playing…" : `Play turn ${chat.played + 1}`}
                  </Button>
                  {remaining > 1 && (
                    <Button variant="secondary" disabled={Boolean(playback)} onClick={() => play(chat.id, remaining)} data-testid="play-all">
                      <PlayCircle aria-hidden /> Play all
                    </Button>
                  )}
                </div>
              </div>
            )}
            {chat.script.length > 0 && remaining === 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-tour="play">
                <p className="text-[13px] text-ink-2">
                  Conversation complete. {customer.name.split(" ")[0]} is now <strong className="font-semibold text-ink">{state.profiles[customer.id].lead_stage}</strong> and in the January packaging campaign.
                </p>
                <Link to="/app/campaigns/1" className={buttonClass("primary", "sm")}>
                  Open campaign <ArrowRight aria-hidden />
                </Link>
              </div>
            )}
            {chat.script.length === 0 && (
              <div className="flex items-center gap-3 rounded-ctl border border-dashed border-line-strong bg-surface px-3 py-2.5 text-[12.5px] text-ink-3">
                <Lock className="size-4 shrink-0" aria-hidden />
                Replying needs the FastAPI backend and an OpenAI key. This public demo only replays synthetic conversations.
              </div>
            )}
          </footer>
        </section>

        {/* Profile */}
        <aside
          id="profile-panel"
          data-tour="profile"
          aria-label={`${customer.name}'s profile`}
          className="surface scroll-thin min-w-0 overflow-y-auto md:h-[calc(100dvh-248px)] md:min-h-[520px] xl:h-[calc(100dvh-232px)] xl:min-h-[540px]"
          data-testid="profile-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="text-[13px] font-semibold text-ink">Customer profile</p>
            <span className="inline-flex items-center gap-1 text-[11.5px] text-indigo">
              <Cpu className="size-3.5" aria-hidden /> extracted from chat
            </span>
          </div>
          <ProfileCard customerId={customer.id} onEvidence={showEvidence} />
        </aside>
      </div>

      <Sheet
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={`Instructions for ${customer.name.split(" ")[0]}'s chat`}
        description="What the backend sends as `instructions` with every turn: the persona prompt plus the sales prompt built from the business settings and this customer's current profile."
        width="sm:max-w-[620px]"
        testId="prompt-sheet"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Provenance kind="backend">TypeScript port of prompter.py</Provenance>
            <Provenance kind="synthetic">Rebuilt live from the demo state</Provenance>
          </div>
          <PromptView
            text={buildChatInstructions(persona, state.business, customer, state.profiles[customer.id])}
            emphasize={["CUSTOMER INTELLIGENCE", "KNOWN OBJECTIONS", "BUSINESS CONTEXT"]}
          />
          <p className="text-[12.5px] text-ink-3">
            With the instructions, the backend sends the last 20 messages of this chat as input to the OpenAI Responses API
            (<code className="font-mono">store=False</code>), then runs profile extraction on the new turn.
          </p>
        </div>
      </Sheet>
    </PageFade>
  )
}

function highlight(text: string, phrases: string[]): ReactNode {
  if (!phrases.length) return text
  const parts: ReactNode[] = []
  let rest = text
  let key = 0
  while (rest) {
    let best: { i: number; p: string } | null = null
    for (const p of phrases) {
      const i = rest.indexOf(p)
      if (i >= 0 && (!best || i < best.i || (i === best.i && p.length > best.p.length))) best = { i, p }
    }
    if (!best) {
      parts.push(rest)
      break
    }
    if (best.i > 0) parts.push(rest.slice(0, best.i))
    parts.push(
      <mark key={key++} className="rounded-sm bg-transparent text-inherit underline decoration-coral decoration-2 underline-offset-[3px]">
        {best.p}
      </mark>,
    )
    rest = rest.slice(best.i + best.p.length)
  }
  return parts
}

function MessageBubble({
  message,
  persona,
  firstInGroup,
  flash,
  highlights,
}: {
  message: Message
  persona: string
  firstInGroup: boolean
  flash: boolean
  highlights: string[]
}) {
  const mine = message.role === "assistant"
  return (
    <li id={`msg-${message.id}`} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
      {mine && firstInGroup && (
        <span className="mb-1 inline-flex items-center gap-1.5 pr-1 text-[11.5px] font-medium text-ink-3">
          <Sparkles className="size-3 text-coral" aria-hidden /> {persona}
        </span>
      )}
      <div
        className={cx(
          "max-w-[88%] rounded-[18px] px-3.5 py-2.5 text-[14px] leading-relaxed sm:max-w-[78%]",
          mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border border-line bg-surface text-ink shadow-[0_1px_0_rgb(31_28_23/0.03)]",
          flash && "flash-ring",
        )}
      >
        <p className="whitespace-pre-wrap">{mine ? message.content : highlight(message.content, highlights)}</p>
      </div>
      <span className="mt-1 px-1 text-[11px] text-ink-3">
        <span className="sr-only">{mine ? `${persona}, ` : "Customer, "}</span>
        {clockTime(message.created_at)}
      </span>
    </li>
  )
}

function PendingTurn({ phase, customer, reply, persona }: { phase: string; customer: string; reply: string; persona: string }) {
  return (
    <>
      <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-start">
        <div className="max-w-[88%] rounded-[18px] rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink sm:max-w-[78%]">
          {customer}
        </div>
        <span className="mt-1 px-1 text-[11px] text-ink-3">just now</span>
      </motion.li>
      <AnimatePresence mode="popLayout">
        {phase === "typing" && (
          <motion.li key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-end" aria-label={`${persona} is typing`}>
            <span className="mb-1 inline-flex items-center gap-1.5 pr-1 text-[11.5px] font-medium text-ink-3">
              <PersonaMark size={16} /> {persona}
            </span>
            <div className="flex gap-1 rounded-[18px] rounded-br-md bg-ink px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot size-1.5 rounded-full bg-paper" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </motion.li>
        )}
        {(phase === "streaming" || phase === "extracting") && (
          <motion.li key="reply" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-end">
            <span className="mb-1 inline-flex items-center gap-1.5 pr-1 text-[11.5px] font-medium text-ink-3">
              <Sparkles className="size-3 text-coral" aria-hidden /> {persona}
            </span>
            <div className="max-w-[88%] rounded-[18px] rounded-br-md bg-ink px-3.5 py-2.5 text-[14px] leading-relaxed text-paper sm:max-w-[78%]">
              {reply}
              {phase === "streaming" && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-paper/70" aria-hidden />}
            </div>
            {phase === "extracting" && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-soft px-2.5 py-1 text-[11.5px] font-medium text-indigo ring-1 ring-indigo/15"
                role="status"
              >
                <Cpu className="size-3.5" aria-hidden /> Extracting profile fields…
              </motion.span>
            )}
          </motion.li>
        )}
      </AnimatePresence>
    </>
  )
}
