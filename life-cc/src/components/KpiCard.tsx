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
  red: { chip: 'life-kpi-card__icon--rose', icon: 'text-[#e05c5c]', badge: 'life-kpi-card__badge--rose', bar: 'bg-[#e05c5c]' },
  amber: { chip: 'life-kpi-card__icon--gold', icon: 'text-[#f5a623]', badge: 'life-kpi-card__badge--gold', bar: 'bg-[#f5a623]' },
  gold: { chip: 'life-kpi-card__icon--gold', icon: 'text-[#c28a33]', badge: 'life-kpi-card__badge--gold', bar: 'bg-[#c8a882]' },
  blue: { chip: 'life-kpi-card__icon--blue', icon: 'text-[#4a90d9]', badge: 'life-kpi-card__badge--blue', bar: 'bg-[#4a90d9]' },
  zinc: { chip: 'bg-[#f1ece4]', icon: 'text-[#7b7064]', badge: 'life-kpi-card__badge--muted', bar: 'bg-[#8c8274]' },
}

function MiniVisual({ tone }: { tone: KpiTone }) {
  if (tone === 'amber') {
    return (
      <div className="life-kpi-card__bars">
        <span style={{ height: '18px' }} />
        <span style={{ height: '28px' }} />
        <span style={{ height: '14px' }} />
        <span style={{ height: '32px' }} />
        <span style={{ height: '22px' }} />
        <span style={{ height: '36px' }} />
        <span style={{ height: '20px' }} />
      </div>
    )
  }

  if (tone === 'gold') {
    return (
      <div className="life-kpi-card__dots">
        <span />
        <span />
        <span />
        <span className="is-empty" />
        <span className="is-empty" />
        <span className="is-empty" />
        <span className="is-empty" />
        <span className="is-empty" />
        <span className="is-empty" />
        <span className="is-empty" />
      </div>
    )
  }

  const stroke = tone === 'red' ? '#e05c5c' : '#4a90d9'
  const fill = tone === 'red' ? 'rgba(224,92,92,0.18)' : 'rgba(74,144,217,0.18)'

  return (
    <svg className="life-kpi-card__sparkline" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0,30 C10,28 20,35 30,25 C40,15 50,30 60,20 C70,10 80,22 90,18 C100,14 110,20 120,15"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
      <path
        d="M0,30 C10,28 20,35 30,25 C40,15 50,30 60,20 C70,10 80,22 90,18 C100,14 110,20 120,15 L120,40 L0,40 Z"
        fill={fill}
      />
      <circle cx="0" cy="30" r="3" fill={stroke} />
    </svg>
  )
}

export function KpiCard({ icon: Icon, tone, value, label, sublabel, badgeText, progressPercent }: KpiCardProps) {
  const style = TONE_STYLE[tone]
  return (
    <div
      className={`life-kpi-card ${
        tone === 'red'
          ? 'life-kpi-card--rose'
          : tone === 'blue'
            ? 'life-kpi-card--blue'
            : tone === 'gold'
              ? 'life-kpi-card--green'
              : 'life-kpi-card--gold'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className={`life-kpi-card__icon ${style.chip}`}>
          <Icon size={16} className={style.icon} />
        </div>
        <span className={`life-kpi-card__badge ${style.badge}`}>{badgeText}</span>
      </div>
      <div className="life-kpi-card__value">{value}</div>
      <div className="life-kpi-card__label">{label}</div>
      <div className="life-kpi-card__sublabel">{sublabel}</div>
      <div className="life-kpi-card__chart">
        <MiniVisual tone={tone} />
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#f0e8dd]">
          <div
            className={`h-full rounded-full ${style.bar}`}
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      </div>
    </div>
  )
}
