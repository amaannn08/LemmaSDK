import { useEffect } from 'react'
import { useAgentTask } from 'lemma-sdk/react'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { Markdown } from './markdown'

// The Dashboard's "AI Briefing" card and the /ai route both render this —
// one component, two mount sites, per the plan (no separate 4-quadrant layout).
export function AiBriefing() {
  const { run, isRunning, streamingText, outputText, error } = useAgentTask({
    client: lemmaClient,
    agentName: 'briefing-agent',
    parseOutput: false,
  })

  useEffect(() => {
    void run("Give me today's briefing.")
    // Run once on mount only — re-running on every render would spam the agent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const text = outputText || streamingText

  return (
    <div className="rounded-xl border border-teal-900 bg-linear-to-br from-teal-950/40 to-zinc-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold text-teal-400">Daily Briefing</span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={14} />
          {error.message}
        </div>
      ) : isRunning && !text ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 size={14} className="animate-spin" />
          Thinking…
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-zinc-300">
          <Markdown text={text} />
        </div>
      )}
    </div>
  )
}
