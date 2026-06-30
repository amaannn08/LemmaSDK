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
        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Reply size={14} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm shadow-2xl shadow-black/40 ring-1 ring-white/5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="mb-3 font-medium text-zinc-200">Reply to: {commitment.title}</p>

            {error ? (
              <p className="text-red-400">{error instanceof Error ? error.message : String(error)}</p>
            ) : phase === 'created' ? (
              <p className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={14} /> Draft created in Gmail.
              </p>
            ) : phase === 'suggesting' ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 size={14} className="animate-spin" /> Drafting a reply from reduced message context…
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={10}
                  className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-zinc-100 outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={createDraft}
                  disabled={phase === 'creating' || !text.trim()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
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
