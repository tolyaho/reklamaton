import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Mail, MessageCircle, Phone, Quote, ShieldCheck, ShieldOff } from "lucide-react"
import { useId, useState, type ReactNode } from "react"
import { useDemo } from "@/demo/context"
import { formatBudget } from "@/demo/engine"
import type { FieldChange, ProfileField } from "@/demo/types"
import { CHANNEL_LABEL, LANGUAGE_LABEL, TONE_LABEL, relativeTime, shortDate } from "@/lib/format"
import { cx } from "@/lib/styles"
import { Avatar, Badge, Provenance, ScoreMeter, StageBadge } from "./ui"

interface Props {
  customerId: number
  /** Called with a message id when the user follows an evidence quote. */
  onEvidence?: (messageId: number) => void
  showHeader?: boolean
}

export function ProfileCard({ customerId, onEvidence, showHeader = true }: Props) {
  const { state } = useDemo()
  const customer = state.customers.find((c) => c.id === customerId)!
  const profile = state.profiles[customerId]
  const change = state.lastProfileChange?.customer_id === customerId ? state.lastProfileChange : null
  const changed = new Map<ProfileField, FieldChange>((change?.changes ?? []).map((c) => [c.field, c]))
  const [showPatch, setShowPatch] = useState(false)
  const patchId = useId()

  const field = (key: ProfileField, label: string, value: ReactNode) => (
    <ProfileRow
      key={key}
      label={label}
      change={changed.get(key)}
      changeKey={change ? `${change.at}-${key}` : undefined}
      onEvidence={change && onEvidence ? () => onEvidence(change.message_id) : undefined}
    >
      {value}
    </ProfileRow>
  )

  return (
    <div className="flex flex-col">
      {showHeader && (
        <div className="flex items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
          <Avatar id={customer.id} name={customer.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{customer.name}</p>
            <p className="truncate text-[13px] text-ink-3">{customer.company}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
              {customer.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" aria-hidden />
                  {customer.email}
                </span>
              )}
              {customer.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" aria-hidden />
                  {customer.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" aria-hidden />
                Prefers {CHANNEL_LABEL[customer.preferred_channel]}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-ctl border border-line bg-surface-2 px-3 py-2 sm:mx-5">
        {customer.marketing_opt_in ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap text-sage">
            <ShieldCheck className="size-4" aria-hidden />
            Opted in to marketing
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium whitespace-nowrap text-rose">
            <ShieldOff className="size-4" aria-hidden />
            No marketing consent
          </span>
        )}
        <span className="text-[12px] whitespace-nowrap text-ink-3">
          {customer.marketing_opt_in && customer.marketing_opt_in_at ? `since ${shortDate(customer.marketing_opt_in_at)} · ` : ""}
          seen {relativeTime(customer.last_seen_at, state.now)}
        </span>
      </div>

      <div aria-live="polite" className="sr-only">
        {change ? `Profile updated from turn ${change.turn + 1}: ${change.changes.length} fields changed.` : ""}
      </div>

      <AnimatePresence initial={false}>
        {change && (
          <motion.div
            key={change.at}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-ctl bg-coral-soft px-3 py-2 text-[12.5px] text-coral-ink ring-1 ring-coral/20 sm:mx-5"
            data-testid="profile-updated"
          >
            <span className="font-semibold">
              Profile updated · {change.changes.length} field{change.changes.length === 1 ? "" : "s"}
            </span>
            <span className="text-coral-ink/80">from turn {change.turn + 1}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <dl className="divide-y divide-line/80">
        <ProfileRow
          label="Lead stage"
          change={changed.get("lead_stage") ?? changed.get("lead_score")}
          changeKey={change ? `${change.at}-stage` : undefined}
          onEvidence={change && onEvidence ? () => onEvidence(change.message_id) : undefined}
          hideEvidence={!changed.get("lead_stage")}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <StageBadge stage={profile.lead_stage} />
              {changed.get("lead_stage") && (
                <span className="text-[12px] text-ink-3">
                  was <span className="line-through decoration-ink-3/60">{changed.get("lead_stage")!.before}</span>
                </span>
              )}
            </div>
            <ScoreMeter value={profile.lead_score} />
            {changed.get("lead_score") && (
              <span className="num text-[12px] text-ink-3">
                Score {changed.get("lead_score")!.before} → {changed.get("lead_score")!.after} (
                {Number(changed.get("lead_score")!.after) - Number(changed.get("lead_score")!.before) >= 0 ? "+" : ""}
                {Number(changed.get("lead_score")!.after) - Number(changed.get("lead_score")!.before)})
              </span>
            )}
          </div>
        </ProfileRow>
        {field(
          "interests",
          "Interests",
          profile.interests.length ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((i) => (
                <Badge key={i} tone={changed.get("interests")?.before.split(", ").includes(i) === false ? "coral" : "indigo"}>
                  {i}
                </Badge>
              ))}
            </div>
          ) : (
            <Empty>Not known yet</Empty>
          ),
        )}
        {field(
          "budget",
          "Budget",
          profile.budget_min == null && profile.budget_max == null ? <Empty>Not mentioned</Empty> : (
            <span className="num font-medium">{formatBudget(profile.budget_min, profile.budget_max)}</span>
          ),
        )}
        {field(
          "objections",
          "Objections",
          profile.objections.length ? (
            <ul className="flex flex-col gap-1">
              {profile.objections.map((o) => (
                <li key={o}>
                  <Badge tone="amber" className="whitespace-normal">{o}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>None raised</Empty>
          ),
        )}
        {field("tone", "Tone", profile.tone ? TONE_LABEL[profile.tone] : <Empty>Not detected</Empty>)}
        {field(
          "language",
          "Language",
          profile.language ? `${LANGUAGE_LABEL[profile.language] ?? profile.language} (${profile.language})` : <Empty>Not detected</Empty>,
        )}
        {field("location", "Location", profile.location ?? <Empty>Unknown</Empty>)}
        {field(
          "notes",
          "Notes",
          profile.notes.length ? (
            <ul className="flex flex-col gap-1.5">
              {profile.notes.map((n, i) => (
                <li key={`${n.at}-${i}`} className="text-[13px] leading-snug text-ink-2">
                  <span className="num mr-1.5 text-[11px] text-ink-3">{shortDate(n.at)}</span>
                  {n.text}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No notes</Empty>
          ),
        )}
      </dl>

      {change && (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <button
            type="button"
            aria-expanded={showPatch}
            aria-controls={patchId}
            onClick={() => setShowPatch((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md text-left text-[12.5px] font-medium text-ink-2 hover:text-ink"
          >
            <span>Extraction patch for turn {change.turn + 1}</span>
            <ChevronDown className={cx("size-4 transition-transform duration-200", showPatch && "rotate-180")} aria-hidden />
          </button>
          {showPatch && (
            <div id={patchId} className="mt-2 flex flex-col gap-2">
              <p className="text-[12px] leading-snug text-ink-3">
                The JSON shape <code className="font-mono text-[11.5px]">profile_extractor.py</code> returns after a turn
                (strict JSON schema). In the demo it is scripted; the merge rules are the backend&apos;s.
              </p>
              <pre className="scroll-thin max-h-56 overflow-auto rounded-ctl bg-ink p-3 font-mono text-[11.5px] leading-relaxed text-paper">
                {JSON.stringify(change.patch, null, 2)}
              </pre>
              <Provenance kind="scripted">Scripted patch, not model output</Provenance>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-ink-3 italic">{children}</span>
}

function ProfileRow({
  label,
  change,
  changeKey,
  onEvidence,
  hideEvidence,
  children,
}: {
  label: string
  change?: FieldChange
  changeKey?: string
  onEvidence?: () => void
  hideEvidence?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative px-4 py-3 sm:px-5" data-changed={change ? "true" : undefined}>
      <AnimatePresence>
        {change && (
          <motion.span
            key={changeKey}
            aria-hidden
            className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-coral"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <motion.div
        key={changeKey ?? "static"}
        initial={change ? { backgroundColor: "rgba(248, 227, 216, 0.9)" } : false}
        animate={{ backgroundColor: "rgba(248, 227, 216, 0)" }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="-mx-2 rounded-md px-2 py-0.5"
      >
        <dt className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {label}
          {change && (
            <span className="rounded bg-coral px-1.5 py-px text-[10px] font-semibold tracking-normal text-white normal-case">
              updated
            </span>
          )}
        </dt>
        <dd className="text-[13.5px] text-ink">{children}</dd>
        {change?.evidence && !hideEvidence && (
          <button
            type="button"
            onClick={onEvidence}
            disabled={!onEvidence}
            className="mt-1.5 inline-flex max-w-full items-start gap-1.5 rounded-md text-left text-[12px] leading-snug text-ink-3 hover:text-coral-ink disabled:hover:text-ink-3"
          >
            <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span className="italic">“{change.evidence}”</span>
          </button>
        )}
      </motion.div>
    </div>
  )
}
