import { cx } from "@/lib/styles"

/** The Reklamaton mark: three lines of a message, the last one turned into a coral data field. */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="#1f1c17" />
      <rect x="8" y="9" width="16" height="2.6" rx="1.3" fill="#f6f2ea" />
      <rect x="8" y="14.7" width="11" height="2.6" rx="1.3" fill="#f6f2ea" opacity="0.72" />
      <rect x="8" y="20.4" width="7" height="2.6" rx="1.3" fill="#e0734f" />
      <circle cx="20.6" cy="21.7" r="1.9" fill="#e0734f" />
    </svg>
  )
}

export function Wordmark({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Mark size={size} />
      <span className="font-display text-[21px] leading-none font-semibold tracking-[-0.02em] text-ink">
        reklamaton
      </span>
    </span>
  )
}
