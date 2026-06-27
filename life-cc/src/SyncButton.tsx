import { useState } from 'react'
import { useAgentTask } from 'lemma-sdk/react'
import { Loader2, RefreshCw, X } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { Markdown } from './markdown'

const SYNC_PROMPT =
  "Do one pass now: check all connected services (Gmail, Calendar, Drive, Docs, Sheets) for anything " +
  'new or changed since your last pass, dedup against existing commitments first, classify category for ' +
  'every row, write rows for anything real, and report a short summary of what you found.'

// Triggers extraction-agent on demand instead of waiting for the 30-minute
// schedule. New/updated rows land via the same live websocket subscription
// every view already uses — this button doesn't refetch anything itself.
export function SyncButton() {
  const [showResult, setShowResult] = useState(false)
  const { run, isRunning, outputText, error } = useAgentTask({
    client: lemmaClient,
    agentName: 'extraction-agent',
    parseOutput: false,
    onError: () => setShowResult(true),
  })

  function sync() {
    setShowResult(true)
    void run(SYNC_PROMPT).then(() => setShowResult(true))
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

      {showResult && !isRunning && (outputText || error) ? (
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
            <p className="text-red-400">{error.message}</p>
          ) : (
            <div className="text-zinc-300">
              <Markdown text={outputText} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
