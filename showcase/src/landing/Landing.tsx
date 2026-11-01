import { motion, useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowRight, ChevronDown, Compass } from "lucide-react"
import { useState, type ComponentType } from "react"
import { Link } from "react-router"
import { AboutDemo } from "@/components/AboutDemo"
import { DemoDisclosure } from "@/components/DemoDisclosure"
import { FactLegend } from "@/components/facts"
import { GithubIcon } from "@/components/GithubIcon"
import { Modal } from "@/components/Sheet"
import { Wordmark } from "@/components/Wordmark"
import { REPO_URL, sourceUrl } from "@/lib/links"
import { buttonClass, cx } from "@/lib/styles"
import { useTour } from "@/tour/context"
import { ActCampaign, ActConversation, ActMemory } from "./Acts"
import { HeroReel } from "./HeroReel"

const ACTS: { id: string; step: string; title: string; muted: string; body: string; Window: ComponentType }[] = [
  {
    id: "conversation",
    step: "Conversation",
    title: "The customer tells you",
    muted: "what matters.",
    body: "Ines asks about packaging for a second bakery. Interests, budget and concerns are marked in her own words as each message is read.",
    Window: ActConversation,
  },
  {
    id: "memory",
    step: "Memory",
    title: "A conversation becomes",
    muted: "customer memory.",
    body: "Every message updates one structured profile. Pick a field to see the words it came from.",
    Window: ActMemory,
  },
  {
    id: "campaign",
    step: "Campaign",
    title: "Memory becomes",
    muted: "a personal campaign.",
    body: "She joins the right audience and gets a draft written from her profile. Nothing leaves until a person approves it.",
    Window: ActCampaign,
  },
]

const RULES = [
  "Marketing consent required",
  "One approval per customer per 24 h",
  "SMS 160 · chat 400 · email 500 characters",
  "A person approves every message",
  "Prices only from the catalog",
  "Formula-safe CSV export",
]

