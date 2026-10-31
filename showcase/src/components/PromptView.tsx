import { cx } from "@/lib/styles"

/** Renders a prompt with its "## SECTION" headings set apart; `emphasize` marks sections built from live data. */
export function PromptView({ text, emphasize = [] }: { text: string; emphasize?: string[] }) {
  const sections: { title: string; lines: string[] }[] = []
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) sections.push({ title: line.slice(3), lines: [] })
    else if (sections.length) sections[sections.length - 1].lines.push(line)
  }
  return (
    <div className="flex flex-col gap-3">
      {sections.map((s, i) => {
        const strong = emphasize.includes(s.title)
        return (
          <section
            key={`${s.title}-${i}`}
            className={cx("rounded-ctl border p-3", strong ? "border-coral/30 bg-coral-soft/40" : "border-line bg-surface-2")}
          >
            <h3 className={cx("font-mono text-[11px] font-semibold tracking-[0.08em]", strong ? "text-coral-ink" : "text-ink-3")}>
              ## {s.title}
            </h3>
            <pre className="mt-1.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-ink-2">
              {s.lines.join("\n").trim()}
            </pre>
          </section>
        )
      })}
    </div>
  )
}
