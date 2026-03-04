import React, { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMotionEnabled } from "@/lib/motion"
import {
  Home,
  MessageSquare,
  Building2,
  Users,
  Megaphone,
  LogOut,
  Menu,
  X,
} from "lucide-react"

export type AppView = "home" | "chat" | "business" | "customers" | "campaigns"

interface NavItem {
  key: AppView
  label: string
  icon: React.ElementType
  requiresAuth: boolean
}

const navItems: NavItem[] = [
  { key: "home", label: "Home", icon: Home, requiresAuth: false },
  { key: "chat", label: "Chat", icon: MessageSquare, requiresAuth: true },
  { key: "business", label: "Business", icon: Building2, requiresAuth: true },
  { key: "customers", label: "Customers", icon: Users, requiresAuth: true },
  { key: "campaigns", label: "Campaigns", icon: Megaphone, requiresAuth: true },
]

interface AppShellProps {
  view: AppView
  onNavigate: (view: AppView) => void
  isAuthed: boolean
  userName?: string
  userPicture?: string
  userEmail?: string
  onLogin?: () => void
  onLogout?: () => void
  children: React.ReactNode
}

export default function AppShell({
  view,
  onNavigate,
  isAuthed,
  userName,
  userPicture,
  onLogin,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const motionEnabled = useMotionEnabled()

  const showFullLayout = view !== "home"

  if (!showFullLayout) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <button onClick={() => onNavigate("home")} className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">Reklamaton</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">Sales Automation</span>
            </button>
            <div className="flex items-center gap-2">
              {isAuthed ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => onNavigate("chat")}>
                    Dashboard
                  </Button>
                  <UserAvatar name={userName} picture={userPicture} />
                  <Button variant="ghost" size="sm" onClick={onLogout}>
                    <LogOut className="mr-1 h-4 w-4" />
                    Sign out
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={onLogin}>
                  Sign in with Google
                </Button>
              )}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <button onClick={() => onNavigate("home")} className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Reklamaton</span>
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = view === item.key
            const Wrapper = motionEnabled ? motion.button : "button"
            const motionProps = motionEnabled
              ? { whileHover: { scale: 1.01 }, whileTap: { scale: 0.99 }, transition: { duration: 0.15 } }
              : {}
            return (
              <Wrapper
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
                {...motionProps}
              >
                {isActive && motionEnabled && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                {isActive && !motionEnabled && (
                  <div className="absolute inset-0 rounded-lg bg-sidebar-accent" style={{ zIndex: 0 }} />
                )}
                <item.icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{item.label}</span>
              </Wrapper>
            )
          })}
        </nav>
        <div className="border-t px-3 py-3">
          {isAuthed ? (
            <div className="flex items-center gap-2">
              <UserAvatar name={userName} picture={userPicture} />
              <div className="flex-1 truncate text-sm font-medium">{userName || "User"}</div>
              <button
                onClick={onLogout}
                className="rounded p-1 text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button className="w-full" size="sm" onClick={onLogin}>
              Sign in with Google
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <button onClick={() => onNavigate("home")} className="text-lg font-bold tracking-tight">
            Reklamaton
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-b bg-background px-4 py-2 md:hidden">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key)
                  setMobileOpen(false)
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  view === item.key ? "bg-accent" : "",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
            <div className="mt-2 border-t pt-2">
              {isAuthed ? (
                <button onClick={onLogout} className="flex w-full items-center gap-3 px-3 py-2 text-sm text-destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <Button className="w-full" size="sm" onClick={onLogin}>
                  Sign in
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Desktop top bar */}
        <header className="hidden h-14 items-center justify-end gap-3 border-b px-6 md:flex">
          {isAuthed && (
            <>
              <span className="text-sm text-muted-foreground">{userName}</span>
              <UserAvatar name={userName} picture={userPicture} />
            </>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-4">{children}</main>
      </div>
    </div>
  )
}

function UserAvatar({ name, picture }: { name?: string; picture?: string }) {
  if (picture) {
    return <img src={picture} alt={name || ""} className="h-7 w-7 rounded-full object-cover" />
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {(name || "U")[0].toUpperCase()}
    </div>
  )
}
