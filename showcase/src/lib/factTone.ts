import type { FactKind } from "@/demo/facts"

/** Text colour, dot colour, chip tint and swatch for each kind of customer fact. */
export const FACT_TONE: Record<FactKind, { text: string; dot: string; chip: string; swatch: string; border: string }> = {
  interest: { text: "text-indigo", dot: "bg-indigo", chip: "bg-fact-interest/70 text-[#2f3878]", swatch: "bg-fact-interest", border: "border-indigo/30" },
  budget: { text: "text-coral-ink", dot: "bg-coral", chip: "bg-fact-budget/75 text-coral-ink", swatch: "bg-fact-budget", border: "border-coral/30" },
  concern: { text: "text-amber", dot: "bg-amber", chip: "bg-fact-concern/80 text-amber", swatch: "bg-fact-concern", border: "border-amber/30" },
  intent: { text: "text-sage", dot: "bg-sage", chip: "bg-fact-intent/80 text-sage", swatch: "bg-fact-intent", border: "border-sage/30" },
  context: { text: "text-ink-2", dot: "bg-ink-3", chip: "bg-paper-2 text-ink-2", swatch: "bg-paper-2", border: "border-line-strong" },
}
