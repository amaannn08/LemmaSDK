import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, RefreshCw, X } from 'lucide-react'
import { runExtraction, type RunExtractionResult } from './pod-functions'
import { useSyncProgress } from './useSyncProgress'
import { SOURCE_APP_LABEL } from './types'

const TIMEOUT_MS = 90_000

export function SyncButton() {
  const [showResult, setShowResult] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runSettled, setRunSettled] = useState(false)
  const [result, setResult] = useState<RunExtractionResult | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const progress = useSyncProgress(runId)
  const syncMutation = useMutation({
    mutationFn: (nextRunId: string) => runExtraction({ sync_run_id: nextRunId }),
    onSuccess: (output) => {
      setResult(output)
      setRunSettled(true)
    },
    onError: (nextError) => {
      setError(nextError instanceof Error ? nextError.message : 'Sync failed to start.')
      setRunSettled(true)
    },
  })
  const hasActiveProgress = progress.some((row) => row.status === 'pending' || row.status === 'running')
  const hasFailedProgress = progress.some((row) => row.status === 'failed')
  const isRunning = Boolean(runId) && (!runSettled || hasActiveProgress) && !error
  const totalWritten = progress.reduce((n, row) => n + (row.items_written ?? 0), 0) || (result?.items_written ?? 0)
  const totalSeen = progress.reduce((n, row) => n + (row.items_seen ?? 0), 0) || (result?.items_seen ?? 0)
  const isFinished = Boolean(runId) && runSettled && !hasActiveProgress && !error
  const outcome = error ? 'error' : hasFailedProgress ? 'failed' : isFinished ? 'complete' : 'running'

  useEffect(() => {
    if ((runSettled || error) && timeoutRef.current && !hasActiveProgress) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [error, hasActiveProgress, runSettled])

  async function sync() {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    setError(null)
    setRunId(id)
    setRunSettled(false)
    setResult(null)
    setShowResult(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(
      () => setError('This is taking longer than expected — the sweep may still finish in the background. Try again in a moment.'),
      TIMEOUT_MS,
    )
    syncMutation.mutate(id)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={sync}
        disabled={isRunning}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
      >
        {isRunning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {isRunning ? 'Checking…' : 'Check now'}
      </button>

      {showResult ? (
        <div className="absolute right-0 top-full z-10 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm shadow-xl">
          <button
            type="button"
            onClick={() => setShowResult(false)}
            className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>

          {error ? (
            <p className="text-red-400">{error}</p>
          ) : (
            <>
              {outcome === 'complete' ? (
                <p className="mb-2 font-medium text-zinc-200">
                  {totalWritten > 0 ? `${totalWritten} new item${totalWritten > 1 ? 's' : ''} found` : 'All caught up'}
                </p>
              ) : outcome === 'failed' ? (
                <p className="mb-2 flex items-center gap-2 font-medium text-amber-400">
                  <AlertCircle size={14} />
                  Extraction finished with at least one connector failure.
                </p>
              ) : null}
              {progress.length > 0 ? (
                <ul className="flex flex-col gap-1.5 text-zinc-400">
                  {progress.map((row) => (
                    <li key={row.id} className="flex items-center gap-2">
                      {row.status === 'done' ? (
                        <Check size={14} className="shrink-0 text-emerald-500" />
                      ) : row.status === 'failed' ? (
                        <AlertCircle size={14} className="shrink-0 text-red-400" />
                      ) : row.status === 'skipped' ? (
                        <span className="w-3.5 shrink-0 text-center text-zinc-600">–</span>
                      ) : (
                        <Loader2 size={14} className="shrink-0 animate-spin" />
                      )}
                      <span>
                        {SOURCE_APP_LABEL[row.source_app]}
                        {row.status === 'done'
                          ? row.category_summary
                            ? `: ${row.category_summary}`
                            : `: ${row.items_written} written`
                          : row.status === 'failed'
                            ? row.error_message
                              ? `: ${row.error_message}`
                              : ': failed'
                          : row.status === 'skipped'
                            ? ': not connected'
                            : '…'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : outcome === 'complete' ? (
                <p className="text-zinc-400">
                  Sweep finished{totalSeen > 0 ? ` after checking ${totalSeen} item${totalSeen === 1 ? '' : 's'}` : ''}.
                </p>
              ) : (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 size={14} className="animate-spin" />
                  Starting the extraction run… this can take up to a minute.
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
