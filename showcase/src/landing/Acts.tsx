import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Check, Download, Play, PlayCircle, Quote, Wand2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { DraftView } from "@/components/DraftView"
import { FactChip, FactText } from "@/components/facts"
import { Memory } from "@/components/Memory"
import { ProductFrame } from "@/components/ProductFrame"
import { Thread } from "@/components/Thread"
import { Avatar, Button, StageBadge } from "@/components/ui"
import * as seed from "@/demo/data"
import { useDemo } from "@/demo/context"
import { downloadOutboxCsv } from "@/demo/download"
import { segmentRecipients } from "@/demo/engine"
import { exportRows } from "@/demo/csv"
import { kindOf, messageFacts, profileHistory, type FactKind, type TurnRecord } from "@/demo/facts"
import { audienceFunnel } from "@/demo/funnel"
import { usePlayer } from "@/demo/playerContext"
import { outboxForCampaign } from "@/demo/state"
import type { FieldChange, ProfileField } from "@/demo/types"
import { STAGE_META, clockTime, plural } from "@/lib/format"
import { FACT_TONE } from "@/lib/factTone"
import { buttonClass, cx } from "@/lib/styles"

const INES = 1
const INES_CHAT = 1
const JANUARY = 1

function useInes() {
  const { state } = useDemo()
  const chat = state.chats.find((c) => c.id === INES_CHAT)!
  return { state, chat, remaining: chat.script.length - chat.played }
}

// ---------------------------------------------------------------------------------------------
// Act I: the conversation
// ---------------------------------------------------------------------------------------------

export function ActConversation() {
  const { state, chat, remaining } = useInes()
  const { playback, play } = usePlayer()
  const reduced = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const count = state.messages.filter((m) => m.chat_id === INES_CHAT).length
  const next = remaining ? chat.script[chat.played] : null
  const untouched = useRef(chat.played === 0)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" })
  }, [count, playback?.phase, reduced])

  // The first time this act comes into view on an untouched workspace, Ines's first message is
  // read for real (same action as the Play button), so the chapters below have something to show.
  useEffect(() => {
    const el = frame.current
    if (!el || reduced || !untouched.current) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio < 0.6 || !untouched.current) return
        untouched.current = false
        void play(INES_CHAT, 1)
      },
      { threshold: [0.6] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [play, reduced])

  return (
    <div ref={frame}>
      <ProductFrame
        section="conversations"
        label="Interactive: Ines Calder's conversation"
        crumb={
          <>
            Conversations <span className="text-line-strong">/</span> Ines Calder
          </>
        }
        right={<span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber">Scripted conversation</span>}
        className="h-[520px] sm:h-[560px]"
        bodyClassName="flex"
      >
        <div className="grid min-w-0 flex-1 @3xl:grid-cols-[minmax(0,1fr)_232px]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <div ref={scroller} className="scroll-thin @container min-h-0 flex-1 overflow-y-auto px-4 py-5 @lg:px-6" data-testid="story-thread">
              {!count && !playback && next && (
                <div className="flex flex-col items-start">
                  <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-coral px-2 py-0.5 text-[11px] font-semibold text-white">
                    New message
                  </span>
                  <div className="max-w-[88%] rounded-[18px] rounded-bl-md border border-dashed border-line-strong bg-surface-2 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink-2 @lg:max-w-[80%]">
                    {next.customer}
                  </div>
                </div>
              )}
              <Thread chat={chat} size="lg" days={false} />
            </div>
            <div className="flex flex-col gap-3 border-t border-line bg-surface-2/80 px-4 py-3 @lg:flex-row @lg:items-center @lg:px-5">
              {next ? (
                <>
                  <p className="min-w-0 flex-1 text-[12.5px] text-ink-3">
                    <span className="font-semibold text-ink-2">
                      Message {chat.played + 1} of {chat.script.length}
                    </span>{" "}
                    from Ines, waiting to be read
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="accent" onClick={() => play(INES_CHAT, 1)} disabled={Boolean(playback)} data-testid="story-play">
                      <Play aria-hidden /> {playback ? "Reading…" : chat.played ? "Next message" : "Play the message"}
                    </Button>
                    {remaining > 1 && (
                      <Button variant="secondary" onClick={() => play(INES_CHAT, remaining)} disabled={Boolean(playback)} data-testid="story-play-all">
                        <PlayCircle aria-hidden /> All
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 text-[13px] text-ink-2">
                    <Check className="mr-1 inline size-4 -translate-y-px text-sage" aria-hidden />
                    All {chat.script.length} messages read.
                  </p>
                  <Link to="/app/conversations/1" className={buttonClass("secondary", "sm")}>
                    Open in the workspace <ArrowRight aria-hidden />
                  </Link>
                </>
              )}
            </div>
          </div>
          <Heard />
        </div>
      </ProductFrame>
    </div>
  )
}

/** The facts the profile has taken from the conversation so far, one row per fact, newest last. */
function Heard() {
  const { state } = useDemo()
  const items = profileHistory(state, INES).flatMap((r) => factsOfTurn(r))
  return (
    <aside
      className="hidden min-h-0 flex-col border-l border-line bg-surface-2/60 @3xl:flex"
      aria-label="What the profile took from the chat"
      data-testid="story-heard"
    >
      <p className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-ink">Heard so far</p>
      <ol className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.key}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[12px] border border-line bg-surface px-3 py-2"
            >
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                <span aria-hidden className={cx("size-2 rounded-full", FACT_TONE[it.kind].dot)} />
                {it.label}
                <span className="ml-auto font-medium tracking-normal normal-case">msg {it.turn + 1}</span>
              </p>
              <p className="mt-0.5 text-[13px] font-medium text-ink">{it.value}</p>
            </motion.li>
          ))}
        </AnimatePresence>
        {!items.length &&
          (["interest", "budget", "concern", "intent"] as const).map((k) => (
            <li key={k} className="rounded-[12px] border border-dashed border-line-strong px-3 py-2" aria-hidden>
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                <span className={cx("size-2 rounded-full opacity-50", FACT_TONE[k].dot)} />
                {k === "intent" ? "Stage" : k}
              </p>
              <p className="mt-1 h-2 w-16 rounded-full bg-line" />
            </li>
          ))}
      </ol>
    </aside>
  )
}

