import { Button } from "@/components/ui/button"
import { Stagger, StaggerItem } from "@/components/Animated"

interface HeroProps {
  isAuthed: boolean
  onPrimaryCta: () => void
  onSecondaryCta?: () => void
}

export default function Hero({ isAuthed, onPrimaryCta, onSecondaryCta }: HeroProps) {
  return (
    <Stagger className="flex flex-col items-center gap-6 pb-8 pt-16 text-center sm:pt-24" stagger={0.08} delay={0.1}>
      <StaggerItem>
        <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          MVP &mdash; Early Access
        </div>
      </StaggerItem>
      <StaggerItem>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          AI Sales Bot for{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            Personalized Outreach
          </span>
        </h1>
      </StaggerItem>
      <StaggerItem>
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Turn conversations into qualified leads. Auto-learn customer preferences, draft compliant outreach messages, and
          export campaigns in minutes.
        </p>
      </StaggerItem>
      <StaggerItem>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button size="lg" onClick={onPrimaryCta}>
            {isAuthed ? "Open Dashboard" : "Sign in to try MVP"}
          </Button>
          {onSecondaryCta && (
            <Button size="lg" variant="outline" onClick={onSecondaryCta}>
              See how it works
            </Button>
          )}
        </div>
      </StaggerItem>
    </Stagger>
  )
}
