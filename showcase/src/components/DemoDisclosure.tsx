import { useState } from "react"
import { cx } from "@/lib/styles"
import { AboutDemo } from "./AboutDemo"
import { Modal } from "./Sheet"

/** The compact, always-visible statement of what this demo is, with the full explanation one click away. */
export function DemoDisclosure({ className, testId = "demo-disclosure", tone = "light" }: { className?: string; testId?: string; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cx(
          "group inline-flex max-w-full items-center gap-2 rounded-full border py-1 pr-3 pl-2.5 text-left text-[12px] transition-colors",
          tone === "light"
            ? "border-line bg-surface/80 text-ink-2 hover:border-line-strong hover:text-ink"
            : "border-paper/20 bg-paper/5 text-paper/80 hover:text-paper",
          className,
        )}
        data-testid={testId}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-coral" aria-hidden />
        <span className="flex flex-wrap gap-x-1.5">
          <span className="whitespace-nowrap">Interactive demo</span>
          <span className="opacity-40" aria-hidden>
            ·
          </span>
          <span className="whitespace-nowrap">Synthetic data</span>
          <span className="opacity-40" aria-hidden>
            ·
          </span>
          <span className="whitespace-nowrap">No live AI calls</span>
        </span>
        <span
          className={cx(
            "shrink-0 font-medium whitespace-nowrap underline underline-offset-2",
            tone === "light" ? "text-coral-ink decoration-coral/30 group-hover:decoration-coral" : "text-paper decoration-paper/40",
          )}
        >
          About this demo
        </span>
      </button>
      <Modal open={open} onOpenChange={setOpen} title="About this demo" testId="about-demo" width="max-w-xl">
        <AboutDemo />
      </Modal>
    </>
  )
}