function factsOfTurn(r: TurnRecord): { key: string; kind: FactKind; label: string; value: string; turn: number }[] {
  const out: { key: string; kind: FactKind; label: string; value: string; turn: number }[] = []
  const added = (c: FieldChange) => c.after.split(", ").filter((x) => x && x !== "none" && !c.before.split(", ").includes(x))
  for (const c of r.changes) {
    const key = `${r.turn}-${c.field}`
    if (c.field === "interests") for (const v of added(c)) out.push({ key: `${key}-${v}`, kind: "interest", label: "Interest", value: v, turn: r.turn })
    if (c.field === "budget") out.push({ key, kind: "budget", label: "Budget", value: c.after, turn: r.turn })
    if (c.field === "objections") for (const v of added(c)) out.push({ key: `${key}-${v}`, kind: "concern", label: "Concern", value: v, turn: r.turn })
    if (c.field === "lead_stage")
      out.push({
        key,
        kind: "intent",
        label: "Stage",
        value: `${STAGE_META[c.before as keyof typeof STAGE_META].label} → ${STAGE_META[c.after as keyof typeof STAGE_META].label}`,
        turn: r.turn,
      })
    if (c.field === "location") out.push({ key, kind: "context", label: "Location", value: c.after, turn: r.turn })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Act II: the memory
// ---------------------------------------------------------------------------------------------

export function ActMemory() {
  const { state, remaining } = useInes()
  const { playback, play } = usePlayer()
  const [focus, setFocus] = useState<{ field: ProfileField; messageId: number } | null>(null)
  const history = profileHistory(state, INES)
  const start = seed.profiles.find((p) => p.customer_id === INES)!

  return (
    <ProductFrame
      section="customers"
      label="Interactive: Ines Calder's customer profile"
      crumb={
        <>
          Customers <span className="text-line-strong">/</span> Ines Calder
        </>
      }
      className="max-h-[720px] sm:h-[640px]"
      bodyClassName="flex"
    >
      <div className="grid min-w-0 flex-1 @3xl:grid-cols-[330px_minmax(0,1fr)]">
        <div className="scroll-thin min-h-0 overflow-y-auto border-line @3xl:border-r" data-testid="story-memory">
          <Memory customerId={INES} variant="story" onSource={(field, messageId) => setFocus({ field, messageId })} activeField={focus?.field ?? null} />
          {remaining > 0 && (
            <div className="border-t border-line p-4 @3xl:hidden">
              <Button variant="primary" size="sm" onClick={() => play(INES_CHAT, remaining)} disabled={Boolean(playback)}>
                <PlayCircle aria-hidden /> {playback ? "Reading…" : history.length ? "Read the rest" : "Read the conversation"}
              </Button>
            </div>
          )}
        </div>
        <div className="scroll-thin hidden min-h-0 overflow-y-auto bg-surface-2/50 px-5 py-4 @3xl:block" data-testid="story-timeline">
          <p className="text-[12px] font-semibold text-ink">How the profile was built</p>
          <ol className="relative mt-3 flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-line-strong/70">
            <li className="relative pl-6">
              <span aria-hidden className="absolute top-1.5 left-0 size-[15px] rounded-full border-2 border-surface bg-line-strong" />
              <p className="text-[11.5px] font-medium text-ink-3">Before the chat</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {STAGE_META[start.lead_stage].label} · score {start.lead_score} · {start.notes[0]?.text}
              </p>
            </li>
            <AnimatePresence initial={false}>
              {history.map((r) => (
                <TimelineItem key={r.message.id} record={r} focus={focus?.messageId === r.message.id ? focus.field : null} />
              ))}
            </AnimatePresence>
          </ol>
          {remaining > 0 && (
            <div className="mt-4 rounded-[14px] border border-dashed border-line-strong bg-surface p-4">
              <p className="text-[13px] text-ink-2">
                {history.length ? `${plural(remaining, "message")} still unread.` : "Nothing learned yet: Ines's messages are unread."}
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={() => play(INES_CHAT, remaining)}
                disabled={Boolean(playback)}
                data-testid="story-memory-play"
              >
                <PlayCircle aria-hidden /> {playback ? "Reading…" : history.length ? "Read the rest" : "Read the conversation"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </ProductFrame>
  )
}

function TimelineItem({ record, focus }: { record: TurnRecord; focus: ProfileField | null }) {
  const { state } = useDemo()
  const facts = messageFacts(state, record.message)
  const main = record.changes.find((c) => ["budget", "objections", "interests", "lead_stage"].includes(c.field))
  const kind = main ? kindOf(main.field, record.patch) : "context"
  const chips = record.changes.filter((c) => c.field !== "notes" && c.field !== "tone" && c.field !== "language")
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-6"
      data-testid={`timeline-${record.turn + 1}`}
    >
      <span aria-hidden className={cx("absolute top-1.5 left-0 size-[15px] rounded-full border-2 border-surface", FACT_TONE[kind].dot)} />
      <p className="text-[11.5px] font-medium text-ink-3">
        Message {record.turn + 1} · {clockTime(record.message.created_at)}
      </p>
      <div
        className={cx(
          "mt-1 rounded-[12px] border bg-surface px-3 py-2.5 transition-shadow duration-300",
          focus ? "border-ink/30 shadow-[0_0_0_3px_rgb(31_28_23/0.06)]" : "border-line",
        )}
      >
        <p className="text-[13.5px] leading-relaxed text-ink">
          <Quote className="mr-1 inline size-3 -translate-y-px text-ink-3" aria-hidden />
          <FactText text={record.message.content} facts={facts} active={focus} />
        </p>
        <ul className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <li key={c.field}>
              <FactChip kind={kindOf(c.field, record.patch)} className="!py-0 !text-[11.5px]">
                {changeLabel(c)}
              </FactChip>
            </li>
          ))}
        </ul>
      </div>
    </motion.li>
  )
}

function changeLabel(c: FieldChange): string {
  switch (c.field) {
    case "lead_score": {
      const d = Number(c.after) - Number(c.before)
      return `score ${d >= 0 ? "+" : "−"}${Math.abs(d)}`
    }
    case "lead_stage":
      return `${c.before} → ${c.after}`
    case "interests":
    case "objections": {
      const added = c.after.split(", ").filter((x) => !c.before.split(", ").includes(x))
      return `+ ${added.join(", ")}`
    }
    case "budget":
      return c.after
    default:
      return `${c.field.replace("_", " ")}: ${c.after}`
  }
}

// ---------------------------------------------------------------------------------------------
// Act III: the campaign
// ---------------------------------------------------------------------------------------------

export function ActCampaign() {
  const { state, dispatch } = useDemo()
  const { playback, play } = usePlayer()
  const { remaining } = useInes()
  const campaign = state.campaigns.find((c) => c.id === JANUARY)!
  const [picked, setPicked] = useState<number | null>(null)
  const [exported, setExported] = useState<string | null>(null)
  const recipients = segmentRecipients(state, campaign)
  const matching = recipients.filter((r) => r.check.matches)
  const ines = recipients.find((r) => r.customer.id === INES)!
  const messages = outboxForCampaign(state, JANUARY)
  const undrafted = matching.filter((r) => !messages.some((m) => m.customer_id === r.customer.id))
  const selected = messages.find((m) => m.customer_id === picked) ?? messages.find((m) => m.customer_id === INES) ?? messages[0]
  const funnel = audienceFunnel(state, campaign.segment)
  const exportable = exportRows(state, JANUARY).length

  const generate = () => {
    const r = dispatch({ type: "generateDrafts", campaignId: JANUARY })
    if (r.ok) toast.success(`${plural(r.created ?? 0, "draft")} written`, { description: "By the demo's template composer. No model was called." })
  }

  return (
    <ProductFrame
      section="campaigns"
      label="Interactive: the January packaging campaign"
      crumb={
        <>
          Campaigns <span className="text-line-strong">/</span> {campaign.name}
        </>
      }
      className="min-h-[520px] sm:h-[700px]"
      bodyClassName="flex flex-col"
    >
      <div className="grid min-h-0 flex-1 @3xl:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="scroll-thin hidden min-h-0 flex-col gap-4 overflow-y-auto border-r border-line bg-surface-2/50 p-4 @3xl:flex" aria-label="Audience">
          <div>
            <p className="text-[12px] font-semibold text-ink">Audience</p>
            <ol className="mt-2 flex flex-col gap-1">
              {funnel.map((s, i) => (
                <li key={s.label} className="relative h-6 overflow-hidden rounded-[7px] bg-paper-2">
                  <motion.span
                    className={cx("absolute inset-y-0 left-0 rounded-[7px]", i === funnel.length - 1 ? "bg-fact-intent" : "bg-line-strong/60")}
                    initial={false}
                    animate={{ width: `${(s.ids.length / state.customers.length) * 100}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <span
                    className={cx(
                      "relative flex h-full items-center justify-between gap-2 px-2 text-[11px] font-medium",
                      i === funnel.length - 1 ? "text-ink" : "text-ink-2",
                    )}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className="num">{s.ids.length}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <ul className="flex flex-col gap-1" data-testid="story-recipients">
            <AnimatePresence initial={false}>
              {matching.map(({ customer, profile }) => {
                const m = messages.find((x) => x.customer_id === customer.id)
                const on = selected?.customer_id === customer.id
                return (
                  <motion.li
                    key={customer.id}
                    layout
                    initial={{ opacity: 0, backgroundColor: "rgba(207,228,214,1)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(207,228,214,0)" }}
                    transition={{ duration: 0.8 }}
                    className="rounded-[10px]"
                  >
                    <button
                      type="button"
                      onClick={() => setPicked(customer.id)}
                      disabled={!m}
                      aria-pressed={on}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left transition-colors",
                        on ? "bg-surface shadow-[0_0_0_1px_var(--color-line-strong)]" : "enabled:hover:bg-surface",
                      )}
                    >
                      <Avatar id={customer.id} name={customer.name} size={26} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{customer.name}</span>
                      {customer.id === INES && <span className="rounded-full bg-coral-soft px-1.5 text-[10.5px] font-semibold text-coral-ink">from chat</span>}
                      {m ? (
                        <span
                          className={cx("size-2 rounded-full", m.status === "approved" ? "bg-sage" : m.status === "sent" ? "bg-indigo" : "bg-ink-3/50")}
                          aria-label={m.status}
                        />
                      ) : (
                        <StageBadge stage={profile.lead_stage} className="!px-1.5 !text-[10.5px]" />
                      )}
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
          {!ines.check.matches && (
            <div className="rounded-[12px] border border-dashed border-line-strong bg-surface p-3" data-testid="story-ines-out">
              <div className="flex items-center gap-2">
                <Avatar id={INES} name="Ines Calder" size={26} />
                <p className="text-[12.5px] font-medium text-ink">Ines Calder · not yet</p>
              </div>
              <p className="mt-1 text-[12px] text-ink-3">{ines.check.reasons.join(" · ")}</p>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => play(INES_CHAT, 1)}
                  disabled={Boolean(playback)}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-coral-ink hover:underline disabled:opacity-50"
                >
                  <Play className="size-3.5" aria-hidden /> Read her first message
                </button>
              )}
            </div>
          )}
        </aside>

        <div className="scroll-thin min-h-0 overflow-y-auto p-3 sm:p-4" data-testid="story-draft">
          <div className="mb-3 flex items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2 @3xl:hidden">
            <span className="flex -space-x-2">
              {matching.slice(0, 6).map((r) => (
                <Avatar key={r.customer.id} id={r.customer.id} name={r.customer.name} size={24} className="ring-2 ring-surface-2" />
              ))}
            </span>
            <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
              <span className="num font-semibold text-ink">{matching.length}</span> in the audience{ines.check.matches ? ", Ines included" : ", Ines not yet"}
            </p>
          </div>
          {selected ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <DraftView message={selected} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
              <span className="flex -space-x-2.5">
                {matching.slice(0, 7).map((r) => (
                  <Avatar key={r.customer.id} id={r.customer.id} name={r.customer.name} size={42} className="ring-2 ring-surface" />
                ))}
              </span>
              <p className="display max-w-sm text-[22px] leading-tight font-semibold text-ink">
                {ines.check.matches ? "Ines is in. Write one draft per customer." : `${plural(matching.length, "customer")} in the audience.`}
              </p>
              <Button variant="primary" size="lg" onClick={generate} disabled={!undrafted.length} data-testid="story-generate">
                <Wand2 aria-hidden /> Write {plural(undrafted.length, "draft")}
              </Button>
            </div>
          )}
          {selected && undrafted.length > 0 && (
            <button type="button" onClick={generate} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-2 hover:text-ink">
              <Wand2 className="size-3.5" aria-hidden /> Write {plural(undrafted.length, "more draft")}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
        <p className="mr-auto text-[12.5px] text-ink-3">
          <span className="num font-semibold text-ink">{plural(exportable, "approved message")}</span> · nothing is sent from here
        </p>
        {exported && (
          <span className="text-[12px] font-medium text-sage" role="status" data-testid="story-export-status">
            <Check className="mr-1 inline size-3.5" aria-hidden />
            {exported}
          </span>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!exportable}
          onClick={() => {
            const done = downloadOutboxCsv(state, JANUARY)
            setExported(`${done.name} downloaded`)
          }}
          data-testid="story-export"
        >
          <Download aria-hidden /> Export CSV
        </Button>
      </div>
    </ProductFrame>
  )
}
