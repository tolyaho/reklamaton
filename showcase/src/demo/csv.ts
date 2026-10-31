// CSV export of a campaign's approved messages. Same rows and columns as the backend's
// `GET /outbox/export.csv`: approved messages only, customers who still have marketing consent,
// ordered by id, with spreadsheet formulas neutralised.

import type { DemoState } from "./types"

export const CSV_COLUMNS = [
  "id",
  "campaign_id",
  "customer_id",
  "customer_name",
  "contact",
  "channel",
  "content",
  "status",
  "approved_at",
] as const

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"]

/** Port of `store.csv_safe_cell` (OWASP CSV injection): prefix formula-like cells with a quote. */
export function csvSafeCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value)
  return FORMULA_PREFIXES.some((p) => text.startsWith(p)) ? `'${text}` : text
}

/** RFC 4180 quoting: wrap in quotes when needed and double embedded quotes. */
export function quoteCell(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function exportRows(state: DemoState, campaignId: number) {
  return state.outbox
    .filter((m) => m.campaign_id === campaignId && m.status === "approved")
    .filter((m) => state.customers.find((c) => c.id === m.customer_id)?.marketing_opt_in)
    .sort((a, b) => a.id - b.id)
}

export function contactFor(state: DemoState, customerId: number, channel: string): string {
  const c = state.customers.find((x) => x.id === customerId)
  if (!c) return ""
  return (channel === "email" ? c.email : c.phone) ?? c.email ?? c.phone ?? ""
}

/** UTF-8 CSV text with CRLF line endings (no BOM; `csvBlob` adds one for spreadsheet apps). */
export function buildOutboxCsv(state: DemoState, campaignId: number): string {
  const lines = [CSV_COLUMNS.join(",")]
  for (const m of exportRows(state, campaignId)) {
    const customer = state.customers.find((c) => c.id === m.customer_id)
    const cells = [
      m.id,
      m.campaign_id,
      m.customer_id,
      customer?.name ?? "",
      contactFor(state, m.customer_id, m.channel),
      m.channel,
      m.content,
      m.status,
      m.approved_at ?? "",
    ]
    lines.push(cells.map((v) => quoteCell(csvSafeCell(v))).join(","))
  }
  return lines.join("\r\n") + "\r\n"
}

export function csvFilename(campaignId: number): string {
  return `outbox_campaign_${campaignId}.csv`
}
