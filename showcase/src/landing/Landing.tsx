import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Compass,
  Download,
  FileSpreadsheet,
  Filter,
  Gauge,
  MessagesSquare,
  PenLine,
  ScanText,
  ShieldCheck,
  Tags,
  Timer,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { buttonClass, cx } from "@/lib/styles"
import { Wordmark } from "@/components/Wordmark"
import { inesScript } from "@/demo/data"
import { REPO_URL, sourceUrl } from "@/lib/links"
import { useTour } from "@/tour/context"
import { HeroLoop } from "./HeroLoop"
import { GithubIcon } from "@/components/GithubIcon"

const LOOP: { icon: LucideIcon; title: string; body: string; code: string; path: string }[] = [
  { icon: Building2, title: "Business context", body: "Brand voice, catalog with prices, personas.", code: "prompter.py", path: "reklamaton/prompter.py" },
  { icon: MessagesSquare, title: "Conversation", body: "An AI persona answers from the catalog only.", code: "assistant_api.py", path: "reklamaton/assistant_api.py" },
  { icon: ScanText, title: "Profile extraction", body: "Each turn becomes a typed JSON patch.", code: "profile_extractor.py", path: "reklamaton/profile_extractor.py" },
  { icon: Filter, title: "Segment", body: "Consent, stage, interests, last seen.", code: "store.py", path: "reklamaton/store.py" },
  { icon: PenLine, title: "Personal drafts", body: "One draft per customer from their profile.", code: "ad_gen.py", path: "reklamaton/ad_gen.py" },
  { icon: UserRoundCheck, title: "Human approval", body: "Nothing is exported until a person approves it.", code: "main.py", path: "reklamaton/main.py" },
  { icon: Download, title: "Export", body: "Approved messages as CSV for your own tools.", code: "export.csv", path: "reklamaton/main.py" },
]

const GUARDRAILS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ShieldCheck, title: "Consent first", body: "Drafts are written only for customers who opted in, and approval re-checks consent." },
  { icon: Timer, title: "One approval per 24 h", body: "A customer can have one approved message per day across all campaigns." },
  { icon: Gauge, title: "Channel limits", body: "160 characters for SMS, 400 for WhatsApp and Telegram, 500 for email and web." },
  { icon: BadgeCheck, title: "A person signs off", body: "Drafts stay drafts until approved; “mark as sent” is bookkeeping only." },
  { icon: Tags, title: "Catalog-only claims", body: "Prompts forbid prices, discounts or terms that are not in the business catalog." },
  { icon: FileSpreadsheet, title: "Spreadsheet-safe CSV", body: "Cells that would run as formulas are escaped before export." },
]

