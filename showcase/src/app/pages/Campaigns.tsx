import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, Eye, Lock, Megaphone, Users, Wand2 } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { PageHeader } from "@/app/PageHeader"
import { DraftView } from "@/components/DraftView"
import { Modal } from "@/components/Sheet"
import { Avatar, Badge, Button, Provenance } from "@/components/ui"
import { channelLimit } from "@/demo/compose"
import { useDemo } from "@/demo/context"
import { CSV_COLUMNS, contactFor, csvFilename, exportRows } from "@/demo/csv"
import { downloadOutboxCsv } from "@/demo/download"
import { segmentJson, segmentRecipients } from "@/demo/engine"
import { audienceFunnel } from "@/demo/funnel"
import { outboxForCampaign } from "@/demo/state"
import { LEAD_STAGES, type Campaign, type OutboundStatus, type Segment } from "@/demo/types"
import { CHANNEL_LABEL, STAGE_META, plural } from "@/lib/format"
import { cx } from "@/lib/styles"

export function Campaigns() {
  const { campaignId } = useParams()
  const { state } = useDemo()
  if (!campaignId) return <Navigate to={`/app/campaigns/${state.campaigns[0].id}`} replace />
  const campaign = state.campaigns.find((c) => c.id === Number(campaignId))
  if (!campaign) return <Navigate to="/app/campaigns" replace />
  return <CampaignView key={campaign.id} campaign={campaign} />
}

const STATUS_DOT: Record<OutboundStatus, string> = { draft: "bg-ink-3/50", approved: "bg-sage", sent: "bg-indigo" }

