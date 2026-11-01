import type { ReactNode } from "react"
import { FACT_KINDS, FACT_LABEL, type Fact, type FactKind } from "@/demo/facts"
import { FACT_TONE } from "@/lib/factTone"
import { cx } from "@/lib/styles"

/** Running text with its facts marked. Facts must not overlap; `reveal` sweeps the marks in. */
export function FactText({
  text,
  facts,
  reveal = true,
  active,
  className,
}: {
  text: string
  facts: Fact[]
  reveal?: boolean
  /** A field or kind to emphasise. */
  active?: string | null
  className?: string
}) {
  if (!facts.length) return <span className={className}>{text}</span>
  const spans = facts
    .map((f) => ({ ...f, start: text.indexOf(f.text) }))
    .filter((f) => f.start >= 0)
    .sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let at = 0
  for (const f of spans) {
    if (f.start < at) continue
    if (f.start > at) parts.push(text.slice(at, f.start))
    parts.push(
      <mark
        key={`${f.field}-${f.start}`}
        className={cx("fact", `fact-${f.kind}`)}
        data-on={reveal}
        data-active={active != null && (active === f.field || active === f.kind)}
        data-field={f.field}
      >
        {f.text}
      </mark>,
    )
    at = f.start + f.text.length
  }
  if (at < text.length) parts.push(text.slice(at))
  return <span className={className}>{parts}</span>
}

export function FactDot({ kind, className }: { kind: FactKind; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2 shrink-0 rounded-full", FACT_TONE[kind].dot, className)} />
}

/** The four kinds of fact, as a compact key. */
export function FactLegend({ className, kinds = FACT_KINDS }: { className?: string; kinds?: FactKind[] }) {
  return (
    <ul className={cx("flex flex-wrap items-center gap-x-5 gap-y-2 text-label text-ink-2", className)} aria-label="Colour key">
      {kinds.map((k) => (
        <li key={k} className="inline-flex items-center gap-2">
          <span aria-hidden className={cx("h-2.5 w-5 rounded-sm", FACT_TONE[k].swatch)} />
          {FACT_LABEL[k]}
        </li>
      ))}
    </ul>
  )
}

export function FactChip({ kind, children, className }: { kind: FactKind; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-medium leading-5", FACT_TONE[kind].chip, className)}>
      {children}
    </span>
  )
}
