import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MdAdd,
  MdSend,
  MdAccountCircle,
  MdLogout,
  MdPersonAdd,
  MdMenu,
  MdKeyboardArrowDown
} from "react-icons/md";

// wire up our new API wrapper
import {
  upsertUser,
  listAvatars,
  listChats,
  createChat,
  listMessages,
  sendMessage,
  createAvatar
} from "@/api";

// shadcn/ui components (generated with `npx shadcn-ui add ...`)
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Типы данных
 */
declare global {
  interface Window {
    google: any;
  }
}

interface Character {
  id: number;
  name: string;
  imageUrl: string | null;
  personality: string;
  features: string;
  age: number;
  gender: string;
  hobbies: string;
  imageStatus?: "pending" | "ready" | "failed";
}
interface Message {
  id: number;
  chatId: number;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}
interface Chat {
  id: number;
  characterId: number;
}
interface UserProfile {
  name:   string
  picture:string
  email:  string            // google email
  backendId: number | null  // our DB user.id
}

/**
 * Демо‑данные + Google OAuth
 */
const CLIENT_ID =
  "953875760885-c568b5rb068a5ha2h12748cqq9ddg3gk.apps.googleusercontent.com";

const initialCharacters: Character[] = [
  {
    id: 1,
    name: "Алиса",
    imageUrl: "https://i.pravatar.cc/150?img=12",
    personality: "Добрая и любознательная",
    features: "Всегда отвечает вопросом на вопрос",
    age: 23,
    gender: "женский",
    hobbies: "чтение, музыка",
  },
  {
    id: 2,
    name: "Борис",
    imageUrl: "https://i.pravatar.cc/150?img=20",
    personality: "Саркастичный и остроумный",
    features: "Любит шутить",
    age: 31,
    gender: "мужской",
    hobbies: "шахматы, кулинария",
  },
];
const initialChats: Chat[] = [
  { id: 1, characterId: 1 },
  { id: 2, characterId: 2 },
];
const initialMessages: Message[] = [
  {
    id: 1,
    chatId: 1,
    sender: "user",
    text: "Привет, Алиса!",
    timestamp: "09:00",
  },
  {
    id: 2,
    chatId: 1,
    sender: "ai",
    text: "Привет! Как настроение сегодня?",
    timestamp: "09:00",
  },
  {
    id: 3,
    chatId: 2,
    sender: "ai",
    text: "Сыграем партию в шахматы?",
    timestamp: "08:45",
  },
  {
    id: 4,
    chatId: 2,
    sender: "user",
    text: "Я пока не совсем проснулся 😂",
    timestamp: "08:46",
  },
];

/**
 * Основное приложение
 */
