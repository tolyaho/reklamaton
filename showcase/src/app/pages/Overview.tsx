import { motion } from "framer-motion"
import { ArrowRight, CheckCheck, FileText, Megaphone, Send, ShieldCheck, Sparkles, UserRoundPen, Users } from "lucide-react"
import { Link } from "react-router"
import { PageFade } from "@/app/AppShell"
import { Avatar, PageHeader, Panel, Provenance } from "@/components/ui"
import { buttonClass, cx } from "@/lib/styles"
import { useDemo } from "@/demo/context"
import { segmentRecipients, stageCounts } from "@/demo/engine"
import { LEAD_STAGES, type EventType } from "@/demo/types"
import { STAGE_META, dayAndTime, plural, relativeTime } from "@/lib/format"

const STAGE_BAR: Record<string, string> = {
  new: "bg-line-strong",
  qualified: "bg-indigo",
  proposal: "bg-amber",
  won: "bg-sage",
  lost: "bg-rose/70",
}

const EVENT_ICON: Record<EventType, typeof Sparkles> = {
  profile_update: UserRoundPen,
  ad_generated: FileText,
  ad_approved: CheckCheck,
  ad_marked_sent: Send,
  consent_changed: ShieldCheck,
}

export function Overview() {
  const { state } = useDemo()
  const counts = stageCounts(state)
  const total = state.customers.length
  const optedIn = state.customers.filter((c) => c.marketing_opt_in).length
  const open = counts.qualified + counts.proposal
  const drafts = state.outbox.filter((m) => m.status === "draft").length
  const approved = state.outbox.filter((m) => m.status === "approved").length
  const sent = state.outbox.filter((m) => m.status === "sent").length
  const ines = state.chats.find((c) => c.id === 1)!
  const objections = state.customers
    .filter((c) => ["qualified", "proposal"].includes(state.profiles[c.id].lead_stage))
    .flatMap((c) => state.profiles[c.id].objections.map((objection) => ({ customer: c, objection, stage: state.profiles[c.id].lead_stage })))
  const events = [...state.events].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 7)

  const kpis = [
    { label: "Customers", value: total, sub: `${optedIn} opted in to marketing`, icon: Users },
    { label: "Open leads", value: open, sub: `${counts.qualified} qualified · ${counts.proposal} proposal`, icon: Sparkles },
    { label: "Drafts to review", value: drafts, sub: "Waiting for a person to approve", icon: FileText },
    { label: "Approved, not yet sent", value: approved, sub: `${sent} marked as sent`, icon: CheckCheck },
  ]

  return (
    <PageFade>
      <PageHeader
        title="Overview"
        description={
          <>
            {state.business.name} · demo clock {dayAndTime(state.now)} (Lisbon). Every figure is counted from the synthetic workspace.
          </>
        }
      />

      <div data-tour="kpis" className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="kpis">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="surface satin p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink-3">{k.label}</span>
              <k.icon className="size-4 text-ink-3" aria-hidden />
            </div>
            <motion.p key={k.value} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="num mt-2 font-display text-[34px] leading-none font-semibold text-ink">
              {k.value}
            </motion.p>
            <p className="mt-2 text-[12.5px] text-ink-3">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
        <div className="min-w-0 xl:col-start-2 xl:row-start-1">
          <section className="surface overflow-hidden">
            <div className="bg-ink px-5 py-4 text-paper">
              <p className="eyebrow !text-paper/60">Start here</p>
              <p className="mt-1 font-display text-[21px] leading-snug font-semibold">
                {ines.played < ines.script.length ? "Ines Calder has a new message" : "Ines's chat is processed"}
              </p>
              <p className="mt-1 text-[13px] text-paper/70">
                {ines.played < ines.script.length
                  ? `A scripted ${ines.script.length}-turn conversation. Watch her CRM profile fill in as it plays.`
                  : "Her profile moved to proposal. She is now in the January packaging campaign."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar id={1} name="Ines Calder" size={32} />
                <span className="text-[13px] text-ink-2">Calder Bakehouse · WhatsApp</span>
              </div>
              <Link to={ines.played < ines.script.length ? "/app/conversations/1" : "/app/campaigns/1"} className={buttonClass("primary", "sm")}>
                {ines.played < ines.script.length ? "Open conversation" : "Open campaign"} <ArrowRight aria-hidden />
              </Link>
            </div>
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Panel title="Lead stages" description="Where each customer's profile stands. Stages change when chats are processed.">
            <div className="flex h-3 overflow-hidden rounded-full bg-paper-2 ring-1 ring-inset ring-line" role="img" aria-label={LEAD_STAGES.map((s) => `${STAGE_META[s].label} ${counts[s]}`).join(", ")}>
              {LEAD_STAGES.map((s) =>
                counts[s] ? (
                  <motion.div key={s} layout className={cx("h-full", STAGE_BAR[s])} style={{ width: `${(counts[s] / total) * 100}%` }} transition={{ duration: 0.4 }} />
                ) : null,
              )}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
              {LEAD_STAGES.map((s) => (
                <li key={s} className="flex items-center gap-2 text-[13px]">
                  <span className={cx("size-2.5 rounded-full", STAGE_BAR[s])} aria-hidden />
                  <span className="text-ink-2">{STAGE_META[s].label}</span>
                  <span className="num ml-auto font-semibold text-ink sm:ml-0">{counts[s]}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Campaigns" actions={<Link to="/app/campaigns" className="text-[13px] font-medium text-coral-ink hover:underline">All campaigns</Link>} bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {state.campaigns.map((c) => {
                const rows = state.outbox.filter((m) => m.campaign_id === c.id)
                const eligible = segmentRecipients(state, c).filter((r) => r.check.matches).length
                return (
                  <li key={c.id}>
                    <Link to={`/app/campaigns/${c.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5">
                      <span className="grid size-9 place-items-center rounded-ctl bg-coral-soft text-coral-ink ring-1 ring-coral/15">
                        <Megaphone className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">{c.name}</p>
                        <p className="num truncate text-[12.5px] text-ink-3">
                          {eligible} in segment · {plural(rows.filter((m) => m.status === "draft").length, "draft")} ·{" "}
                          {rows.filter((m) => m.status === "approved").length} approved · {rows.filter((m) => m.status === "sent").length} sent
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title="Open objections" description="Concerns customers raised in chat that still stand between them and a yes. Drafts answer them first." bodyClassName="p-0">
            <ul className="divide-y divide-line" data-testid="objections">
              {objections.map(({ customer, objection, stage }) => (
                <li key={`${customer.id}-${objection}`}>
                  <Link to={`/app/customers/${customer.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                    <Avatar id={customer.id} name={customer.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{customer.name}</p>
                      <p className="truncate text-[12.5px] text-amber">{objection}</p>
                    </div>
                    <span className="text-[12px] text-ink-3">{STAGE_META[stage].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">

          <Panel title="Activity" description="Customer events, newest first (the backend's CustomerEvent log)." bodyClassName="p-0">
            <ol className="divide-y divide-line" data-testid="activity">
              {events.map((e) => {
                const Icon = EVENT_ICON[e.type]
                const customer = state.customers.find((c) => c.id === e.customer_id)!
                return (
                  <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-paper-2 text-ink-2 ring-1 ring-line">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink">
                        <span className="font-medium">{customer.name}</span> <span className="text-ink-2">· {e.summary}</span>
                      </p>
                      <p className="text-[12px] text-ink-3">{relativeTime(e.created_at, state.now)}</p>
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          </Panel>
          <Provenance kind="synthetic" className="self-start">Synthetic workspace · demo clock starts Mon 26 Oct 09:30</Provenance>
        </div>
      </div>
    </PageFade>
  )
}
