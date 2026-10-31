import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Lock,
  Megaphone,
  RefreshCw,
  Send,
  Users,
  Wand2,
} from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { Avatar, Badge, Button, EmptyState, PageHeader, Panel, Provenance, StageBadge } from "@/components/ui"
import { cx } from "@/lib/styles"
import { channelLimit } from "@/demo/compose"
import { useDemo } from "@/demo/context"
import { buildOutboxCsv, csvFilename, exportRows } from "@/demo/csv"
import { approvalBlock, segmentJson, segmentRecipients } from "@/demo/engine"
import { outboxForCampaign } from "@/demo/state"
import { LEAD_STAGES, type Campaign, type OutboundMessage, type OutboundStatus, type Segment } from "@/demo/types"
import { CHANNEL_LABEL, LANGUAGE_LABEL, STAGE_META, clockTime, plural, relativeTime } from "@/lib/format"

export function Campaigns() {
  const { campaignId } = useParams()
  const { state } = useDemo()
  if (!campaignId) return <Navigate to={`/app/campaigns/${state.campaigns[0].id}`} replace />
  const campaign = state.campaigns.find((c) => c.id === Number(campaignId))
  if (!campaign) return <Navigate to="/app/campaigns" replace />
  return <CampaignView campaign={campaign} />
}

const STATUS_META: Record<OutboundStatus, { label: string; tone: "neutral" | "sage" | "indigo"; icon: typeof FileText }> = {
  draft: { label: "Draft", tone: "neutral", icon: FileText },
  approved: { label: "Approved", tone: "sage", icon: CheckCheck },
  sent: { label: "Marked as sent", tone: "indigo", icon: Send },
}