export default function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chats,      setChats     ] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(
    chats[0]?.id ?? null
  );

  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("userProfile");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        localStorage.removeItem("userProfile");
      }
    }
    return null;
  });

  const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  function toAbsolute(url?: string | null) {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return API_BASE.replace(/\/$/, "") + url;  // url уже начинается с /
  }

  useEffect(() => {
    if (!userProfile?.backendId) return;
  
    // 1) получить список аватаров из БД
    listAvatars(userProfile.backendId)
      .then((arr) => {
        // API возвращает Avatar[] с полем avatar.url и avatar.id
        console.log("RAW avatars from backend:", arr);
        setCharacters(arr.map(a => ({
          id: a.id,
          name: a.name,
          imageUrl: toAbsolute(a.image_url),
          personality: a.personality ?? "",
          features: a.features ?? "",
          age: a.age ?? 0,
          gender: a.gender ?? "",
          hobbies: a.hobbies ?? "",
          imageStatus: a.image_status
        })));
      })
      .catch(console.error);
  
    // 2) получить список чатов
    listChats(userProfile.backendId)
      .then(setChats)
      .catch(console.error);
  }, [userProfile?.backendId]);
  
  useEffect(() => {
    if (!selectedChatId) return;
  
    listMessages(selectedChatId).then((apiMsgs) => {
      const hydrated: Message[] = apiMsgs.map((m) => {
        // narrow `role` to one of our two literals:
        const sender: "user" | "ai" = m.role === "assistant" ? "ai" : "user";
    
        return {
          id: m.id,
          chatId: m.chat_id,
          sender,     // now typed correctly
          text: m.content,
          timestamp: new Date(m.created_at + "Z").toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      });
    
      setMessages(hydrated);
    });
  }, [selectedChatId]);

  useEffect(() => {
    if (chats.length && selectedChatId == null) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  const [isChooseCharacterOpen, setIsChooseCharacterOpen] = useState(false);
  const [isNewCharacterOpen, setIsNewCharacterOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  function scrollToBottom() {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 50;
      setShowScrollDown(
        el.scrollHeight - el.scrollTop - el.clientHeight > threshold
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // state формы создания персонажа
  const [newCharForm, setNewCharForm] = useState({
    name: "",
    personality: "",
    features: "",
    age: 18,
    gender: "",
    hobbies: ""
  });

  const tokenClientRef = useRef<any>(null);

  /**
   * Google OAuth initialisation
   */
  const [googleReady, setGoogleReady] = useState(false);
  
  useEffect(() => {
    console.log("Appending Google Identity script…");
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log("Google script loaded, initializing token client…");
      initTokenClient();
      setGoogleReady(true);
    };
    document.body.appendChild(script);

    function initTokenClient() {
      if (!window.google?.accounts?.oauth2) {
        console.error("Google Identity Services SDK не доступен.");
        return;
      }
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "openid profile email",
        ux_mode: "popup",
        callback: async (tokenResponse: any) => {
          try {
            const res = await fetch(
              "https://www.googleapis.com/oauth2/v3/userinfo",
              {
                headers: {
                  Authorization: `Bearer ${tokenResponse.access_token}`,
                },
              }
            );
            const user = await res.json();
            const dbUser = await upsertUser(user.email)
            const prof: UserProfile = {
              name:      user.name,
              picture:   user.picture,
              email:     user.email,
              backendId: dbUser.id,
            }
            setUserProfile(prof);
            localStorage.setItem("userProfile", JSON.stringify(prof));
          } catch (err) {
            console.error("Ошибка получения профиля:", err);
            alert("Не удалось получить профиль пользователя.");
          }
        },
      });
      console.log("Token client created:", tokenClientRef.current);
    }
  }, []);

  const getOrCreateUserId = (email: string): string => {
    const map = JSON.parse(localStorage.getItem("userMap") || "{}");
    if (!map[email]) {
      map[email] = crypto.randomUUID();
      localStorage.setItem("userMap", JSON.stringify(map));
    }
    return map[email];
  };

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;
  const selectedCharacter =
    characters.find((c) => c.id === selectedChat?.characterId) || null;

  // Анимации
  const sidebarVariants = {
    hidden: { x: -300, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 },
  };
  const messageVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  /**
   * Обработчики
   */
  const handleGoogleLogin = () => {
    if (userProfile || !tokenClientRef.current) return;
    tokenClientRef.current.requestAccessToken();
  };
  
  const handleLogout = () => {
    setUserProfile(null);
    setCharacters([]);
    setChats([]);
    setSelectedChatId(null);
    setMessages([]);
    localStorage.removeItem("userProfile");
  };

  const handleChooseCharacterForChat = async (character: Character) => {
    if (!userProfile?.backendId) {
      console.error("No backend user ID – are you logged in?");
      return;
    }
  
    try {
      console.log("Creating chat for avatar", character.id);
      const created = await createChat(userProfile.backendId, character.id);
      console.log("Backend returned new chat:", created);
      // created has the shape { id: number, characterId: number }
      setChats((prev) => [...prev, created]);
      setSelectedChatId(created.id);
    } catch (err) {
      console.error("Failed to create chat:", err);
      alert("Не удалось создать новый диалог.");
    } finally {
      setIsChooseCharacterOpen(false);
    }
  };

  const TypingIndicator: React.FC = () => {
    const dots = [0, 1, 2];
    return (
      <div
        className="rounded-xl px-4 py-2 max-w-xs shadow text-sm bg-gray-200 text-gray-900 rounded-bl-none flex items-center gap-1"
        style={{ minHeight: 40 }}
      >
        {dots.map(i => (
          <motion.span
            key={i}
            className="w-2 h-2 bg-gray-500 rounded-full inline-block"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatDelay: 0.1,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    );
  };

  const handleOpenNewCharacter = () => {
    setIsChooseCharacterOpen(false);
    setIsNewCharacterOpen(true);
  };

  const handleCreateCharacter = async () => {
    if (!newCharForm.name.trim() || !userProfile?.backendId) return;
    try {
      // 🚀 Call backend to create the avatar
      const created = await createAvatar(userProfile.backendId, {
        name:        newCharForm.name,
        personality: newCharForm.personality,
        features:    newCharForm.features,
        age:         newCharForm.age,
        gender:      newCharForm.gender,
        hobbies:     newCharForm.hobbies,
      });
      // Map backend Avatar → our Character shape
          setCharacters(prev => [
              ...prev,
              {
                id:          created.id,
                name:        created.name,
                imageUrl:      created.image_url || null,
                personality: created.personality,
                features:    created.features,
                age:         created.age,
                gender:      created.gender,
                hobbies:     created.hobbies,
                imageStatus:      created.image_status, // "pending"
              }
            ]);

      pollAvatar(created.id);
      setNewCharForm({
        name: "",
        personality: "",
        features: "",
        age: 18,
        gender: "",
        hobbies: ""
      });
      setIsNewCharacterOpen(false);
    } catch (err) {
      console.error("Failed to create avatar:", err);
      alert("Не удалось создать персонажа.");
    }
  };

  async function pollAvatar(avatarId: number, attempts = 20, delayMs = 3000) {
      for (let i = 0; i < attempts; i++) {
        try {
          // Предполагается эндпоинт: GET /avatars/{avatar_id}/
          const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/avatars/${avatarId}/`);
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json(); // тот же shape что и createAvatar response
    
          if (data.image_status === "ready" || data.image_status === "failed") {
            setCharacters(prev =>
              prev.map(c =>
                c.id === avatarId
                  ? {
                      ...c,
                      imageUrl: toAbsolute(data.image_url) || c.imageUrl,
                      imageStatus: data.image_status
                    }
                  : c
              )
            );
            break;
          }
        } catch (e) {
          console.warn("pollAvatar error:", e);
          // можно не прерывать – пусть делает ещё попытку
        }
        await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !selectedCharacter) return;

    const text = newMessage.trim();
    const ts = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // optimistic user message
    const userMsg: Message = {
      id: Date.now(),
      chatId: selectedChat.id,
      sender: "user",
      text,
      timestamp: ts,
    };
    setMessages((prev) => [...prev, userMsg]);
    setNewMessage("");

    setIsTyping(true);

    try {
      const { reply } = await sendMessage(
        selectedChat.id,
        selectedCharacter.id,
        text
      );

      const aiMsg: Message = {
        id: Date.now() + 1,
        chatId: selectedChat.id,
        sender: "ai",
        text: reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Send message failed:", err);
    }
    setIsTyping(false);
  };

  /**
   * UI
   */
  return (
    <div className="h-screen flex font-sans text-sm text-gray-900 relative overflow-hidden">
      {/* ----------- Sidebar ----------- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            className="w-60 bg-gray-100 border-r p-4 flex flex-col"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sidebarVariants}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg font-medium mb-4">Диалоги</h2>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {chats.map((chat) => {
                const character = characters.find((c) => c.id === chat.characterId)!;
                const isActive = chat.id === selectedChatId;
                return (
                  <motion.div
                    key={chat.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`cursor-pointer transition border ${
                        isActive
                          ? "bg-blue-50 border-blue-500"
                          : "bg-white hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedChatId(chat.id)}
                    >
                      <CardContent className="flex items-center space-x-3 p-2">
                      <div className="relative w-8 h-8">
  {character.imageUrl && character.imageStatus !== "failed" ? (
    <img
      src={character.imageUrl}
      alt={character.name}
      className={`w-8 h-8 rounded-full object-cover transition-opacity ${
        character.imageStatus === "pending" ? "opacity-50" : "opacity-100"
      }`}
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
      {character.name.slice(0,1).toUpperCase()}
    </div>
  )}

  {character.imageStatus === "pending" && (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )}

  {character.imageStatus === "failed" && (
    <div
      className="absolute inset-0 flex items-center justify-center bg-red-500/70 rounded-full text-[9px] font-medium text-white"
      title="Генерация не удалась"
    >
      !
    </div>
  )}
</div>
<span
   className={`truncate leading-5 ${
     character.imageStatus === "pending" ? "text-gray-400" :
     character.imageStatus === "failed"  ? "text-red-500"  : ""
   }`}
 >
   {character.name}
 </span>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <Button
              variant="default"
              className="mt-4 gap-2"
              onClick={() => setIsChooseCharacterOpen(true)}
            >
              <MdAdd /> Новый диалог
            </Button>

          </motion.aside>
        )}
      </AnimatePresence>

      {/* ----------- Main ----------- */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-14 flex items-center justify-between border-b px-4 bg-white/70 backdrop-blur">
          <div className="flex items-center gap-2">
            <IconButton onClick={() => setIsSidebarOpen((prev) => !prev)}>
              <MdMenu size={24} />
            </IconButton>
            {selectedCharacter && (
              <>
                <div className="relative w-8 h-8">
  {selectedCharacter.imageUrl && selectedCharacter.imageStatus !== "failed" ? (
    <img
      src={selectedCharacter.imageUrl}
      alt={selectedCharacter.name}
      className={`w-8 h-8 rounded-full object-cover transition-opacity ${
        selectedCharacter.imageStatus === "pending" ? "opacity-50" : "opacity-100"
      }`}
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
      {selectedCharacter.name.slice(0,1).toUpperCase()}
    </div>
  )}

  {selectedCharacter.imageStatus === "pending" && (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )}

  {selectedCharacter.imageStatus === "failed" && (
    <div
      className="absolute inset-0 flex items-center justify-center bg-red-500/70 rounded-full text-[9px] font-medium text-white"
      title="Генерация не удалась"
    >
      !
    </div>
  )}
</div>
                <h2 className="font-semibold text-base">
                  {selectedCharacter.name}
                </h2>
              </>
            )}
          </div>

          {/* User profile / auth */}
          <div className="flex items-center gap-3">
            {userProfile ? (
              <>
                <span>{userProfile.name}</span>
                <img
                  src={userProfile.picture}
                  alt={userProfile.name}
                  className="w-8 h-8 rounded-full object-cover"/>
                <IconButton onClick={handleLogout} title="Выйти">
                  <MdLogout size={20}/>
                </IconButton>
              </>
            ) : (
              <Button variant="outline" onClick={handleGoogleLogin} className="gap-1">
                <MdAccountCircle size={18}/> Войти
              </Button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gray-50">
        {selectedChat ? (
  <>
    {messages
      .filter(m => m.chatId === selectedChat.id)
      .map(m => (
        <motion.div
          key={m.id}
          variants={messageVariants}
          initial="hidden"
          animate="visible"
          className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`rounded-xl px-4 py-2 max-w-xs shadow text-sm leading-5 whitespace-pre-wrap ${
              m.sender === "user"
                ? "bg-blue-500 text-white rounded-br-none"
                : "bg-gray-200 text-gray-900 rounded-bl-none"
            }`}
          >
            {m.text}
            <span className="block text-[10px] opacity-70 mt-1 text-right">
              {m.timestamp}
            </span>
          </div>
        </motion.div>
      ))}

    {isTyping && (
    <motion.div
       key="typing"
       variants={messageVariants}
       initial="hidden"
       animate="visible"
       className="flex justify-start"
     >
       <TypingIndicator />
     </motion.div>
   )}
  </>
) : (
  <p className="text-center text-gray-500">Выберите диалог…</p>
)}
        </div>

        {/* Composer */}
        {selectedChat && (
          <div className="h-16 border-t px-4 flex items-center gap-3 bg-white">
            <Input
              placeholder="Ваше сообщение…"
              className="flex-1"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <IconButton onClick={handleSendMessage} title="Отправить">
              <MdSend size={20}/>
            </IconButton>
          </div>
        )}

        {/* Scroll-to-bottom arrow */}
        {showScrollDown && (
          <IconButton
            onClick={() => {
              if (chatContainerRef.current) {
                chatContainerRef.current.scrollTo({
                  top: chatContainerRef.current.scrollHeight,
                  behavior: "smooth",
                });
              }
            }}
            className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 bg-white shadow-md"
            title="Прокрутить вниз"
          >
            <MdKeyboardArrowDown size={24} />
          </IconButton>
        )}
      </div>

      {/* ----------- Диалог выбора персонажа ----------- */}
      <Dialog open={isChooseCharacterOpen} onOpenChange={setIsChooseCharacterOpen}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Выберите персонажа</DialogTitle>
        </DialogHeader>

        {/* Прокручиваемая область */}
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {characters.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:bg-gray-50"
               onClick={() => {
                 if (c.imageStatus === "ready") handleChooseCharacterForChat(c);
                 }}
            >
              <CardContent className="flex items-center gap-3 p-2">
              <div className="relative w-8 h-8 shrink-0">
                    {c.imageUrl && c.imageStatus !== "failed" ? (
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className={`w-8 h-8 rounded-full object-cover transition-opacity ${
                          c.imageStatus === "pending" ? "opacity-50" : "opacity-100"
                        }`}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                        {c.name.slice(0,1).toUpperCase()}
                      </div>
                    )}

                    {c.imageStatus === "pending" && (
                           <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-full">
                             <div className="w-3 h-3 border-2 border-blue-500/70 border-t-transparent rounded-full animate-spin" />
                           </div>
                    )}

                    {c.imageStatus === "failed" && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-red-500/70 rounded-full text-[9px] font-medium text-white"
                        title="Генерация не удалась"
                      >
                        !
                      </div>
                    )}
                  </div>
                  <span
  className={`truncate ${
    c.imageStatus === "pending" ? "text-gray-400" :
     c.imageStatus === "failed"  ? "text-red-500"  : ""
   }`}
 >
   {c.name}
 </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="secondary" className="gap-2" onClick={handleOpenNewCharacter}>
            <MdPersonAdd /> Новый персонаж
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* ----------- Диалог создания персонажа ----------- */}
      <Dialog open={isNewCharacterOpen} onOpenChange={setIsNewCharacterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать нового персонажа</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Имя"
              value={newCharForm.name}
              onChange={(e) => setNewCharForm({ ...newCharForm, name: e.target.value })}
            />
            <Textarea
              placeholder="Характер"
              rows={2}
              value={newCharForm.personality}
              onChange={(e) => setNewCharForm({ ...newCharForm, personality: e.target.value })}
            />
            <Textarea
              placeholder="Особенности"
              rows={2}
              value={newCharForm.features}
              onChange={(e) => setNewCharForm({ ...newCharForm, features: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Возраст"
              value={newCharForm.age}
              onChange={(e) => setNewCharForm({ ...newCharForm, age: +e.target.value })}
            />
            <Input
              placeholder="Пол"
              value={newCharForm.gender}
              onChange={(e) => setNewCharForm({ ...newCharForm, gender: e.target.value })}
            />
            <Textarea
              placeholder="Увлечения"
              rows={2}
              value={newCharForm.hobbies}
              onChange={(e) => setNewCharForm({ ...newCharForm, hobbies: e.target.value })}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsNewCharacterOpen(false)}>
              Отмена
            </Button>
            <Button className="gap-2" onClick={handleCreateCharacter}>
              <MdAdd/> Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Вспомогательная обёртка для иконок‑кнопок
 */
const IconButton: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({ children, className = "", ...rest }) => (
  <button
    className={`p-2 rounded-full hover:bg-gray-200/80 active:bg-gray-300 transition ${className}`}
    {...rest}
  >
    {children}
  </button>
);
