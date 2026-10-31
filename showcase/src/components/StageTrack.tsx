import type { LeadStage } from "@/demo/types"
import { STAGE_META } from "@/lib/format"
import { cx } from "@/lib/styles"

const TRACK: LeadStage[] = ["new", "qualified", "proposal", "won"]

/** Where a lead is on the way to a yes. Segments fill as the stage advances. */
export function StageTrack({ stage, compact = false, className }: { stage: LeadStage; compact?: boolean; className?: string }) {
  const lost = stage === "lost"
  const at = lost ? -1 : TRACK.indexOf(stage)
  return (
    <div className={cx("flex flex-col gap-1.5", className)} role="img" aria-label={`Lead stage: ${STAGE_META[stage].label}`}>
      <div className="flex gap-1">
        {TRACK.map((s, i) => (
          <span
            key={s}
            aria-hidden
            style={{ transitionDelay: `${i * 90}ms` }}
            className={cx(
              "rounded-full transition-colors duration-500",
              compact ? "h-1 flex-1" : "h-1.5 flex-1",
              lost ? "bg-rose/25" : i <= at ? (s === "won" ? "bg-sage" : "bg-ink") : "bg-line",
            )}
          />
        ))}
      </div>
      {!compact && (
        <div className="flex text-[11px] font-medium" aria-hidden>
          {lost ? (
            <span className="text-rose">Lost</span>
          ) : (
            TRACK.map((s, i) => (
              <span key={s} className={cx("flex-1 transition-colors duration-500", i === at ? "font-semibold text-ink" : "text-ink-3")}>
                {STAGE_META[s].label}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}
