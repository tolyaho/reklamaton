import { Card } from "@/components/ui/card"

interface StatProps {
  value: string
  label: string
  note?: string
}

export default function Stat({ value, label, note }: StatProps) {
  return (
    <Card className="flex flex-col items-center gap-1 px-6 py-6 text-center">
      <span className="text-3xl font-bold tracking-tight">{value}</span>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {note && <span className="text-xs text-muted-foreground/70">{note}</span>}
    </Card>
  )
}
