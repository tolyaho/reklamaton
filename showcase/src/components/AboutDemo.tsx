import { ExternalLink } from "lucide-react"
import { sourceUrl } from "@/lib/links"
import { Provenance, type ProvenanceKind } from "./ui"

const ROWS: { kind: ProvenanceKind; label?: string; title: string; body: string }[] = [
  {
    kind: "synthetic",
    title: "Interactive demo",
    body: "Studio Halden, its 12 customers, the chats and both campaigns are invented. Your clicks change a local state kept in this browser; Reset restores the start.",
  },
  {
    kind: "scripted",
    title: "Scripted conversation",
    body: "Ines's four turns, the persona's replies and the profile patch after each turn are written for the demo. They are not model output. The replay on the landing page plays the same script.",
  },
  {
    kind: "composer",
    title: "Drafts from a template composer",
    body: "Drafts are assembled from the customer's profile fields with fixed sentence templates. In the real app each draft is one OpenAI Responses API call with those fields in the prompt.",
  },
  {
    kind: "backend",
    label: "Ported backend rules",
    title: "Same rules as the backend",
    body: "Profile merging, segment matching, the consent check, one approval per customer per 24 hours, channel character limits and the CSV columns are TypeScript ports of the Python code.",
  },
  {
    kind: "backend",
    label: "Real file",
    title: "Export",
    body: "The CSV is generated in your browser from the messages that are approved right now.",
  },
]

export function AboutDemo() {
  return (
    <div className="flex flex-col gap-6 text-ui leading-relaxed text-ink-2">
      <ul className="flex flex-col gap-4">
        {ROWS.map((r) => (
          <li key={r.title} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{r.title}</span>
              <Provenance kind={r.kind}>{r.label}</Provenance>
            </div>
            <p>{r.body}</p>
          </li>
        ))}
      </ul>
      <div className="rounded-ctl border border-line bg-surface-2 p-4">
        <p className="font-semibold text-ink">Not in Reklamaton at all</p>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
          <li>Sending. There is no SMS, WhatsApp, Telegram or email integration; “Mark as sent” only records that you sent it elsewhere.</li>
          <li>Authentication. The FastAPI backend trusts the user id it is given, so it is meant to run locally, not on the public internet.</li>
          <li>Measured results. The demo shows counts from its own synthetic data, not customers, conversions or time saved.</li>
        </ul>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-label">
        {[
          ["store.py", "reklamaton/store.py"],
          ["profile_extractor.py", "reklamaton/profile_extractor.py"],
          ["ad_gen.py", "reklamaton/ad_gen.py"],
          ["docs/demo.md", "docs/demo.md"],
        ].map(([label, path]) => (
          <a key={path} href={sourceUrl(path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-coral-ink hover:underline">
            {label} <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  )
}
