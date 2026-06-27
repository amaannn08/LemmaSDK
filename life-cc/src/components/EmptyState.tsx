import type { LucideIcon } from 'lucide-react'

export type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
}

// STUB — implementation lands separately. Signature is the contract other
// files build against; do not change these prop names without updating
// every caller.
export function EmptyState(_props: EmptyStateProps) {
  return null
}