function CampaignView({ campaign }: { campaign: Campaign }) {
  const { state, dispatch } = useDemo()
  const [lastExport, setLastExport] = useState<{ count: number; name: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const messages = outboxForCampaign(state, campaign.id)
  const recipients = segmentRecipients(state, campaign)
  const matching = recipients.filter((r) => r.check.matches)
  const undrafted = matching.filter((r) => !messages.some((m) => m.customer_id === r.customer.id))
  const counts = { draft: 0, approved: 0, sent: 0 } as Record<OutboundStatus, number>
  for (const m of messages) counts[m.status]++
  const exportable = exportRows(state, campaign.id).length
  const selected =
    messages.find((m) => m.id === picked) ?? messages.find((m) => m.customer_id === 1) ?? messages.find((m) => m.status === "draft") ?? messages[0]
  const index = selected ? messages.indexOf(selected) : -1

  const steps = [
    { id: "audience", label: "Audience", value: plural(matching.length, "customer"), done: matching.length > 0 },
    { id: "drafts", label: "Drafts", value: `${messages.length} written`, done: messages.length > 0 && !undrafted.length },
    { id: "approval", label: "Approval", value: `${counts.approved + counts.sent} of ${messages.length}`, done: messages.length > 0 && counts.draft === 0 },
    { id: "export", label: "Export", value: `${exportable} ready`, done: Boolean(lastExport) || (messages.length > 0 && exportable === 0 && counts.sent > 0) },
  ]
  const active = steps.findIndex((s) => !s.done)

  const generate = () => {
    const result = dispatch({ type: "generateDrafts", campaignId: campaign.id })
    if (result.ok) {
      setPicked(null)
      toast.success(`${plural(result.created ?? 0, "draft")} written`, {
        description: "Built from each recipient's profile by the demo composer. No model was called.",
      })
    }
  }

  const exportCsv = () => {
    const done = downloadOutboxCsv(state, campaign.id)
    setLastExport(done)
    toast.success(`Exported ${plural(done.count, "approved message")}`, { description: done.name })
  }

  return (
    <PageFade>
      <PageHeader title="Campaigns" meta="Audience, drafts, approval, export. A person signs off every message." />

      {/* Which campaign, and what it offers. */}
      <section className="mt-8 lg:mt-10" aria-label="Campaign brief">
        <nav aria-label="Campaigns" className="flex flex-wrap gap-2">
          {state.campaigns.map((c) => {
            const on = c.id === campaign.id
            return (
              <Link
                key={c.id}
                to={`/app/campaigns/${c.id}`}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex h-10 items-center gap-2.5 rounded-full border px-4 text-label font-medium transition-colors",
                  on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                <Megaphone className={cx("size-4", on ? "text-coral" : "text-ink-3")} aria-hidden />
                {c.name}
                <span className={cx("text-meta font-normal", on ? "text-paper/70" : "text-ink-3")}>{c.status === "draft" ? "new" : "running"}</span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-6 flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between lg:gap-12">
          <p className="max-w-3xl text-body text-ink sm:text-lead">“{campaign.offer_text}”</p>
          <p className="shrink-0 text-label text-ink-3">
            {CHANNEL_LABEL[campaign.channel]} · {channelLimit(campaign.channel)} characters max
          </p>
        </div>
      </section>

      {/* Progress through the workflow: a quiet line, with the current step in ink. */}
      <ol className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4" aria-label="Campaign progress" data-testid="stepper">
        {steps.map((s, i) => {
          const isActive = i === active
          return (
            <li key={s.id} className="min-w-0" aria-current={isActive ? "step" : undefined}>
              <a href={`#${s.id === "drafts" || s.id === "approval" ? "review" : s.id}`} className="group block rounded-md">
                <span className={cx("block h-1 rounded-full transition-colors duration-300", isActive ? "bg-ink" : s.done ? "bg-sage" : "bg-line")} aria-hidden />
                <span className="mt-3 flex items-center gap-2.5">
                  <span
                    className={cx(
                      "grid size-6 shrink-0 place-items-center rounded-full text-micro font-semibold",
                      isActive ? "bg-ink text-paper" : s.done ? "bg-sage text-white" : "bg-surface text-ink-3 ring-1 ring-line-strong",
                    )}
                  >
                    {s.done && !isActive ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cx("truncate text-label font-semibold", isActive || s.done ? "text-ink" : "text-ink-3")}>{s.label}</span>
                </span>
                <span className="num mt-0.5 block truncate pl-8.5 text-meta text-ink-3">{s.value}</span>
              </a>
            </li>
          )
        })}
      </ol>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:gap-8">
        <AudiencePanel campaign={campaign} onPick={(customerId) => setPicked(messages.find((m) => m.customer_id === customerId)?.id ?? null)} />

        <section id="review" className="surface @container flex min-w-0 scroll-mt-6 flex-col" data-testid="outbox" aria-label="Drafts">
          <header className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="w-full min-w-0 @md:w-auto @md:flex-1">
              <h2 className="type-card">Drafts</h2>
              <p className="num mt-1 text-label text-ink-3">
                {counts.draft} draft · {counts.approved} approved · {counts.sent} marked as sent
              </p>
            </div>
            <Provenance kind="composer" className="@md:mt-1" />
            {messages.length > 0 && undrafted.length > 0 && (
              <Button variant="secondary" size="sm" onClick={generate} data-tour="generate" data-testid="generate-drafts">
                <Wand2 aria-hidden /> Write {plural(undrafted.length, "more draft")}
              </Button>
            )}
          </header>

          {!messages.length ? (
            <div className="flex flex-col items-center gap-5 px-6 pt-16 pb-16 text-center">
              <span className="flex -space-x-2.5">
                {matching.slice(0, 7).map((r) => (
                  <Avatar key={r.customer.id} id={r.customer.id} name={r.customer.name} size={44} className="ring-2 ring-surface" />
                ))}
              </span>
              <p className="type-title max-w-md text-ink">
                {matching.length ? `One personal draft for each of ${matching.length} customers` : "No one is in the audience yet"}
              </p>
              <Button variant="primary" size="lg" onClick={generate} disabled={!undrafted.length} data-tour="generate" data-testid="generate-drafts">
                <Wand2 aria-hidden /> Write {plural(undrafted.length, "draft")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-4 pt-5 pb-5 sm:px-6">
              <LayoutGroup>
                <ul className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="draft-list" aria-label="Drafts in this campaign">
                  {messages.map((m) => {
                    const c = state.customers.find((x) => x.id === m.customer_id)!
                    const on = m.id === selected?.id
                    return (
                      <li key={m.id} className="shrink-0">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPicked(m.id)}
                          className={cx(
                            "relative flex h-11 items-center gap-2.5 rounded-full border pr-4 pl-1.5 text-label font-medium transition-colors",
                            on
                              ? "border-ink bg-surface text-ink shadow-[0_0_0_1px_var(--color-ink)]"
                              : "border-line bg-surface text-ink-2 hover:border-line-strong",
                          )}
                          data-testid={`queue-${c.id}`}
                        >
                          <Avatar id={c.id} name={c.name} size={32} />
                          {c.name.split(" ")[0]}
                          <motion.span layout className={cx("size-2 rounded-full", STATUS_DOT[m.status])} aria-label={m.status} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </LayoutGroup>

              <AnimatePresence mode="wait" initial={false}>
                {selected && (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DraftView message={selected} size="lg" />
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.length > 1 && (
                <div className="flex items-center justify-between text-label text-ink-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPicked(messages[(index - 1 + messages.length) % messages.length].id)}
                    aria-label="Previous draft"
                  >
                    <ArrowLeft aria-hidden /> Previous
                  </Button>
                  <span className="num">
                    {index + 1} of {messages.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPicked(messages[(index + 1) % messages.length].id)}
                    aria-label="Next draft"
                    data-testid="next-draft"
                  >
                    Next <ArrowRight aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div id="export" className="mt-auto flex scroll-mt-6 flex-col gap-2 border-t border-line bg-surface-2/80 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-ui text-ink">
                <span className="num font-semibold">{plural(exportable, "approved message")}</span> <span className="text-ink-3">ready to export</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} disabled={!exportable} data-testid="preview-csv">
                <Eye aria-hidden /> Preview
              </Button>
              <Button variant="primary" size="sm" onClick={exportCsv} disabled={!exportable} data-tour="export" data-testid="export-csv">
                <Download aria-hidden /> Export approved ({exportable})
              </Button>
            </div>
            <AnimatePresence>
              {lastExport ? (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 text-label text-sage"
                  role="status"
                  data-testid="export-status"
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  Downloaded {lastExport.name} · {plural(lastExport.count, "message")}. Send them with your own tool, then mark them as sent.
                </motion.p>
              ) : (
                <p className="text-meta text-ink-3">Reklamaton does not send messages. The CSV goes to your own email or messaging tool.</p>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`${csvFilename(campaign.id)}`}
        description="The rows the export contains right now: approved messages to customers who still have consent. Same columns as the backend's /outbox/export.csv."
        testId="csv-preview"
        width="max-w-4xl"
      >
        <CsvPreview campaignId={campaign.id} onDownload={exportCsv} />
      </Modal>
    </PageFade>
  )
}

function CsvPreview({ campaignId, onDownload }: { campaignId: number; onDownload: () => void }) {
  const { state } = useDemo()
  const rows = exportRows(state, campaignId)
  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-thin max-h-[52vh] overflow-auto rounded-[12px] border border-line">
        <table className="w-full min-w-[760px] text-left text-meta">
          <thead className="sticky top-0 bg-surface-2 font-mono text-micro text-ink-3">
            <tr>
              {CSV_COLUMNS.filter((c) => c !== "campaign_id" && c !== "status").map((c) => (
                <th key={c} scope="col" className="border-b border-line px-3 py-2.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((m) => {
              const customer = state.customers.find((c) => c.id === m.customer_id)!
              return (
                <tr key={m.id}>
                  <td className="num px-3 py-2.5 text-ink-3">{m.id}</td>
                  <td className="num px-3 py-2.5 text-ink-3">{m.customer_id}</td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap text-ink">{customer.name}</td>
                  <td className="px-3 py-2.5 text-ink-2">{contactFor(state, m.customer_id, m.channel)}</td>
                  <td className="px-3 py-2.5 text-ink-2">{m.channel}</td>
                  <td className="min-w-[300px] px-3 py-2.5 whitespace-pre-wrap text-ink">{m.content}</td>
                  <td className="num px-3 py-2.5 whitespace-nowrap text-ink-3">{m.approved_at?.replace("T", " ").slice(0, 16)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-meta text-ink-3">
        The file also has <code className="font-mono">campaign_id</code> and <code className="font-mono">status</code> columns. It is UTF-8 with a byte-order
        mark for spreadsheet apps, and cells that would run as formulas are prefixed with a quote.
      </p>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDownload}>
          <Download aria-hidden /> Download CSV
        </Button>
      </div>
    </div>
  )
}

function AudiencePanel({ campaign, onPick }: { campaign: Campaign; onPick: (customerId: number) => void }) {
  const { state, dispatch } = useDemo()
  const [showRules, setShowRules] = useState(false)
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
  const funnel = audienceFunnel(state, seg)
  const total = state.customers.length
  const drafted = (id: number) => state.outbox.find((m) => m.campaign_id === campaign.id && m.customer_id === id)
  const chip = (on: boolean, tone: "ink" | "indigo") =>
    cx(
      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-label font-medium transition-colors duration-150",
      on ? (tone === "ink" ? "border-ink bg-ink text-paper" : "border-indigo bg-indigo text-white") : "border-line bg-surface text-ink-2 hover:border-line-strong",
    )

  return (
    <section id="audience" className="surface flex min-w-0 scroll-mt-6 flex-col self-start" data-tour="segment" data-testid="segment" aria-label="Audience">
      <header className="px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 className="type-card">Audience</h2>
        <p className="mt-1 text-label text-ink-3">Same rules as the backend&apos;s segment_json</p>
      </header>

      <div className="flex flex-col gap-6 px-5 pt-5 pb-6 sm:px-6">
        {/* Each rule narrows the audience; the bars move as the profile data changes. */}
        <ol className="flex flex-col gap-2" aria-label="Audience funnel" data-testid="funnel">
          {funnel.map((step, i) => (
            <li key={step.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
              <div className="relative h-8 overflow-hidden rounded-[9px] bg-paper-2">
                <motion.div
                  className={cx("absolute inset-y-0 left-0 rounded-[9px]", i === funnel.length - 1 ? "bg-fact-intent" : "bg-line-strong/55")}
                  initial={false}
                  animate={{ width: `${Math.max(4, (step.ids.length / total) * 100)}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
                <span
                  className={cx(
                    "relative flex h-full items-center truncate px-3 text-meta font-medium",
                    i === funnel.length - 1 ? "text-ink" : "text-ink-2",
                  )}
                >
                  {step.label}
                </span>
              </div>
              <span className={cx("num w-7 text-right text-ui font-semibold", i === funnel.length - 1 ? "text-ink" : "text-ink-3")}>{step.ids.length}</span>
            </li>
          ))}
        </ol>

        <div aria-live="polite">
          <p className="flex items-baseline justify-between text-label">
            <span className="font-semibold text-ink">
              <span className="num">{matching.length}</span> in the audience
            </span>
            <span className="num text-ink-3">{excluded.length} excluded</span>
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-line rounded-[12px] border border-line bg-surface" data-testid="recipients">
            <AnimatePresence initial={false}>
              {matching.map(({ customer, profile }) => {
                const m = drafted(customer.id)
                return (
                  <motion.li
                    key={customer.id}
                    layout
                    initial={{ opacity: 0, backgroundColor: "rgba(207,228,214,1)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(207,228,214,0)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                  >
                    <button
                      type="button"
                      onClick={() => m && onPick(customer.id)}
                      disabled={!m}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left enabled:hover:bg-surface-2"
                    >
                      <Avatar id={customer.id} name={customer.name} size={30} />
                      <span className="min-w-0 flex-1 truncate text-label text-ink">{customer.name}</span>
                      <span className="sr-only">{STAGE_META[profile.lead_stage].label}</span>
                      {recent === customer.id && <Badge tone="coral">from chat</Badge>}
                      {m && <span className={cx("size-2 shrink-0 rounded-full", STATUS_DOT[m.status])} aria-label={`${m.status}`} />}
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
            {!matching.length && (
              <li className="px-4 py-5 text-center text-label text-ink-3">
                <Users className="mx-auto mb-1.5 size-4" aria-hidden /> No customer matches every condition.
              </li>
            )}
          </ul>
          <button
            type="button"
            aria-expanded={showExcluded}
            onClick={() => setShowExcluded((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-label font-medium text-ink-2 hover:text-ink"
            data-testid="toggle-excluded"
          >
            <ChevronDown className={cx("size-4 transition-transform", showExcluded && "rotate-180")} aria-hidden />
            {showExcluded ? "Hide" : "Show"} who is excluded and why
          </button>
          {showExcluded && (
            <ul className="mt-3 flex flex-col gap-2" data-testid="excluded">
              {excluded.map(({ customer, check }) => (
                <li key={customer.id} className="flex items-start justify-between gap-4 text-label">
                  <span className="text-ink-2">{customer.name}</span>
                  <span className="text-right text-meta text-ink-3">{check.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The rules themselves, one click away: consent is fixed, the rest can be changed. */}
        <div className="rounded-[14px] border border-line">
          <button
            type="button"
            aria-expanded={showRules}
            aria-controls={`rules-${campaign.id}`}
            onClick={() => setShowRules((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            data-testid="toggle-rules"
          >
            <span className="min-w-0">
              <span className="block text-label font-semibold text-ink">Audience rules</span>
              <span className="mt-0.5 block text-meta text-ink-3">
                Consent · {seg.lead_stage_in.length ? seg.lead_stage_in.map((x) => STAGE_META[x].label.toLowerCase()).join(" or ") : "any stage"}
                {seg.interests_any.length ? ` · ${seg.interests_any.join(" or ")}` : ""}
                {seg.last_seen_older_than_days ? ` · seen over ${seg.last_seen_older_than_days} days ago` : ""}
              </span>
            </span>
            <ChevronDown className={cx("size-4 shrink-0 text-ink-2 transition-transform", showRules && "rotate-180")} aria-hidden />
          </button>
          {showRules && (
            <div id={`rules-${campaign.id}`} className="flex flex-col gap-6 border-t border-line px-4 pt-4 pb-5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-label font-medium text-ink">
                  <Lock className="size-4 text-ink-3" aria-hidden /> Marketing consent
                </span>
                <span className="text-label text-sage">Required, always</span>
              </div>

              <fieldset>
                <legend className="type-label mb-2.5">Lead stage is any of</legend>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STAGES.map((s) => {
                    const on = seg.lead_stage_in.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => update({ lead_stage_in: toggle(seg.lead_stage_in, s) })}
                        className={chip(on, "ink")}
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
                <legend className="type-label mb-2.5">Interested in any of</legend>
                <div className="flex flex-wrap gap-2">
                  {interests.map((i) => {
                    const on = seg.interests_any.includes(i)
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        onClick={() => update({ interests_any: toggle(seg.interests_any, i) })}
                        className={chip(on, "indigo")}
                        data-testid={`seg-interest-${i.replace(/\s+/g, "-")}`}
                      >
                        {on && <Check className="size-3.5" aria-hidden />}
                        {i}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label className="flex flex-wrap items-center justify-between gap-3">
                <span className="type-label">Last seen more than</span>
                <select
                  value={seg.last_seen_older_than_days ?? ""}
                  onChange={(e) => update({ last_seen_older_than_days: e.target.value ? Number(e.target.value) : null })}
                  className="h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-label text-ink"
                  data-testid="seg-last-seen"
                >
                  <option value="">any time ago</option>
                  <option value="7">7 days ago</option>
                  <option value="14">14 days ago</option>
                  <option value="30">30 days ago</option>
                </select>
              </label>

              <div>
                <button
                  type="button"
                  aria-expanded={showJson}
                  onClick={() => setShowJson((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-label font-medium text-ink-2 hover:text-ink"
                >
                  <ChevronDown className={cx("size-4 transition-transform", showJson && "rotate-180")} aria-hidden />
                  <span>
                    Stored as <code className="font-mono">segment_json</code>
                  </span>
                </button>
                {showJson && (
                  <pre className="mt-3 overflow-x-auto rounded-[10px] bg-ink p-3.5 font-mono text-meta leading-relaxed text-paper" data-testid="segment-json">
                    {segmentJson(seg)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
