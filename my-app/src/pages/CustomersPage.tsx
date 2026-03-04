import { useEffect, useMemo, useState } from "react"
import { listCustomers, upsertCustomer, type Avatar, type ChatSession, type Customer } from "@/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import EmptyState from "@/components/EmptyState"
import CustomerDetailPage from "./CustomerDetailPage"
import { Search, Users } from "lucide-react"
import { toast } from "sonner"
import { FadeIn } from "@/components/Animated"

interface Props {
  businessId: number
  avatars: Avatar[]
  onChatCreated: (chat: ChatSession) => void
}

const emptyForm = {
  external_id: "",
  name: "",
  phone: "",
  email: "",
  preferred_channel: "web",
  marketing_opt_in: false,
}

export default function CustomersPage({ businessId, avatars, onChatCreated }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState("")

  async function refresh() {
    setLoading(true)
    try {
      const data = await listCustomers(businessId)
      setCustomers(data)
    } catch (e) {
      toast.error("Failed to load customers: " + String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.external_id?.toLowerCase().includes(q),
    )
  }, [customers, search])

  async function handleUpsert() {
    try {
      await upsertCustomer(businessId, {
        ...form,
        external_id: form.external_id || null,
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
      })
      setDialogOpen(false)
      setForm(emptyForm)
      await refresh()
      toast.success("Customer saved")
    } catch (e) {
      toast.error("Failed to save: " + String(e))
    }
  }

  function labelFor(customer: Customer) {
    return customer.name || customer.external_id || `Customer #${customer.id}`
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Customers</h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setDialogOpen(true)}>Add customer</Button>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Loading...</Card>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No customers yet"
            description="Add your first customer to start building profiles and running campaigns."
            actionLabel="Add customer"
            onAction={() => setDialogOpen(true)}
            className="border-0 shadow-none"
          />
        ) : (
          <FadeIn className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Channel</th>
                  <th className="px-3 py-2.5 font-medium">Opt-in</th>
                  <th className="px-3 py-2.5 font-medium">Last seen</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-3 py-2.5 font-medium">{labelFor(c)}</td>
                    <td className="px-3 py-2.5">{c.preferred_channel || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.marketing_opt_in ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.marketing_opt_in ? "opted in" : "opted out"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {c.last_seen_at ? new Date(c.last_seen_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCustomerId(c.id)}>
                          Open
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </FadeIn>
        )}
      </Card>

      {selectedCustomerId && (
        <CustomerDetailPage
          businessId={businessId}
          customerId={selectedCustomerId}
          avatars={avatars}
          onChatCreated={onChatCreated}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add / Upsert Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="External ID (optional)"
              value={form.external_id}
              onChange={(e) => setForm((s) => ({ ...s, external_id: e.target.value }))}
            />
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
            <Input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Preferred channel</label>
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                value={form.preferred_channel}
                onChange={(e) => setForm((s) => ({ ...s, preferred_channel: e.target.value }))}
              >
                <option value="web">web</option>
                <option value="telegram">telegram</option>
                <option value="whatsapp">whatsapp</option>
                <option value="email">email</option>
                <option value="sms">sms</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.marketing_opt_in}
                onChange={(e) => setForm((s) => ({ ...s, marketing_opt_in: e.target.checked }))}
                className="rounded"
              />
              Marketing opt-in
            </label>
            <Button className="w-full" onClick={handleUpsert}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
