import { buildOutboxCsv, csvFilename, exportRows } from "./csv"
import type { DemoState } from "./types"

/** Downloads a campaign's approved messages as the backend's CSV (UTF-8 with a byte-order mark). Returns the row count. */
export function downloadOutboxCsv(state: DemoState, campaignId: number): { count: number; name: string } {
  const csv = buildOutboxCsv(state, campaignId)
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = csvFilename(campaignId)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { count: exportRows(state, campaignId).length, name: csvFilename(campaignId) }
}
