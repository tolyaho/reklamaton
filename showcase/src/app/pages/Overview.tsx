import { LayoutGroup, motion } from "framer-motion"
import {
  ArrowRight,
  CheckCheck,
  Download,
  FileText,
  MessageSquareText,
  PartyPopper,
  Send,
  ShieldCheck,
  UserRoundPen,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router"
import { PageFade } from "@/app/AppShell"
import { PageHeader } from "@/app/PageHeader"
import { Avatar } from "@/components/ui"
import { useDemo } from "@/demo/context"
import { segmentRecipients, stageCounts } from "@/demo/engine"
import { LEAD_STAGES, type DemoState, type EventType, type LeadStage } from "@/demo/types"
import { STAGE_META, dayAndTime, plural, relativeTime } from "@/lib/format"
import { buttonClass, cx } from "@/lib/styles"

const STAGE_FILL: Record<LeadStage, string> = {
  new: "bg-line-strong",
  qualified: "bg-indigo",
  proposal: "bg-amber",
  won: "bg-sage",
  lost: "bg-rose/60",
}

const EVENT_ICON: Record<EventType, LucideIcon> = {
  profile_update: UserRoundPen,
  ad_generated: FileText,
  ad_approved: CheckCheck,
  ad_marked_sent: Send,
  consent_changed: ShieldCheck,
}

interface Task {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  to: string
  action: string
  people: number[]
  quote?: string
}

/** The work the workspace is waiting on, most important first. Everything is derived from the demo state. */
function tasks(state: DemoState): Task[] {
  const out: Task[] = []
  for (const chat of state.chats.filter((c) => c.played < c.script.length)) {
    const c = state.customers.find((x) => x.id === chat.customer_id)!
    out.push({
      id: `chat-${chat.id}`,
      icon: MessageSquareText,
      title: chat.played ? `${c.name} is mid-conversation` : `${c.name} wrote in`,
      detail: `${c.company} · ${chat.script.length - chat.played} unread message${chat.script.length - chat.played === 1 ? "" : "s"}`,
      to: `/app/conversations/${c.id}`,
      action: "Open conversation",
      people: [c.id],
      quote: chat.script[chat.played].customer,
    })
  }
  for (const campaign of state.campaigns) {
    const rows = state.outbox.filter((m) => m.campaign_id === campaign.id)
    const waiting = segmentRecipients(state, campaign).filter((r) => r.check.matches && !rows.some((m) => m.customer_id === r.customer.id))
    const drafts = rows.filter((m) => m.status === "draft")
    const approved = rows.filter((m) => m.status === "approved")
    if (waiting.length && campaign.status === "draft") {
      out.push({
        id: `audience-${campaign.id}`,
        icon: Wand2,
        title: `${plural(waiting.length, "customer")} ready for “${campaign.name}”`,
        detail: "In the audience, no draft written yet",
        to: `/app/campaigns/${campaign.id}`,
        action: "Write drafts",
        people: waiting.map((r) => r.customer.id),
      })
    }
    if (drafts.length) {
      out.push({
        id: `drafts-${campaign.id}`,
        icon: FileText,
        title: `${plural(drafts.length, "draft")} to review in “${campaign.name}”`,
        detail: "Nothing is exported until a person approves it",
        to: `/app/campaigns/${campaign.id}`,
        action: "Review drafts",
        people: drafts.map((m) => m.customer_id),
      })
    }
    if (approved.length) {
      out.push({
        id: `export-${campaign.id}`,
        icon: Download,
        title: `${plural(approved.length, "approved message")} in “${campaign.name}”`,
        detail: "Export them as CSV and send with your own tools",
        to: `/app/campaigns/${campaign.id}`,
        action: "Open export",
        people: approved.map((m) => m.customer_id),
      })
    }
  }
  return out
}

export function Overview() {
  const { state } = useDemo()
  const counts = stageCounts(state)
  const total = state.customers.length
  const optedIn = state.customers.filter((c) => c.marketing_opt_in).length
  const list = tasks(state)
  const [first, ...rest] = list
  const events = [...state.events].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 6)

  return (
    <PageFade>
      <PageHeader title="Overview" meta={`${state.business.name} · ${dayAndTime(state.now)} · ${total} customers, ${optedIn} opted in`} />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" data-tour="workspace">
        {/* Primary: what needs attention */}
        <section aria-labelledby="attention-title" className="surface flex flex-col overflow-hidden" data-testid="attention">
          <h2 id="attention-title" className="sr-only">
            Needs attention
          </h2>
          {first ? (
            <motion.div
              key={first.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="bg-ink px-5 py-6 text-paper sm:px-7 sm:py-7"
            >
              <p className="inline-flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.14em] text-paper/60 uppercase">
                <first.icon className="size-4 text-coral" aria-hidden /> Up next
              </p>
              <p className="display mt-3 text-[28px] leading-[1.1] font-semibold sm:text-[34px]">{first.title}</p>
              {first.quote && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-paper/80">“{first.quote}”</p>}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link to={first.to} className={buttonClass("accent", "md")} data-testid="attention-action">
                  {first.action} <ArrowRight aria-hidden />
                </Link>
                <span className="flex items-center gap-2 text-[13px] text-paper/70">
                  <span className="flex -space-x-2">
                    {first.people.slice(0, 6).map((id) => {
                      const c = state.customers.find((x) => x.id === id)!
                      return <Avatar key={id} id={id} name={c.name} size={28} className="ring-2 ring-ink" />
                    })}
                  </span>
                  {first.detail}
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center gap-4 bg-ink px-7 py-8 text-paper">
              <PartyPopper className="size-7 text-coral" aria-hidden />
              <p className="display text-[28px] font-semibold">All caught up</p>
            </div>
          )}
          <ul className="divide-y divide-line">
            {rest.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link to={t.to} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-2 sm:px-7">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-paper-2 text-ink-2 ring-1 ring-line">
                    <t.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{t.title}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">{t.detail}</span>
                  </span>
                  <span className="hidden text-[12.5px] font-medium text-ink-2 group-hover:text-ink sm:inline">{t.action}</span>
                  <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
            {!rest.length && first && <li className="px-7 py-3.5 text-[13px] text-ink-3">Nothing else is waiting.</li>}
          </ul>
        </section>

        {/* Secondary: the pipeline, one avatar per customer */}
        <section aria-labelledby="pipeline-title" className="surface flex flex-col p-5 sm:p-6" data-testid="pipeline">
          <div className="flex items-baseline justify-between">
            <h2 id="pipeline-title" className="text-[15px] font-semibold text-ink">
              Customer pipeline
            </h2>
            <p className="num text-[12.5px] text-ink-3">{total} customers</p>
          </div>
          <div
            className="mt-4 flex h-2 overflow-hidden rounded-full bg-paper-2"
            role="img"
            aria-label={LEAD_STAGES.map((s) => `${STAGE_META[s].label} ${counts[s]}`).join(", ")}
          >
            {LEAD_STAGES.map((s) =>
              counts[s] ? (
                <motion.span
                  key={s}
                  layout
                  className={cx("h-full first:rounded-l-full last:rounded-r-full", STAGE_FILL[s])}
                  style={{ width: `${(counts[s] / total) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              ) : null,
            )}
          </div>
          <LayoutGroup>
            <ol className="mt-4 flex flex-1 flex-col divide-y divide-line/70">
              {LEAD_STAGES.map((s) => {
                const people = state.customers.filter((c) => state.profiles[c.id].lead_stage === s)
                return (
                  <li key={s} className="flex min-h-[52px] items-center gap-3 py-2">
                    <p className="flex w-[92px] shrink-0 items-center gap-2 text-[13px] font-medium text-ink-2">
                      <span className={cx("size-2 shrink-0 rounded-full", STAGE_FILL[s])} aria-hidden />
                      {STAGE_META[s].label}
                    </p>
                    <p className="num w-6 shrink-0 text-[18px] font-semibold text-ink">{people.length}</p>
                    <ul className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {people.map((c) => (
                        <motion.li key={c.id} layoutId={`pipe-${c.id}`} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                          <Link to={`/app/customers/${c.id}`} title={c.name} className="block rounded-full focus-visible:outline-offset-1">
                            <Avatar id={c.id} name={c.name} size={28} />
                            <span className="sr-only">{c.name}</span>
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ol>
          </LayoutGroup>
        </section>

        {/* Tertiary: campaigns and activity */}
        <section aria-labelledby="campaigns-title" className="surface p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 id="campaigns-title" className="text-[15px] font-semibold text-ink">
              Campaigns
            </h2>
            <Link to="/app/campaigns" className="text-[12.5px] font-medium text-coral-ink hover:underline">
              All campaigns
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {state.campaigns.map((c) => {
              const rows = state.outbox.filter((m) => m.campaign_id === c.id)
              const eligible = segmentRecipients(state, c).filter((r) => r.check.matches).length
              const n = (s: string) => rows.filter((m) => m.status === s).length
              const base = Math.max(eligible, rows.length, 1)
              return (
                <li key={c.id}>
                  <Link to={`/app/campaigns/${c.id}`} className="group block">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[14px] font-medium text-ink group-hover:underline">{c.name}</p>
                      <p className="num shrink-0 text-[12px] text-ink-3">{eligible} in audience</p>
                    </div>
                    <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-paper-2">
                      {(["sent", "approved", "draft"] as const).map((s) => (
                        <motion.span
                          key={s}
                          layout
                          className={cx("h-full", s === "sent" ? "bg-indigo" : s === "approved" ? "bg-sage" : "bg-ink-3/40")}
                          style={{ width: `${(n(s) / base) * 100}%` }}
                        />
                      ))}
                    </div>
                    <p className="num mt-1.5 text-[12px] text-ink-3">
                      {n("draft")} draft · {n("approved")} approved · {n("sent")} marked as sent
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="activity-title" className="surface p-5 sm:p-6">
          <h2 id="activity-title" className="text-[15px] font-semibold text-ink">
            Activity
          </h2>
          <ol className="mt-3 flex flex-col" data-testid="activity">
            {events.map((e) => {
              const Icon = EVENT_ICON[e.type]
              const customer = state.customers.find((c) => c.id === e.customer_id)!
              return (
                <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 py-2">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-2 ring-1 ring-line">
                    <Icon className="size-3" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
                    <span className="font-medium text-ink">{customer.name}</span> · {e.summary}
                    <span className="block text-[11.5px] text-ink-3">{relativeTime(e.created_at, state.now)}</span>
                  </p>
                </motion.li>
              )
            })}
          </ol>
        </section>
      </div>
    </PageFade>
  )
}
