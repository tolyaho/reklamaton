// Deterministic draft composer for the static demo.
//
// In the real app each draft is one Responses API call (`ad_gen.generate_ad_message`) whose prompt
// contains the business, the offer and the customer's structured profile. The public demo cannot
// call a model, so this composer assembles fixed sentence templates from the same structured fields.
// It never reads free-text notes, and it reports which field produced which sentence ("factors").

import { offerTranslations } from "./data"
import type { Business, Campaign, Channel, Customer, CustomerProfile, DraftFactor, Persona, Product } from "./types"

/** Port of `ad_gen._channel_limit`. */
export function channelLimit(channel: Channel): number {
  return ({ sms: 160, telegram: 400, whatsapp: 400 } as Partial<Record<Channel, number>>)[channel] ?? 500
}

/** Port of the truncation in `ad_gen.generate_ad_message`: cut at a word boundary and add an ellipsis. */
export function fitToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > Math.floor(limit / 2) ? cut.slice(0, lastSpace) : cut) + "…"
}

/** Port of `ad_gen.draft_language`: the customer's detected language, else the offer's language. */
export function draftLanguage(campaign: Campaign, profile: CustomerProfile): string {
  if (profile.language) return profile.language.toLowerCase()
  return /[\u0400-\u04ff]/.test(campaign.offer_text) ? "ru" : "en"
}

function productPrice(product: Product): number | null {
  const m = product.price.replace(/,/g, "").match(/€(\d+)/)
  return m ? Number(m[1]) : null
}

/** The catalog product the offer is about: the first product whose name appears in the offer text. */
export function offerProduct(business: Business, campaign: Campaign): Product | undefined {
  const norm = (t: string) => t.toLowerCase().replace(/-/g, " ")
  const offer = norm(campaign.offer_text)
  return business.products.find((p) => offer.includes(norm(p.name)))
}

const INTEREST_PHRASES: Record<string, { en: string; de: string }> = {
  packaging: { en: "your packaging", de: "Ihrer Verpackung" },
  labels: { en: "your new labels", de: "Ihren neuen Etiketten" },
  "pastry boxes": { en: "your new pastry boxes", de: "Ihren neuen Gebäckschachteln" },
  "gift boxes": { en: "your gift boxes", de: "Ihren Geschenkboxen" },
  "coffee bags": { en: "your coffee bags", de: "Ihren Kaffeebeuteln" },
}

const PACKAGING_KINDS: Record<string, string> = {
  "pastry boxes": "packaging",
  "gift boxes": "packaging",
  "coffee bags": "packaging",
}

const OBJECTION_ANSWERS: { match: RegExp; field: string; en: string; de: string }[] = [
  { match: /timeline|month|deadline|late/i, field: "timeline",
    en: "Review dates and the print date are fixed at kick-off, so the timeline is agreed before we start.",
    de: "Prüftermine und Drucktermin legen wir beim Kick-off fest, der Zeitplan steht also vor dem Start." },
  { match: /compar|quote/i, field: "comparing quotes",
    en: "I can send a line-by-line scope so you can compare quotes like for like.",
    de: "Gern schicke ich Ihnen den Leistungsumfang Punkt für Punkt, damit Sie Angebote direkt vergleichen können." },
  { match: /price|expensive/i, field: "price",
    en: "I can also outline a smaller first step if the full scope is more than you planned.",
    de: "Gern skizziere ich auch einen kleineren ersten Schritt." },
  { match: /co-owner|sign-off|partner/i, field: "needs sign-off",
    en: "I can send a one-page summary to share with your co-owner.",
    de: "Gern schicke ich eine einseitige Zusammenfassung für Ihre Mitinhaber." },
  { match: /bag stock|existing/i, field: "existing stock",
    en: "The labels can be fitted to the stock you already have.",
    de: "Die Etiketten passen wir an Ihren vorhandenen Bestand an." },
  { match: /minimum order/i, field: "minimum orders",
    en: "We check minimum order quantities with two printers before you commit to a design.",
    de: "Mindestmengen klären wir vorab mit zwei Druckereien." },
  { match: /edit the site/i, field: "self-editing",
    en: "The site is built on a template you can edit yourself.",
    de: "Die Website basiert auf einer Vorlage, die Sie selbst bearbeiten können." },
]

const eur = (n: number, lang: "en" | "de") =>
  lang === "de" ? `${n.toLocaleString("de-DE")} €` : `€${n.toLocaleString("en-GB")}`

export interface ComposedDraft {
  content: string
  language: string
  factors: DraftFactor[]
}

