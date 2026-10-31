import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, Search, ShieldCheck, ShieldOff, Users, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { ProfileCard } from "@/components/ProfileCard"
import { Sheet } from "@/components/Sheet"
import { Avatar, Badge, EmptyState, PageHeader, Provenance, StageBadge } from "@/components/ui"
import { buttonClass, cx } from "@/lib/styles"
import { useDemo } from "@/demo/context"
import { checkSegment, formatBudget } from "@/demo/engine"
import { LEAD_STAGES, type Customer, type CustomerProfile, type LeadStage } from "@/demo/types"
import { CHANNEL_LABEL, STAGE_META, relativeTime } from "@/lib/format"

type BudgetFilter = "any" | "unknown" | "lt2" | "2to4" | "gt4"
const BUDGETS: { id: BudgetFilter; label: string; test: (p: CustomerProfile) => boolean }[] = [
  { id: "any", label: "Any budget", test: () => true },
  { id: "unknown", label: "Not mentioned", test: (p) => p.budget_max == null && p.budget_min == null },
  { id: "lt2", label: "Up to €2,000", test: (p) => p.budget_max != null && p.budget_max <= 2000 },
  { id: "2to4", label: "€2,000–4,500", test: (p) => p.budget_max != null && p.budget_max > 2000 && p.budget_max <= 4500 },
  { id: "gt4", label: "Over €4,500", test: (p) => p.budget_max != null && p.budget_max > 4500 },
]

