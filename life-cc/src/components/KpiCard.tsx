import type { LucideIcon } from 'lucide-react'

export type KpiTone = 'red' | 'amber' | 'gold' | 'blue' | 'zinc'

export type KpiCardProps = {
  icon: LucideIcon
  tone: KpiTone
  value: number
  label: string
  sublabel: string
  badgeText: string
  progressPercent: number
}

// STUB — implementation lands separately. Signature is the contract other
// files build against; do not change these prop names without updating
// every caller.
export function KpiCard(_props: KpiCardProps) {
  return null
}
