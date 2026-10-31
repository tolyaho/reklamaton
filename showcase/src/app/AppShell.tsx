import { motion } from "framer-motion"
import {
  BookOpenText,
  Compass,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessagesSquare,
  RotateCcw,
  Store,
  Users,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { toast } from "sonner"
import { AboutDemo } from "@/components/AboutDemo"
import { Modal, Sheet } from "@/components/Sheet"
import { Button } from "@/components/ui"
import { cx } from "@/lib/styles"
import { Wordmark } from "@/components/Wordmark"
import { useDemo } from "@/demo/context"
import { REPO_URL } from "@/lib/links"
import { useTour } from "@/tour/context"
import { GithubIcon } from "@/components/GithubIcon"

const NAV = [
  { to: "/app/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/app/conversations", label: "Conversations", icon: MessagesSquare },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/app/business", label: "Business", icon: Store },
] as const

function useNavCounts() {
  const { state } = useDemo()
  const unplayed = state.chats.filter((c) => c.played < c.script.length).length
  const drafts = state.outbox.filter((m) => m.status === "draft").length
  return {
    "/app/conversations": unplayed ? { value: unplayed, label: `${unplayed} new` } : null,
    "/app/customers": { value: state.customers.length, label: `${state.customers.length} customers` },
    "/app/campaigns": drafts ? { value: drafts, label: `${drafts} drafts awaiting approval` } : null,
  } as Record<string, { value: number; label: string } | null | undefined>
}

function NavItems({ onNavigate, layoutKey }: { onNavigate?: () => void; layoutKey: string }) {
  const counts = useNavCounts()
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => {
        const count = counts[to]
        return (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  "group relative flex h-10 items-center gap-3 rounded-ctl px-3 text-[14px] font-medium transition-colors duration-150",
                  isActive ? "text-ink" : "text-ink-2 hover:bg-paper-2/70 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={`nav-active-${layoutKey}`}
                      className="absolute inset-0 rounded-ctl border border-line bg-surface shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_6px_16px_-12px_rgb(31_28_23/0.45)]"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  )}
                  <Icon className={cx("relative size-[18px]", isActive ? "text-coral" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
                  <span className="relative flex-1">{label}</span>
                  {count && (
                    <span
                      className={cx(
                        "num relative min-w-6 rounded-full px-1.5 text-center text-[11.5px] leading-5 font-semibold",
                        to === "/app/customers" ? "text-ink-3" : "bg-coral text-white",
                      )}
                      aria-label={count.label}
                    >
                      {count.value}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

function SideFooter({ onAction }: { onAction?: () => void }) {
  const tour = useTour()
  const [resetOpen, setResetOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const { dispatch } = useDemo()
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        className="w-full justify-start"
        onClick={() => {
          onAction?.()
          tour.start()
        }}
        data-testid="start-tour"
      >
        <Compass aria-hidden /> Guided tour
      </Button>
      <button type="button" onClick={() => setAboutOpen(true)} className="flex h-9 items-center gap-3 rounded-ctl px-3 text-[13.5px] text-ink-2 transition-colors hover:bg-paper-2/70 hover:text-ink">
        <BookOpenText className="size-4 text-ink-3" aria-hidden /> What's real in this demo
      </button>
      <button type="button" onClick={() => setResetOpen(true)} className="flex h-9 items-center gap-3 rounded-ctl px-3 text-[13.5px] text-ink-2 transition-colors hover:bg-paper-2/70 hover:text-ink" data-testid="reset-demo">
        <RotateCcw className="size-4 text-ink-3" aria-hidden /> Reset demo
      </button>
      <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-3 rounded-ctl px-3 text-[13.5px] text-ink-2 transition-colors hover:bg-paper-2/70 hover:text-ink">
        <GithubIcon className="size-4 text-ink-3" /> Source on GitHub
      </a>

      <Modal open={aboutOpen} onOpenChange={setAboutOpen} title="What's real in this demo" testId="about-demo">
        <AboutDemo />
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo?"
        description="This restores the starting workspace: Ines's conversation unplayed, campaign 1 without drafts, every consent as it was."
        testId="reset-dialog"
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            data-testid="confirm-reset"
            onClick={() => {
              dispatch({ type: "reset" })
              setResetOpen(false)
              onAction?.()
              toast.success("Demo reset to its starting state")
            }}
          >
            <RotateCcw aria-hidden /> Reset
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function WorkspaceBadge() {
  const { state } = useDemo()
  return (
    <div className="satin rounded-ctl border border-line px-3 py-2.5">
      <p className="truncate text-[13.5px] font-semibold text-ink">{state.business.name}</p>
      <p className="mt-0.5 text-[11.5px] text-ink-3">Demo workspace · synthetic data</p>
    </div>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const tour = useTour()
  const location = useLocation()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-paper/70 px-3 py-5 backdrop-blur-sm lg:flex" aria-label="Main navigation">
        <Link to="/" className="rounded-md px-2" aria-label="Reklamaton home">
          <Wordmark />
        </Link>
        <WorkspaceBadge />
        <nav aria-label="Workspace" className="flex-1">
          <NavItems layoutKey="side" />
        </nav>
        <SideFooter />
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="grid size-10 place-items-center rounded-ctl text-ink-2 hover:bg-paper-2"
          aria-label="Open navigation"
          data-testid="open-nav"
        >
          <Menu className="size-5" />
        </button>
        <Link to="/" aria-label="Reklamaton home">
          <Wordmark size={24} />
        </Link>
        <Button variant="secondary" size="sm" onClick={() => tour.start()} aria-label="Start guided tour">
          <Compass aria-hidden /> <span className="hidden sm:inline">Tour</span>
        </Button>
      </header>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Reklamaton" side="left" width="sm:max-w-[300px]">
        <div className="flex flex-col gap-5 p-4">
          <WorkspaceBadge />
          <nav aria-label="Workspace">
            <NavItems layoutKey="sheet" onNavigate={() => setMenuOpen(false)} />
          </nav>
          <SideFooter onAction={() => setMenuOpen(false)} />
        </div>
      </Sheet>

      <div className="min-w-0">
        <DemoStrip />
        <main id="main" key={location.pathname.split("/")[2]} className="mx-auto w-full max-w-[1480px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function DemoStrip() {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line bg-surface-2/80 px-4 py-2 text-[12.5px] text-ink-2 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className="size-1.5 rounded-full bg-coral" aria-hidden /> Interactive demo
        </span>
        <span>Fictional studio and synthetic customers. No model calls, no backend, and nothing is sent.</span>
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-coral-ink underline decoration-coral/40 underline-offset-2 hover:decoration-coral">
          What's real?
        </button>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="What's real in this demo">
        <AboutDemo />
      </Modal>
    </div>
  )
}

export function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}
