import { useEffect, useState } from "react"
import {
  createBusinessChat,
  getCustomer,
  getCustomerProfile,
  updateCustomer,
  type Avatar,
  type ChatSession,
  type Customer,
  type CustomerProfile,
} from "@/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { User } from "lucide-react"
import { toast } from "sonner"
import { SlideInRight, FadeIn } from "@/components/Animated"

interface Props {
  businessId: number
  customerId: number
  avatars: Avatar[]
  onChatCreated: (chat: ChatSession) => void
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : []
  } catch {
    return []
  }
}

export default function CustomerDetailPage({ businessId, customerId, avatars, onChatCreated }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatDialogOpen, setChatDialogOpen] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([getCustomer(businessId, customerId), getCustomerProfile(businessId, customerId)])
      setCustomer(c)
      setProfile(p)
    } catch (e) {
      toast.error("Failed to load customer: " + String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, customerId])

  async function patchCustomer(patch: Partial<Customer>) {
    if (!customer) return
    try {
      const updated = await updateCustomer(businessId, customer.id, patch)
      setCustomer(updated)
      toast.success("Customer updated")
    } catch (e) {
      toast.error(String(e))
    }
  }

  async function startChatWithAvatar(avatarId: number) {
    if (!customer) return
    try {
      const chat = await createBusinessChat(businessId, avatarId, customer.id)
      onChatCreated(chat)
      setChatDialogOpen(false)
      toast.success("Chat created")
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading customer...</p>
      </Card>
    )
  }

  if (!customer || !profile) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <User className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to load customer details.</p>
      </Card>
    )
  }

  const interests = parseJsonArray(profile.interests_json)
  const objections = parseJsonArray(profile.objections_json)

  return (
    <SlideInRight className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-4 text-lg font-semibold">Customer Detail</h3>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Name" value={customer.name} />
          <Field label="External ID" value={customer.external_id} />
          <Field label="Phone" value={customer.phone} />
          <Field label="Email" value={customer.email} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={customer.marketing_opt_in}
              onChange={(e) => patchCustomer({ marketing_opt_in: e.target.checked })}
              className="rounded"
            />
            Marketing opt-in
          </label>
          <select
            className="rounded-lg border bg-background px-3 py-1.5 text-sm"
            value={customer.preferred_channel || ""}
            onChange={(e) => patchCustomer({ preferred_channel: e.target.value || null })}
          >
            <option value="">Select channel</option>
            <option value="web">web</option>
            <option value="telegram">telegram</option>
            <option value="whatsapp">whatsapp</option>
            <option value="email">email</option>
            <option value="sms">sms</option>
          </select>
          <Button size="sm" onClick={() => setChatDialogOpen(true)}>
            Start chat
          </Button>
        </div>
      </Card>

      <FadeIn>
      <Card className="p-5">
        <h3 className="mb-4 text-lg font-semibold">Profile</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{profile.lead_stage}</Badge>
          <Badge variant="outline">Score: {profile.lead_score}</Badge>
          {profile.tone && <Badge variant="outline">Tone: {profile.tone}</Badge>}
          {profile.language && <Badge variant="outline">Lang: {profile.language}</Badge>}
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field
            label="Budget"
            value={
              profile.budget_min != null || profile.budget_max != null
                ? `${profile.budget_min ?? "?"} – ${profile.budget_max ?? "?"}`
                : null
            }
          />
          <Field label="Location" value={profile.location} />
        </div>

        {interests.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Interests</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {interests.map((i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {i}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {objections.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Objections</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {objections.map((o) => (
                <Badge key={o} variant="outline" className="text-xs font-normal">
                  {o}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.notes && (
          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</span>
            <p className="mt-1 text-sm text-muted-foreground">{profile.notes}</p>
          </div>
        )}
      </Card>
      </FadeIn>

      <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select avatar to start chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {avatars.map((a) => (
              <Button key={a.id} variant="outline" className="w-full justify-start" onClick={() => startChatWithAvatar(a.id)}>
                {a.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </SlideInRight>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value || "—"}</span>
    </div>
  )
}
