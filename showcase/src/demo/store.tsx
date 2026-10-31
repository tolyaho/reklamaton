import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DemoContext } from "./context"
import { initialState, reduce, STATE_VERSION, type Action } from "./state"
import type { DemoState } from "./types"

const STORAGE_KEY = "reklamaton-demo"

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState
      if (parsed?.version === STATE_VERSION) return parsed
    }
  } catch {
    // unreadable or blocked storage: start fresh
  }
  return initialState()
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load)
  const ref = useRef(state)

  const dispatch = useCallback((action: Action) => {
    const { state: next, result } = reduce(ref.current, action)
    ref.current = next
    setState(next)
    return result
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage full or disabled: the demo still works for this visit
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
