export interface ApiMessage {
    id: number;
    chat_id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }

