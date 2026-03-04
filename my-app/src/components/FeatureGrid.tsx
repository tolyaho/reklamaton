import { Card } from "@/components/ui/card"
import { StaggerInView, StaggerItem } from "@/components/Animated"
import { Brain, MessageSquare, Send, FileSpreadsheet, Users, BarChart3 } from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Customer Preferences Memory",
    description: "Automatically capture tone, language, budget, and objections from every chat interaction.",
  },
  {
    icon: MessageSquare,
    title: "Sales Conversations with CTA",
    description: "Guided qualification chats that naturally steer toward conversion with contextual calls-to-action.",
  },
  {
    icon: Send,
    title: "Campaign Drafts + Outbox Approval",
    description: "Generate personalized messages per customer. No spam — opt-in enforced, human-approved.",
  },
  {
    icon: FileSpreadsheet,
    title: "CSV Export",
    description: "Export approved outbound messages and send via any channel — Telegram, WhatsApp, email, or SMS.",
  },
  {
    icon: Users,
    title: "Multi-Persona Agents",
    description: "Create multiple avatars with unique brand voices and personalities for different segments.",
  },
  {
    icon: BarChart3,
    title: "Analytics-Ready Events",
    description: "Every interaction is logged as a CustomerEvent — ready for dashboards and data analysis.",
  },
]

export default function FeatureGrid() {
  return (
    <StaggerInView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07} delay={0.05}>
      {features.map((f) => (
        <StaggerItem key={f.title}>
          <Card className="flex h-full flex-col gap-3 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.description}</p>
          </Card>
        </StaggerItem>
      ))}
    </StaggerInView>
  )
}
