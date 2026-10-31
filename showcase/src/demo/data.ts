// Synthetic demo workspace. Every business, person, message and contact detail here is invented.
// Emails use the reserved example.com domain (RFC 2606); phone numbers come from the UK Ofcom
// range 07700 900000–900999, which is set aside for drama and fiction.

import type {
  Business,
  Campaign,
  Chat,
  Customer,
  CustomerProfile,
  Message,
  Persona,
  ScriptTurn,
} from "./types"

/** Fixed start of the demo clock: Monday 26 October 2026, 09:30 in Lisbon (UTC+0 in winter). */
export const DEMO_START = "2026-10-26T09:30:00.000Z"

export function minutesBefore(minutes: number, from = DEMO_START): string {
  return new Date(Date.parse(from) - minutes * 60_000).toISOString()
}
const hours = (h: number) => minutesBefore(h * 60)
const days = (d: number) => minutesBefore(d * 24 * 60)

export const business: Business = {
  id: 1,
  name: "Studio Halden",
  tagline: "Independent brand and packaging studio for food and drink makers (fictional)",
  brand_voice:
    "Warm, plain-spoken and specific. Short sentences and real numbers from the catalog. No hype, no pressure: always offer one clear next step.",
  timezone: "Europe/Lisbon",
  channels: ["email", "whatsapp", "web"],
  products: [
    {
      name: "Packaging system",
      price: "from €3,900",
      duration: "5 weeks",
      description:
        "Boxes, labels and sleeves for up to six products, print-ready files and one press check. Fixed review dates; the print date is agreed at kick-off.",
    },
    {
      name: "Brand identity sprint",
      price: "€4,800",
      duration: "3 weeks",
      description: "Logo, type, colour and a one-page brand guide. Two concept routes, two revision rounds.",
    },
    {
      name: "Label refresh",
      price: "€1,600",
      duration: "2 weeks",
      description: "New labels for an existing range of up to four products. Can be fitted to existing bag or bottle stock.",
    },
    {
      name: "Website launch kit",
      price: "from €6,500",
      duration: "6 weeks",
      description: "A five-page site on a template the client can edit themselves.",
    },
    {
      name: "Design retainer",
      price: "€1,900 / month",
      duration: "3-month minimum",
      description: "Up to three days of design work a month.",
    },
    {
      name: "Packaging audit",
      price: "free",
      duration: "30 minutes",
      description: "Video call reviewing current packaging, with three concrete fixes. Minimum order quantities checked with two printers on request.",
    },
  ],
}

export const personas: Persona[] = [
  {
    id: 1,
    name: "Mira",
    role: "Studio concierge",
    personality: "Calm, specific, asks one question at a time",
    features: "Quotes catalog prices and timelines exactly",
    hobbies: "Print production, type specimens",
    age: 32,
    gender: "female",
  },
  {
    id: 2,
    name: "Ada",
    role: "Project lead",
    personality: "Thorough and structured",
    features: "Explains scope step by step",
    hobbies: "Bookbinding, ceramics",
    age: 41,
    gender: "female",
  },
]

const phone = (n: number) => `+44 7700 900${String(n).padStart(3, "0")}`

type CustomerSeed = Omit<Customer, "external_id" | "email"> & { email?: string | null }

