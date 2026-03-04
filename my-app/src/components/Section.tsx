import { cn } from "@/lib/utils"

interface SectionProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export default function Section({ children, className, id }: SectionProps) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8", className)}>
      {children}
    </section>
  )
}
