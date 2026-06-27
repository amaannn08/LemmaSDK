import { AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useBriefing } from './BriefingContext'
import { Markdown } from './markdown'

// The Dashboard's "AI Briefing" card and the /ai route both render this —
// one component, two mount sites. Backed by BriefingProvider (mounted once
// at the app root) instead of running its own agent task, so navigating
// away and back doesn't re-trigger the agent.
export function AiBriefing() {
  const { isRunning, text, error, refresh } = useBriefing()

  return (
    <div className="rounded-xl border border-teal-900 bg-linear-to-br from-teal-950/40 to-zinc-900 p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="flex-1 text-sm font-bold text-teal-400">Daily Briefing</span>
        <button
          type="button"
          onClick={refresh}
          disabled={isRunning}
          aria-label="Refresh briefing"
          title="Refresh briefing"
          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
        </button>
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
