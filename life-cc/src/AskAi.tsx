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
    <div className="life-card">
      <div className="life-card__header">
        <span className="life-card__title">Ask about your queue</span>
        <Sparkles size={14} className="text-[#b09078]" />
      </div>
      <p className="life-muted-note mb-3">Read-only answers from the commitments already loaded in the app.</p>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder='Try: "What is due this week?", "What is overdue?", or "What is snoozed?"'
          className="life-field flex-1"
        />
        <button
          type="button"
          onClick={ask}
          disabled={isLoading || !question.trim()}
          className="life-action-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Ask
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-[#e05c5c]">{error.message}</p>
      ) : text ? (
        <div className="mt-3 text-sm leading-relaxed text-[#423a32]">
          <Markdown text={text} />
        </div>
      ) : null}
    </div>
  )
}
