import { MotionConfig } from "framer-motion"
import { Compass } from "lucide-react"
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router"
import { Toaster } from "sonner"
import { AppShell } from "@/app/AppShell"
import { Business } from "@/app/pages/Business"
import { Campaigns } from "@/app/pages/Campaigns"
import { Conversations } from "@/app/pages/Conversations"
import { Customers } from "@/app/pages/Customers"
import { Overview } from "@/app/pages/Overview"
import { buttonClass } from "@/lib/styles"
import { Wordmark } from "@/components/Wordmark"
import { PlayerProvider } from "@/demo/player"
import { DemoProvider } from "@/demo/store"
import { Landing } from "@/landing/Landing"
import { TourProvider } from "@/tour/TourProvider"

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Wordmark />
        <h1 className="display mt-8 text-[40px] leading-tight text-ink">This page isn't part of the demo</h1>
        <p className="mt-3 text-body text-ink-3">The workspace lives under /app.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/app/overview" className={buttonClass("primary")}>
            <Compass aria-hidden /> Open the workspace
          </Link>
          <Link to="/" className={buttonClass("secondary")}>Home</Link>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <DemoProvider>
          <PlayerProvider>
            <TourProvider>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<Navigate to="/app/overview" replace />} />
                  <Route path="overview" element={<Overview />} />
                  <Route path="conversations" element={<Conversations />} />
                  <Route path="conversations/:customerId" element={<Conversations />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/:customerId" element={<Customers />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="campaigns/:campaignId" element={<Campaigns />} />
                  <Route path="business" element={<Business />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster
                position="top-center"
                toastOptions={{
                  className: "!rounded-ctl !border !border-line !bg-surface !text-ink !shadow-pop !font-sans",
                  descriptionClassName: "!text-ink-3",
                }}
              />
            </TourProvider>
          </PlayerProvider>
        </DemoProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
