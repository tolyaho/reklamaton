export interface ApiMessage {
    id: number;
    chat_id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }

  export interface AvatarRead {
    id: number;
    name: string;
    personality: string | null;
    features: string | null;
    age: number | null;
    gender: string | null;
    hobbies: string | null;
    prompt: string;
    image_url: string | null;
    image_status: "pending" | "ready" | "failed";
    is_system: boolean;
    owner_id: number | null;
    created_at: string;
  }