const customerSeeds: CustomerSeed[] = [
  { id: 1, name: "Ines Calder", company: "Calder Bakehouse", phone: phone(101), preferred_channel: "whatsapp",
    marketing_opt_in: true, marketing_opt_in_at: hours(20), last_seen_at: hours(20), created_at: hours(20) },
  { id: 2, name: "Theo Marchetti", company: "Marchetti Coffee Roasters", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(42), last_seen_at: days(3), created_at: days(42) },
  { id: 3, name: "Amara Okafor", company: "Okafor Hot Sauce Co.", phone: phone(103), preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(9), last_seen_at: days(2), created_at: days(9) },
  { id: 4, name: "Lena Brandt", company: "Brandt Naturwein", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(30), last_seen_at: days(6), created_at: days(30) },
  { id: 5, name: "Ruben de Vries", company: "De Vries Kaas", phone: phone(105), preferred_channel: "whatsapp",
    marketing_opt_in: true, marketing_opt_in_at: days(15), last_seen_at: days(4), created_at: days(15) },
  { id: 6, name: "Camille Roux", company: "Roux Chocolaterie", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(60), last_seen_at: days(41), created_at: days(60) },
  { id: 7, name: "Sofía Ibarra", company: "Ibarra Olive Oil", phone: phone(107), preferred_channel: "whatsapp",
    marketing_opt_in: false, marketing_opt_in_at: null, last_seen_at: days(5), created_at: days(12) },
  { id: 8, name: "Jonas Weber", company: "Weber Brauerei", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(80), last_seen_at: days(21), created_at: days(80) },
  { id: 9, name: "Priya Raman", company: "Kumbu Tea", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(2), last_seen_at: null, created_at: days(2) },
  { id: 10, name: "Marta Kowalska", company: "Pierogarnia Kowal", phone: phone(110), preferred_channel: "whatsapp",
    marketing_opt_in: true, marketing_opt_in_at: days(33), last_seen_at: days(19), created_at: days(33) },
  { id: 11, name: "Noor Haddad", company: "Maison Haddad", phone: null, preferred_channel: "email",
    marketing_opt_in: true, marketing_opt_in_at: days(14), last_seen_at: days(1), created_at: days(14) },
  { id: 12, name: "Elliot Shaw", company: "Shaw & Daughters Cider", phone: phone(112), preferred_channel: "web",
    marketing_opt_in: false, marketing_opt_in_at: null, last_seen_at: null, created_at: days(1) },
]

export const customers: Customer[] = customerSeeds.map((c) => {
  const [first, ...rest] = c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(" ")
  return {
    ...c,
    external_id: `web-${1000 + c.id}`,
    email: c.email === undefined ? `${first}.${rest.join("")}@example.com` : c.email,
  }
})

const note = (at: string, text: string) => ({ at, text })

function profile(p: Partial<CustomerProfile> & { customer_id: number; updated_at: string }): CustomerProfile {
  return {
    language: null,
    tone: null,
    interests: [],
    budget_min: null,
    budget_max: null,
    location: null,
    lead_stage: "new",
    lead_score: 0,
    objections: [],
    notes: [],
    ...p,
  }
}

