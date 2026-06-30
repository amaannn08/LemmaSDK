import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import { refreshBriefing } from './pod-functions'

const AUTO_BRIEFING_REFRESH_ENABLED = import.meta.env.VITE_ENABLE_BRIEFING_AUTO_REFRESH === 'true'

// The briefing lives in the `briefing` table: the briefing-refresh workflow
// (briefing-agent judges + write_briefing persists) writes it on the */5 schedule
// and on manual refresh; the app only reads it live. No per-load LLM call, survives
// cache clears, consistent across devices.
type Briefing = { id: string; briefing_date: string; content: string; generated_at: string }

type BriefingContextValue = {
  isRunning: boolean
  text: string
  error: Error | null
  refresh: () => void
}

const BriefingContext = createContext<BriefingContextValue | null>(null)

export function BriefingProvider({ children }: { children: ReactNode }) {
  const { records, isLoading } = useLiveRecords<Briefing>({
    client: lemmaClient,
    tableName: 'briefing',
    sort: [{ field: 'generated_at', direction: 'desc' }],
  })
  const latest = records[0]
  const text = latest?.content ?? ''

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const kicked = useRef(false)
  const awaitingFrom = useRef<string | null>(null)

  async function refresh() {
    setError(null)
    setIsRefreshing(true)
    awaitingFrom.current = latest?.generated_at ?? ''
    try {
      await refreshBriefing()
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Briefing refresh failed.'))
      setIsRefreshing(false)
    }
  }

  // Briefing auto-refresh is opt-in at runtime so quiet deployments do not pay
  // for default-on LLM work.
  useEffect(() => {
    if (!AUTO_BRIEFING_REFRESH_ENABLED || kicked.current || isLoading || latest) return
    kicked.current = true
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, latest])

  // Stop the spinner once a newer briefing lands (or after a timeout fallback).
  useEffect(() => {
    if (isRefreshing && latest && latest.generated_at !== awaitingFrom.current) {
      setIsRefreshing(false)
    }
  }, [latest, isRefreshing])

  useEffect(() => {
    if (!isRefreshing) return
    const t = setTimeout(() => setIsRefreshing(false), 60_000)
    return () => clearTimeout(t)
  }, [isRefreshing])

  return (
    <BriefingContext.Provider value={{ isRunning: isRefreshing, text, error, refresh }}>
      {children}
    </BriefingContext.Provider>
  )
}

export function useBriefing(): BriefingContextValue {
  const ctx = useContext(BriefingContext)
  if (!ctx) throw new Error('useBriefing must be used within BriefingProvider')
  return ctx
}