export function Landing() {
  const tour = useTour()
  const reduced = useReducedMotion()
  const turn = inesScript[1]
  const rise = (delay = 0) =>
    reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const } }

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Reklamaton home"><Wordmark /></Link>
          <nav aria-label="Page" className="hidden items-center gap-7 text-[14px] text-ink-2 md:flex">
            <a href="#loop" className="hover:text-ink">How it works</a>
            <a href="#real" className="hover:text-ink">What's real</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
              <GithubIcon className="size-4" /> Source
            </a>
          </nav>
          <Link to="/app/overview" className={buttonClass("primary", "sm")} data-testid="nav-explore">
            Explore demo <ArrowRight aria-hidden />
          </Link>
        </div>
      </header>

      <main id="content">
        {/* Hero */}
        <section className="relative mx-auto grid max-w-[1200px] gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pt-20 lg:pb-24">
          <div className="min-w-0">
            <motion.p {...rise(0)} className="eyebrow">Open-source AI sales workspace</motion.p>
            <motion.h1
              {...rise(0.05)}
              className="mt-4 font-display text-[40px] leading-[1.04] font-semibold tracking-[-0.025em] text-ink sm:text-[52px] lg:text-[60px]"
            >
              Every conversation becomes <span className="text-coral italic">customer memory</span>.
            </motion.h1>
            <motion.p {...rise(0.12)} className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
              Reklamaton chats with customers through an AI persona, extracts what they say into a structured CRM profile,
              and turns those profiles into personalized campaign drafts that a person approves before export.
            </motion.p>
            <motion.div {...rise(0.18)} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app/overview" className={buttonClass("primary", "lg")} data-testid="hero-explore">
                Explore the demo <ArrowRight aria-hidden />
              </Link>
              <button type="button" onClick={tour.start} className={buttonClass("secondary", "lg")} data-testid="hero-tour">
                <Compass aria-hidden /> Start guided tour
              </button>
            </motion.div>
            <motion.p {...rise(0.24)} className="mt-6 max-w-[34rem] text-[13px] leading-relaxed text-ink-3">
              Interactive demo with a fictional studio and synthetic customers. No sign-up, no API key, no model calls, and
              nothing is sent. The working backend is in the{" "}
              <a href={REPO_URL} className="font-medium text-ink-2 underline decoration-line-strong underline-offset-2 hover:decoration-ink-2">repository</a>.
            </motion.p>
          </div>
          <HeroLoop turn={turn} />
        </section>

        {/* The loop */}
        <section id="loop" className="scroll-mt-20 border-y border-line bg-surface-2/60">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <SectionHead eyebrow="How it works" title="One loop, from a chat to an approved message">
              Each step is implemented in the FastAPI backend. The demo runs the same rules in your browser on synthetic data.
            </SectionHead>
            <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {LOOP.map((s, i) => (
                <li key={s.title} className="surface relative flex flex-col p-4 transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-ctl bg-paper-2 text-ink ring-1 ring-line">
                      <s.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="num font-display text-[22px] text-line-strong">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-4 text-[14.5px] font-semibold text-ink">{s.title}</p>
                  <p className="mt-1 flex-1 text-[13px] leading-snug text-ink-3">{s.body}</p>
                  <a
                    href={sourceUrl(s.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-fit items-center rounded-md bg-paper-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2 ring-1 ring-line hover:text-coral-ink"
                  >
                    {s.code}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Signature: text → structure */}
        <section className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <SectionHead eyebrow="The core idea" title="Unstructured chat in, typed customer data out">
              After every reply, the backend sends the latest turn and the current profile to a model with a strict JSON
              schema. The result is a patch, not prose: interests, budget, stage, objections, tone, language, a note.
            </SectionHead>
            <ul className="mt-6 flex flex-col gap-2.5 text-[14px] text-ink-2">
              {[
                "“-” or null means “not mentioned”, so silence never erases what is known.",
                "Interests and objections only grow; the lead score moves by a delta and stays within 0–100.",
                "Every patch is logged as a customer event, and the next chat turn sees the updated profile.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-5 py-3">
              <p className="text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Turn 2 of the demo chat</p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">“{turn.customer}”</p>
            </div>
            <pre className="scroll-thin overflow-x-auto bg-ink p-5 font-mono text-[12.5px] leading-relaxed text-paper">
              <span className="text-paper/50">{"// profile patch (scripted for the demo)\n"}</span>
              {JSON.stringify(turn.patch, null, 2)}
            </pre>
            <div className="flex flex-wrap gap-2 px-5 py-3 text-[12.5px]">
              <span className="rounded-full bg-coral-soft px-2.5 py-1 font-medium text-coral-ink">budget: unknown → up to €4,000</span>
              <span className="rounded-full bg-coral-soft px-2.5 py-1 font-medium text-coral-ink">interests: + labels</span>
              <span className="rounded-full bg-coral-soft px-2.5 py-1 font-medium text-coral-ink">score: 13 → 23</span>
            </div>
          </div>
        </section>

        {/* Guardrails */}
        <section className="border-y border-line bg-surface-2/60">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <SectionHead eyebrow="Guardrails" title="Rules the code enforces">
              Outreach that a person reviews, to people who agreed to hear from you, within limits.
            </SectionHead>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GUARDRAILS.map((g) => (
                <li key={g.title} className="surface flex gap-3.5 p-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-ctl bg-sage-soft text-sage ring-1 ring-sage/15">
                    <g.icon className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[14.5px] font-semibold text-ink">{g.title}</p>
                    <p className="mt-1 text-[13.5px] leading-snug text-ink-3">{g.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What's real */}
        <section id="real" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHead eyebrow="What's real" title="The demo, the backend, and what isn't built">
            The demo is honest about its parts: synthetic data, scripted chat, a template composer instead of a model.
          </SectionHead>
          <div className="mt-10 grid gap-3 lg:grid-cols-3">
            <RealCard tone="ink" title="Backend (runs locally)" items={[
              "FastAPI, SQLModel and SQLite: users, business, customers, chats, campaigns, outbox",
              "OpenAI Responses API for chat replies, profile extraction (strict JSON schema) and drafts",
              "REST and WebSocket chat, CSV export, and offline tests that use a fake model client",
            ]} />
            <RealCard tone="coral" title="This demo (static site)" items={[
              "React app with a fictional studio and 12 synthetic customers, state kept in your browser",
              "Scripted chat and patches; drafts from a template composer, so no model is called",
              "Segment, consent, 24-hour and export rules ported from the Python code; a real CSV download",
            ]} />
            <RealCard tone="line" title="Not built" items={[
              "Sending: no SMS, WhatsApp, Telegram or email integration; “mark as sent” is a record only",
              "Authentication: the backend trusts the user id it is given, so it is not deployed publicly",
              "Results: no customers, conversion or time-saving figures exist, so none are shown",
            ]} />
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-panel bg-ink px-6 py-12 text-paper sm:px-12 lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div className="max-w-xl">
              <h2 className="font-display text-[30px] leading-tight font-semibold sm:text-[36px]">Play the conversation, then ship the campaign.</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-paper/70">
                About two minutes: watch a profile fill in, see it change who a campaign reaches, approve a draft and download the CSV.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/app/overview" className={buttonClass("accent", "lg")}>
                  Open the workspace <ArrowRight aria-hidden />
                </Link>
                <button type="button" onClick={tour.start} className={buttonClass("secondary", "lg", "!bg-transparent !text-paper !border-paper/30 hover:!bg-paper/10")}>
                  <Compass aria-hidden /> Guided tour
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-[13px] text-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Wordmark size={22} className="[&_span]:text-[17px]" />
            <span>MIT licence</span>
          </div>
          <p className="max-w-xl md:text-right">
            Built by Ho Dang Dung (@tolyaho). The July 2025 prototype was a team project with Dima Nikuradze, who set up its Docker build and docs.
            Studio Halden and every customer in the demo are fictional.
          </p>
        </div>
      </footer>
    </div>
  )
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink sm:text-[38px]">{title}</h2>
      {children && <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">{children}</p>}
    </div>
  )
}

function RealCard({ title, items, tone }: { title: string; items: string[]; tone: "ink" | "coral" | "line" }) {
  return (
    <div className="surface flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className={cx("size-2.5 rounded-full", tone === "ink" ? "bg-ink" : tone === "coral" ? "bg-coral" : "bg-line-strong")} aria-hidden />
        <p className="text-[15px] font-semibold text-ink">{title}</p>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px] leading-snug text-ink-2">
        {items.map((t) => (
          <li key={t} className="border-t border-line pt-2.5 first:border-0 first:pt-0">{t}</li>
        ))}
      </ul>
    </div>
  )
}
