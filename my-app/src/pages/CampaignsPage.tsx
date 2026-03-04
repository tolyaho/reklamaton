import { useEffect, useMemo, useState } from "react"
import {
  approveOutbox,
  createCampaign,
  exportOutboxCsvUrl,
  generateDrafts,
  listCampaigns,
  listCustomers,
  listOutbox,
  markSentOutbox,
  type Campaign,
  type Customer,
  type OutboundMessage,
} from "@/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import EmptyState from "@/components/EmptyState"
import { Megaphone, Copy, Download, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/Animated"

const SEGMENT_STARTER = `{
  "marketing_opt_in": true,
  "lead_stage_in": ["qualified","proposal"],
  "interests_any": ["..."],
  "last_seen_older_than_days": 7
}`

interface Props {
  businessId: number
}

export default function CampaignsPage({ businessId }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [outbox, setOutbox] = useState<OutboundMessage[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [form, setForm] = useState({
    name: "",
    objective: "reactivation",
    offer_text: "",
    channel: "telegram",
    segment_json: SEGMENT_STARTER,
  })

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name || c.external_id || `#${c.id}`])),
    [customers],
  )

  async function refreshCampaigns() {
    setLoading(true)
    try {
      const [campaignData, customerData] = await Promise.all([listCampaigns(businessId), listCustomers(businessId)])
      setCampaigns(campaignData)
      setCustomers(customerData)
    } catch (e) {
      toast.error("Failed to load campaigns: " + String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  function validateSegmentJson() {
    try {
      JSON.parse(form.segment_json)
      toast.success("Valid JSON")
    } catch (e) {
      toast.error("Invalid JSON: " + String(e))
    }
  }

  async function createCampaignAction() {
    try {
      JSON.parse(form.segment_json)
    } catch {
      toast.error("Segment JSON is invalid. Fix it before creating.")
      return
    }
    try {
      await createCampaign(businessId, form)
      setForm((s) => ({ ...s, name: "", offer_text: "" }))
      await refreshCampaigns()
      toast.success("Campaign created")
    } catch (e) {
      toast.error("Failed: " + String(e))
    }
  }

  async function loadOutbox(campaignId: number) {
    setSelectedCampaignId(campaignId)
    try {
      const rows = await listOutbox(campaignId)
      setOutbox(rows)
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function generateDraftsAction(campaignId: number) {
    try {
      await generateDrafts(campaignId)
      await loadOutbox(campaignId)
      toast.success("Drafts generated")
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function approveAction(messageId: number) {
    try {
      await approveOutbox(messageId)
      if (selectedCampaignId) await loadOutbox(selectedCampaignId)
      toast.success("Approved")
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function markSentAction(messageId: number) {
    try {
      await markSentOutbox(messageId)
      if (selectedCampaignId) await loadOutbox(selectedCampaignId)
      toast.success("Marked as sent")
    } catch (e) {
      toast.error(String(e))
    }
  }

  function copyAllApproved() {
    const approved = outbox.filter((m) => m.status === "approved")
    if (approved.length === 0) {
      toast("No approved messages to copy")
      return
    }
    const text = approved.map((m) => `[${customerMap.get(m.customer_id) || m.customer_id}]\n${m.content}`).join("\n\n---\n\n")
    navigator.clipboard.writeText(text)
    toast.success(`Copied ${approved.length} message(s)`)
  }

  const filteredOutbox = useMemo(() => {
    if (statusFilter === "all") return outbox
    return outbox.filter((m) => m.status === statusFilter)
  }, [outbox, statusFilter])

  return (
    <div className="space-y-4">
      {/* Create campaign form */}
      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Create Campaign</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Objective</label>
            <Input value={form.objective} onChange={(e) => setForm((s) => ({ ...s, objective: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Offer text</label>
            <Textarea
              rows={3}
              value={form.offer_text}
              onChange={(e) => setForm((s) => ({ ...s, offer_text: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Channel</label>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm((s) => ({ ...s, channel: e.target.value }))}
            >
              <option value="telegram">telegram</option>
              <option value="whatsapp">whatsapp</option>
              <option value="email">email</option>
              <option value="sms">sms</option>
              <option value="web">web</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">Segment JSON</label>
              <Button size="sm" variant="ghost" onClick={validateSegmentJson}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Validate
              </Button>
            </div>
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={form.segment_json}
              onChange={(e) => setForm((s) => ({ ...s, segment_json: e.target.value }))}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={createCampaignAction} disabled={!form.name.trim()}>
          Create Campaign
        </Button>
      </Card>

      {/* Campaign list */}
      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Campaigns</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-10 w-10" />}
            title="No campaigns yet"
            description="Create your first campaign above to start generating outreach drafts."
            className="border-0 shadow-none"
          />
        ) : (
          <FadeIn className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Objective</th>
                  <th className="px-3 py-2.5 font-medium">Channel</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-3 py-2.5 font-medium">{c.name}</td>
                    <td className="px-3 py-2.5">{c.objective}</td>
                    <td className="px-3 py-2.5">{c.channel}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => generateDraftsAction(c.id)}>
                          Generate drafts
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => loadOutbox(c.id)}>
                          View outbox
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FadeIn>
        )}
      </Card>

      {/* Outbox */}
      {selectedCampaignId && (
        <Card className="p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">
              Outbox
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Campaign #{selectedCampaignId}
              </span>
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-lg border bg-background px-3 py-1.5 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
              </select>
              <Button size="sm" variant="outline" onClick={copyAllApproved}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy approved
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(exportOutboxCsvUrl(selectedCampaignId), "_blank")}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
          {filteredOutbox.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {outbox.length === 0 ? "No messages in outbox. Generate drafts first." : "No messages match this filter."}
            </p>
          ) : (
            <FadeIn className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Customer</th>
                    <th className="px-3 py-2.5 font-medium">Channel</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Content</th>
                    <th className="px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutbox.map((m) => (
                    <tr key={m.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="px-3 py-2.5 font-medium">
                        {customerMap.get(m.customer_id) || `#${m.customer_id}`}
                      </td>
                      <td className="px-3 py-2.5">{m.channel}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.status === "approved"
                              ? "bg-blue-100 text-blue-700"
                              : m.status === "sent"
                                ? "bg-green-100 text-green-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="max-w-[400px] px-3 py-2.5">
                        <div className="line-clamp-2 whitespace-pre-wrap">{m.content}</div>
                        <button
                          className="mt-1 text-xs text-primary hover:underline"
                          onClick={() => {
                            navigator.clipboard.writeText(m.content)
                            toast("Copied to clipboard")
                          }}
                        >
                          Copy
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-2">
                          {m.status === "draft" && (
                            <Button size="sm" onClick={() => approveAction(m.id)}>
                              Approve
                            </Button>
                          )}
                          {m.status === "approved" && (
                            <Button size="sm" variant="outline" onClick={() => markSentAction(m.id)}>
                              Mark sent
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeIn>
          )}
        </Card>
      )}
    </div>
  )
}
