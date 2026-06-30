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
        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <Eye size={14} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm shadow-2xl shadow-black/40 ring-1 ring-white/5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="mb-3 font-medium text-zinc-200">{commitment.title}</p>

            {previewMutation.isPending ? (
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 size={14} className="animate-spin" /> Fetching document…
              </div>
            ) : error ? (
              <p className="text-red-400">{error instanceof Error ? error.message : String(error)}</p>
            ) : (
              <div className="text-zinc-300">
                <Markdown text={outputText} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
