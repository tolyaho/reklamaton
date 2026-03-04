// src/api.ts

export interface ApiMessage {
    id: number
    chat_id: number
    role: "user" | "assistant"
    content: string
    created_at: string
  }
  
  export interface ChatSession {
  id: number
  characterId: number
  customerId?: number | null
  businessId?: number | null
}
  
  export interface Avatar {
    id: number;
    name: string;
    personality: string;
    features: string;
    age: number;
    gender: string;
    hobbies: string;
    image_url: string | null;
    image_status: "pending" | "ready" | "failed";
    is_system: boolean;
  }
  
  //–– for creating a new avatar ––
  export interface AvatarCreateDTO {
    name: string;
    personality?: string;
    features?: string;
    age?: number;
    gender?: string;
    hobbies?: string;
  }
  
  export interface UserRead {
    id: number
    username: string
    age?: number
    sex?: string
    created_at: string
  }
  
  const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"

function currentUserIdFromStorage(): number {
  const raw = localStorage.getItem("userProfile")
  if (!raw) throw new Error("Not logged in: userProfile missing")
  const parsed = JSON.parse(raw)
  const uid = Number(parsed?.backendId)
  if (!uid) throw new Error("Not logged in: backend user id missing")
  return uid
}
  
  async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init)
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }
  
  // ◼️ Users
  
  /**
   * Create (or re-create) a user record for this Google username.
   */
  export function upsertUser(username: string, age?: number, sex?: string) {
    return request<UserRead>(`${BASE}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, age, sex })
    })
  }
  
  // ◼️ Avatars
  
  /** List all avatars owned by a user */
  export function listAvatars(userId: number): Promise<Avatar[]> {
    return request<Avatar[]>(`${BASE}/users/${userId}/avatars/`)
  }
  
  /** Create a new avatar for this user */
  export function createAvatar(userId: number, dto: {
  name: string;
  personality?: string;
  features?: string;
  age?: number;
  gender?: string;
  hobbies?: string;
}): Promise<Avatar> {
  return request(`${BASE}/users/${userId}/avatars/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto)
  });
}
  
  // ◼️ Chats
  
  /** List all chat‐sessions for a user, remapping avatar_id→characterId */
  export function listChats(userId: number): Promise<ChatSession[]> {
    return request<{ id: number; avatar_id: number; customer_id?: number | null; business_id?: number | null }[]>(
      `${BASE}/users/${userId}/chats/`
    ).then(arr =>
      arr.map((c) => ({
        id: c.id,
        characterId: c.avatar_id,
        customerId: c.customer_id ?? null,
        businessId: c.business_id ?? null,
      }))
    )
  }
  
  /** Start a new chat‐session for this user + avatar */
  export function createChat(
    userId: number,
    avatarId: number
  ): Promise<ChatSession> {
    return request<{ id: number; avatar_id: number; customer_id?: number | null; business_id?: number | null }>(
      `${BASE}/users/${userId}/chats/?avatar_id=${avatarId}`,
      { method: "POST" }
    ).then((c) => ({
      id: c.id,
      characterId: c.avatar_id,
      customerId: c.customer_id ?? null,
      businessId: c.business_id ?? null,
    }))
  }
  
  // ◼️ Messages & Assistant (your existing functions)
  
  export function listMessages(chatId: number): Promise<ApiMessage[]> {
    return request<ApiMessage[]>(`${BASE}/chats/${chatId}/messages/`)
  }
  
  export function sendMessage(
    chatId: number,
    avatarId: number,
    message: string
  ): Promise<{ reply: string }> {
    return request(`${BASE}/api/assistant/${chatId}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_id: avatarId, message })
    })
  }

// ◼️ Sales automation (MVP)

export interface Business {
  id: number
  owner_user_id: number
  name: string
  brand_voice: string
  products_json: string
  timezone: string
  created_at: string
}

export interface Customer {
  id: number
  business_id: number
  external_id: string | null
  name: string | null
  phone: string | null
  email: string | null
  preferred_channel: string | null
  marketing_opt_in: boolean
  marketing_opt_in_at: string | null
  last_seen_at: string | null
  created_at: string
}

export interface CustomerProfile {
  id: number
  customer_id: number
  language: string | null
  tone: string | null
  interests_json: string | null
  budget_min: number | null
  budget_max: number | null
  location: string | null
  lead_stage: string
  lead_score: number
  objections_json: string | null
  notes: string | null
  updated_at: string
}

export interface Campaign {
  id: number
  business_id: number
  name: string
  objective: string
  offer_text: string
  channel: string
  segment_json: string
  status: string
  created_at: string
}

export interface OutboundMessage {
  id: number
  campaign_id: number
  customer_id: number
  channel: string
  content: string
  status: string
  created_at: string
  approved_at: string | null
  sent_at: string | null
  error: string | null
}

export function getOrCreateBusiness(userId: number, payload?: Partial<Business>) {
  return request<Business>(`${BASE}/users/${userId}/business`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  })
}

export function getBusiness(businessId: number) {
  const userId = currentUserIdFromStorage()
  return request<Business>(`${BASE}/business/${businessId}?user_id=${userId}`)
}

export function updateBusiness(businessId: number, patch: Partial<Business>) {
  const userId = currentUserIdFromStorage()
  return request<Business>(`${BASE}/business/${businessId}?user_id=${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  })
}

