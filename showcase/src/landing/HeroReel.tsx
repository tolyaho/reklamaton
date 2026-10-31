import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Check, Pause, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { FactChip, FactText } from "@/components/facts"
import { Memory } from "@/components/Memory"
import { ProductFrame } from "@/components/ProductFrame"
import { Thread } from "@/components/Thread"
import { Avatar, StageBadge } from "@/components/ui"
import { DemoContext, type DemoContextValue } from "@/demo/context"
import { checkSegment, formatBudget } from "@/demo/engine"
import { draftFacts } from "@/demo/facts"
import { PlayerContext, type PlayerContextValue } from "@/demo/playerContext"
import type { DemoState } from "@/demo/types"
import { cx } from "@/lib/styles"
import { buildReel, type Beat } from "./reel"

const SEGMENTS = ["1", "2", "3", "4", "Draft"] as const

/**
 * The hero: a window onto the workspace replaying Ines's scripted conversation. It renders the
 * app's own Thread and Memory components from frames the reducer produced, inside their own
 * context, so it never touches the visitor's workspace.
 */
export function HeroReel() {
  const reel = useMemo(() => buildReel(), [])
  const last = reel.beats.length - 1
  const reduced = useReducedMotion()
  const [beat, setBeat] = useState(0)
  const [paused, setPaused] = useState(false)
  const [touched, setTouched] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // With reduced motion nothing plays by itself: the replay opens on its last frame and the steps below move through it.
  const still = Boolean(reduced)
  const shown = still && !touched ? last : beat
  const atEnd = shown === last
  const b = reel.beats[shown]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (still || paused || !inView || beat >= last) return
    const id = setTimeout(() => setBeat((n) => Math.min(n + 1, last)), reel.beats[beat].ms)
    return () => clearTimeout(id)
  }, [beat, inView, last, paused, reel.beats, still])

  const demo = useMemo<DemoContextValue>(() => ({ state: b.state, dispatch: () => ({ ok: false, error: "This is a replay" }) }), [b.state])
  const player = useMemo<PlayerContextValue>(() => ({ playback: b.playback, play: async () => {} }), [b.playback])

  const jump = (segment: number) => {
    setPaused(true)
    setTouched(true)
    const target = segment < 4 ? reel.beats.findIndex((x) => x.kind === "learn" && x.turn === segment) : last
    setBeat(target)
  }
  const segmentOf = (x: Beat) => (x.kind === "campaign" || x.kind === "draft" ? 4 : x.turn)
  const current = segmentOf(b)

  return (
    <div ref={ref} className="relative">
      <DemoContext.Provider value={demo}>
        <PlayerContext.Provider value={player}>
          <ProductFrame
            section="conversations"
            label="Product preview: a replay of the demo's scripted conversation"
            crumb={
              <>
                Conversations <span className="text-line-strong">/</span> Ines Calder
              </>
            }
            right={
              <>
                <span className="hidden rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber @lg:inline">Scripted demo replay</span>
                {!still && (
                  <button
                    type="button"
                    onClick={() => {
                      if (atEnd) {
                        setBeat(0)
                        setPaused(false)
                      } else setPaused((p) => !p)
                    }}
                    className="grid size-7 place-items-center rounded-full text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2 hover:text-ink"
                    aria-label={atEnd ? "Replay" : paused ? "Play the replay" : "Pause the replay"}
                    data-testid="reel-toggle"
                  >
                    {atEnd ? <RotateCcw className="size-3.5" /> : paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  </button>
                )}
              </>
            }
            className="h-[540px] sm:h-[580px] lg:h-[clamp(470px,calc(100dvh-150px),600px)]"
            bodyClassName="flex flex-col"
          >
            <div className="grid min-h-0 flex-1 @xl:grid-cols-[minmax(0,1fr)_minmax(236px,288px)]">
              <div className="relative flex min-h-0 flex-col">
                <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
                  <Avatar id={1} name="Ines Calder" size={32} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">Ines Calder</p>
                    <p className="truncate text-[11.5px] text-ink-3">Calder Bakehouse · WhatsApp · Mira replies</p>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <div className="absolute inset-x-0 bottom-0 px-4 pt-4 pb-4 @lg:px-5">
                    <Thread chat={b.state.chats[0]} days={false} compactReplies />
                  </div>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface to-transparent" />
                </div>
                <MemoryStrip state={b.state} beat={b} />
                <AnimatePresence>
                  {b.kind === "draft" && (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-x-3 bottom-3 rounded-[16px] border border-line bg-surface p-4 shadow-pop @lg:inset-x-5 @lg:bottom-5"
                      data-testid="reel-draft"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Draft · January packaging slots</p>
                        <span className="ml-auto rounded-full bg-indigo-soft px-2 py-0.5 text-[11px] font-medium text-indigo">template composer</span>
                      </div>
                      <p className="mt-2 line-clamp-6 text-[13.5px] leading-relaxed whitespace-pre-line text-ink">
                        <FactText text={reel.draft.content.split("\n\nBest,")[0]} facts={draftFacts(reel.draft)} />
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                          <Check className="size-3.5 text-sage" aria-hidden /> Waits for a person to approve
                        </span>
                        <Link
                          to="/app/conversations/1"
                          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-coral-ink hover:underline"
                        >
                          Try it yourself <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="hidden min-h-0 flex-col overflow-hidden border-l border-line bg-surface-2/50 @xl:flex">
                <p className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-ink">Customer memory</p>
                <div className="scroll-thin min-h-0 flex-1 overflow-hidden">
                  <Memory customerId={1} variant="compact" announce={false} />
                </div>
                <CampaignRow state={b.state} />
              </div>
            </div>

            <nav aria-label="Replay steps" className="flex shrink-0 items-center gap-1.5 border-t border-line bg-surface-2 px-3 py-2">
              {SEGMENTS.map((label, i) => {
                const beatsIn = reel.beats.filter((x) => segmentOf(x) === i)
                const done = i < current ? 1 : i > current ? 0 : (beatsIn.indexOf(b) + 1) / beatsIn.length
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => jump(i)}
                    className="group flex flex-1 flex-col gap-1 rounded-md px-1 py-0.5 text-left"
                    aria-label={i < 4 ? `Show message ${i + 1}` : "Show the draft"}
                    aria-current={i === current ? "step" : undefined}
                  >
                    <span className="relative h-1 overflow-hidden rounded-full bg-line">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-500" style={{ width: `${done * 100}%` }} />
                    </span>
                    <span className={cx("text-[10.5px] font-medium whitespace-nowrap", i === current ? "text-ink" : "text-ink-3 group-hover:text-ink-2")}>
                      {i < 4 ? (
                        <>
                          <span className="hidden @md:inline">Message </span>
                          {label}
                        </>
                      ) : (
                        "Draft"
                      )}
                    </span>
                  </button>
                )
              })}
            </nav>
          </ProductFrame>
        </PlayerContext.Provider>
      </DemoContext.Provider>
    </div>
  )
}

