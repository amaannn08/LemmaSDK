import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { useAgentTask } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'

const BRIEFING_PROMPT = "Give me today's briefing."

type BriefingContextValue = {
  isRunning: boolean
  text: string
  error: Error | null
  refresh: () => void
}

const BriefingContext = createContext<BriefingContextValue | null>(null)

// Mounted once at the app root so the briefing survives route changes —
// AiBriefing previously called useAgentTask itself and ran on every mount,
// which meant navigating away from Dashboard and back re-ran the agent
// every time. This runs once on app load; `refresh()` is the only way to
// re-trigger it after that.
export function BriefingProvider({ children }: { children: ReactNode }) {
  const { run, isRunning, streamingText, outputText, error } = useAgentTask({
    client: lemmaClient,
    agentName: 'briefing-agent',
    parseOutput: false,
  })
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true
    void run(BRIEFING_PROMPT)
  }, [run])

  return (
    <BriefingContext.Provider
      value={{
        isRunning,
        text: outputText || streamingText,
        error,
        refresh: () => void run(BRIEFING_PROMPT),
      }}
    >
      {children}
    </BriefingContext.Provider>
  )
}

export function useBriefing(): BriefingContextValue {
  const ctx = useContext(BriefingContext)
  if (!ctx) throw new Error('useBriefing must be used within BriefingProvider')
  return ctx
}
