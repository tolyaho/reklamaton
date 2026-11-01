import type { ReactNode } from "react"
import { DemoDisclosure } from "@/components/DemoDisclosure"

/** Page title, a short line of context, page actions, and the demo disclosure every screen carries. */
export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-10">
      <div className="min-w-0">
        <h1 className="type-page">{title}</h1>
        {meta && <p className="mt-1.5 text-ui text-ink-3">{meta}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3 xl:shrink-0 xl:justify-end">
        <DemoDisclosure />
        {actions}
      </div>
    </div>
  )
}
