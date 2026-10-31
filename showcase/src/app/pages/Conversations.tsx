import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, FileCode2, Lock, MessagesSquare, Play, PlayCircle, Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { PageHeader } from "@/app/PageHeader"
import { FactLegend } from "@/components/facts"
import { Memory } from "@/components/Memory"
import { PromptView } from "@/components/PromptView"
import { Sheet } from "@/components/Sheet"
import { Thread } from "@/components/Thread"
import { Avatar, Button, EmptyState, Provenance, StageBadge } from "@/components/ui"
import { useDemo } from "@/demo/context"
import { usePlayer } from "@/demo/playerContext"
import { buildChatInstructions } from "@/demo/prompt"
import { messagesForChat } from "@/demo/state"
import type { Chat, ProfileField } from "@/demo/types"
import { CHANNEL_LABEL, relativeTime, shortDate } from "@/lib/format"
import { buttonClass, cx } from "@/lib/styles"

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
            Only customers who wrote in have a chat.{" "}
            <Link to="/app/conversations" className="text-coral-ink underline">
              Back to the inbox
            </Link>
          </EmptyState>
        </div>
      </PageFade>
    )
  }
  return <ConversationView key={chat.id} chat={chat} chats={chats} />
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
  const [flash, setFlash] = useState<{ messageId: number; field: ProfileField | null; n: number } | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const change = state.lastProfileChange?.chat_id === chat.id ? state.lastProfileChange : null
  const unplayed = state.chats.filter((c) => c.played < c.script.length).length

  // Keep the newest message in view.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" })
  }, [messages.length, pending?.phase, reduced])

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

  const showSource = (field: ProfileField, messageId: number) => {
    document.getElementById(`msg-${messageId}`)?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" })
    setFlash((f) => ({ messageId, field, n: (f?.n ?? 0) + 1 }))
  }

  return (
    <PageFade>
      <PageHeader title="Conversations" meta={`${state.chats.length} chats${unplayed ? ` · ${unplayed} new` : ""} · replies by AI personas`} />

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

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px] xl:mt-6 xl:grid-cols-[248px_minmax(0,1fr)_360px]">
        {/* Inbox */}
        <aside className="surface hidden min-h-0 flex-col overflow-hidden xl:flex xl:h-[calc(100dvh-150px)] xl:min-h-[560px]" aria-label="Inbox">
          <p className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">Inbox</p>
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
                    className={cx("relative flex gap-3 border-b border-line/60 px-4 py-3 transition-colors", active ? "bg-paper-2/70" : "hover:bg-surface-2")}
                  >
                    {active && <motion.span layoutId="inbox-active" className="absolute inset-y-0 left-0 w-[3px] bg-coral" />}
                    <Avatar id={cu.id} name={cu.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cx("truncate text-[13.5px] text-ink", isNew ? "font-semibold" : "font-medium")}>{cu.name}</span>
                        <span className={cx("shrink-0 text-[11px]", isNew ? "font-semibold text-coral-ink" : "text-ink-3")}>
                          {isNew ? "new" : last ? shortDate(last.created_at) : ""}
                        </span>
                      </div>
                      <p className="truncate text-[12.5px] text-ink-3">{isNew ? c.script[c.played].customer : last?.content}</p>
                      <div className="mt-1.5">
                        <StageBadge stage={state.profiles[cu.id].lead_stage} className="!py-0 !text-[11px]" />
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
          className="surface flex min-h-[520px] min-w-0 flex-col overflow-hidden md:h-[calc(100dvh-170px)] xl:h-[calc(100dvh-150px)] xl:min-h-[560px]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar id={customer.id} name={customer.name} size={38} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{customer.name}</p>
                <p className="truncate text-[12.5px] text-ink-3">
                  {customer.company} · {CHANNEL_LABEL[chat.source_channel]}
                </p>
                <p className="truncate text-[12px] text-ink-3">
                  <Sparkles className="mr-1 inline size-3 -translate-y-px text-coral" aria-hidden />
                  Replies by {persona.name}, AI persona
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setPromptOpen(true)} data-testid="view-prompt">
                <FileCode2 aria-hidden /> Prompt
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/app/customers/${customer.id}`)} className="max-sm:hidden">
                CRM <ArrowRight aria-hidden />
              </Button>
            </div>
          </header>

          <div ref={threadRef} className="scroll-thin @container relative flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-testid="thread">
            <div className="mb-5 flex justify-center">
              {chat.script.length ? (
                <Provenance kind="scripted">Scripted demo conversation · not live model output</Provenance>
              ) : (
                <Provenance kind="synthetic">Synthetic conversation history</Provenance>
              )}
            </div>
            {!messages.length && !pending && chat.script.length > 0 && (
              <div className="mx-auto mt-4 flex max-w-sm flex-col items-center gap-3 text-center" data-testid="thread-intro">
                <Avatar id={customer.id} name={customer.name} size={52} />
                <p className="text-[15px] font-semibold text-ink">
                  {customer.name.split(" ")[0]} wrote in on {CHANNEL_LABEL[chat.source_channel]} {relativeTime(chat.created_at, state.now)}
                </p>
                <FactLegend className="justify-center" />
              </div>
            )}
            <Thread chat={chat} flash={flash} />
          </div>

          <footer className="border-t border-line bg-surface-2/70 px-4 py-3 sm:px-5">
            {chat.script.length > 0 && remaining > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">
                    Next from {customer.name.split(" ")[0]} · {chat.played + 1} of {chat.script.length}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2 sm:line-clamp-1">“{chat.script[chat.played].customer}”</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="accent" data-tour="play" data-testid="play-turn" disabled={Boolean(playback)} onClick={() => play(chat.id, 1)}>
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
                  Conversation complete. {customer.name.split(" ")[0]} is now{" "}
                  <strong className="font-semibold text-ink">{state.profiles[customer.id].lead_stage}</strong> and in the January packaging campaign.
                </p>
                <Link to="/app/campaigns/1" className={buttonClass("primary", "sm")}>
                  Open campaign <ArrowRight aria-hidden />
                </Link>
              </div>
            )}
            {chat.script.length === 0 && (
              <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-line-strong bg-surface px-3 py-2.5 text-[12.5px] text-ink-3">
                <Lock className="size-4 shrink-0" aria-hidden />
                Replying needs the FastAPI backend and an OpenAI key. This demo only replays synthetic history.
              </div>
            )}
          </footer>
        </section>

        {/* Memory */}
        <aside
          id="profile-panel"
          data-tour="profile"
          aria-label={`${customer.name}'s profile`}
          className="surface scroll-thin min-w-0 overflow-y-auto md:h-[calc(100dvh-170px)] md:min-h-[520px] xl:h-[calc(100dvh-150px)] xl:min-h-[560px]"
          data-testid="profile-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Customer memory</p>
            <span className="text-[11.5px] text-ink-3">updated after every message</span>
          </div>
          <Memory customerId={customer.id} onSource={showSource} activeField={flash?.field ?? null} />
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
            With the instructions, the backend sends the last 20 messages of this chat to the OpenAI Responses API (
            <code className="font-mono">store=False</code>), then runs profile extraction on the new turn.
          </p>
        </div>
      </Sheet>
    </PageFade>
  )
}
