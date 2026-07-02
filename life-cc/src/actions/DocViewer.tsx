import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, Loader2, X } from 'lucide-react'
import { Markdown } from '../markdown'
import { previewDocument } from '../pod-functions'
import type { Commitment } from '../types'

export function DocViewer({ commitment }: { commitment: Commitment }) {
  const [open, setOpen] = useState(false)
  const previewMutation = useMutation({
    mutationFn: () => previewDocument(commitment.id),
  })
  const outputText = previewMutation.data?.content ?? ''
  const error = previewMutation.error

  function openViewer() {
    if (commitment.source_app === 'google_drive' && commitment.source_ref) {
      window.open(`https://drive.google.com/file/d/${commitment.source_ref}/view`, '_blank', 'noopener')
      return
    }
    setOpen(true)
    if (!outputText && !previewMutation.isPending) previewMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        aria-label="View document"
        title="View document"
        onClick={openViewer}
        className="rounded-md p-1.5 text-[#8d8274] hover:bg-[#f3eee7] hover:text-[#2c261f]"
      >
        <Eye size={14} />
      </button>

      {open ? (
        <div className="life-overlay">
          <div className="life-modal max-h-[80vh] w-full max-w-lg overflow-y-auto p-5 text-sm">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="life-modal__close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="life-modal__title">{commitment.title}</p>

            {previewMutation.isPending ? (
              <div className="flex items-center gap-2 text-[#6f6458]">
                <Loader2 size={14} className="animate-spin" /> Fetching document…
              </div>
            ) : error ? (
              <p className="text-[#e05c5c]">{error instanceof Error ? error.message : String(error)}</p>
            ) : (
              <div className="text-[#423a32]">
                <Markdown text={outputText} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
