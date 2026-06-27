import type { Commitment } from '../types'

export type ItemRowVariant = 'preview' | 'full'

export type ItemRowProps = {
  commitment: Commitment
  variant: ItemRowVariant
  onMarkDone: (id: string) => void
  onSnooze: (id: string) => void
  onDelete: (id: string) => void
  isUpdating?: boolean
}

// STUB — implementation lands separately. Signature is the contract other
// files build against; do not change these prop names without updating
// every caller. `variant: "preview"` is used in the Dashboard's compact
// per-category lists (no action buttons needed); `"full"` is used in the
// full category view pages (shows mark-done/snooze/delete actions).
export function ItemRow(_props: ItemRowProps) {
  return null
}
