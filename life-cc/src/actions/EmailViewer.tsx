import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, Loader2, X } from 'lucide-react'
import { suggestGmailReply } from '../pod-functions'
import type { Commitment } from '../types'

export function EmailViewer({ commitment }: { commitment: Commitment }) {
  const [open, setOpen] = useState(false)
  const previewMutation = useMutation({
    mutationFn: () => suggestGmailReply(commitment.id),
  })
  const email = previewMutation.data
  const error = previewMutation.error

  function openViewer() {
    setOpen(true)
    if (!email && !previewMutation.isPending) previewMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        aria-label="View email"
        title="View email"
        onClick={openViewer}
        className="rounded-md p-1.5 text-[#8d8274] hover:bg-[#f3eee7] hover:text-[#2c261f]"
      >
        <Eye size={14} />
      </button>

      {open ? (
        <div className="life-overlay">
          <div className="life-modal life-modal--wide max-h-[80vh] overflow-y-auto text-sm">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="life-modal__close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="life-modal__title">{email?.subject || commitment.title}</p>

            {previewMutation.isPending ? (
              <div className="flex items-center gap-2 text-[#6f6458]">
                <Loader2 size={14} className="animate-spin" /> Fetching email…
              </div>
            ) : error ? (
              <p className="text-[#e05c5c]">{error instanceof Error ? error.message : String(error)}</p>
            ) : email ? (
              <div className="flex flex-col gap-2 text-[#423a32]">
                <p className="text-xs text-[#8d8274]">From: {email.sender || 'Unknown sender'}</p>
                <p className="whitespace-pre-wrap">{email.excerpt || '(no plain-text content available)'}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
