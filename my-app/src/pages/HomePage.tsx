import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Section from "@/components/Section"
import Stat from "@/components/Stat"
import Hero from "@/components/Hero"
import FeatureGrid from "@/components/FeatureGrid"
import { SectionReveal, StaggerInView, StaggerItem } from "@/components/Animated"
import { Settings, MessageSquare, Rocket } from "lucide-react"

interface Props {
  isAuthed: boolean
  onPrimaryCta: () => void
  onLogin: () => void
}

const steps = [
  {
    icon: Settings,
    step: "1",
    title: "Configure Brand Voice & Offers",
    description: "Set up your business profile, define products, pricing, and brand personality.",
  },
  {
    icon: MessageSquare,
    step: "2",
    title: "Chat with Customers",
    description: "Engage customers through AI-powered conversations that auto-build rich profiles over time.",
  },
  {
    icon: Rocket,
    step: "3",
    title: "Generate & Export Outreach",
    description: "Create personalized campaign drafts, approve them, and export the approved messages as CSV.",
  },
]

export default function HomePage({ isAuthed, onPrimaryCta, onLogin }: Props) {
  function scrollToFeatures() {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="w-full">
      <Section className="py-0 sm:py-0">
        <Hero isAuthed={isAuthed} onPrimaryCta={isAuthed ? onPrimaryCta : onLogin} onSecondaryCta={scrollToFeatures} />
      </Section>

      <Section>
        <SectionReveal>
          <div className="mb-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Built-in guardrails</p>
          </div>
          <StaggerInView className="grid gap-4 sm:grid-cols-3" stagger={0.08}>
            <StaggerItem><Stat value="Opt-in only" label="Drafts are written only for customers who agreed to marketing" /></StaggerItem>
            <StaggerItem><Stat value="1 per 24 h" label="Approved messages per customer, across all campaigns" /></StaggerItem>
            <StaggerItem><Stat value="160 / 400 / 500" label="Character limits for SMS / Telegram and WhatsApp / email and web" /></StaggerItem>
          </StaggerInView>
        </SectionReveal>
      </Section>

      <Section id="features">
        <SectionReveal>
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to close more deals</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              From first chat to an approved campaign message. A person approves every message before it leaves.
            </p>
          </div>
        </SectionReveal>
        <FeatureGrid />
      </Section>

      <Section>
        <SectionReveal>
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-lg text-muted-foreground">Three steps from setup to first campaign.</p>
          </div>
        </SectionReveal>
        <StaggerInView className="grid gap-6 sm:grid-cols-3" stagger={0.1}>
          {steps.map((s) => (
            <StaggerItem key={s.step}>
              <Card className="relative flex h-full flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerInView>
      </Section>

      <Section>
        <SectionReveal>
          <Card className="flex flex-col items-center gap-4 bg-primary/5 px-6 py-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Try it on your own business profile</h2>
            <p className="max-w-lg text-muted-foreground">
              Sign in with Google, describe your business, add customers and set up a campaign. Chat, profile extraction and
              draft generation need an OpenAI API key on the server.
            </p>
            <Button size="lg" onClick={isAuthed ? onPrimaryCta : onLogin}>
              Get started
            </Button>
          </Card>
        </SectionReveal>
      </Section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Reklamaton. Sales Automation MVP.</p>
      </footer>
    </div>
  )
}
