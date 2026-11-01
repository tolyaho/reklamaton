import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Quote, ShieldCheck, ShieldOff } from "lucide-react"
import { useId, useState, type CSSProperties, type ReactNode } from "react"
import { useDemo } from "@/demo/context"
import { formatBudget } from "@/demo/engine"
import { kindOf, lastTurnFor, profileHistory, type FactKind, type TurnRecord } from "@/demo/facts"
import type { FieldChange, ProfileField } from "@/demo/types"
import { CHANNEL_LABEL, LANGUAGE_LABEL, TONE_LABEL, relativeTime, shortDate } from "@/lib/format"
import { FACT_TONE } from "@/lib/factTone"
import { cx } from "@/lib/styles"
import { FactChip, FactDot } from "./facts"
import { StageTrack } from "./StageTrack"
import { Avatar, Provenance } from "./ui"

const GLOW: Record<FactKind, string> = {
  interest: "rgb(67 78 152 / 0.32)",
  budget: "rgb(196 80 46 / 0.32)",
  concern: "rgb(140 91 12 / 0.32)",
  intent: "rgb(54 107 78 / 0.32)",
  context: "rgb(104 97 87 / 0.28)",
}

interface Props {
  customerId: number
  /** Called with the field and the customer message it came from. */
  onSource?: (field: ProfileField, messageId: number) => void
  activeField?: ProfileField | null
  /** "panel" sits next to a conversation; "drawer" opens from the CRM; "story" and "compact" are landing-page views. */
  variant?: "panel" | "drawer" | "story" | "compact"
  /** Announce profile updates to screen readers (off for the landing replay, which loops through them). */
  announce?: boolean
}

/**
 * A customer's memory: the structured profile the backend keeps, with each field coloured by the
 * kind of fact it holds. Fields the last chat turn changed glow and quote the words they came from.
 */
