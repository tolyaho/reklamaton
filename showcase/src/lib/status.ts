import { CheckCheck, FileText, Send } from "lucide-react"
import type { OutboundStatus } from "@/demo/types"

export const STATUS_META: Record<OutboundStatus, { label: string; tone: "neutral" | "sage" | "indigo"; icon: typeof FileText }> = {
  draft: { label: "Draft", tone: "neutral", icon: FileText },
  approved: { label: "Approved", tone: "sage", icon: CheckCheck },
  sent: { label: "Marked as sent", tone: "indigo", icon: Send },
}