export const profiles: CustomerProfile[] = [
  profile({ customer_id: 1, lead_score: 5, updated_at: hours(20),
    notes: [note(hours(20), "Signed up through the website contact form.")] }),
  profile({ customer_id: 2, language: "en", tone: "short", interests: ["labels", "coffee bags"], budget_min: 1500,
    budget_max: 2500, location: "Bologna", lead_stage: "proposal", lead_score: 61,
    objections: ["wants to keep existing bag stock"], updated_at: days(3),
    notes: [note(days(3), "Three coffees need new labels; 4,000 printed bags left."), note(days(3), "Asked for the label refresh scope.")] }),
  profile({ customer_id: 3, language: "en", tone: "detailed", interests: ["packaging", "brand identity"], budget_min: 4000,
    budget_max: 6000, location: "London", lead_stage: "qualified", lead_score: 48,
    objections: ["comparing quotes from two studios"], updated_at: days(2),
    notes: [note(days(2), "Three hot sauces moving from market stalls into delis.")] }),
  profile({ customer_id: 4, language: "de", tone: "formal", interests: ["labels"], budget_max: 2000, location: "Wien",
    lead_stage: "qualified", lead_score: 44, updated_at: days(6),
    notes: [note(days(6), "Four natural wines need new labels.")] }),
  profile({ customer_id: 5, language: "en", tone: "friendly", interests: ["packaging", "labels", "gift boxes"],
    budget_min: 3000, budget_max: 4500, location: "Utrecht", lead_stage: "qualified", lead_score: 41,
    objections: ["needs sign-off from his co-owner"], updated_at: days(4),
    notes: [note(days(4), "Cheese wheel labels and a holiday gift box.")] }),
  profile({ customer_id: 6, language: "en", tone: "friendly", interests: ["packaging", "gift boxes"], location: "Lyon",
    lead_stage: "qualified", lead_score: 37, objections: ["printer minimum order quantities"], updated_at: days(41),
    notes: [note(days(41), "Christmas gift boxes; printers quoted 5,000-unit minimums.")] }),
  profile({ customer_id: 7, language: "es", tone: "friendly", interests: ["packaging", "labels"], location: "Sevilla",
    lead_stage: "qualified", lead_score: 30, updated_at: days(5),
    notes: [note(days(5), "Three olive oil varieties; asked about labels and boxes.")] }),
  profile({ customer_id: 8, language: "en", tone: "short", interests: ["brand identity", "cans"], budget_min: 4000,
    budget_max: 5000, location: "Leipzig", lead_stage: "won", lead_score: 82, updated_at: days(21),
    notes: [note(days(21), "Signed the brand identity sprint.")] }),
  profile({ customer_id: 9, lead_score: 4, updated_at: days(2),
    notes: [note(days(2), "Joined the newsletter list.")] }),
  profile({ customer_id: 10, language: "en", tone: "short", interests: ["packaging"], location: "Kraków",
    lead_stage: "lost", lead_score: 0, objections: ["price too high"], updated_at: days(19),
    notes: [note(days(19), "Said maybe next year.")] }),
  profile({ customer_id: 11, language: "en", tone: "detailed", interests: ["website"], budget_min: 5000, budget_max: 7000,
    location: "Marseille", lead_stage: "proposal", lead_score: 58, objections: ["wants to edit the site herself"],
    updated_at: days(1), notes: [note(days(1), "New site for a second patisserie.")] }),
  profile({ customer_id: 12, updated_at: days(1) }),
]

/** The signature scenario: Ines's first conversation, played turn by turn in the demo. */
export const inesScript: ScriptTurn[] = [
  {
    customer:
      "Hi! We're opening a second Calder Bakehouse in Porto in March and our pastry boxes look tired. Do you do packaging?",
    reply:
      "Hi Ines, congratulations on the second shop! Yes, packaging is most of what we do. The packaging system covers boxes, labels and sleeves for up to six products, from €3,900 over about five weeks. How many items would need new packaging?",
    patch: {
      language: "en",
      tone: "friendly",
      interests: ["packaging", "pastry boxes"],
      location: "Porto",
      lead_stage: "qualified",
      lead_score_delta: 8,
      notes_append: "Opening a second bakery in Porto in March; current pastry boxes feel dated.",
    },
    evidence: {
      language: "We're opening a second Calder Bakehouse",
      tone: "Hi!",
      interests: "our pastry boxes look tired. Do you do packaging?",
      location: "in Porto",
      lead_stage: "Do you do packaging?",
      lead_score: "Do you do packaging?",
      notes: "opening a second Calder Bakehouse in Porto in March",
    },
  },
  {
    customer: "Four pastry boxes and a couple of labels. Our budget is around €4,000 all in. Is that realistic?",
    reply:
      "It is. Four boxes and two labels fit inside the packaging system at €3,900. Printing is quoted by the printer, and we can get that quote before you commit. Would it help if I outlined the five weeks step by step?",
    patch: {
      interests: ["labels"],
      budget_max: 4000,
      lead_score_delta: 10,
      notes_append: "Needs four pastry boxes and two labels.",
    },
    evidence: {
      interests: "a couple of labels",
      budget: "around €4,000 all in",
      lead_score: "Is that realistic?",
      notes: "Four pastry boxes and a couple of labels",
    },
  },
  {
    customer: "Honestly, our last studio took four months and we nearly missed our opening. We can't risk that again.",
    reply:
      "That's a fair worry. The packaging system is planned at five weeks, every review has a fixed date, and we agree the print date at kick-off. Starting in mid-January would leave you print-ready files by late February. Would a short call this week help you decide?",
    patch: {
      objections: ["timeline: last studio took four months"],
      lead_score_delta: -5,
    },
    evidence: {
      objections: "our last studio took four months",
      lead_score: "We can't risk that again.",
    },
  },
  {
    customer:
      "That helps. Could you email me the packaging plan and a couple of times for a call? Email works better for me than WhatsApp.",
    reply:
      "Of course. I'll email the packaging plan today with two call times: Thursday 10:00 or Friday 15:00, Lisbon time. Talk soon, Ines!",
    patch: {
      lead_stage: "proposal",
      lead_score_delta: 15,
      notes_append: "Asked for the packaging plan and call times by email; prefers email to WhatsApp.",
    },
    evidence: {
      lead_stage: "Could you email me the packaging plan",
      lead_score: "Could you email me the packaging plan and a couple of times for a call?",
      notes: "Email works better for me than WhatsApp.",
    },
  },
]

