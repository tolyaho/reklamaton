import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, Search, ShieldCheck, ShieldOff, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { PageHeader } from "@/app/PageHeader"
import { FactChip } from "@/components/facts"
import { Consent, Memory } from "@/components/Memory"
import { Sheet } from "@/components/Sheet"
import { StageTrack } from "@/components/StageTrack"
import { Avatar, Badge, EmptyState, Provenance, StageBadge } from "@/components/ui"
import { useDemo } from "@/demo/context"
import { checkSegment, formatBudget } from "@/demo/engine"
import { LEAD_STAGES, type Customer, type CustomerProfile, type DemoState, type LeadStage } from "@/demo/types"
import { STAGE_META, relativeTime } from "@/lib/format"
import { buttonClass, cx } from "@/lib/styles"

type BudgetFilter = "any" | "unknown" | "lt2" | "2to4" | "gt4"
const BUDGETS: { id: BudgetFilter; label: string; test: (p: CustomerProfile) => boolean }[] = [
  { id: "any", label: "Any budget", test: () => true },
  { id: "unknown", label: "Not mentioned", test: (p) => p.budget_max == null && p.budget_min == null },
  { id: "lt2", label: "Up to €2,000", test: (p) => p.budget_max != null && p.budget_max <= 2000 },
  { id: "2to4", label: "€2,000–4,500", test: (p) => p.budget_max != null && p.budget_max > 2000 && p.budget_max <= 4500 },
  { id: "gt4", label: "Over €4,500", test: (p) => p.budget_max != null && p.budget_max > 4500 },
]

const STAGE_DOT: Record<LeadStage, string> = {
  new: "bg-line-strong",
  qualified: "bg-indigo",
  proposal: "bg-amber",
  won: "bg-sage",
  lost: "bg-rose/60",
}

/** Same fields as the backend's `list_customers` search (name, email, phone, external id), plus company. */
function matchesSearch(c: Customer, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [c.name, c.company, c.email, c.phone, c.external_id].some((v) => v?.toLowerCase().includes(needle))
}

/** The next thing the workspace would do with this customer, from the demo state. */
function nextStep(state: DemoState, c: Customer): { label: string; tone: "coral" | "sage" | "neutral" | "rose" | "indigo" } {
  const chat = state.chats.find((x) => x.customer_id === c.id)
  if (chat && chat.played < chat.script.length) return { label: "New message", tone: "coral" }
  const rows = state.outbox.filter((m) => m.customer_id === c.id)
  if (rows.some((m) => m.status === "draft")) return { label: "Draft to approve", tone: "neutral" }
  if (rows.some((m) => m.status === "approved")) return { label: "Approved, not sent", tone: "sage" }
  if (!c.marketing_opt_in) return { label: "No consent", tone: "rose" }
  const stage = state.profiles[c.id].lead_stage
  if (stage === "won") return { label: "Customer", tone: "sage" }
  if (stage === "lost") return { label: "Closed", tone: "neutral" }
  const ready = state.campaigns.find((k) => checkSegment(c, state.profiles[c.id], k.segment, state.now).matches && !rows.some((m) => m.campaign_id === k.id))
  if (ready) return { label: `Fits ${ready.name.split(",")[0]}`, tone: "indigo" }
  return { label: "Waiting to hear more", tone: "neutral" }
}

