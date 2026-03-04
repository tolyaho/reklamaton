import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createAvatar,
  createBusinessChat,
  getCustomerProfile,
  getOrCreateBusiness,
  listAvatars,
  listChats,
  listCustomers,
  listMessages,
  sendMessage,
  upsertUser,
  type ApiMessage,
  type Avatar,
  type Business,
  type ChatSession,
  type Customer,
  type CustomerProfile,
} from "@/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AppShell, { type AppView } from "@/components/AppShell"
import EmptyState from "@/components/EmptyState"
import { PageFade, FadeIn, MessageBubble, Stagger, StaggerItem } from "@/components/Animated"
import HomePage from "@/pages/HomePage"
import BusinessSettingsPage from "@/pages/BusinessSettingsPage"
import CampaignsPage from "@/pages/CampaignsPage"
import CustomersPage from "@/pages/CustomersPage"
import { MessageSquare, Plus, Search, User, Zap } from "lucide-react"
import { Toaster, toast } from "sonner"

declare global {
  interface Window {
    google: any
  }
}

interface UserProfile {
  name: string
  picture: string
  email: string
  backendId: number | null
}

interface UiMessage {
  id: number
  chatId: number
  sender: "user" | "ai"
  text: string
  timestamp: string
}

const CLIENT_ID = "953875760885-c568b5rb068a5ha2h12748cqq9ddg3gk.apps.googleusercontent.com"
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"

function avatarImageUrl(avatar?: Avatar | null): string | null {
  if (!avatar?.image_url) return null
  if (avatar.image_url.startsWith("http")) return avatar.image_url
  return `${API_BASE}${avatar.image_url}`
}

