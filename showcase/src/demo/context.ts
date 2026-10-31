import { createContext, useContext } from "react"
import type { Action, Result } from "./state"
import type { DemoState } from "./types"

export interface DemoContextValue {
  state: DemoState
  dispatch: (action: Action) => Result
}

export const DemoContext = createContext<DemoContextValue | null>(null)

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error("useDemo outside DemoProvider")
  return ctx
}
