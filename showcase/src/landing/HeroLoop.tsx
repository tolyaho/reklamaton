import { motion, useReducedMotion } from "framer-motion"
import { ArrowDown, Check, Cpu, Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { Avatar } from "@/components/ui"
import type { ScriptTurn } from "@/demo/types"

/** The hero illustration: one real turn of the demo chat, the profile patch it produced, and the draft line it shaped. */
export function HeroLoop({ turn }: { turn: ScriptTurn }) {
  const reduced = useReducedMotion()
  const appear = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16, scale: 0.985 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="relative" aria-label="Example from the demo: a chat message, the profile update it caused, and a draft line it shaped" role="img">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[28px] border border-line/70 bg-[linear-gradient(180deg,rgb(255_253_249/0.85),rgb(239_233_222/0.6))] sm:-inset-6"
        style={{
          backgroundImage:
            "linear-gradient(rgb(31 28 23 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(31 28 23 / 0.035) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative flex flex-col gap-2.5" aria-hidden>
        <motion.div {...appear(0.2)} className="surface p-4 sm:mr-14">
          <Step n="01" label="Conversation" />
          <div className="mt-3 flex items-start gap-2.5">
            <Avatar id={1} name="Ines Calder" size={30} />
            <div className="rounded-[16px] rounded-tl-md border border-line bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed text-ink">
              {turn.customer}
            </div>
          </div>
        </motion.div>

        <Connector delay={0.55} reduced={Boolean(reduced)} />

        <motion.div {...appear(0.75)} className="surface p-4 sm:mx-7">
          <div className="flex items-center justify-between">
            <Step n="02" label="Profile" />
            <span className="inline-flex items-center gap-1 text-[11.5px] text-indigo">
              <Cpu className="size-3.5" /> extracted
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
            <Row label="Budget" delay={1.15} reduced={Boolean(reduced)}>
              <span className="text-ink-3 line-through decoration-ink-3/50">unknown</span>
              <span className="font-semibold text-ink">up to €4,000</span>
            </Row>
            <Row label="Interests" delay={1.3} reduced={Boolean(reduced)}>
              <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-[12px] text-indigo">packaging</span>
              <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-[12px] text-indigo">pastry boxes</span>
              <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[12px] font-medium text-coral-ink">+ labels</span>
            </Row>
            <Row label="Score" delay={1.45} reduced={Boolean(reduced)}>
              <span className="num text-ink-3">13</span>
              <span className="text-ink-3">→</span>
              <span className="num font-semibold text-ink">23</span>
            </Row>
          </dl>
        </motion.div>

        <Connector delay={1.6} reduced={Boolean(reduced)} />

        <motion.div {...appear(1.8)} className="surface p-4 sm:ml-14">
          <div className="flex items-center justify-between">
            <Step n="03" label="Draft" />
            <motion.span
              initial={reduced ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0 : 2.5, type: "spring", stiffness: 420, damping: 22 }}
              className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2 py-0.5 text-[12px] font-medium text-sage ring-1 ring-sage/20"
            >
              <Check className="size-3.5" /> Approved
            </motion.span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
            Hi Ines, following up on your new pastry boxes… <mark className="rounded bg-coral-soft px-0.5 text-ink">At €3,900, it fits the budget you mentioned.</mark> Review dates and the print date are fixed at kick-off…
          </p>
          <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <Sparkles className="size-3.5 text-coral" /> Personalized from: budget · interest · objection · stage
          </p>
        </motion.div>
      </div>
      <p className="relative mt-5 text-center text-[12px] text-ink-3 sm:mt-7">Taken from the demo's synthetic data. Chat and patch are scripted.</p>
    </div>
  )
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
      <span className="num rounded bg-ink px-1.5 py-0.5 text-[10px] tracking-normal text-paper">{n}</span>
      {label}
    </span>
  )
}

function Connector({ delay, reduced }: { delay: number; reduced: boolean }) {
  return (
    <motion.div
      className="flex justify-center"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reduced ? 0 : delay, duration: 0.4 }}
    >
      <span className="grid size-6 place-items-center rounded-full border border-line bg-surface text-coral shadow-card">
        <ArrowDown className="size-3.5" />
      </span>
    </motion.div>
  )
}

function Row({ label, children, delay, reduced }: { label: string; children: ReactNode; delay: number; reduced: boolean }) {
  return (
    <>
      <dt className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{label}</dt>
      <motion.dd
        className="-mx-1.5 flex flex-wrap items-center gap-1.5 rounded-md px-1.5 py-0.5"
        initial={reduced ? false : { backgroundColor: "rgba(248,227,216,0)" }}
        animate={reduced ? undefined : { backgroundColor: ["rgba(248,227,216,0)", "rgba(248,227,216,1)", "rgba(248,227,216,0.35)"] }}
        transition={{ delay, duration: 1.2, times: [0, 0.3, 1] }}
      >
        {children}
      </motion.dd>
    </>
  )
}
