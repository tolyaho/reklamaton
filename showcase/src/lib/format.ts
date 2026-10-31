import type { Channel, LeadStage, Tone } from "@/demo/types"

/** Times are shown in the business timezone (Europe/Lisbon). */
const TZ = "Europe/Lisbon"

export function relativeTime(iso: string | null, now: string): string {
  if (!iso) return "never"
  const diff = Date.parse(now) - Date.parse(iso)
  const min = Math.round(diff / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? "yesterday" : `${d} days ago`
}

export function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso))
}

export function dayAndTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso))
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso))
}

export const STAGE_META: Record<LeadStage, { label: string; tone: BadgeTone; hint: string }> = {
  new: { label: "New", tone: "neutral", hint: "No buying signal yet" },
  qualified: { label: "Qualified", tone: "indigo", hint: "Asked specific questions" },
  proposal: { label: "Proposal", tone: "amber", hint: "Discussing terms or asked for an offer" },
  won: { label: "Won", tone: "sage", hint: "Said yes" },
  lost: { label: "Lost", tone: "rose", hint: "Declined" },
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  sms: "SMS",
  web: "Web chat",
}

export const TONE_LABEL: Record<Tone, string> = {
  formal: "Formal",
  friendly: "Friendly",
  short: "Short",
  detailed: "Detailed",
}

export const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
  ru: "Russian",
}

export type BadgeTone = "neutral" | "coral" | "indigo" | "sage" | "amber" | "rose"

export function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => /^[A-ZÀ-Ý]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