export const chats: Chat[] = [
  { id: 1, customer_id: 1, persona_id: 1, source_channel: "whatsapp", created_at: hours(20), script: inesScript, played: 0 },
  { id: 2, customer_id: 2, persona_id: 1, source_channel: "email", created_at: days(3), script: [], played: 0 },
  { id: 3, customer_id: 3, persona_id: 2, source_channel: "web", created_at: days(2), script: [], played: 0 },
  { id: 4, customer_id: 4, persona_id: 1, source_channel: "email", created_at: days(6), script: [], played: 0 },
  { id: 5, customer_id: 5, persona_id: 1, source_channel: "whatsapp", created_at: days(4), script: [], played: 0 },
  { id: 6, customer_id: 6, persona_id: 1, source_channel: "web", created_at: days(41), script: [], played: 0 },
  { id: 7, customer_id: 7, persona_id: 1, source_channel: "whatsapp", created_at: days(5), script: [], played: 0 },
  { id: 8, customer_id: 10, persona_id: 1, source_channel: "whatsapp", created_at: days(19), script: [], played: 0 },
]

let messageId = 0
function thread(chat_id: number, startMinutesAgo: number, lines: [Message["role"], string][]): Message[] {
  return lines.map(([role, content], i) => ({
    id: ++messageId,
    chat_id,
    role,
    content,
    created_at: minutesBefore(startMinutesAgo - i * 3),
  }))
}