function parseList(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : []
  } catch {
    return []
  }
}

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("userProfile")
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  })
  const [view, setViewRaw] = useState<AppView>(() => {
    const stored = localStorage.getItem("appView")
    const valid: AppView[] = ["home", "chat", "business", "customers", "campaigns"]
    return stored && valid.includes(stored as AppView) ? (stored as AppView) : "home"
  })
  const setView = (v: AppView) => {
    setViewRaw(v)
    localStorage.setItem("appView", v)
  }
  const [business, setBusiness] = useState<Business | null>(null)

  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [chats, setChats] = useState<ChatSession[]>([])
  const [selectedChatId, setSelectedChatIdRaw] = useState<number | null>(() => {
    const stored = localStorage.getItem("selectedChatId")
    return stored ? Number(stored) : null
  })
  const setSelectedChatId = (id: number | null) => {
    setSelectedChatIdRaw(id)
    if (id != null) localStorage.setItem("selectedChatId", String(id))
    else localStorage.removeItem("selectedChatId")
  }
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const [chatSearch, setChatSearch] = useState("")
  const [salesDialogOpen, setSalesDialogOpen] = useState(false)
  const [selectedSalesAvatarId, setSelectedSalesAvatarId] = useState<number | null>(null)
  const [selectedSalesCustomerId, setSelectedSalesCustomerId] = useState<number | null>(null)
  const [activeProfile, setActiveProfile] = useState<CustomerProfile | null>(null)

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [avatarForm, setAvatarForm] = useState({ name: "", personality: "", features: "", age: "", gender: "", hobbies: "" })
  const [avatarCreating, setAvatarCreating] = useState(false)

  const tokenClientRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageCountRef = useRef(0)

  const isAuthed = !!userProfile
  const userId = userProfile?.backendId ?? null

  const selectedChat = useMemo(() => chats.find((c) => c.id === selectedChatId) || null, [chats, selectedChatId])
  const selectedAvatar = useMemo(
    () => avatars.find((a) => a.id === selectedChat?.characterId) || null,
    [avatars, selectedChat],
  )

  const sortedChats = useMemo(() => [...chats].sort((a, b) => b.id - a.id), [chats])

  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return sortedChats
    const q = chatSearch.toLowerCase()
    return sortedChats.filter((chat) => {
      const avatar = avatars.find((a) => a.id === chat.characterId)
      const customer = customers.find((c) => c.id === chat.customerId)
      return (
        avatar?.name?.toLowerCase().includes(q) ||
        customer?.name?.toLowerCase().includes(q) ||
        customer?.email?.toLowerCase().includes(q)
      )
    })
  }, [chats, chatSearch, avatars, customers])

  const scrollToBottom = useCallback((force = false) => {
    const container = messagesContainerRef.current
    if (!container || !messagesEndRef.current) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (force || isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    messageCountRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!window.google?.accounts?.oauth2) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "openid profile email",
        ux_mode: "popup",
        callback: async (tokenResponse: any) => {
          try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            })
            const user = await res.json()
            const dbUser = await upsertUser(user.email)
            const profile: UserProfile = {
              name: user.name,
              picture: user.picture,
              email: user.email,
              backendId: dbUser.id,
            }
            setUserProfile(profile)
            localStorage.setItem("userProfile", JSON.stringify(profile))
            const biz = await getOrCreateBusiness(dbUser.id)
            setBusiness(biz)
            setView("chat")
            toast.success("Signed in successfully")
          } catch (e) {
            toast.error("Login failed: " + String(e))
          }
        },
      })
    }
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      try {
        const [avatarData, chatData] = await Promise.all([listAvatars(userId), listChats(userId)])
        setAvatars(avatarData)
        setChats(chatData)
        if (!business) {
          const biz = await getOrCreateBusiness(userId)
          setBusiness(biz)
        }
      } catch (e) {
        toast.error("Failed to load data: " + String(e))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!business?.id) return
    listCustomers(business.id).then(setCustomers).catch((e) => toast.error(String(e)))
  }, [business?.id])

  useEffect(() => {
    if (!selectedChatId) return
    messageCountRef.current = 0
    listMessages(selectedChatId)
      .then((apiMsgs: ApiMessage[]) => {
        const mapped = apiMsgs.map((m) => ({
          id: m.id,
          chatId: m.chat_id,
          sender: (m.role === "assistant" ? "ai" : "user") as "user" | "ai",
          text: m.content,
          timestamp: new Date(m.created_at + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
        messageCountRef.current = mapped.length
        setMessages(mapped)
        setTimeout(() => scrollToBottom(true), 50)
      })
      .catch((e) => toast.error(String(e)))
  }, [selectedChatId, scrollToBottom])

  useEffect(() => {
    if (!selectedChat?.customerId || !business?.id) {
      setActiveProfile(null)
      return
    }
    getCustomerProfile(business.id, selectedChat.customerId)
      .then(setActiveProfile)
      .catch(() => setActiveProfile(null))
  }, [selectedChat?.customerId, business?.id, messages.length])

  const handleGoogleLogin = () => {
    if (userProfile || !tokenClientRef.current) return
    tokenClientRef.current.requestAccessToken()
  }

  const handleLogout = () => {
    setUserProfile(null)
    setBusiness(null)
    setAvatars([])
    setCustomers([])
    setChats([])
    setMessages([])
    setSelectedChatId(null)
    localStorage.removeItem("userProfile")
    setView("home")
    toast("Signed out")
  }

  const createSalesChat = async () => {
    if (!business?.id || !selectedSalesAvatarId || !selectedSalesCustomerId) return
    try {
      const chat = await createBusinessChat(business.id, selectedSalesAvatarId, selectedSalesCustomerId)
      setChats((prev) => [chat, ...prev])
      setSelectedChatId(chat.id)
      setView("chat")
      setSalesDialogOpen(false)
      toast.success("Chat created")
    } catch (e) {
      toast.error("Failed to create chat: " + String(e))
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !selectedAvatar) return
    const text = newMessage.trim()
    const optimistic: UiMessage = {
      id: Date.now(),
      chatId: selectedChat.id,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, optimistic])
    setNewMessage("")
    setIsTyping(true)
    try {
      const { reply } = await sendMessage(selectedChat.id, selectedAvatar.id, text)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          chatId: selectedChat.id,
          sender: "ai",
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    } catch (e) {
      toast.error("Send failed: " + String(e))
    } finally {
      setIsTyping(false)
    }
  }

  const handleCreateAvatar = async () => {
    if (!userId || !avatarForm.name.trim()) return
    setAvatarCreating(true)
    try {
      const dto: Parameters<typeof createAvatar>[1] = {
        name: avatarForm.name.trim(),
        personality: avatarForm.personality || undefined,
        features: avatarForm.features || undefined,
        age: avatarForm.age ? Number(avatarForm.age) : undefined,
        gender: avatarForm.gender || undefined,
        hobbies: avatarForm.hobbies || undefined,
      }
      const newAvatar = await createAvatar(userId, dto)
      setAvatars((prev) => [...prev, newAvatar])
      setAvatarForm({ name: "", personality: "", features: "", age: "", gender: "", hobbies: "" })
      setAvatarDialogOpen(false)
      toast.success(`Avatar "${newAvatar.name}" created`)
    } catch (e) {
      toast.error("Failed to create avatar: " + String(e))
    } finally {
      setAvatarCreating(false)
    }
  }

  const interests = parseList(activeProfile?.interests_json)
  const objections = parseList(activeProfile?.objections_json)
  const currentCustomer = useMemo(
    () => customers.find((c) => c.id === selectedChat?.customerId) || null,
    [customers, selectedChat],
  )

  const renderAuthGuard = () => (
    <EmptyState
      icon={<User className="h-12 w-12" />}
      title="Please sign in"
      description="You need to sign in with Google to access this section."
      actionLabel="Sign in with Google"
      onAction={handleGoogleLogin}
    />
  )

  const chatMessages = useMemo(
    () => (selectedChat ? messages.filter((m) => m.chatId === selectedChat.id) : []),
    [messages, selectedChat],
  )

  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <AppShell
        view={view}
        onNavigate={setView}
        isAuthed={isAuthed}
        userName={userProfile?.name}
        userPicture={userProfile?.picture}
        userEmail={userProfile?.email}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      >
        <PageFade motionKey={view}>
          {/* HOME */}
          {view === "home" && (
            <HomePage
              isAuthed={isAuthed}
              onPrimaryCta={() => setView("chat")}
              onLogin={handleGoogleLogin}
            />
          )}

          {/* AUTH GUARD for non-home views */}
          {view !== "home" && !isAuthed && renderAuthGuard()}

          {/* CHAT */}
          {view === "chat" && isAuthed && (
            <Stagger stagger={0.1} delay={0.05} className="grid h-[calc(100vh-7.5rem)] grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_240px]">
              {/* Chat list */}
              <StaggerItem className="min-h-0"><Card className="flex h-full flex-col overflow-hidden">
                <div className="space-y-2 border-b p-3">
                  <Button size="sm" className="w-full" onClick={() => setSalesDialogOpen(true)}>
                    <Zap className="mr-1 h-4 w-4" />
                    New Sales Chat
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setAvatarDialogOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    New Avatar
                  </Button>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search chats..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto p-2">
                  {filteredChats.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                      {chats.length === 0 ? "No chats yet" : "No matches"}
                    </p>
                  ) : (
                    filteredChats.map((chat) => {
                      const avatar = avatars.find((a) => a.id === chat.characterId)
                      const customer = customers.find((c) => c.id === chat.customerId)
                      const img = avatarImageUrl(avatar)
                      return (
                        <button
                          key={chat.id}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                            selectedChatId === chat.id
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                          }`}
                          onClick={() => setSelectedChatId(chat.id)}
                        >
                          {img ? (
                            <img src={img} alt={avatar?.name || ""} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {(avatar?.name || "A")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 overflow-hidden">
                            <div className="truncate font-medium">{avatar?.name || `Avatar #${chat.characterId}`}</div>
                            {customer && (
                              <div className="truncate text-xs text-muted-foreground">
                                {customer.name || customer.external_id || `Customer #${customer.id}`}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </Card></StaggerItem>

              {/* Message area */}
              <StaggerItem className="min-h-0"><Card className="flex h-full flex-col overflow-hidden">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  {selectedAvatar ? (
                    <>
                      {avatarImageUrl(selectedAvatar) ? (
                        <img
                          src={avatarImageUrl(selectedAvatar)!}
                          alt={selectedAvatar.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {selectedAvatar.name[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold leading-tight">{selectedAvatar.name}</div>
                        {currentCustomer && (
                          <div className="text-xs text-muted-foreground">
                            {currentCustomer.name || currentCustomer.external_id}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select a chat</span>
                  )}
                </div>
                <div ref={messagesContainerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {selectedChat ? (
                    <>
                      {chatMessages.map((m, idx) => {
                        const isNew = idx >= messageCountRef.current
                        return (
                          <MessageBubble
                            key={m.id}
                            isNew={isNew}
                            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                                m.sender === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="whitespace-pre-wrap">{m.text}</div>
                              <div
                                className={`mt-1 text-right text-[10px] ${
                                  m.sender === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                                }`}
                              >
                                {m.timestamp}
                              </div>
                            </div>
                          </MessageBubble>
                        )
                      })}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  ) : (
                    <EmptyState
                      icon={<MessageSquare className="h-10 w-10" />}
                      title="No chat selected"
                      description="Pick a conversation from the sidebar or start a new sales chat."
                      className="border-0 shadow-none"
                    />
                  )}
                </div>
                {selectedChat && (
                  <div className="flex gap-2 border-t p-3">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isTyping}>
                      Send
                    </Button>
                  </div>
                )}
              </Card></StaggerItem>

              {/* Profile panel */}
              <StaggerItem className="min-h-0"><Card className="flex h-full flex-col overflow-hidden">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Customer Profile</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {activeProfile ? (
                    <FadeIn key={activeProfile.id}>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{activeProfile.lead_stage}</Badge>
                          <Badge variant="outline">Score: {activeProfile.lead_score}</Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <ProfileField label="Tone" value={activeProfile.tone} />
                          <ProfileField label="Language" value={activeProfile.language} />
                          <ProfileField label="Location" value={activeProfile.location} />
                          <ProfileField
                            label="Budget"
                            value={
                              activeProfile.budget_min != null || activeProfile.budget_max != null
                                ? `${activeProfile.budget_min ?? "?"} – ${activeProfile.budget_max ?? "?"}`
                                : null
                            }
                          />
                        </div>

                        {interests.length > 0 && (
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Interests
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {interests.map((i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {i}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {objections.length > 0 && (
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Objections
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {objections.map((o) => (
                                <Badge key={o} variant="outline" className="text-xs font-normal">
                                  {o}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeProfile.notes && (
                          <div>
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Notes
                            </span>
                            <p className="mt-1 text-sm text-muted-foreground">{activeProfile.notes}</p>
                          </div>
                        )}
                      </div>
                    </FadeIn>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <User className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {selectedChat ? "No profile data yet. Chat to build it." : "Select a chat to view profile."}
                      </p>
                    </div>
                  )}
                </div>
              </Card></StaggerItem>

              {/* Sales dialog */}
              <Dialog open={salesDialogOpen} onOpenChange={setSalesDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start Sales Chat</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Avatar</label>
                      <select
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        value={selectedSalesAvatarId ?? ""}
                        onChange={(e) => setSelectedSalesAvatarId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select avatar...</option>
                        {avatars.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Customer</label>
                      <select
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        value={selectedSalesCustomerId ?? ""}
                        onChange={(e) => setSelectedSalesCustomerId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select customer...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.external_id || `Customer #${c.id}`}
                          </option>
                        ))}
                      </select>
                      {customers.length === 0 && (
                        <button
                          className="mt-1 text-xs text-primary hover:underline"
                          onClick={() => {
                            setSalesDialogOpen(false)
                            setView("customers")
                          }}
                        >
                          + Create your first customer
                        </button>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={createSalesChat}
                      disabled={!selectedSalesAvatarId || !selectedSalesCustomerId}
                    >
                      Create Chat
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Avatar creation dialog */}
              <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Avatar</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Name *</label>
                      <Input
                        placeholder="e.g. Sales Pro"
                        value={avatarForm.name}
                        onChange={(e) => setAvatarForm((s) => ({ ...s, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Personality</label>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Friendly, professional, persuasive"
                        value={avatarForm.personality}
                        onChange={(e) => setAvatarForm((s) => ({ ...s, personality: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Features / Appearance</label>
                      <Input
                        placeholder="e.g. Dark hair, glasses, suit"
                        value={avatarForm.features}
                        onChange={(e) => setAvatarForm((s) => ({ ...s, features: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium">Age</label>
                        <Input
                          type="number"
                          placeholder="e.g. 30"
                          value={avatarForm.age}
                          onChange={(e) => setAvatarForm((s) => ({ ...s, age: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium">Gender</label>
                        <select
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                          value={avatarForm.gender}
                          onChange={(e) => setAvatarForm((s) => ({ ...s, gender: e.target.value }))}
                        >
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Hobbies</label>
                      <Input
                        placeholder="e.g. Reading, traveling, cooking"
                        value={avatarForm.hobbies}
                        onChange={(e) => setAvatarForm((s) => ({ ...s, hobbies: e.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleCreateAvatar}
                      disabled={!avatarForm.name.trim() || avatarCreating}
                    >
                      {avatarCreating ? "Creating..." : "Create Avatar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </Stagger>
          )}

          {/* BUSINESS */}
          {view === "business" && isAuthed && business && (
            <BusinessSettingsPage businessId={business.id} onUpdated={setBusiness} />
          )}

          {/* CUSTOMERS */}
          {view === "customers" && isAuthed && business && (
            <CustomersPage
              businessId={business.id}
              avatars={avatars}
              onChatCreated={(chat) => {
                setChats((prev) => [chat, ...prev])
                setSelectedChatId(chat.id)
                setView("chat")
              }}
            />
          )}

          {/* CAMPAIGNS */}
          {view === "campaigns" && isAuthed && business && <CampaignsPage businessId={business.id} />}
        </PageFade>
      </AppShell>
    </>
  )
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  )
}