/** Whether the profile now puts Ines in the January campaign's audience. */
function CampaignRow({ state }: { state: DemoState }) {
  const campaign = state.campaigns[0]
  const check = checkSegment(state.customers[0], state.profiles[1], campaign.segment, state.now)
  return (
    <div className="border-t border-line px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Campaign</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-ink">{campaign.name}</p>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={String(check.matches)}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
            className={cx(
              "shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
              check.matches ? "bg-sage text-white" : "bg-paper-2 text-ink-3 ring-1 ring-line",
            )}
          >
            {check.matches ? "In audience" : "Not yet"}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** On narrow screens the profile becomes a strip of the facts collected so far. */
function MemoryStrip({ state, beat }: { state: DemoState; beat: Beat }) {
  const p = state.profiles[1]
  const fresh = beat.kind === "learn" ? new Set(state.lastProfileChange?.changes.map((c) => c.field)) : new Set<string>()
  const glow = (f: string) => (fresh.has(f) ? "ring-2 ring-offset-1 ring-offset-surface-2 ring-ink/20" : "")
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-surface-2/70 px-3 py-2.5 @xl:hidden" aria-label="Customer memory">
      <span className={cx("rounded-full", glow("lead_stage"))}>
        <StageBadge stage={p.lead_stage} />
      </span>
      {p.interests.map((i) => (
        <FactChip key={i} kind="interest" className={glow("interests")}>
          {i}
        </FactChip>
      ))}
      {p.budget_max != null && (
        <FactChip kind="budget" className={glow("budget")}>
          {formatBudget(p.budget_min, p.budget_max)}
        </FactChip>
      )}
      {p.objections.map((o) => (
        <FactChip key={o} kind="concern" className={glow("objections")}>
          {o.split(":")[0]}
        </FactChip>
      ))}
      {!p.interests.length && <span className="text-[12px] text-ink-3">Profile fills in as she writes</span>}
    </div>
  )
}