/** Same fields as the backend's `list_customers` search (name, email, phone, external id), plus company. */
function matchesSearch(c: Customer, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [c.name, c.company, c.email, c.phone, c.external_id].some((v) => v?.toLowerCase().includes(needle))
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

  const allInterests = useMemo(
    () => [...new Set(state.customers.flatMap((c) => state.profiles[c.id].interests))].sort(),
    [state],
  )
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
      <PageHeader
        title="Customers"
        description="The CRM. Profiles fill in from conversations; consent and contact details come from sign-up."
      />

      <div className="surface mt-6 flex flex-col gap-3 p-3 sm:p-4" role="search" aria-label="Filter customers">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search customers</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, email or phone"
              className="h-10 w-full rounded-ctl border border-line-strong bg-surface pr-3 pl-9 text-[14px] text-ink placeholder:text-ink-3 focus:border-indigo focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-indigo/20"
              data-testid="customer-search"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              aria-label="Filter by interest"
              className="h-10 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink"
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
              className="h-10 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink"
              data-testid="budget-filter"
            >
              {BUDGETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink-2 select-none">
              <input type="checkbox" checked={optedIn} onChange={(e) => setOptedIn(e.target.checked)} className="size-4 accent-[var(--color-sage)]" />
              Opted in only
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lead stage">
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
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-150",
                  on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
                data-testid={`stage-${s}`}
              >
                {on && <Check className="size-3.5" aria-hidden />}
                {STAGE_META[s].label}
                <span className={cx("num", on ? "text-paper/70" : "text-ink-3")}>{n}</span>
              </button>
            )
          })}
          <span className="num ml-auto text-[12.5px] text-ink-3" aria-live="polite" data-testid="customer-count">
            Showing {rows.length} of {state.customers.length}
          </span>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-coral-ink hover:underline">
              <X className="size-3.5" aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table (md and up) */}
      <div className="surface mt-4 hidden overflow-hidden md:block">
        <table className="w-full text-left text-[13.5px]" data-testid="customer-table">
          <thead className="border-b border-line bg-surface-2 text-[11.5px] tracking-[0.08em] text-ink-3 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Stage</th>
              <th scope="col" className="num px-3 py-2.5 text-right font-semibold">Score</th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Interests</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Budget</th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell">Channel</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Consent</th>
              <th scope="col" className="hidden px-4 py-2.5 font-semibold xl:table-cell">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {rows.map((c) => {
                const p = state.profiles[c.id]
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar id={c.id} name={c.name} size={34} />
                        <div className="min-w-0">
                          <Link
                            to={`/app/customers/${c.id}`}
                            className="font-medium text-ink after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-indigo"
                          >
                            {c.name}
                          </Link>
                          <p className="truncate text-[12.5px] text-ink-3">{c.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><StageBadge stage={p.lead_stage} /></td>
                    <td className="num px-3 py-3 text-right font-semibold">{p.lead_score}</td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {p.interests.slice(0, 2).map((i) => <Badge key={i} tone="indigo">{i}</Badge>)}
                        {p.interests.length > 2 && <Badge>+{p.interests.length - 2}</Badge>}
                        {!p.interests.length && <span className="text-ink-3">—</span>}
                      </div>
                    </td>
                    <td className="num px-3 py-3 whitespace-nowrap text-ink-2">{p.budget_max == null && p.budget_min == null ? "—" : formatBudget(p.budget_min, p.budget_max)}</td>
                    <td className="hidden px-3 py-3 text-ink-2 xl:table-cell">{CHANNEL_LABEL[c.preferred_channel]}</td>
                    <td className="px-3 py-3">
                      {c.marketing_opt_in ? (
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-sage"><ShieldCheck className="size-4" aria-hidden />Opted in</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-rose"><ShieldOff className="size-4" aria-hidden />No consent</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-ink-3 xl:table-cell">{relativeTime(c.last_seen_at, state.now)}</td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <EmptyState icon={Users} title="No customers match">Try removing a filter.</EmptyState>}
      </div>

      {/* Cards (mobile) */}
      <ul className="mt-4 flex flex-col gap-2 md:hidden" data-testid="customer-cards">
        {rows.map((c) => {
          const p = state.profiles[c.id]
          return (
            <li key={c.id}>
              <Link to={`/app/customers/${c.id}`} className="surface flex items-center gap-3 p-3 active:scale-[0.99]">
                <Avatar id={c.id} name={c.name} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-medium text-ink">{c.name}</p>
                    <StageBadge stage={p.lead_stage} />
                  </div>
                  <p className="truncate text-[12.5px] text-ink-3">
                    {c.company} · {c.marketing_opt_in ? "opted in" : "no consent"}
                    {p.budget_max != null ? ` · ${formatBudget(p.budget_min, p.budget_max)}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
        {!rows.length && <li className="surface"><EmptyState icon={Users} title="No customers match">Try removing a filter.</EmptyState></li>}
      </ul>

      <p className="mt-3"><Provenance kind="synthetic">Fictional people · example.com emails · phone numbers from the Ofcom drama range</Provenance></p>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && navigate("/app/customers")}
        title={selected?.name ?? ""}
        description={selected?.company}
        testId="customer-drawer"
      >
        {selected && <CustomerDetail customer={selected} />}
      </Sheet>
    </PageFade>
  )
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const { state, dispatch } = useDemo()
  const chat = state.chats.find((c) => c.customer_id === customer.id)
  const events = state.events.filter((e) => e.customer_id === customer.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
  return (
    <div className="flex flex-col pb-6">
      <ProfileCard customerId={customer.id} showHeader />
      <div className="mx-4 flex flex-col gap-4 border-t border-line pt-4 sm:mx-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-semibold text-ink">Marketing consent</p>
            <p className="text-[12.5px] text-ink-3">Campaigns only ever include customers who opted in.</p>
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
                  ? "Removed from campaign segments; approved messages are left out of exports."
                  : "Now eligible for campaigns that match the profile.",
              })
            }}
            className={cx(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
              customer.marketing_opt_in ? "bg-sage" : "bg-line-strong",
            )}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 600, damping: 35 }}
              className={cx("absolute top-1 size-5 rounded-full bg-white shadow", customer.marketing_opt_in ? "right-1" : "left-1")}
            />
          </button>
        </div>

        <div>
          <p className="text-[13.5px] font-semibold text-ink">Campaign eligibility</p>
          <ul className="mt-2 flex flex-col gap-2">
            {state.campaigns.map((c) => {
              const check = checkSegment(customer, state.profiles[customer.id], c.segment, state.now)
              return (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-ctl border border-line bg-surface-2 px-3 py-2">
                  <Link to={`/app/campaigns/${c.id}`} className="text-[13px] font-medium text-ink hover:underline">{c.name}</Link>
                  {check.matches ? (
                    <Badge tone="sage"><Check className="size-3" aria-hidden />In segment</Badge>
                  ) : (
                    <span className="text-right text-[12px] text-ink-3">{check.reasons.join(" · ")}</span>
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
          <p className="text-[13.5px] font-semibold text-ink">Events</p>
          <ol className="mt-2 flex flex-col gap-2 border-l border-line pl-3">
            {events.map((e) => (
              <li key={e.id} className="text-[12.5px] text-ink-2">
                {e.summary} <span className="text-ink-3">· {relativeTime(e.created_at, state.now)}</span>
              </li>
            ))}
            {!events.length && <li className="text-[12.5px] text-ink-3">No events yet.</li>}
          </ol>
        </div>
      </div>
    </div>
  )
}
