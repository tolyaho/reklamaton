import clsx from "clsx"

export const cx = clsx

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "success"
export type ButtonSize = "sm" | "md" | "lg"

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-[#35302a] shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_6px_16px_-8px_rgb(31_28_23/0.6)]",
  accent: "bg-coral text-white hover:bg-coral-ink shadow-[0_6px_16px_-8px_rgb(196_80_46/0.7)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-ink-3/40",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
  success: "bg-sage text-white hover:bg-[#2c5940]",
}
const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-label gap-1.5",
  md: "h-11 px-4.5 text-ui gap-2",
  lg: "h-12 px-5.5 text-body gap-2",
}

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-ctl font-medium whitespace-nowrap select-none",
    "transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-soft",
    "active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    extra,
  )
}

