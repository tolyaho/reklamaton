import * as Dialog from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { cx } from "@/lib/styles"

/** Side sheet (desktop) / bottom sheet (mobile) on Radix Dialog: focus trap, Escape, scroll lock. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  width = "max-w-[460px]",
  testId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  side?: "right" | "left"
  width?: string
  testId?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                data-testid={testId}
                className={cx(
                  "fixed z-50 flex flex-col bg-surface shadow-pop outline-none",
                  "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-panel border-t border-line",
                  "sm:inset-y-0 sm:bottom-auto sm:max-h-none sm:w-full sm:rounded-none sm:border-t-0",
                  side === "right" ? "sm:right-0 sm:left-auto sm:border-l" : "sm:left-0 sm:right-auto sm:border-r",
                  width,
                )}
                initial={{ opacity: 0, x: side === "right" ? 32 : -32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: side === "right" ? 24 : -24 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                  <div className="min-w-0">
                    <Dialog.Title className="text-[20px] leading-tight font-semibold tracking-[-0.015em] text-ink">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1.5 max-w-prose text-label text-ink-3">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">Details</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close
                    className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Centered modal dialog. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  testId,
  width = "max-w-lg",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  testId?: string
  width?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <Dialog.Content asChild forceMount>
                <motion.div
                  data-testid={testId}
                  className={cx("scroll-thin pointer-events-auto max-h-[88dvh] w-full overflow-y-auto rounded-panel border border-line bg-surface shadow-pop outline-none", width)}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-7">
                    <div className="min-w-0">
                      <Dialog.Title className="text-[21px] leading-tight font-semibold tracking-[-0.015em] text-ink">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-1.5 max-w-prose text-ui text-ink-3">{description}</Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">Dialog</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close
                      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </Dialog.Close>
                  </div>
                  <div className="px-6 pt-5 pb-7 sm:px-7">{children}</div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
