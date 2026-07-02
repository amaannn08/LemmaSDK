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
    <div className="life-briefing">
      <div className="life-briefing__header">
        <div className="life-briefing__mark">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="life-briefing__title">Daily Briefing</span>
        <button
          type="button"
          onClick={refresh}
          disabled={isRunning}
          aria-label="Refresh briefing"
          title="Refresh briefing"
          className="text-[#8a8073] hover:text-[#5f5548] disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="life-inline-status life-inline-status--danger">
          <AlertCircle size={14} />
          {error.message}
        </div>
      ) : isRunning && !text ? (
        <div className="flex items-center gap-2 text-sm text-[#8d8274]">
          <Loader2 size={14} className="animate-spin" />
          Thinking…
        </div>
      ) : !text ? (
        <div className="life-briefing__muted">No briefing yet. Refresh when you want one.</div>
      ) : (
        <div className="life-briefing__body">
          <Markdown text={text} />
        </div>
      )}
    </div>
  )
}
