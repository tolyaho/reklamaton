import { useEffect, useState } from "react"
import { getBusiness, updateBusiness, type Business } from "@/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { FadeIn } from "@/components/Animated"

const STARTER_PRODUCTS_JSON = `{
  "catalog": [
    {"name":"...", "price_from":0, "price_to":0, "features":["..."] }
  ],
  "faq": [
    {"q":"...", "a":"..."}
  ],
  "rules": {"delivery":"...", "payment":"...", "refunds":"..."}
}`

interface Props {
  businessId: number
  onUpdated?: (business: Business) => void
}

export default function BusinessSettingsPage({ businessId, onUpdated }: Props) {
  const [form, setForm] = useState({
    name: "",
    brand_voice: "",
    products_json: STARTER_PRODUCTS_JSON,
    timezone: "Europe/Moscow",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    getBusiness(businessId)
      .then((business) => {
        if (!active) return
        setForm({
          name: business.name,
          brand_voice: business.brand_voice,
          products_json: business.products_json?.trim() ? business.products_json : STARTER_PRODUCTS_JSON,
          timezone: business.timezone,
        })
      })
      .catch((e) => toast.error("Failed to load settings: " + String(e)))
      .finally(() => setLoading(false))
    return () => {
      active = false
    }
  }, [businessId])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateBusiness(businessId, form)
      onUpdated?.(updated)
      toast.success("Settings saved")
    } catch (e) {
      toast.error("Failed to save: " + String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <h2 className="mb-5 text-xl font-semibold">Business Settings</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <FadeIn className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Business name</label>
            <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Brand voice</label>
            <Textarea
              rows={5}
              value={form.brand_voice}
              onChange={(e) => setForm((s) => ({ ...s, brand_voice: e.target.value }))}
              placeholder="Describe the personality and tone of your brand..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Products JSON</label>
            <Textarea
              rows={10}
              className="font-mono text-xs"
              value={form.products_json}
              onChange={(e) => setForm((s) => ({ ...s, products_json: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Timezone</label>
            <Input value={form.timezone} onChange={(e) => setForm((s) => ({ ...s, timezone: e.target.value }))} />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </FadeIn>
      )}
    </Card>
  )
}
