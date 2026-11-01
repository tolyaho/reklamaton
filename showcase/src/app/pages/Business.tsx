import { Braces, Clock3, Globe2, MessageCircle, PenLine, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageFade } from "@/app/AppShell"
import { PromptView } from "@/components/PromptView"
import { Sheet } from "@/components/Sheet"
import { PageHeader } from "@/app/PageHeader"
import { Button, Panel, PersonaMark, Provenance } from "@/components/ui"
import { cx } from "@/lib/styles"
import { useDemo } from "@/demo/context"
import { buildAvatarPrompt, buildSalesPrompt } from "@/demo/prompt"
import { CHANNEL_LABEL } from "@/lib/format"

export function Business() {
  const { state } = useDemo()
  const b = state.business
  const [editOpen, setEditOpen] = useState(false)
  const [editKey, setEditKey] = useState(0)
  const [json, setJson] = useState(false)
  const [personaPrompt, setPersonaPrompt] = useState<number | null>(null)

  return (
    <PageFade>
      <PageHeader
        title="Business"
        meta="The context every chat reply and every draft is written from"
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditKey((k) => k + 1)
              setEditOpen(true)
            }}
            data-testid="edit-business"
          >
            <PenLine aria-hidden /> Business settings
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 lg:mt-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] xl:gap-8">
        <div className="flex flex-col gap-6 xl:gap-8">
          <section className="surface overflow-hidden">
            <div className="p-6 sm:p-7">
              <p className="eyebrow">Business profile</p>
              <h2 className="type-title mt-2 text-ink">{b.name}</h2>
              <p className="mt-1.5 max-w-prose text-ui text-ink-2">{b.tagline}</p>
              <dl className="mt-5 flex flex-col gap-2.5 text-label sm:flex-row sm:flex-wrap sm:gap-x-8">
                <div className="flex items-center gap-2 text-ink-2">
                  <Clock3 className="size-4 text-ink-3" aria-hidden />
                  <dt className="sr-only">Timezone</dt>
                  <dd>{b.timezone}</dd>
                </div>
                <div className="flex items-center gap-2 text-ink-2">
                  <Globe2 className="size-4 text-ink-3" aria-hidden />
                  <dt className="sr-only">Channels</dt>
                  <dd>{b.channels.map((c) => CHANNEL_LABEL[c]).join(" · ")}</dd>
                </div>
              </dl>
            </div>
            <div className="border-t border-line bg-surface-2/80 p-6 sm:p-7">
              <p className="eyebrow">Brand voice</p>
              <blockquote className="mt-3 max-w-prose border-l-2 border-coral pl-4 text-lead text-ink">“{b.brand_voice}”</blockquote>
              <p className="mt-4 text-label text-ink-3">
                Sent with every chat turn (sales prompt) and every draft (copywriter prompt).
              </p>
            </div>
          </section>

          <Panel title="AI personas" description="The character the assistant plays in chats. Each persona becomes its own prompt.">
            <ul className="flex flex-col gap-3">
              {state.personas.map((p) => (
                <li key={p.id} className="rounded-[14px] border border-line bg-surface-2 px-4 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <PersonaMark size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-ui font-semibold text-ink">{p.name} <span className="font-normal text-ink-3">· {p.role}</span></p>
                      <p className="mt-0.5 text-label text-ink-3">{p.personality}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setPersonaPrompt(p.id)}>
                      Prompt
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel
          title="Catalog"
          description="Prices, durations and terms the assistant may quote. Anything not here, it must not promise."
          actions={
            <Button size="sm" variant="secondary" aria-pressed={json} onClick={() => setJson((v) => !v)} data-testid="toggle-products-json">
              <Braces aria-hidden /> {json ? "List" : "products_json"}
            </Button>
          }
        >
          {json ? (
            <pre className="scroll-thin max-h-[560px] overflow-auto rounded-ctl bg-ink p-4 font-mono text-meta leading-relaxed text-paper">
              {JSON.stringify(b.products, null, 2)}
            </pre>
          ) : (
            <ul className="divide-y divide-line">
              {b.products.map((p) => (
                <li key={p.name} className="grid gap-x-8 gap-y-1 py-5 first:pt-1 last:pb-1 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">
                      {p.name} <span className="ml-1.5 text-label font-normal text-ink-3">{p.duration}</span>
                    </p>
                    <p className="mt-1 max-w-prose text-ui text-ink-2">{p.description}</p>
                  </div>
                  <p className={cx("num text-body font-semibold sm:text-right", p.price === "free" ? "text-sage" : "text-ink")}>{p.price}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex items-start gap-2 border-t border-line pt-5 text-label text-ink-3">
            <MessageCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            In the demo chat, Mira quotes “from €3,900, about five weeks” because it is written here.
          </div>
        </Panel>
      </div>

      <BusinessSettings key={editKey} open={editOpen} onOpenChange={setEditOpen} />

      <Sheet
        open={personaPrompt != null}
        onOpenChange={(o) => !o && setPersonaPrompt(null)}
        title="Persona prompt"
        description="Built by the backend's build_avatar_prompt; it comes first in every chat's instructions."
        width="sm:max-w-[600px]"
      >
        {personaPrompt != null && (
          <div className="flex flex-col gap-4 p-6">
            <Provenance kind="backend">TypeScript port of prompter.build_avatar_prompt</Provenance>
            <PromptView text={buildAvatarPrompt(state.personas.find((p) => p.id === personaPrompt)!)} emphasize={["ROLE", "PERSONA"]} />
          </div>
        )}
      </Sheet>
    </PageFade>
  )
}

function BusinessSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, dispatch } = useDemo()
  const [name, setName] = useState(state.business.name)
  const [voice, setVoice] = useState(state.business.brand_voice)
  const ines = state.customers[0]
  const preview = buildSalesPrompt({ ...state.business, name, brand_voice: voice }, ines, state.profiles[ines.id])
  const dirty = name !== state.business.name || voice !== state.business.brand_voice

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Business settings"
      description="Edit the name or voice and watch the prompt the backend would send change. Saved only in this browser."
      width="sm:max-w-[620px]"
      testId="business-settings"
    >
      <form
        className="flex flex-col gap-5 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          dispatch({ type: "updateBusiness", patch: { name: name.trim() || state.business.name, brand_voice: voice.trim() || state.business.brand_voice } })
          toast.success("Business settings saved", { description: "New chats and drafts would use them." })
          onOpenChange(false)
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-label font-medium text-ink">Business name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="h-11 rounded-ctl border border-line-strong bg-surface px-3.5 text-ui focus:border-indigo focus:ring-2 focus:ring-indigo/20 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-label font-medium text-ink">Brand voice</span>
          <textarea
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-ctl border border-line-strong bg-surface px-3.5 py-2.5 text-ui leading-relaxed focus:border-indigo focus:ring-2 focus:ring-indigo/20 focus:outline-none"
            data-testid="brand-voice"
          />
          <span className="text-meta text-ink-3">Same 2,000-character limit the backend now enforces.</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <button type="submit" disabled={!dirty} className="inline-flex h-11 items-center gap-2 rounded-ctl bg-ink px-4.5 text-ui font-medium text-paper transition-colors hover:bg-[#35302a] disabled:opacity-55">
            Save
          </button>
        </div>
        <div className="border-t border-line pt-5">
          <p className="mb-3 inline-flex items-center gap-1.5 text-label font-semibold text-ink">
            <Sparkles className="size-4 text-coral" aria-hidden /> Sales prompt for Ines, live
          </p>
          <PromptView text={preview} emphasize={["BUSINESS CONTEXT"]} />
        </div>
      </form>
    </Sheet>
  )
}
