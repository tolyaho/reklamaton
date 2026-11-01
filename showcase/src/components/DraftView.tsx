import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Check, Copy, RefreshCw, Send } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { channelLimit } from "@/demo/compose"
import { useDemo } from "@/demo/context"
import { approvalBlock } from "@/demo/engine"
import { draftFacts, kindOf } from "@/demo/facts"
import type { OutboundMessage } from "@/demo/types"
import { CHANNEL_LABEL, LANGUAGE_LABEL, clockTime, relativeTime } from "@/lib/format"
import { FACT_TONE } from "@/lib/factTone"
import { STATUS_META } from "@/lib/status"
import { cx } from "@/lib/styles"
import { FactText } from "./facts"
import { Avatar, Badge, Button, StageBadge } from "./ui"

/**
 * One outbound message: the draft text with the sentences each profile field produced marked in
 * that field's colour, the fields it used, and the approval controls with the backend's rules.
 */
export function DraftView({ message, onApproved, size = "md" }: { message: OutboundMessage; onApproved?: () => void; size?: "md" | "lg" }) {
  const { state, dispatch } = useDemo()
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [explained, setExplained] = useState<{ label: string; effect: string } | null>(null)
  const customer = state.customers.find((c) => c.id === message.customer_id)!
  const profile = state.profiles[customer.id]
  const status = STATUS_META[message.status]
  const limit = channelLimit(message.channel)
  const stale = message.status === "draft" && profile.updated_at > message.created_at
  const block = message.status === "draft" ? approvalBlock(state, message) : null
  const isInes = customer.id === 1 && message.campaign_id === 1
  const facts = draftFacts(message)

  const approve = () => {
    const r = dispatch({ type: "approve", messageId: message.id })
    if (r.ok) {
      setError(null)
      toast.success(`Approved for ${customer.name.split(" ")[0]}`, { description: "Ready for export. Nothing has been sent." })
      onApproved?.()
    } else setError(r.error)
  }
  const markSent = () => {
    const r = dispatch({ type: "markSent", messageId: message.id })
    if (r.ok) toast("Marked as sent", { description: "Bookkeeping only: Reklamaton did not deliver anything." })
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
        "relative flex flex-col overflow-hidden rounded-[16px] border bg-surface transition-[border-color,box-shadow] duration-500",
        message.status === "approved"
          ? "border-sage/45 shadow-[0_0_0_4px_rgb(54_107_78/0.08)]"
          : message.status === "sent"
            ? "border-indigo/30"
            : "border-line",
      )}
      data-tour={isInes ? "draft-ines" : undefined}
      data-testid={`draft-${customer.id}`}
      aria-label={`${status.label} message for ${customer.name}`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-line/80 px-5 py-4">
        <Avatar id={customer.id} name={customer.name} size={38} />
        <div className="min-w-0 flex-1 basis-44">
          <Link to={`/app/customers/${customer.id}`} className="text-heading font-semibold text-ink hover:underline">
            {customer.name}
          </Link>
          <p className="truncate text-label text-ink-3">
            {CHANNEL_LABEL[message.channel]} · {message.channel === "email" ? customer.email : customer.phone}
          </p>
        </div>
        <StageBadge stage={profile.lead_stage} />
        {message.language !== "en" && <Badge tone="indigo">{LANGUAGE_LABEL[message.language] ?? message.language}</Badge>}
        <span className="inline-flex" data-testid="draft-status">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={message.status}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
            >
              <Badge tone={status.tone}>
                <status.icon className="size-3" aria-hidden /> {status.label}
              </Badge>
            </motion.span>
          </AnimatePresence>
        </span>
      </header>

      <div className={cx(size === "lg" ? "px-5 py-6 sm:px-7" : "px-5 py-5")}>
        <p className={cx("max-w-[68ch] whitespace-pre-wrap text-ink", size === "lg" ? "text-body leading-[1.75]" : "text-ui leading-[1.7]")} data-testid="draft-content">
          <FactText text={message.content} facts={facts} active={focus} />
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-paper-2">
            <div
              className={cx("h-full rounded-full", message.content.length > limit * 0.92 ? "bg-amber" : "bg-ink-3/50")}
              style={{ width: `${Math.min(100, (message.content.length / limit) * 100)}%` }}
            />
          </div>
          <span className="num text-meta text-ink-3">
            {message.content.length} / {limit} characters
          </span>
        </div>
      </div>

      {/* The profile fields the draft used. Pointing at one marks the sentence it wrote and says how. */}
      <div className="border-t border-line/80 bg-surface-2/70 px-5 py-4">
        <p className="type-label">Written from {customer.name.split(" ")[0]}&apos;s profile</p>
        <ul className="mt-2.5 flex flex-wrap gap-2" data-testid="draft-factors">
          {message.factors.map((f) => {
            const kind = kindOf(f.field)
            const marked = facts.some((x) => x.field === f.field)
            const show = () => {
              setFocus(marked ? f.field : null)
              setExplained({ label: f.label, effect: f.effect })
            }
            const hide = () => {
              setFocus(null)
              setExplained(null)
            }
            return (
              <li key={f.label}>
                <button
                  type="button"
                  onMouseEnter={show}
                  onMouseLeave={hide}
                  onFocus={show}
                  onBlur={hide}
                  className={cx(
                    "inline-flex h-8 items-center gap-2 rounded-full border bg-surface px-3 text-meta font-medium text-ink transition-colors hover:bg-paper-2",
                    marked ? FACT_TONE[kind].border : "border-line text-ink-2",
                  )}
                >
                  <span aria-hidden className={cx("size-2 shrink-0 rounded-full", FACT_TONE[kind].dot)} />
                  {f.label}
                  <span className="sr-only">: {f.effect}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-2.5 min-h-5 text-meta text-ink-3" aria-hidden>
          {explained ? (
            <>
              <span className="font-medium text-ink-2">{explained.label}:</span> {explained.effect}
            </>
          ) : (
            "Point at a field to see the sentence it wrote."
          )}
        </p>
      </div>

      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber/20 bg-amber-soft/60 px-5 py-2.5 text-label text-amber">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-4" aria-hidden /> Profile changed since this draft was written.
          </span>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "regenerateDraft", messageId: message.id })}>
            <RefreshCw aria-hidden /> Rewrite draft
          </Button>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-line/80 px-5 py-4">
        {message.status === "draft" && (
          <Button
            variant="success"
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
            <span className="text-meta text-ink-3">Approved {message.approved_at ? clockTime(message.approved_at) : ""} · ready for export</span>
          </>
        )}
        {message.status === "sent" && (
          <span className="text-meta text-ink-3">
            Marked as sent {message.sent_at ? relativeTime(message.sent_at, state.now) : ""}. No message was delivered by Reklamaton.
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={copy} className="ml-auto" aria-label={`Copy message for ${customer.name}`}>
          <Copy aria-hidden /> Copy
        </Button>
        {(error || block) && message.status === "draft" && (
          <p
            id={`block-${message.id}`}
            role={error ? "alert" : undefined}
            className="flex w-full items-start gap-2 rounded-[10px] border border-rose/15 bg-rose-soft/60 px-3.5 py-3 text-label leading-snug text-rose"
            data-testid={`block-${customer.id}`}
          >
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
