import type { ReactNode } from "react"
import { DemoDisclosure } from "@/components/DemoDisclosure"

/** Page title, a short line of context, page actions, and the demo disclosure every screen carries. */
export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="display text-[30px] leading-[1.05] font-semibold text-ink sm:text-[34px]">{title}</h1>
        {meta && <p className="mt-1.5 text-[13.5px] text-ink-3">{meta}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <DemoDisclosure />
        {actions}
      </div>
    </div>
  )
}