function CampaignView({ campaign }: { campaign: Campaign }) {
  const { state, dispatch } = useDemo()
  const reduced = useReducedMotion()
  const [filter, setFilter] = useState<OutboundStatus | "all">("all")
  const [lastExport, setLastExport] = useState<{ count: number; at: string; name: string } | null>(null)
  const messages = outboxForCampaign(state, campaign.id)
  const recipients = segmentRecipients(state, campaign)
  const matching = recipients.filter((r) => r.check.matches)
  const undrafted = matching.filter((r) => !messages.some((m) => m.customer_id === r.customer.id))
  const counts = { draft: 0, approved: 0, sent: 0 } as Record<OutboundStatus, number>
  for (const m of messages) counts[m.status]++
  const exportable = exportRows(state, campaign.id).length
  const visible = filter === "all" ? messages : messages.filter((m) => m.status === filter)

  const generate = () => {
    const result = dispatch({ type: "generateDrafts", campaignId: campaign.id })
    if (result.ok) {
      toast.success(`${plural(result.created ?? 0, "draft")} written`, {
        description: "Built from each recipient's profile by the demo composer. No model was called.",
      })
    }
  }

  const exportCsv = () => {
    const csv = buildOutboxCsv(state, campaign.id)
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = csvFilename(campaign.id)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setLastExport({ count: exportable, at: state.now, name: csvFilename(campaign.id) })
    toast.success(`Exported ${plural(exportable, "approved message")}`, { description: csvFilename(campaign.id) })
  }

  return (
    <PageFade>
      <PageHeader title="Campaigns" description="Pick a segment, write one draft per recipient, approve, export. A person signs off every message." />

      <nav aria-label="Campaigns" className="mt-5 flex flex-wrap gap-2">
        {state.campaigns.map((c) => {
          const active = c.id === campaign.id
          return (
            <Link
              key={c.id}
              to={`/app/campaigns/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-2.5 rounded-ctl border px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <Megaphone className={cx("size-4", active ? "text-coral" : "text-ink-3")} aria-hidden />
              {c.name}
              <span className={cx("text-[11.5px] font-normal", active ? "text-paper/60" : "text-ink-3")}>{c.status === "draft" ? "new" : "running"}</span>
            </Link>
          )
        })}
      </nav>

      <section className="surface satin mt-4 grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]" aria-label="Campaign brief">
        <div className="min-w-0">
          <p className="eyebrow">Offer</p>
          <p className="mt-1 font-display text-[19px] leading-snug text-ink sm:text-[21px]">“{campaign.offer_text}”</p>
          <p className="mt-2 text-[13px] text-ink-3">Objective: {campaign.objective}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 self-end text-[13px] lg:grid-cols-1 lg:gap-2 lg:text-right">
          <div>
            <dt className="text-ink-3">Channel</dt>
            <dd className="font-medium text-ink">{CHANNEL_LABEL[campaign.channel]} · {channelLimit(campaign.channel)} chars</dd>
          </div>
          <div>
            <dt className="text-ink-3">In segment</dt>
            <dd className="num font-medium text-ink">{matching.length} of {state.customers.length}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Created</dt>
            <dd className="font-medium text-ink">{relativeTime(campaign.created_at, state.now)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <SegmentPanel campaign={campaign} />

        <Panel
          title="Outbox"
          description={
            <span className="num">
              {counts.draft} draft · {counts.approved} approved · {counts.sent} marked as sent
            </span>
          }
          bodyClassName="p-0"
          data-testid="outbox"
        >
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={generate} disabled={!undrafted.length} data-tour="generate" data-testid="generate-drafts">
                <Wand2 aria-hidden />
                {undrafted.length ? `Generate ${plural(undrafted.length, "draft")}` : "All recipients have a draft"}
              </Button>
              <Button variant="secondary" onClick={exportCsv} disabled={!exportable} data-tour="export" data-testid="export-csv">
                <Download aria-hidden /> Export approved ({exportable})
              </Button>
              <Provenance kind="composer" className="ml-auto" />
            </div>
            <AnimatePresence>
              {lastExport && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-[12.5px] text-sage"
                  role="status"
                  data-testid="export-status"
                >
                  <Check className="size-4" aria-hidden />
                  Downloaded {lastExport.name} · {plural(lastExport.count, "message")}. Send them with your own tool, then mark them as sent.
                </motion.p>
              )}
            </AnimatePresence>
            <div className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter by status">
              {(["all", "draft", "approved", "sent"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cx(
                    "h-8 shrink-0 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                    filter === f ? "bg-paper-2 text-ink ring-1 ring-line-strong" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {f === "all" ? `All ${messages.length}` : `${STATUS_META[f].label} ${counts[f]}`}
                </button>
              ))}
            </div>
          </div>

          {!messages.length ? (
            <EmptyState icon={FileText} title="No drafts yet">
              Generate drafts to write one message for each of the {matching.length} customers in the segment.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3 p-3 sm:p-4" data-testid="draft-list">
              <AnimatePresence initial={false}>
                {visible.map((m, i) => (
                  <motion.li
                    key={m.id}
                    layout={!reduced}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduced ? 0 : Math.min(i, 6) * 0.07, duration: 0.32 } }}
                    exit={{ opacity: 0 }}
                  >
                    <DraftCard message={m} />
                  </motion.li>
                ))}
              </AnimatePresence>
              {!visible.length && <li className="py-6 text-center text-[13px] text-ink-3">Nothing with this status.</li>}
            </ul>
          )}
        </Panel>
      </div>
    </PageFade>
  )
}

function SegmentPanel({ campaign }: { campaign: Campaign }) {
  const { state, dispatch } = useDemo()
  const [showJson, setShowJson] = useState(false)
  const [showExcluded, setShowExcluded] = useState(false)
  const recipients = segmentRecipients(state, campaign)
  const matching = recipients.filter((r) => r.check.matches)
  const excluded = recipients.filter((r) => !r.check.matches)
  const interests = [...new Set(state.customers.flatMap((c) => state.profiles[c.id].interests))].sort()
  const seg = campaign.segment
  const update = (patch: Partial<Segment>) => dispatch({ type: "updateSegment", campaignId: campaign.id, segment: { ...seg, ...patch } })
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x])
  const recent = state.lastProfileChange?.customer_id

  return (
    <Panel title="Segment" description="Who gets a draft. Same criteria as the backend's segment_json." data-tour="segment" data-testid="segment">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-ctl border border-line bg-surface-2 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
            <Lock className="size-3.5 text-ink-3" aria-hidden /> Marketing consent
          </span>
          <span className="text-[12.5px] text-sage">Required, always</span>
        </div>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Lead stage is any of</legend>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STAGES.map((s) => {
              const on = seg.lead_stage_in.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ lead_stage_in: toggle(seg.lead_stage_in, s) })}
                  className={cx(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150",
                    on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                  data-testid={`seg-stage-${s}`}
                >
                  {on && <Check className="size-3.5" aria-hidden />}
                  {STAGE_META[s].label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Interested in any of</legend>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((i) => {
              const on = seg.interests_any.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ interests_any: toggle(seg.interests_any, i) })}
                  className={cx(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150",
                    on ? "border-indigo bg-indigo text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                  )}
                  data-testid={`seg-interest-${i.replace(/\s+/g, "-")}`}
                >
                  {on && <Check className="size-3.5" aria-hidden />}
                  {i}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Last seen more than</span>
          <select
            value={seg.last_seen_older_than_days ?? ""}
            onChange={(e) => update({ last_seen_older_than_days: e.target.value ? Number(e.target.value) : null })}
            className="h-9 rounded-ctl border border-line-strong bg-surface px-2.5 text-[13px] text-ink"
            data-testid="seg-last-seen"
          >
            <option value="">any time ago</option>
            <option value="7">7 days ago</option>
            <option value="14">14 days ago</option>
            <option value="30">30 days ago</option>
          </select>
        </label>

        <div className="rounded-ctl border border-line">
          <button
            type="button"
            aria-expanded={showJson}
            onClick={() => setShowJson((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-[12.5px] font-medium text-ink-2 hover:text-ink"
          >
            <span>
              Stored as <code className="font-mono">segment_json</code>
            </span>
            <ChevronDown className={cx("size-4 transition-transform", showJson && "rotate-180")} aria-hidden />
          </button>
          {showJson && (
            <pre className="m-2 mt-0 overflow-x-auto rounded-md bg-ink p-3 font-mono text-[11.5px] leading-relaxed text-paper" data-testid="segment-json">
              {segmentJson(seg)}
            </pre>
          )}
        </div>

        <div aria-live="polite">
          <p className="flex items-baseline justify-between text-[13px]">
            <span className="font-semibold text-ink">
              <span className="num">{matching.length}</span> recipients
            </span>
            <span className="num text-ink-3">{excluded.length} excluded</span>
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-ctl border border-line bg-surface" data-testid="recipients">
            <AnimatePresence initial={false}>
              {matching.map(({ customer, profile }) => (
                <motion.li
                  key={customer.id}
                  layout
                  initial={{ opacity: 0, backgroundColor: "rgba(248,227,216,1)" }}
                  animate={{ opacity: 1, backgroundColor: "rgba(248,227,216,0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                  className="flex items-center gap-2.5 px-3 py-2"
                >
                  <Avatar id={customer.id} name={customer.name} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{customer.name}</span>
                  {recent === customer.id && <Badge tone="coral">updated from chat</Badge>}
                  <StageBadge stage={profile.lead_stage} />
                </motion.li>
              ))}
            </AnimatePresence>
            {!matching.length && (
              <li className="px-3 py-4 text-center text-[12.5px] text-ink-3">
                <Users className="mx-auto mb-1 size-4" aria-hidden /> No customer matches every condition.
              </li>
            )}
          </ul>
          <button
            type="button"
            aria-expanded={showExcluded}
            onClick={() => setShowExcluded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-2 hover:text-ink"
            data-testid="toggle-excluded"
          >
            <ChevronDown className={cx("size-4 transition-transform", showExcluded && "rotate-180")} aria-hidden />
            {showExcluded ? "Hide" : "Show"} who is excluded and why
          </button>
          {showExcluded && (
            <ul className="mt-2 flex flex-col gap-1.5" data-testid="excluded">
              {excluded.map(({ customer, check }) => (
                <li key={customer.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                  <span className="text-ink-2">{customer.name}</span>
                  <span className="text-right text-ink-3">{check.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}

function DraftCard({ message }: { message: OutboundMessage }) {
  const { state, dispatch } = useDemo()
  const [error, setError] = useState<string | null>(null)
  const customer = state.customers.find((c) => c.id === message.customer_id)!
  const profile = state.profiles[customer.id]
  const status = STATUS_META[message.status]
  const limit = channelLimit(message.channel)
  const stale = message.status === "draft" && profile.updated_at > message.created_at
  const block = message.status === "draft" ? approvalBlock(state, message) : null
  const isInes = customer.id === 1 && message.campaign_id === 1

  const approve = () => {
    const r = dispatch({ type: "approve", messageId: message.id })
    if (r.ok) {
      setError(null)
      toast.success(`Approved for ${customer.name.split(" ")[0]}`, { description: "Ready for export. Nothing has been sent." })
    } else setError(r.error)
  }
  const markSent = () => {
    const r = dispatch({ type: "markSent", messageId: message.id })
    if (r.ok) toast(`Marked as sent`, { description: "Bookkeeping only: Reklamaton did not deliver anything." })
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Clipboard is not available here")
    }
  }

  return (
    <article
      className={cx(
        "relative overflow-hidden rounded-card border bg-surface transition-[border-color,box-shadow] duration-300",
        message.status === "approved" ? "border-sage/40 shadow-[0_0_0_3px_rgb(54_107_78/0.08)]" : message.status === "sent" ? "border-indigo/25" : "border-line",
      )}
      data-tour={isInes ? "draft-ines" : undefined}
      data-testid={`draft-${customer.id}`}
      aria-label={`${status.label} message for ${customer.name}`}
    >
      <span
        aria-hidden
        className={cx(
          "absolute inset-y-0 left-0 w-[3px] transition-colors duration-300",
          message.status === "approved" ? "bg-sage" : message.status === "sent" ? "bg-indigo" : "bg-transparent",
        )}
      />
      <header className="flex flex-wrap items-center gap-2.5 border-b border-line/80 px-4 py-2.5">
        <Avatar id={customer.id} name={customer.name} size={30} />
        <div className="min-w-0 flex-1">
          <Link to={`/app/customers/${customer.id}`} className="text-[13.5px] font-semibold text-ink hover:underline">{customer.name}</Link>
          <p className="truncate text-[12px] text-ink-3">
            {customer.company} · {message.channel === "email" ? customer.email : customer.phone}
          </p>
        </div>
        <StageBadge stage={profile.lead_stage} />
        {message.language !== "en" && <Badge tone="indigo">{LANGUAGE_LABEL[message.language] ?? message.language}</Badge>}
        <motion.span key={message.status} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
          <Badge tone={status.tone} >
            <status.icon className="size-3" aria-hidden /> {status.label}
          </Badge>
        </motion.span>
      </header>

      <div className="px-4 py-3">
        <p className="font-[450] text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink" data-testid="draft-content">{message.content}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-paper-2">
            <div className={cx("h-full rounded-full", message.content.length > limit * 0.92 ? "bg-amber" : "bg-ink-3/50")} style={{ width: `${Math.min(100, (message.content.length / limit) * 100)}%` }} />
          </div>
          <span className="num text-[11.5px] text-ink-3">{message.content.length} / {limit}</span>
        </div>
      </div>

      <div className="border-t border-line/80 bg-surface-2/70 px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Personalized from the profile</p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2" data-testid="draft-factors">
          {message.factors.map((f) => (
            <li key={f.label} className="flex flex-col rounded-md border border-line bg-surface px-2.5 py-1.5">
              <span className="text-[12px] font-semibold text-ink">{f.label}</span>
              <span className="text-[11.5px] leading-snug text-ink-3">{f.effect}</span>
            </li>
          ))}
        </ul>
      </div>

      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber/20 bg-amber-soft/60 px-4 py-2 text-[12.5px] text-amber">
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-4" aria-hidden /> Profile changed since this draft was written.</span>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "regenerateDraft", messageId: message.id })}>
            <RefreshCw aria-hidden /> Rewrite draft
          </Button>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line/80 px-4 py-2.5">
        {message.status === "draft" && (
          <Button
            variant="success"
            size="sm"
            onClick={approve}
            data-tour={isInes ? "approve-ines" : undefined}
            data-testid={`approve-${customer.id}`}
            aria-describedby={block ? `block-${message.id}` : undefined}
          >
            <Check aria-hidden /> Approve
          </Button>
        )}
        {message.status === "approved" && (
          <>
            <Button variant="secondary" size="sm" onClick={markSent} data-testid={`mark-sent-${customer.id}`}>
              <Send aria-hidden /> Mark as sent
            </Button>
            <span className="text-[12px] text-ink-3">Approved {message.approved_at ? clockTime(message.approved_at) : ""} · records that you sent it elsewhere</span>
          </>
        )}
        {message.status === "sent" && (
          <span className="text-[12px] text-ink-3">
            Marked as sent {message.sent_at ? relativeTime(message.sent_at, state.now) : ""}. No message was delivered by Reklamaton.
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={copy} className="ml-auto" aria-label={`Copy message for ${customer.name}`}>
          <Copy aria-hidden /> Copy
        </Button>
        {(error || block) && message.status === "draft" && (
          <p id={`block-${message.id}`} role={error ? "alert" : undefined} className="flex w-full items-start gap-1.5 text-[12.5px] text-rose" data-testid={`block-${customer.id}`}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error ?? blockHint(state, block!)}
          </p>
        )}
      </footer>
    </article>
  )
}

function blockHint(state: ReturnType<typeof useDemo>["state"], block: NonNullable<ReturnType<typeof approvalBlock>>): string {
  if (block.kind === "consent") return "Can't be approved: the customer has not opted in to marketing."
  if (block.kind === "sent") return "Already marked as sent."
  const campaign = state.campaigns.find((c) => c.id === block.other.campaign_id)
  return `Approving will be refused: one approved message per customer per 24 h, and “${campaign?.name}” was approved ${relativeTime(block.other.approved_at, state.now)}.`
}