export function composeDraft(
  business: Business,
  campaign: Campaign,
  customer: Customer,
  profile: CustomerProfile,
  persona: Persona,
): ComposedDraft {
  const requested = draftLanguage(campaign, profile)
  const lang: "en" | "de" = requested === "de" ? "de" : "en"
  const factors: DraftFactor[] = []
  const first = customer.name.split(" ")[0]
  const tone = profile.tone ?? "friendly"

  // Greeting: tone preference.
  const greeting =
    lang === "de"
      ? tone === "formal" ? `Guten Tag ${customer.name},` : `Hallo ${first},`
      : tone === "formal" ? `Hello ${customer.name},` : tone === "short" ? `${first},` : `Hi ${first},`
  factors.push({
    field: "tone",
    label: `Tone · ${profile.tone ?? "not detected"}`,
    effect: profile.tone ? `Opens with “${greeting}”` : "Defaults to a friendly greeting",
    text: greeting,
  })
  if (requested !== "en") {
    factors.push({
      field: "language",
      label: `Language · ${requested}`,
      effect: lang === "de" ? "Written in German" : `No ${requested} template in the demo composer, so English`,
    })
  }

  const sentences: string[] = []

  // Hook: the most specific interest the campaign targets.
  // A packaging sub-interest ("pastry boxes") is preferred to the generic "packaging" when the
  // customer asked about packaging and the campaign targets it.
  const targets = campaign.segment.interests_any
  const candidates = profile.interests.filter((i) => targets.includes(i) || targets.includes(PACKAGING_KINDS[i]))
  const topic =
    (profile.interests.includes("packaging") ? candidates.find((i) => PACKAGING_KINDS[i]) : undefined) ??
    candidates.find((i) => i !== "packaging" && !PACKAGING_KINDS[i]) ??
    candidates[0] ??
    profile.interests[0]
  if (topic) {
    const phrase = INTEREST_PHRASES[topic]?.[lang] ?? (lang === "de" ? `Ihrem Projekt (${topic})` : topic)
    const hook =
      lang === "de"
        ? profile.lead_stage === "proposal"
          ? `ich melde mich noch einmal zu ${phrase}.`
          : `Sie hatten nach ${phrase} gefragt, daher eine kurze Nachricht.`
        : profile.lead_stage === "proposal"
          ? `Following up on ${phrase}.`
          : `A quick note since you asked about ${phrase.replace(/^your /, "")}.`
    sentences.push(hook)
    factors.push({ field: "interests", label: `Interest · ${topic}`, effect: "Opening line refers to it", text: hook })
  }

  // Offer, verbatim (or its fixed translation).
  sentences.push(lang === "de" ? offerTranslations[campaign.id]?.de ?? campaign.offer_text : campaign.offer_text)

  // Budget fit against the catalog price of the offered product.
  const product = offerProduct(business, campaign)
  const price = product ? productPrice(product) : null
  if (product && price != null && profile.budget_max != null) {
    if (profile.budget_max >= price) {
      const fit = lang === "de" ? `Mit ${eur(price, "de")} passt das in Ihr Budget.` : `At ${eur(price, "en")}, it fits the budget you mentioned.`
      sentences.push(fit)
      factors.push({
        field: "budget",
        label: `Budget · up to ${eur(profile.budget_max, "en")}`,
        effect: `Says the ${eur(price, "en")} ${product.name.toLowerCase()} fits`,
        text: fit,
      })
    } else {
      const smaller = business.products
        .filter((p) => p !== product && (productPrice(p) ?? Infinity) <= profile.budget_max!)
        .find((p) => p.name === "Label refresh" && profile.interests.includes("labels"))
      if (smaller) {
        const alt =
          lang === "de"
            ? `Falls das mehr ist als geplant: Der Label-Refresh (${eur(productPrice(smaller)!, "de")}) ist die kleinere Option.`
            : `If that is more than you planned, the label refresh (${eur(productPrice(smaller)!, "en")}) is the smaller option.`
        sentences.push(alt)
        factors.push({
          field: "budget",
          label: `Budget · up to ${eur(profile.budget_max, "en")}`,
          effect: "Below the offer price, so it points to the label refresh",
          text: alt,
        })
      }
    }
  }

  // Objection: answer the first one the composer has a catalog-backed answer for.
  for (const objection of profile.objections) {
    const answer = OBJECTION_ANSWERS.find((a) => a.match.test(objection))
    if (answer) {
      sentences.push(answer[lang])
      factors.push({ field: "objections", label: `Objection · ${answer.field}`, effect: "Answered before the ask", text: answer[lang] })
      break
    }
  }

  // Call to action: stage and tone.
  const audit = /audit/i.test(campaign.offer_text)
  let cta: string
  if (profile.lead_stage === "proposal") {
    cta = lang === "de" ? "Soll ich einen der Plätze für Sie reservieren?" : "Shall I hold one of the slots while we set up a call?"
  } else if (tone === "short") {
    cta = lang === "de" ? "Kurze Antwort genügt, dann schicke ich zwei Termine." : "Reply YES and I'll send two call times."
  } else {
    cta =
      lang === "de"
        ? audit ? "Hätten Sie diese Woche Zeit für das kostenlose Audit?" : "Darf ich Ihnen zwei Termine für ein kurzes Gespräch vorschlagen?"
        : audit ? "Would you like to book the free audit this week?" : "Would a short call this week be useful?"
  }
  sentences.push(cta)
  factors.push({
    field: "lead_stage",
    label: `Stage · ${profile.lead_stage}`,
    effect: profile.lead_stage === "proposal" ? "Asks to hold a slot" : tone === "short" ? "One-word reply ask" : "Invites a first call",
    text: cta,
  })

  // Sign-off by channel.
  const signer = `${persona.name}, ${business.name}`
  const signOff =
    campaign.channel === "email"
      ? lang === "de" ? `\n\nMit freundlichen Grüßen\n${signer}` : tone === "formal" ? `\n\nKind regards,\n${signer}` : `\n\nBest,\n${signer}`
      : campaign.channel === "sms" ? "" : `\n${persona.name}`
  factors.push({ field: "channel", label: `Channel · ${campaign.channel}`, effect: `${channelLimit(campaign.channel)}-character limit` })

  const body = sentences.join(" ")
  const content = fitToLimit(`${greeting}\n\n${body}${signOff}`, channelLimit(campaign.channel))
  return { content, language: lang, factors }
}
