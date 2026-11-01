import { LayoutDashboard, Megaphone, MessagesSquare, Store, Users } from "lucide-react"
import type { ReactNode } from "react"
import { cx } from "@/lib/styles"
import { Mark } from "./Wordmark"

const RAIL = [
  { id: "overview", icon: LayoutDashboard },
  { id: "conversations", icon: MessagesSquare },
  { id: "customers", icon: Users },
  { id: "campaigns", icon: Megaphone },
  { id: "business", icon: Store },
] as const

export type FrameSection = (typeof RAIL)[number]["id"]

/**
 * A window onto the Reklamaton workspace, used on the landing page. Everything inside is the real
 * app UI rendered from demo state; the frame only adds the title bar and the navigation rail.
 */
export function ProductFrame({
  section,
  crumb,
  right,
  children,
  className,
  bodyClassName,
  label,
}: {
  section: FrameSection
  crumb: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  label: string
}) {
  return (
    <div role="region" aria-label={label} data-product-ui className={cx("window @container flex flex-col", className)}>
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-4">
        <Mark size={20} />
        <p className="flex min-w-0 items-center gap-1.5 text-label whitespace-nowrap">
          <span className="hidden text-ink-3 @2xl:inline">Studio Halden</span>
          <span className="hidden text-line-strong @2xl:inline" aria-hidden>
            /
          </span>
          <span className="truncate font-medium text-ink">{crumb}</span>
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div aria-hidden className="hidden w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-surface-2/60 py-3 @3xl:flex">
          {RAIL.map(({ id, icon: Icon }) => (
            <span
              key={id}
              className={cx(
                "grid size-9 place-items-center rounded-[10px]",
                id === section
                  ? "bg-surface text-coral shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_4px_10px_-6px_rgb(31_28_23/0.4)] ring-1 ring-line"
                  : "text-ink-3/70",
              )}
            >
              <Icon className="size-[17px]" />
            </span>
          ))}
        </div>
        <div className={cx("min-w-0 flex-1", bodyClassName)}>{children}</div>
      </div>
    </div>
  )
}
