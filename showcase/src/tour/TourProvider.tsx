import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Wand2, X } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router"
import { Button } from "@/components/ui"
import { cx } from "@/lib/styles"
import { useDemo } from "@/demo/context"
import { usePlayer } from "@/demo/playerContext"
import { TourContext } from "./context"
import { TOUR_STEPS } from "./steps"

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const start = useCallback(() => {
    setStep(0)
    setActive(true)
  }, [])
  const stop = useCallback(() => setActive(false), [])
  const goTo = useCallback((n: number) => setStep(Math.max(0, Math.min(TOUR_STEPS.length - 1, n))), [])
  const value = useMemo(() => ({ active, step, start, stop, goTo }), [active, step, start, stop, goTo])
  return (
    <TourContext.Provider value={value}>
      {children}
      {active && <TourOverlay step={step} goTo={goTo} stop={stop} />}
    </TourContext.Provider>
  )
}

function TourOverlay({ step, goTo, stop }: { step: number; goTo: (n: number) => void; stop: () => void }) {
  const current = TOUR_STEPS[step]
  const { state, dispatch } = useDemo()
  const { play, playback } = usePlayer()
  const navigate = useNavigate()
  const location = useLocation()
  const reduced = useReducedMotion()
  const [rect, setRect] = useState<Rect | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const last = step === TOUR_STEPS.length - 1
  const complete = current.complete?.(state) ?? false
  const [working, setWorking] = useState(false)

  // Go to the step's page.
  useEffect(() => {
    if (location.pathname !== current.route) navigate(current.route)
  }, [current.route, location.pathname, navigate])

  // Announce the step and move focus to it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  // Keep the highlight ring on the target, scrolling it into view once per step.
  useLayoutEffect(() => {
    let frame = 0
    let scrolled = false
    let prev = ""
    const tick = () => {
      const el = current.target ? document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`) : null
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" })
          scrolled = true
        }
        const r = el.getBoundingClientRect()
        const key = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.width)}:${Math.round(r.height)}`
        if (key !== prev) {
          prev = key
          setRect(r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
        }
      } else if (prev !== "none") {
        prev = "none"
        setRect(null)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [current.target, reduced, step])

  // Escape ends the tour, unless a dialog is open (that Escape belongs to the dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (document.querySelector('[role="dialog"][data-state="open"]')) return
      stop()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [stop])

  // Steps whose action the visitor performed themselves move on by themselves.
  const wasComplete = useRef(complete)
  useEffect(() => {
    if (current.autoAdvance && complete && !wasComplete.current && !last) {
      const t = setTimeout(() => goTo(step + 1), reduced ? 300 : 1100)
      wasComplete.current = complete
      return () => clearTimeout(t)
    }
    wasComplete.current = complete
  }, [complete, current.autoAdvance, goTo, last, reduced, step])
  useEffect(() => {
    wasComplete.current = current.complete?.(state) ?? false
    // only when the step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const runAction = async () => {
    if (!current.action) return
    setWorking(true)
    try {
      if (current.action.clickTarget && current.target) {
        document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`)?.click()
      }
      const actions = current.action.run?.(state) ?? []
      const turns = actions.filter((a) => a.type === "playTurn")
      if (turns.length && turns[0].type === "playTurn") await play(turns[0].chatId, turns.length)
      for (const a of actions) if (a.type !== "playTurn") dispatch(a)
    } finally {
      setWorking(false)
    }
  }

  const ringPad = 6
  const placeLeft = rect ? rect.left + rect.width / 2 > window.innerWidth * 0.55 : false

  return (
    <>
      <AnimatePresence>
        {rect && (
          <motion.div
            key={current.id}
            aria-hidden
            data-testid="tour-ring"
            className="pointer-events-none fixed z-40 rounded-[14px] ring-2 ring-coral"
            style={{ boxShadow: "0 0 0 6px rgb(196 80 46 / 0.16), 0 0 0 9999px rgb(31 28 23 / 0.06)" }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              top: rect.top - ringPad,
              left: rect.left - ringPad,
              width: rect.width + ringPad * 2,
              height: rect.height + ringPad * 2,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      <motion.div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-testid="tour-panel"
        className={cx(
          "fixed z-[45] w-auto rounded-panel border border-line bg-surface/95 p-5 shadow-pop backdrop-blur-md sm:w-[400px] sm:p-6",
          "inset-x-2 bottom-2 sm:inset-x-auto sm:bottom-5",
          placeLeft ? "sm:left-5 lg:left-[276px]" : "sm:right-5",
        )}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow num">
            Guided tour · {step + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={stop}
            className="grid size-8 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Close the tour"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={cx("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-coral" : "bg-line")} />
          ))}
        </div>
        <h2 id="tour-title" ref={headingRef} tabIndex={-1} className="mt-4 text-[19px] leading-snug font-semibold tracking-[-0.012em] text-ink outline-none">
          {current.title}
        </h2>
        <p id="tour-body" aria-live="polite" className="mt-2 text-ui text-ink-2">
          {current.body}
        </p>

        {current.action && (
          <div className="mt-4">
            {complete ? (
              <span className="inline-flex items-center gap-1.5 text-label font-medium text-sage">
                <Check className="size-4" aria-hidden /> Done
              </span>
            ) : (
              <Button variant="accent" size="sm" onClick={runAction} disabled={working || Boolean(playback)} data-testid="tour-action">
                <Wand2 aria-hidden />
                {working || playback ? "Working…" : current.action.label}
              </Button>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => goTo(step - 1)} disabled={step === 0}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          <div className="flex items-center gap-2">
            {last ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => goTo(0)}>
                  Restart
                </Button>
                <Button variant="primary" size="sm" onClick={stop} data-testid="tour-finish">
                  Explore freely
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => goTo(step + 1)} data-testid="tour-next">
                Next <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