export function upsertCustomer(businessId: number, payload: Partial<Customer>) {
  const userId = currentUserIdFromStorage()
  return request<Customer>(`${BASE}/business/${businessId}/customers/upsert?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
}

export function listCustomers(businessId: number) {
  const userId = currentUserIdFromStorage()
  return request<Customer[]>(`${BASE}/business/${businessId}/customers?user_id=${userId}`)
}

export function getCustomer(businessId: number, customerId: number) {
  const userId = currentUserIdFromStorage()
  return request<Customer>(`${BASE}/business/${businessId}/customers/${customerId}?user_id=${userId}`)
}

export function updateCustomer(businessId: number, customerId: number, patch: Partial<Customer>) {
  const userId = currentUserIdFromStorage()
  return request<Customer>(`${BASE}/business/${businessId}/customers/${customerId}?user_id=${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  })
}

export function getCustomerProfile(businessId: number, customerId: number) {
  const userId = currentUserIdFromStorage()
  return request<CustomerProfile>(`${BASE}/business/${businessId}/customers/${customerId}/profile?user_id=${userId}`)
}

export function createBusinessChat(
  businessId: number,
  avatarId: number,
  customerId: number,
  sourceChannel = "web",
) {
  const userId = currentUserIdFromStorage()
  return request<{ id: number; avatar_id: number; customer_id?: number | null; business_id?: number | null }>(
    `${BASE}/business/${businessId}/chats/?avatar_id=${avatarId}&customer_id=${customerId}&user_id=${userId}&source_channel=${sourceChannel}`,
    { method: "POST" },
  ).then((c) => ({ id: c.id, characterId: c.avatar_id, customerId: c.customer_id ?? null, businessId: c.business_id ?? null }))
}

export function createCampaign(businessId: number, payload: Partial<Campaign>) {
  const userId = currentUserIdFromStorage()
  return request<Campaign>(`${BASE}/business/${businessId}/campaigns?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
}

export function listCampaigns(businessId: number) {
  const userId = currentUserIdFromStorage()
  return request<Campaign[]>(`${BASE}/business/${businessId}/campaigns?user_id=${userId}`)
}

export function generateDrafts(campaignId: number) {
  const userId = currentUserIdFromStorage()
  return request<OutboundMessage[]>(`${BASE}/campaigns/${campaignId}/generate_drafts?user_id=${userId}`, {
    method: "POST",
  })
}

export function listOutbox(campaignId: number) {
  const userId = currentUserIdFromStorage()
  return request<OutboundMessage[]>(`${BASE}/campaigns/${campaignId}/outbox?user_id=${userId}`)
}

export function approveOutbox(messageId: number) {
  const userId = currentUserIdFromStorage()
  return request<OutboundMessage>(`${BASE}/outbox/${messageId}/approve?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved: true })
  })
}

export function markSentOutbox(messageId: number) {
  const userId = currentUserIdFromStorage()
  return request<OutboundMessage>(`${BASE}/outbox/${messageId}/mark_sent?user_id=${userId}`, {
    method: "POST",
  })
}

export function exportOutboxCsvUrl(campaignId: number) {
  const userId = currentUserIdFromStorage()
  return `${BASE}/outbox/export.csv?campaign_id=${campaignId}&user_id=${userId}`
}