export function Landing() {
  const tour = useTour()
  const reduced = useReducedMotion()
  const [aboutOpen, setAboutOpen] = useState(false)
  const rise = (delay = 0) =>
    reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link to="/" aria-label="Reklamaton home">
            <Wordmark />
          </Link>
          <nav aria-label="Page" className="hidden items-center gap-8 text-ui text-ink-2 md:flex">
            <a href="#story" className="hover:text-ink">
              How it works
            </a>
            <button type="button" onClick={() => setAboutOpen(true)} className="hover:text-ink">
              About this demo
            </button>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
              <GithubIcon className="size-4" /> GitHub
            </a>
          </nav>
          <Link to="/app/overview" className={buttonClass("primary", "sm")} data-testid="nav-explore">
            <span className="hidden sm:inline">Explore interactive demo</span>
            <span className="sm:hidden">Open demo</span> <ArrowRight aria-hidden />
          </Link>
        </div>
      </header>
      <Modal open={aboutOpen} onOpenChange={setAboutOpen} title="About this demo" width="max-w-xl">
        <AboutDemo />
      </Modal>

      <main id="content">
        {/* Hero: the product, playing. */}
        <section className="mx-auto grid max-w-[1360px] gap-12 px-4 pt-12 pb-24 sm:px-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center lg:gap-14 lg:px-10 lg:pt-12 lg:pb-32">
          <div className="min-w-0">
            <motion.h1 {...rise(0)} className="display text-[clamp(36px,10.4vw,48px)] leading-[1.04] text-ink sm:text-[58px] lg:text-[clamp(40px,min(6.6vh,4.3vw),62px)]">
              Every conversation <span className="text-coral italic">becomes an opportunity.</span>
            </motion.h1>
            <motion.p {...rise(0.08)} className="mt-7 max-w-[30rem] text-lead text-ink-2">
              Reklamaton remembers what customers tell you in chat and turns it into personalized drafts that a person approves.
            </motion.p>
            <motion.div {...rise(0.14)} className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/app/overview" className={buttonClass("primary", "lg", "lg:h-11 lg:px-4 xl:h-12 xl:px-5")} data-testid="hero-explore">
                Explore interactive demo <ArrowRight aria-hidden />
              </Link>
              <a href="#story" className={buttonClass("ghost", "lg", "lg:h-11 lg:px-3 xl:h-12")} data-testid="hero-how">
                See how it works <ArrowDown aria-hidden />
              </a>
            </motion.div>
            <motion.div {...rise(0.2)} className="mt-8">
              <DemoDisclosure testId="hero-disclosure" />
            </motion.div>
          </div>
          <motion.div {...rise(0.1)} className="min-w-0" data-testid="hero-reel">
            <HeroReel />
          </motion.div>
        </section>

        {/* Three acts, on the visitor's own workspace. */}
        <section id="story" aria-label="How it works" className="scroll-mt-16 border-t border-line bg-surface-2/40">
          <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-10">
            {ACTS.map((act, i) => (
              <article
                key={act.id}
                id={act.id}
                aria-labelledby={`${act.id}-title`}
                className={cx(
                  "grid scroll-mt-16 gap-10 py-20 sm:py-24 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] lg:gap-14 lg:py-36 xl:gap-16",
                  i > 0 && "border-t border-line",
                )}
                data-testid={`act-${act.id}`}
              >
                <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
                  <Flow active={i} />
                  <h2 id={`${act.id}-title`} className="display mt-7 text-[34px] leading-[1.06] text-ink sm:text-[44px] xl:text-[48px]">
                    {act.title} <span className="text-ink-3">{act.muted}</span>
                  </h2>
                  <p className="mt-6 max-w-[26rem] text-lead text-ink-2">{act.body}</p>
                  {i === 0 && <FactLegend className="mt-8" />}
                </div>
                <div className="min-w-0">
                  <act.Window />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Proof: what runs underneath. */}
        <section aria-labelledby="proof-title" className="mx-auto max-w-[1360px] px-4 py-24 sm:px-6 lg:px-10 lg:py-36">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-16">
            <div>
              <h2 id="proof-title" className="display text-[34px] leading-[1.06] text-ink sm:text-[44px]">
                A real backend <span className="text-ink-3">underneath.</span>
              </h2>
              <p className="mt-6 max-w-[27rem] text-lead text-ink-2">
                FastAPI and SQLite, with OpenAI&apos;s Responses API for replies, profile extraction and drafts. This page runs the same rules in your browser,
                without a model.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
                  <GithubIcon className="size-4" /> Read the source
                </a>
                <a href={sourceUrl("docs/architecture.md")} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
                  Architecture notes
                </a>
              </div>
            </div>
            <Architecture />
          </div>
          <details className="group mt-12 rounded-[16px] border border-line bg-surface/60 lg:mt-14" data-testid="rules">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[16px] px-5 py-4 text-ui font-medium text-ink hover:bg-surface sm:px-6 [&::-webkit-details-marker]:hidden">
              The {RULES.length} rules the code enforces
              <ChevronDown className="size-4 shrink-0 text-ink-2 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="flex flex-wrap gap-2 px-5 pt-1 pb-5 sm:px-6" aria-label="Rules the code enforces">
              {RULES.map((r) => (
                <li key={r} className="rounded-full border border-line bg-surface px-4 py-2 text-label text-ink-2">
                  {r}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="mx-auto max-w-[1360px] px-4 pb-24 sm:px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-16 text-paper sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-16 lg:py-20">
            <h2 className="display text-[36px] leading-[1.06] sm:text-[48px]">
              Play it yourself. <span className="text-paper/60">Start to export in two minutes.</span>
            </h2>
            <div className="mt-10 flex shrink-0 flex-wrap gap-3 lg:mt-0">
              <Link to="/app/overview" className={buttonClass("accent", "lg")} data-testid="cta-explore">
                Explore interactive demo <ArrowRight aria-hidden />
              </Link>
              <button
                type="button"
                onClick={tour.start}
                className={buttonClass("secondary", "lg", "!border-paper/25 !bg-transparent !text-paper hover:!bg-paper/10")}
                data-testid="hero-tour"
              >
                <Compass aria-hidden /> Guided tour
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 py-10 text-meta text-ink-3 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-10">
          <div className="flex flex-col gap-3">
            <Wordmark size={22} className="[&_span]:text-[17px]" />
            <p>
              MIT licence ·{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                Source on GitHub
              </a>
            </p>
          </div>
          <div className="flex max-w-xl flex-col gap-1 leading-relaxed md:text-right">
            <p>Built by Ho Dang Dung (@tolyaho).</p>
            <p>The July 2025 prototype was a team project with Dima Nikuradze, who set up its Docker build and docs.</p>
            <p>Studio Halden and every customer in the demo are fictional.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/** Conversation → Memory → Campaign, with this act's step lit. */
function Flow({ active }: { active: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-label font-medium" aria-label={`Step ${active + 1} of 3`}>
      {ACTS.map((a, i) => (
        <li key={a.id} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className={cx("h-px w-4 sm:w-5", i <= active ? "bg-ink" : "bg-line-strong")} />}
          <a
            href={`#${a.id}`}
            aria-current={i === active ? "step" : undefined}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors",
              i === active ? "bg-ink text-paper" : i < active ? "text-ink-2 hover:text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            <span className="num">{i + 1}</span>
            {a.step}
          </a>
        </li>
      ))}
    </ol>
  )
}

const MODULES = [
  { file: "prompter.py", role: "persona + business context" },
  { file: "profile_extractor.py", role: "chat → typed profile patch" },
  { file: "store.py", role: "merge, segments, approvals" },
  { file: "ad_gen.py", role: "one draft per customer" },
]

/** The backend in one picture: where a message goes and what comes out. */
function Architecture() {
  return (
    <figure className="window p-5 sm:p-7" aria-label="Architecture: customer chat to FastAPI to OpenAI, stored in SQLite, exported as CSV">
      <div className="grid items-stretch gap-3 sm:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.5fr)_auto_minmax(0,0.8fr)]">
        <Node title="Customer chat" sub="REST or WebSocket" />
        <Arrow />
        <div className="rounded-[14px] border border-ink/80 bg-ink p-4 text-paper">
          <p className="text-label font-semibold">FastAPI backend</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {MODULES.map((m) => (
              <li key={m.file}>
                <a
                  href={sourceUrl(`reklamaton/${m.file}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col text-meta"
                >
                  <span className="font-mono text-paper group-hover:underline">{m.file}</span>
                  <span className="text-paper/70">{m.role}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <Arrow />
        <Node title="OpenAI" sub="Responses API, store=False" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Node title="SQLite" sub="customers · profiles · events · outbox" />
        <Node title="CSV export" sub="approved, consented rows only" />
      </div>
      <figcaption className="mt-5 flex items-start gap-2.5 rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-label text-ink-3">
        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" aria-hidden />
        This page: the same merge, segment, consent and approval rules ported to TypeScript, with synthetic data and no model.
      </figcaption>
    </figure>
  )
}

function Node({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface-2 p-4">
      <p className="text-label font-semibold text-ink">{title}</p>
      <p className="mt-1 text-meta text-ink-3">{sub}</p>
    </div>
  )
}

function Arrow() {
  return (
    <span aria-hidden className="hidden items-center justify-center text-ink-3 sm:flex">
      <ArrowRight className="size-4" />
    </span>
  )
}
