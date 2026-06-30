import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useAllCommitments } from './CommitmentsContext'
import { Markdown } from './markdown'
import { answerReadOnlyQuestion } from './read-only-ask-ai'

export function AskAi() {
  const [question, setQuestion] = useState('')
  const [text, setText] = useState('')
  const { openRecords, snoozedRecords, isLoading, error } = useAllCommitments()

  function ask() {
    if (!question.trim() || isLoading) return
    setText(answerReadOnlyQuestion(question, { openRecords, snoozedRecords }))
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-1 text-sm font-semibold text-zinc-200">Ask about your queue</div>
      <p className="mb-3 text-xs text-zinc-500">Read-only answers from the commitments already loaded in the app.</p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder='Try: "What is due this week?", "What is overdue?", or "What is snoozed?"'
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-teal-600"
        />
        <button
          type="button"
          onClick={ask}
          disabled={isLoading || !question.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
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
