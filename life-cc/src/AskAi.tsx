import { useState } from 'react'
import { useAgentTask } from 'lemma-sdk/react'
import { Loader2, Sparkles } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { Markdown } from './markdown'

export function AskAi() {
  const [question, setQuestion] = useState('')
  const { run, isRunning, streamingText, outputText, error } = useAgentTask({
    client: lemmaClient,
    agentName: 'briefing-agent',
    parseOutput: false,
  })

  const text = outputText || streamingText

  function ask() {
    const trimmed = question.trim()
    if (!trimmed || isRunning) return
    void run(trimmed)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-3 text-sm font-semibold text-zinc-200">Ask about your commitments</div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder='Try: "What is due this week?" or "Summarize my open loops"'
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-teal-600"
        />
        <button
          type="button"
          onClick={ask}
          disabled={isRunning || !question.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Ask
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400">{error.message}</p>
      ) : text ? (
        <div className="mt-3 text-sm leading-relaxed text-zinc-300">
          <Markdown text={text} />
        </div>
      ) : null}
    </div>
  )
}
