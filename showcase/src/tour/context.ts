import { createContext, useContext } from "react"

export interface TourContextValue {
  active: boolean
  step: number
  start: () => void
  stop: () => void
  goTo: (step: number) => void
}

export const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour outside TourProvider")
  return ctx
}