export function Customers() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { state } = useDemo()
  const [query, setQuery] = useState("")
  const [stages, setStages] = useState<LeadStage[]>([])
  const [interest, setInterest] = useState<string>("")
  const [budget, setBudget] = useState<BudgetFilter>("any")
  const [optedIn, setOptedIn] = useState(false)

  const allInterests = useMemo(() => [...new Set(state.customers.flatMap((c) => state.profiles[c.id].interests))].sort(), [state])
  const rows = state.customers.filter((c) => {
    const p = state.profiles[c.id]
    return (
      matchesSearch(c, query) &&
      (!stages.length || stages.includes(p.lead_stage)) &&
      (!interest || p.interests.includes(interest)) &&
      BUDGETS.find((b) => b.id === budget)!.test(p) &&
      (!optedIn || c.marketing_opt_in)
    )
  })
  const filtered = Boolean(query || stages.length || interest || budget !== "any" || optedIn)
  const clear = () => {
    setQuery("")
    setStages([])
    setInterest("")
    setBudget("any")
    setOptedIn(false)
  }
  const selected = customerId ? state.customers.find((c) => c.id === Number(customerId)) : undefined

  return (
    <PageFade>
      <PageHeader title="Customers" meta={`${state.customers.length} customers · profiles fill in from conversations`} />

      <div className="mt-8 flex flex-col gap-4 lg:mt-10" role="search" aria-label="Filter customers">
        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="group" aria-label="Lead stage">
          {LEAD_STAGES.map((s) => {
            const on = stages.includes(s)
            const n = state.customers.filter((c) => state.profiles[c.id].lead_stage === s).length
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setStages((xs) => (on ? xs.filter((x) => x !== s) : [...xs, s]))}
                className={cx(
                  "flex min-w-0 flex-col items-start rounded-[14px] border px-2.5 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 sm:px-4 sm:py-3.5",
                  on ? "border-ink bg-ink text-paper shadow-pop" : "border-line bg-surface text-ink hover:border-line-strong",
                )}
                data-testid={`stage-${s}`}
              >
                <span className={cx("flex max-w-full items-center gap-1.5 text-meta font-medium sm:text-label", on ? "text-paper/80" : "text-ink-2")}>
                  <span className={cx("size-2 shrink-0 rounded-full", STAGE_DOT[s])} aria-hidden />
                  <span className="truncate">{STAGE_META[s].label}</span>
                  {on && <Check className="size-3.5 shrink-0" aria-hidden />}
                </span>
                <span className="num mt-1.5 text-[22px] leading-none font-semibold sm:mt-2 sm:text-[26px]">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, email or phone"
              className="h-11 w-full rounded-[11px] border border-line-strong bg-surface pr-3 pl-10 text-ui text-ink placeholder:text-ink-3 focus:border-indigo focus:ring-2 focus:ring-indigo/20 focus:outline-none focus-visible:outline-none"
              data-testid="customer-search"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              aria-label="Filter by interest"
              className="h-11 rounded-[11px] border border-line-strong bg-surface px-3 text-label text-ink"
              data-testid="interest-filter"
            >
              <option value="">Any interest</option>
              {allInterests.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value as BudgetFilter)}
              aria-label="Filter by budget"
              className="h-11 rounded-[11px] border border-line-strong bg-surface px-3 text-label text-ink"
              data-testid="budget-filter"
            >
              {BUDGETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[11px] border border-line-strong bg-surface px-3.5 text-label text-ink-2 select-none">
              <input type="checkbox" checked={optedIn} onChange={(e) => setOptedIn(e.target.checked)} className="size-4 accent-[var(--color-sage)]" />
              Opted in only
            </label>
            <span className="num ml-1 text-label text-ink-3" aria-live="polite" data-testid="customer-count">
              Showing {rows.length} of {state.customers.length}
            </span>
            {filtered && (
              <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-label font-medium text-coral-ink hover:underline">
                <X className="size-3.5" aria-hidden /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table (md and up) */}
      <div className="surface mt-5 hidden overflow-hidden md:block">
        <table className="w-full table-fixed text-left text-ui" data-testid="customer-table">
          <thead className="border-b border-line bg-surface-2 text-meta text-ink-3">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                Customer
              </th>
              <th scope="col" className="w-[150px] px-4 py-3 font-medium">
                Stage
              </th>
              <th scope="col" className="hidden w-[170px] px-4 py-3 font-medium xl:table-cell">
                Interests
              </th>
              <th scope="col" className="w-[140px] px-4 py-3 font-medium">
                Budget
              </th>
              <th scope="col" className="w-[244px] px-4 py-3 font-medium">
                Next step
              </th>
              <th scope="col" className="hidden w-[130px] px-5 py-3 font-medium 2xl:table-cell">
                Last seen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {rows.map((c) => {
                const p = state.profiles[c.id]
                const step = nextStep(state, c)
                return (
                  <motion.tr
                    key={c.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group relative transition-colors hover:bg-surface-2"
                    data-testid={`customer-row-${c.id}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3.5">
                        <Avatar id={c.id} name={c.name} size={38} />
                        <div className="min-w-0">
                          <Link
                            to={`/app/customers/${c.id}`}
                            className="block truncate font-medium text-ink after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-indigo"
                          >
                            {c.name}
                          </Link>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-label text-ink-3">
                            {c.marketing_opt_in ? (
                              <ShieldCheck className="size-3.5 shrink-0 text-sage" aria-label="Opted in" />
                            ) : (
                              <ShieldOff className="size-3.5 shrink-0 text-rose" aria-label="No marketing consent" />
                            )}
                            {c.company}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-label font-medium text-ink">{STAGE_META[p.lead_stage].label}</span>
                        <span className="num text-meta text-ink-3" title="Lead score">
                          {p.lead_score}
                        </span>
                      </div>
                      <StageTrack stage={p.lead_stage} compact className="mt-2" />
                    </td>
                    <td className="hidden px-4 py-4 xl:table-cell">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        {p.interests.slice(0, 1).map((i) => (
                          <FactChip key={i} kind="interest" className="whitespace-nowrap">
                            {i}
                          </FactChip>
                        ))}
                        {p.interests.length > 1 && (
                          <span className="inline-flex items-center px-1 text-meta text-ink-3" title={p.interests.slice(1).join(", ")}>
                            +{p.interests.length - 1}
                            <span className="sr-only"> more: {p.interests.slice(1).join(", ")}</span>
                          </span>
                        )}
                        {!p.interests.length && <span className="text-ink-3">—</span>}
                      </div>
                    </td>
                    <td className="num truncate px-4 py-4 whitespace-nowrap text-ink-2">
                      {p.budget_max == null && p.budget_min == null ? <span className="text-ink-3">—</span> : formatBudget(p.budget_min, p.budget_max)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={step.tone} className="max-w-full">
                        <span className="truncate">{step.label}</span>
                      </Badge>
                    </td>
                    <td className="hidden px-5 py-4 text-label whitespace-nowrap text-ink-3 2xl:table-cell">{relativeTime(c.last_seen_at, state.now)}</td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState icon={Users} title="No customers match">
            Try removing a filter.
          </EmptyState>
        )}
      </div>

      {/* Cards (mobile) */}
      <ul className="mt-5 flex flex-col gap-2.5 md:hidden" data-testid="customer-cards">
        {rows.map((c) => {
          const p = state.profiles[c.id]
          return (
            <li key={c.id}>
              <Link to={`/app/customers/${c.id}`} className="surface flex items-center gap-3.5 px-4 py-3.5 active:scale-[0.99]">
                <Avatar id={c.id} name={c.name} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-ui font-medium text-ink">{c.name}</p>
                    <StageBadge stage={p.lead_stage} />
                  </div>
                  <p className="mt-0.5 truncate text-label text-ink-3">
                    {c.company} · {c.marketing_opt_in ? "opted in" : "no consent"}
                    {p.budget_max != null ? ` · ${formatBudget(p.budget_min, p.budget_max)}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
        {!rows.length && (
          <li className="surface">
            <EmptyState icon={Users} title="No customers match">
              Try removing a filter.
            </EmptyState>
          </li>
        )}
      </ul>

      <p className="mt-5">
        <Provenance kind="synthetic">Fictional people · example.com emails · phone numbers from the Ofcom drama range</Provenance>
      </p>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && navigate("/app/customers")}
        title={selected?.name ?? ""}
        description={selected?.company}
        testId="customer-drawer"
        width="sm:max-w-[520px]"
      >
        {selected && <CustomerDetail customer={selected} />}
      </Sheet>
    </PageFade>
  )
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const { state, dispatch } = useDemo()
  const chat = state.chats.find((c) => c.customer_id === customer.id)
  const p = state.profiles[customer.id]
  const events = state.events.filter((e) => e.customer_id === customer.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
  return (
    <div className="flex flex-col pb-8">
      {/* Summary first: who, how far, how much, and whether we may write to them. */}
      <div className="flex items-center gap-5 border-b border-line bg-surface-2 px-6 py-5">
        <Avatar id={customer.id} name={customer.name} size={52} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-4">
          <div>
            <p className="type-meta">Stage</p>
            <p className="mt-1 text-ui font-semibold text-ink">{STAGE_META[p.lead_stage].label}</p>
          </div>
          <div>
            <p className="type-meta">Budget</p>
            <p className="num mt-1 truncate text-ui font-semibold text-ink">
              {p.budget_max == null && p.budget_min == null ? "—" : formatBudget(p.budget_min, p.budget_max)}
            </p>
          </div>
          <div>
            <p className="type-meta">Consent</p>
            <Consent optedIn={customer.marketing_opt_in} className="mt-1" />
          </div>
        </div>
      </div>

      <Memory customerId={customer.id} variant="drawer" />

      <div className="mx-6 flex flex-col gap-8 border-t border-line pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="type-card">Marketing consent</p>
            <p className="mt-1 text-label text-ink-3">Campaigns only ever include customers who opted in.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={customer.marketing_opt_in}
            aria-label="Marketing consent"
            data-testid="consent-switch"
            onClick={() => {
              dispatch({ type: "setConsent", customerId: customer.id, value: !customer.marketing_opt_in })
              toast(customer.marketing_opt_in ? "Consent withdrawn" : "Consent recorded", {
                description: customer.marketing_opt_in
                  ? "Removed from campaign audiences; approved messages are left out of exports."
                  : "Now eligible for campaigns that match the profile.",
              })
            }}
            className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200", customer.marketing_opt_in ? "bg-sage" : "bg-line-strong")}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 600, damping: 35 }}
              className={cx("absolute top-1 size-5 rounded-full bg-white shadow", customer.marketing_opt_in ? "right-1" : "left-1")}
            />
          </button>
        </div>

        <div>
          <p className="type-card">Campaign eligibility</p>
          <ul className="mt-3 flex flex-col gap-2">
            {state.campaigns.map((c) => {
              const check = checkSegment(customer, state.profiles[customer.id], c.segment, state.now)
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3">
                  <Link to={`/app/campaigns/${c.id}`} className="text-label font-medium text-ink hover:underline">
                    {c.name}
                  </Link>
                  {check.matches ? (
                    <Badge tone="sage">
                      <Check className="size-3" aria-hidden />
                      In audience
                    </Badge>
                  ) : (
                    <span className="text-right text-meta text-ink-3">{check.reasons.join(" · ")}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {chat && (
          <Link to={`/app/conversations/${customer.id}`} className={buttonClass("secondary", "md", "self-start")}>
            Open conversation <ArrowRight aria-hidden />
          </Link>
        )}

        <div>
          <p className="type-card">Events</p>
          <ol className="mt-3 flex flex-col gap-2.5 border-l border-line pl-4">
            {events.map((e) => (
              <li key={e.id} className="text-label text-ink-2">
                {e.summary} <span className="text-ink-3">· {relativeTime(e.created_at, state.now)}</span>
              </li>
            ))}
            {!events.length && <li className="text-label text-ink-3">No events yet.</li>}
          </ol>
        </div>
      </div>
    </div>
  )
}