export const messages: Message[] = [
  ...thread(2, 3 * 24 * 60, [
    ["user", "Need new labels for 3 coffees. Budget 1.5–2.5k. We still have 4,000 printed bags."],
    ["assistant", "Thanks, Theo. The label refresh covers up to four products for €1,600 and takes two weeks, and the labels can be fitted to the bags you already have. Shall I send the scope?"],
    ["user", "Yes. Send it."],
    ["assistant", "Done: the scope is on its way by email."],
  ]),
  ...thread(3, 2 * 24 * 60, [
    ["user", "Hello! We make three hot sauces and we're moving from market stalls into delis, so both the bottles and the brand need work. What's the difference between your identity sprint and the packaging system, and can they be combined? Our budget is €4,000–6,000, and to be transparent I'm also talking to one other studio."],
    ["assistant", "Hello Amara, thank you for the detail. The identity sprint (€4,800, three weeks) sets the logo, type and colours; the packaging system (from €3,900, five weeks) applies them to bottles, labels and boxes. Together they come to €8,700, above your range, so many clients start with the sprint and add packaging later. Would a side-by-side of what each includes help you compare?"],
  ]),
  ...thread(4, 6 * 24 * 60, [
    ["user", "Guten Tag, wir suchen neue Etiketten für vier Naturweine. Unser Budget liegt bei maximal 2.000 Euro. Wie lange dauert so ein Projekt?"],
    ["assistant", "Guten Tag Frau Brandt, vielen Dank für Ihre Anfrage. Unser Label-Refresh umfasst bis zu vier Etiketten für 1.600 € und dauert etwa zwei Wochen. Darf ich Ihnen den Ablauf per E-Mail schicken?"],
    ["user", "Ja, gerne."],
  ]),
  ...thread(5, 4 * 24 * 60, [
    ["user", "Hey! Our cheese wheels need proper labels and a gift box for the holidays. Budget maybe 3 to 4.5k. My brother co-owns the shop, so he has to agree too."],
    ["assistant", "Hi Ruben! Labels plus a gift box fit within the packaging system, from €3,900. I can put together a one-page summary you can share with your brother. Want me to?"],
  ]),
  ...thread(6, 41 * 24 * 60, [
    ["user", "Love your tea tin work! We need gift boxes for Christmas, but printers keep asking for 5,000 units minimum, which is far too many for us."],
    ["assistant", "Thank you, Camille! Minimums depend on the printer and the box style. During the free packaging audit we can check minimum order quantities with two printers before you commit to a design. Would that help?"],
  ]),
  ...thread(7, 5 * 24 * 60, [
    ["user", "Hola, ¿hacéis etiquetas y cajas para aceite de oliva? Tenemos tres variedades."],
    ["assistant", "¡Hola, Sofía! Sí: el sistema de packaging cubre etiquetas y cajas para hasta seis productos, desde 3.900 €. ¿Para cuándo lo necesitaríais?"],
  ]),
  ...thread(8, 19 * 24 * 60, [
    ["user", "How much for pierogi boxes?"],
    ["assistant", "Hi Marta! The packaging system starts at €3,900 for up to six products. Would you like a few options?"],
    ["user", "Too expensive. Maybe next year."],
  ]),
]

export const campaigns: Campaign[] = [
  {
    id: 1,
    name: "January packaging slots",
    objective: "Book discovery calls for the two January packaging-system slots.",
    offer_text:
      "Two packaging-system slots open the week of 11 January, with print-ready files by mid-February. Booking includes a free 30-minute packaging audit.",
    channel: "email",
    segment: {
      marketing_opt_in: true,
      lead_stage_in: ["qualified", "proposal"],
      interests_any: ["packaging", "labels"],
      last_seen_older_than_days: null,
    },
    status: "draft",
    created_at: hours(1),
  },
  {
    id: 2,
    name: "Label refresh, autumn batch",
    objective: "Offer the label refresh to leads who asked about labels.",
    offer_text: "The label refresh covers up to four products for €1,600 in two weeks. Three autumn slots are left.",
    channel: "email",
    segment: {
      marketing_opt_in: true,
      lead_stage_in: ["qualified", "proposal"],
      interests_any: ["labels"],
      last_seen_older_than_days: null,
    },
    status: "active",
    created_at: days(2),
  },
]

/** Fixed translations of each offer, used only by the demo's template composer (a model would translate). */
export const offerTranslations: Record<number, Record<string, string>> = {
  1: {
    de: "Im Januar sind zwei Plätze für unser Verpackungssystem frei; die druckfertigen Dateien liegen bis Mitte Februar vor. Zur Buchung gehört ein kostenloses 30-minütiges Verpackungs-Audit.",
  },
  2: {
    de: "Der Label-Refresh umfasst bis zu vier Produkte für 1.600 € in zwei Wochen. Für den Herbst sind noch drei Plätze frei.",
  },
}

/** Campaign 2's outbox before the demo starts: [customer, created, approved, sent] (hours ago). */
export const campaign2History: { customer_id: number; created: number; approved: number | null; sent: number | null }[] = [
  { customer_id: 2, created: 26, approved: 3, sent: null },
  { customer_id: 4, created: 28, approved: 27, sent: 26 },
  { customer_id: 5, created: 26, approved: null, sent: null },
]