export function Memory({ customerId, onSource, activeField, variant = "panel", announce = true }: Props) {
  const { state } = useDemo()
  const customer = state.customers.find((c) => c.id === customerId)!
  const profile = state.profiles[customerId]
  const history = profileHistory(state, customerId)
  const change = state.lastProfileChange?.customer_id === customerId ? state.lastProfileChange : null
  const changed = new Map<ProfileField, FieldChange>((change?.changes ?? []).map((c) => [c.field, c]))
  const [showPatch, setShowPatch] = useState(false)
  const patchId = useId()
  const newInterests = changed.has("interests") ? profile.interests.filter((i) => !changed.get("interests")!.before.split(", ").includes(i)) : []
  const newObjections = changed.has("objections") ? profile.objections.filter((o) => !changed.get("objections")!.before.split(", ").includes(o)) : []
  const score = changed.get("lead_score")
  const delta = score ? Number(score.after) - Number(score.before) : 0

  const block = (field: ProfileField, label: string, value: ReactNode, opts: { also?: ProfileField; className?: string } = {}) => {
    const c = changed.get(field) ?? (opts.also ? changed.get(opts.also) : undefined)
    const source = lastTurnFor(history, field) ?? (opts.also ? lastTurnFor(history, opts.also) : undefined)
    return (
      <FieldBlock
        key={c ? `${change?.at}-${field}` : field}
        field={field}
        kind={kindOf(field, change?.patch)}
        label={label}
        change={c}
        source={source}
        active={activeField === field}
        onSource={onSource}
        className={cx(variant === "compact" && "py-2", opts.className)}
      >
        {value}
      </FieldBlock>
    )
  }

  return (
    <div className="flex flex-col" data-variant={variant}>
      {(variant === "panel" || variant === "story") && (
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <Avatar id={customer.id} name={customer.name} size={variant === "story" ? 46 : 42} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-heading font-semibold text-ink">{customer.name}</p>
            <p className="truncate text-label text-ink-3">{customer.company}</p>
          </div>
          <Consent optedIn={customer.marketing_opt_in} />
        </div>
      )}

      {announce && (
        <div aria-live="polite" className="sr-only">
          {change ? `Profile updated from message ${change.turn + 1}: ${change.changes.length} fields changed.` : ""}
        </div>
      )}
      <AnimatePresence initial={false} mode="wait">
        {change && (
          <motion.div
            key={change.at}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cx(
              "mx-4 mb-2 flex items-center justify-between gap-2 rounded-[10px] bg-ink px-3.5 py-2 text-label whitespace-nowrap text-paper",
              variant === "compact" && "mt-3",
            )}
            data-testid="profile-updated"
          >
            <span className="truncate font-semibold">
              Profile updated · {change.changes.length} field{change.changes.length === 1 ? "" : "s"}
            </span>
            <span className="text-paper/70">msg {change.turn + 1}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cx("flex flex-col px-2", variant === "compact" ? "gap-0.5 pb-2" : "gap-1.5 pb-4")}>
        {block(
          "lead_stage",
          "Stage",
          <div className="flex flex-col gap-2 pt-1">
            <StageTrack stage={profile.lead_stage} />
            <p className="num text-meta text-ink-3">
              Lead score <span className="font-semibold text-ink">{profile.lead_score}</span>
              {score && (
                <span className={cx("ml-1.5 font-semibold", delta >= 0 ? "text-sage" : "text-amber")}>
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta)}
                </span>
              )}
            </p>
          </div>,
          { also: "lead_score" },
        )}
        {block(
          "interests",
          "Interests",
          profile.interests.length ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {profile.interests.map((i) => (
                <FactChip key={i} kind="interest" className={cx(newInterests.includes(i) && "ring-2 ring-indigo/30")}>
                  {i}
                </FactChip>
              ))}
            </div>
          ) : (
            <Empty>Not known yet</Empty>
          ),
        )}
        {block(
          "budget",
          "Budget",
          profile.budget_min == null && profile.budget_max == null ? (
            <Empty>Not mentioned</Empty>
          ) : (
            <span className="num text-lead font-semibold tracking-[-0.012em] text-ink">{formatBudget(profile.budget_min, profile.budget_max)}</span>
          ),
        )}
        {block(
          "objections",
          "Concerns",
          profile.objections.length ? (
            <div className="flex flex-col items-start gap-1.5 pt-1">
              {profile.objections.map((o) => (
                <FactChip key={o} kind="concern" className={cx("whitespace-normal", newObjections.includes(o) && "ring-2 ring-amber/30")}>
                  {o}
                </FactChip>
              ))}
            </div>
          ) : (
            <Empty>None raised</Empty>
          ),
        )}
        {variant !== "compact" && (
          <div className="grid grid-cols-2 gap-1.5">
            {block("location", "Location", profile.location ?? <Empty>Unknown</Empty>)}
            {block("language", "Language", profile.language ? (LANGUAGE_LABEL[profile.language] ?? profile.language) : <Empty>Unknown</Empty>)}
            {block("tone", "Tone", profile.tone ? TONE_LABEL[profile.tone] : <Empty>Unknown</Empty>)}
            <div className="rounded-[12px] px-3 py-2.5">
              <p className="type-label">Prefers</p>
              <p className="mt-1 text-ui text-ink">{CHANNEL_LABEL[customer.preferred_channel]}</p>
            </div>
          </div>
        )}
        {variant !== "compact" &&
          block(
            "notes",
            "Notes",
            profile.notes.length ? (
              <ul className="flex flex-col gap-2 pt-1">
                {profile.notes.map((n, i) => (
                  <li key={`${n.at}-${i}`} className="text-label leading-relaxed text-ink-2">
                    <span className="num mr-2 text-meta text-ink-3">{shortDate(n.at)}</span>
                    {n.text}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No notes</Empty>
            ),
          )}
      </div>

      {variant !== "compact" && (
        <p className="flex flex-wrap items-center gap-x-2 border-t border-line px-5 py-3.5 text-meta text-ink-3">
          {customer.marketing_opt_in && customer.marketing_opt_in_at ? `Opted in ${shortDate(customer.marketing_opt_in_at)} · ` : ""}
          Seen {relativeTime(customer.last_seen_at, state.now)}
        </p>
      )}

      {change && variant === "panel" && (
        <div className="border-t border-line px-5 py-3.5">
          <button
            type="button"
            aria-expanded={showPatch}
            aria-controls={patchId}
            onClick={() => setShowPatch((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md text-left text-label font-medium text-ink-2 hover:text-ink"
          >
            <span>Extraction patch for message {change.turn + 1}</span>
            <ChevronDown className={cx("size-4 transition-transform duration-200", showPatch && "rotate-180")} aria-hidden />
          </button>
          {showPatch && (
            <div id={patchId} className="mt-3 flex flex-col gap-2.5">
              <p className="text-meta text-ink-3">
                The JSON shape <code className="font-mono">profile_extractor.py</code> returns after a turn. Here it is scripted; the merge rules
                are the backend&apos;s.
              </p>
              <pre className="scroll-thin max-h-56 overflow-auto rounded-[10px] bg-ink p-3.5 font-mono text-meta leading-relaxed text-paper">
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

export function Consent({ optedIn, className }: { optedIn: boolean; className?: string }) {
  return optedIn ? (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-sage-soft px-2.5 text-meta font-medium text-sage", className)}>
      <ShieldCheck className="size-3.5" aria-hidden /> Opted in
    </span>
  ) : (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-rose-soft px-2.5 text-meta font-medium text-rose", className)}>
      <ShieldOff className="size-3.5" aria-hidden /> No consent
    </span>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-label text-ink-3">{children}</span>
}

function FieldBlock({
  field,
  kind,
  label,
  change,
  source,
  active,
  onSource,
  className,
  children,
}: {
  field: ProfileField
  kind: FactKind
  label: string
  change?: FieldChange
  source?: TurnRecord
  active: boolean
  onSource?: Props["onSource"]
  className?: string
  children: ReactNode
}) {
  const evidence = source?.changes.find((c) => c.field === field)?.evidence ?? change?.evidence
  const canTrace = Boolean(onSource && source)
  return (
    <div
      data-field={field}
      data-changed={change ? "true" : undefined}
      style={{ "--glow": GLOW[kind] } as CSSProperties}
      className={cx(
        "relative rounded-[12px] px-3 py-2.5 transition-colors duration-300",
        change && "glow-in bg-surface-2",
        active && "bg-paper-2/80",
        className,
      )}
    >
      {change && <span aria-hidden className={cx("absolute inset-y-2 left-0 w-[3px] rounded-r", FACT_TONE[kind].dot)} />}
      <div className="flex items-center gap-2">
        {kind !== "context" && <FactDot kind={kind} />}
        <p className="type-label">
          {label}
          {change && <span className="sr-only"> (updated)</span>}
        </p>
      </div>
      <div className="mt-1 text-ui text-ink">{children}</div>
      {evidence && canTrace && (change || active) && (
        <button
          type="button"
          onClick={() => onSource!(field, source!.message.id)}
          className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-md text-left text-label leading-snug text-ink-2 hover:text-ink"
        >
          <Quote className={cx("mt-0.5 size-3.5 shrink-0", FACT_TONE[kind].text)} aria-hidden />
          <span>“{evidence}”</span>
          <span className="sr-only"> (show in conversation)</span>
        </button>
      )}
      {evidence && canTrace && !change && !active && (
        <button
          type="button"
          onClick={() => onSource!(field, source!.message.id)}
          className="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-full px-2 text-micro font-medium text-ink-3 hover:bg-paper-2 hover:text-ink"
          aria-label={`Show where ${label.toLowerCase()} came from: “${evidence}”`}
        >
          <Quote className="size-3" aria-hidden /> msg {source!.turn + 1}
        </button>
      )}
    </div>
  )
}
