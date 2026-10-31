import { DAY_MS } from "./engine"
import type { DemoState, Segment } from "./types"
import { STAGE_META } from "@/lib/format"

/** Customers left after each condition of the segment, in the order the backend checks them. */
export function audienceFunnel(state: DemoState, segment: Segment) {
  const steps: { label: string; ids: number[] }[] = []
  let ids = state.customers.map((c) => c.id)
  steps.push({ label: "All customers", ids })
  ids = ids.filter((id) => state.customers.find((c) => c.id === id)!.marketing_opt_in)
  steps.push({ label: "Opted in to marketing", ids })
  if (segment.lead_stage_in.length) {
    ids = ids.filter((id) => segment.lead_stage_in.includes(state.profiles[id].lead_stage))
    steps.push({ label: `Stage: ${segment.lead_stage_in.map((s) => STAGE_META[s].label.toLowerCase()).join(" or ")}`, ids })
  }
  if (segment.interests_any.length) {
    ids = ids.filter((id) => segment.interests_any.some((i) => state.profiles[id].interests.includes(i)))
    steps.push({ label: `Interested in ${segment.interests_any.join(" or ")}`, ids })
  }
  if (segment.last_seen_older_than_days != null) {
    const cutoff = Date.parse(state.now) - segment.last_seen_older_than_days * DAY_MS
    ids = ids.filter((id) => {
      const seen = state.customers.find((c) => c.id === id)!.last_seen_at
      return !seen || Date.parse(seen) <= cutoff
    })
    steps.push({ label: `Not seen for ${segment.last_seen_older_than_days}+ days`, ids })
  }
  return steps
}
