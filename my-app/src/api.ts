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
    return request<{ id: number; avatar_id: number }[]>(
      `${BASE}/users/${userId}/chats/`
    ).then(arr =>
      arr.map((c) => ({
        id: c.id,
        characterId: c.avatar_id
      }))
    )
  }
  
  /** Start a new chat‐session for this user + avatar */
  export function createChat(
    userId: number,
    avatarId: number
  ): Promise<ChatSession> {
    return request<{ id: number; avatar_id: number }>(
      `${BASE}/users/${userId}/chats/?avatar_id=${avatarId}`,
      { method: "POST" }
    ).then((c) => ({
      id: c.id,
      characterId: c.avatar_id
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