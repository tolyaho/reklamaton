import { motion } from "framer-motion"
import { Bot, FileCode2, FlaskConical, Sparkles, type LucideIcon } from "lucide-react"
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { STAGE_META, initials, type BadgeTone } from "@/lib/format"
import { buttonClass, cx, type ButtonSize, type ButtonVariant } from "@/lib/styles"
import type { LeadStage } from "@/demo/types"

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />
}

// ---------- Badges ----------

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-paper-2 text-ink-2 border-line",
  coral: "bg-coral-soft text-coral-ink border-coral/20",
  indigo: "bg-indigo-soft text-indigo border-indigo/15",
  sage: "bg-sage-soft text-sage border-sage/20",
  amber: "bg-amber-soft text-amber border-amber/20",
  rose: "bg-rose-soft text-rose border-rose/20",
}

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-meta font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const meta = STAGE_META[stage]
  return (
    <motion.span key={stage} initial={{ scale: 0.9, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }} className="inline-flex">
      <Badge tone={meta.tone} className={className}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {meta.label}
      </Badge>
    </motion.span>
  )
}

// ---------- Avatar ----------

const AVATAR_TINTS = [
  "bg-[#efd9cc] text-[#7a3a22]",
  "bg-[#dfe2f1] text-[#353f80]",
  "bg-[#dcebe1] text-[#2f5b43]",
  "bg-[#f1e4c9] text-[#71490a]",
  "bg-[#ecdbe0] text-[#7b3040]",
  "bg-[#e3e0d8] text-[#48433b]",
]

export function Avatar({ id, name, size = 36, className }: { id: number; name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ring-1 ring-black/5",
        AVATAR_TINTS[id % AVATAR_TINTS.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function PersonaMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-grid shrink-0 place-items-center rounded-full bg-ink text-paper ring-1 ring-black/10"
    >
      <Sparkles style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}

// ---------- Score meter ----------

export function ScoreMeter({ value, label = "Lead score" }: { value: number; label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-line"
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo/70 to-indigo"
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="num w-8 text-right text-label font-semibold text-ink">{value}</span>
    </div>
  )
}

// ---------- Provenance labels ----------

export type ProvenanceKind = "scripted" | "composer" | "backend" | "synthetic"

const PROVENANCE: Record<ProvenanceKind, { icon: LucideIcon; text: string; className: string }> = {
  scripted: { icon: FlaskConical, text: "Scripted demo text", className: "text-amber bg-amber-soft/70 border-amber/20" },
  composer: { icon: Bot, text: "Demo composer, no model call", className: "text-indigo bg-indigo-soft/70 border-indigo/15" },
  backend: { icon: FileCode2, text: "Backend code", className: "text-ink-2 bg-paper-2 border-line" },
  synthetic: { icon: FlaskConical, text: "Synthetic data", className: "text-ink-2 bg-paper-2 border-line" },
}

export function Provenance({ kind, children, className }: { kind: ProvenanceKind; children?: ReactNode; className?: string }) {
  const p = PROVENANCE[kind]
  const Icon = p.icon
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-micro font-medium",
        p.className,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children ?? p.text}
    </span>
  )
}

// ---------- Layout bits ----------

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cx("surface flex min-w-0 flex-col", className)} {...rest}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-1 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            {title && <h2 className="type-card">{title}</h2>}
            {description && <p className="mt-1 max-w-prose text-label text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("min-w-0 flex-1", bodyClassName ?? "p-5 sm:p-6")}>{children}</div>
    </section>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-surface px-1.5 py-px font-mono text-micro text-ink-2 shadow-[0_1px_0_var(--color-line-strong)]">
      {children}
    </kbd>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-paper-2 text-ink-3 ring-1 ring-line">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-ui font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-label text-ink-3">{children}</div>}
    </div>
  )
}
