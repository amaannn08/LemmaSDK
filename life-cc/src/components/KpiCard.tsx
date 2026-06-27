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

const TONE_STYLE: Record<KpiTone, { chip: string; icon: string; badge: string; bar: string }> = {
  red: { chip: 'bg-red-950', icon: 'text-red-400', badge: 'bg-red-950 text-red-400', bar: 'bg-red-500' },
  amber: { chip: 'bg-amber-950', icon: 'text-amber-400', badge: 'bg-amber-950 text-amber-400', bar: 'bg-amber-500' },
  gold: { chip: 'bg-yellow-950', icon: 'text-yellow-400', badge: 'bg-yellow-950 text-yellow-400', bar: 'bg-yellow-500' },
  blue: { chip: 'bg-blue-950', icon: 'text-blue-400', badge: 'bg-blue-950 text-blue-400', bar: 'bg-blue-500' },
  zinc: { chip: 'bg-zinc-800', icon: 'text-zinc-400', badge: 'bg-zinc-800 text-zinc-400', bar: 'bg-zinc-500' },
}

export function KpiCard({ icon: Icon, tone, value, label, sublabel, badgeText, progressPercent }: KpiCardProps) {
  const style = TONE_STYLE[tone]
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-shadow hover:shadow-lg hover:shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${style.chip}`}>
          <Icon size={16} className={style.icon} />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>{badgeText}</span>
      </div>
      <div className="text-2xl font-bold leading-none tracking-tight text-zinc-50">{value}</div>
      <div className="mt-1 text-xs font-medium text-zinc-400">{label}</div>
      <div className="mt-0.5 text-xs text-zinc-600">{sublabel}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
        />
      </div>
    </div>
  )
}
