import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAgentTask } from 'lemma-sdk/react'
import { CheckCircle2, Loader2, Reply, X } from 'lucide-react'
import { createGmailDraft, suggestGmailReply } from '../pod-functions'
import { lemmaClient } from '../lemma-client'
import type { Commitment } from '../types'

type Phase = 'idle' | 'suggesting' | 'review' | 'creating' | 'created'

export function ReplyPanel({ commitment }: { commitment: Commitment }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const agentTask = useAgentTask({
    client: lemmaClient,
    agentName: 'reply-suggestion-agent',
    parseOutput: false,
  })
  const suggestMutation = useMutation({
    mutationFn: () => suggestGmailReply(commitment.id),
    onSuccess: async (result) => {
      try {
        await agentTask.run(result.prompt)
      } catch (error) {
        setPhase('review')
        setText(error instanceof Error ? error.message : 'Reply suggestion failed.')
      }
    },
  })
  const draftMutation = useMutation({
    mutationFn: () => createGmailDraft({ commitment_id: commitment.id, final_text: text }),
    onSuccess: () => setPhase('created'),
  })
  const isRunning = suggestMutation.isPending || draftMutation.isPending || agentTask.isRunning
  const error = suggestMutation.error ?? draftMutation.error ?? agentTask.error

  useEffect(() => {
    if (open || phase === 'idle') return
    setText('')
    setPhase('idle')
    suggestMutation.reset()
    draftMutation.reset()
    agentTask.reset()
  }, [open, phase])

  useEffect(() => {
    if (agentTask.outputText && phase === 'suggesting') {
      setText(agentTask.outputText)
      setPhase('review')
    }
  }, [agentTask.outputText, phase])

  function openPanel() {
    setOpen(true)
    if (phase === 'idle') {
      setPhase('suggesting')
      suggestMutation.mutate()
    }
  }

  function createDraft() {
    setPhase('creating')
    draftMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        aria-label="Reply"
        title="Reply"
        onClick={openPanel}
        className="rounded-md p-1.5 text-[#8d8274] hover:bg-[#f3eee7] hover:text-[#2c261f]"
      >
        <Reply size={14} />
      </button>

      {open ? (
        <div className="life-overlay">
          <div className="life-modal life-modal--wide text-sm">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="life-modal__close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="life-modal__title">Reply to: {commitment.title}</p>

            {error ? (
              <p className="text-[#e05c5c]">{error instanceof Error ? error.message : String(error)}</p>
            ) : phase === 'created' ? (
              <p className="life-inline-status life-inline-status--success">
                <CheckCircle2 size={14} /> Draft created in Gmail.
              </p>
            ) : phase === 'suggesting' ? (
              <div className="flex items-center gap-2 text-[#6f6458]">
                <Loader2 size={14} className="animate-spin" /> Drafting a reply…
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  className="life-field life-field--textarea w-full"
                />
                <button
                  type="button"
                  onClick={createDraft}
                  disabled={phase === 'creating' || !text.trim()}
                  className="life-action-primary mt-3 inline-flex items-center gap-2 text-xs disabled:opacity-50"
                >
                  {phase === 'creating' ? <Loader2 size={12} className="animate-spin" /> : null}
                  Create draft
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
