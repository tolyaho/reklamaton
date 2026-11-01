// Field names and value sets mirror the FastAPI backend (reklamaton/models.py, profile_extractor.py),
// so the demo state reads like rows from its SQLite tables.

export type LeadStage = "new" | "qualified" | "proposal" | "won" | "lost"
export type Tone = "formal" | "friendly" | "short" | "detailed"
export type Channel = "email" | "whatsapp" | "telegram" | "sms" | "web"
export type OutboundStatus = "draft" | "approved" | "sent"

export const LEAD_STAGES: LeadStage[] = ["new", "qualified", "proposal", "won", "lost"]

export interface Product {
  name: string
  price: string
  duration: string
  description: string
}

export interface Business {
  id: number
  name: string
  tagline: string
  brand_voice: string
  products: Product[]
  timezone: string
  channels: Channel[]
}

export interface Persona {
  id: number
  name: string
  role: string
  personality: string
  features: string
  hobbies: string
  age: number
  gender: string
}

export interface Customer {
  id: number
  external_id: string
  name: string
  company: string
  email: string | null
  phone: string | null
  preferred_channel: Channel
  marketing_opt_in: boolean
  marketing_opt_in_at: string | null
  last_seen_at: string | null
  created_at: string
}

export interface NoteLine {
  at: string
  text: string
}

export interface CustomerProfile {
  customer_id: number
  language: string | null
  tone: Tone | null
  interests: string[]
  budget_min: number | null
  budget_max: number | null
  location: string | null
  lead_stage: LeadStage
  lead_score: number
  objections: string[]
  notes: NoteLine[]
  updated_at: string
}

/** The normalised patch `profile_extractor.extract_profile_patch` returns for one chat turn. */
export interface ProfilePatch {
  language?: string
  tone?: Tone
  interests?: string[]
  budget_min?: number
  budget_max?: number
  location?: string
  lead_stage?: LeadStage
  lead_score_delta: number
  objections?: string[]
  notes_append?: string
}

export type ProfileField =
  | "language"
  | "tone"
  | "interests"
  | "budget"
  | "location"
  | "lead_stage"
  | "lead_score"
  | "objections"
  | "notes"

export interface Message {
  id: number
  chat_id: number
  role: "user" | "assistant"
  content: string
  created_at: string
  /** Index of the scripted turn that produced this message, if any. */
  turn?: number
}

export interface ScriptTurn {
  customer: string
  reply: string
  patch: ProfilePatch
  /** For each profile field the patch changes, the words in the customer's message it came from. */
  evidence: Partial<Record<ProfileField, string>>
}

export interface Chat {
  id: number
  customer_id: number
  persona_id: number
  source_channel: Channel
  created_at: string
  /** Scripted turns not yet played. Empty for chats whose history is already complete. */
  script: ScriptTurn[]
  played: number
}

export interface Segment {
  marketing_opt_in: boolean
  lead_stage_in: LeadStage[]
  interests_any: string[]
  last_seen_older_than_days: number | null
}

export interface Campaign {
  id: number
  name: string
  objective: string
  offer_text: string
  channel: Channel
  segment: Segment
  status: "draft" | "active"
  created_at: string
}

export interface DraftFactor {
  field: ProfileField | "name" | "channel"
  label: string
  effect: string
  /** The exact sentence of the draft this field produced, when it produced one. */
  text?: string
}

export interface OutboundMessage {
  id: number
  campaign_id: number
  customer_id: number
  channel: Channel
  content: string
  status: OutboundStatus
  created_at: string
  approved_at: string | null
  sent_at: string | null
  factors: DraftFactor[]
  language: string
}

export type EventType = "profile_update" | "ad_generated" | "ad_approved" | "ad_marked_sent" | "consent_changed"

export interface CustomerEvent {
  id: number
  customer_id: number
  type: EventType
  summary: string
  created_at: string
}

export interface FieldChange {
  field: ProfileField
  before: string
  after: string
  evidence?: string
}

export interface ProfileChange {
  customer_id: number
  chat_id: number
  turn: number
  message_id: number
  patch: ProfilePatch
  changes: FieldChange[]
  at: string
}

export interface DemoState {
  version: number
  /** Demo clock (ISO). It starts at a fixed time and advances one minute per action, so output is reproducible. */
  now: string
  business: Business
  personas: Persona[]
  customers: Customer[]
  profiles: Record<number, CustomerProfile>
  chats: Chat[]
  messages: Message[]
  campaigns: Campaign[]
  outbox: OutboundMessage[]
  events: CustomerEvent[]
  lastProfileChange: ProfileChange | null
  nextId: number
}
