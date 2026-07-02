import { useState } from 'react'
import type { ComponentType } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { useCurrentUser } from 'lemma-sdk/react'
import { CONNECTORS, RECOMMENDED_CONNECTOR_SLUGS, type ConnectorSlug } from './connectors'
import { lemmaClient } from './lemma-client'
import { useConnectorAccounts } from './useConnectorAccounts'
import { useOnboardingState } from './onboarding-state'
import { getUserDisplayName } from './user-profile'
import { runExtraction } from './pod-functions'

function parseTargetPath(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return '/dashboard'
  return raw.startsWith('/') ? raw : '/dashboard'
}

function ConnectorCard({
  slug,
  label,
  description,
  icon: Icon,
  comingSoon,
  alwaysConnected,
  note,
  account,
  isBusy,
  error,
  onConnect,
  onDisconnect,
}: {
  slug: ConnectorSlug
  label: string
  description: string
  icon: ComponentType<{ size?: number; className?: string }>
  comingSoon?: boolean
  alwaysConnected?: boolean
  note?: string
  account?: { id: string; status: string }
  isBusy: boolean
  error?: string
  onConnect: (slug: ConnectorSlug) => void
  onDisconnect: (slug: ConnectorSlug, accountId: string) => void
}) {
  const isConnected = account?.status === 'CONNECTED' || Boolean(alwaysConnected)
  const needsReconnect = account?.status === 'REAUTH_REQUIRED'

  return (
    <article className={`life-connector-card ${isConnected ? 'life-connector-card--connected' : ''}`}>
      <div className="life-connector-card__top">
        <div className="life-connector-card__icon">
          <Icon size={18} />
        </div>
        <div className="life-connector-card__copy">
          <div className="life-connector-card__title-row">
            <h3>{label}</h3>
            {isConnected ? (
              <span className="life-inline-status life-inline-status--success">
                <CheckCircle2 size={14} />
                Connected
              </span>
            ) : needsReconnect ? (
              <span className="life-inline-status life-inline-status--warning">Reconnect</span>
            ) : comingSoon ? (
              <span className="life-muted-note">Coming soon</span>
            ) : null}
          </div>
          <p>{description}</p>
        </div>
      </div>

      <div className="life-connector-card__actions">
        {note ? (
          <span className="life-muted-note">{note}</span>
        ) : isConnected ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => account && onDisconnect(slug, account.id)}
            className="life-action-chip disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : null}
            Disconnect
          </button>
        ) : comingSoon ? (
          <button type="button" disabled className="life-action-chip opacity-60">
            Connect
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onConnect(slug)}
            className="life-action-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {isBusy ? <Loader2 size={14} className="animate-spin" /> : null}
            {needsReconnect ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>

      {error ? <p className="life-connector-card__error">{error}</p> : null}
    </article>
  )
}

function ConnectorSection({
  title,
  subtitle,
  connectors,
  accountBySlug,
  pendingSlug,
  actionErrors,
  onConnect,
  onDisconnect,
}: {
  title: string
  subtitle: string
  connectors: typeof CONNECTORS
  accountBySlug: Map<string, { id: string; status: string }>
  pendingSlug?: string
  actionErrors: Record<string, string>
  onConnect: (slug: ConnectorSlug) => void
  onDisconnect: (slug: ConnectorSlug, accountId: string) => void
}) {
  return (
    <section className="life-card life-onboarding-section">
      <div className="life-card__header">
        <span className="life-card__title">{title}</span>
        <span className="life-muted-note">{subtitle}</span>
      </div>
      <div className="life-onboarding-grid">
        {connectors.map((connector) => (
          <ConnectorCard
            key={connector.slug}
            slug={connector.slug}
            label={connector.label}
            description={connector.description}
            icon={connector.icon}
            comingSoon={connector.comingSoon}
            alwaysConnected={connector.alwaysConnected}
            note={connector.note}
            account={accountBySlug.get(connector.slug)}
            isBusy={pendingSlug === connector.slug}
            error={actionErrors[connector.slug]}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        ))}
      </div>
    </section>
  )
}

export function OnboardingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading: userLoading } = useCurrentUser({ client: lemmaClient })
  const { accountBySlug, pendingSlug, actionErrors, connectConnector, disconnectConnector } = useConnectorAccounts()
  const { saveCompleted, saveSkipped, isSaving } = useOnboardingState()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const displayName = getUserDisplayName(user)
  const targetPath = parseTargetPath((location.state as { from?: unknown } | null)?.from)
  const recommendedConnectors = CONNECTORS.filter((connector) => RECOMMENDED_CONNECTOR_SLUGS.includes(connector.slug))
  const secondaryConnectors = CONNECTORS.filter((connector) => !RECOMMENDED_CONNECTOR_SLUGS.includes(connector.slug))
  const connectedRecommendedCount = recommendedConnectors.filter((connector) => accountBySlug.get(connector.slug)?.status === 'CONNECTED').length
  const hasAnyRecommendedConnection = connectedRecommendedCount > 0
  const connectedConnectorSlugs = CONNECTORS.filter((connector) => accountBySlug.get(connector.slug)?.status === 'CONNECTED').map((connector) => connector.slug)
  const isUserReady = !userLoading && Boolean(user?.id)

  async function finishSetup() {
    setSubmitError(null)
    try {
      await saveCompleted(connectedConnectorSlugs)
      if (connectedConnectorSlugs.length > 0) {
        setIsExtracting(true)
        try {
          const runId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
          await runExtraction({ sync_run_id: runId })
        } catch {
          // Best effort — the dashboard's "Check now" covers a retry if this first pass fails.
        } finally {
          setIsExtracting(false)
        }
      }
      navigate(targetPath, { replace: true, state: { onboardingUnlocked: true } })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
    }
  }

  async function skipSetup() {
    setSubmitError(null)
    try {
      await saveSkipped(connectedConnectorSlugs)
      navigate(targetPath, { replace: true, state: { onboardingUnlocked: true } })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="life-onboarding">
      <section className="life-onboarding-hero life-card">
        <div className="life-onboarding-hero__eyebrow">
          <Sparkles size={14} />
          First-time setup
        </div>
        <h1 className="life-onboarding-hero__title">Welcome, {displayName}.</h1>
        <p className="life-onboarding-hero__copy">
          Connect your main Google services so Life Command Centre can pull in deadlines, follow-ups, documents, and recurring work automatically.
          You can skip setup and finish later from Connections.
        </p>

        <div className="life-onboarding-hero__stats">
          <div>
            <strong>{connectedRecommendedCount}</strong>
            <span>Recommended connected</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Recommended connectors</span>
          </div>
          <div>
            <strong>1 click</strong>
            <span>Skip anytime</span>
          </div>
        </div>

        <div className="life-onboarding-hero__actions">
          <button
            type="button"
            onClick={() => void finishSetup()}
            disabled={!isUserReady || !hasAnyRecommendedConnection || isSaving || isExtracting}
            className="life-action-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {isSaving || isExtracting ? <Loader2 size={14} className="animate-spin" /> : null}
            {isExtracting ? 'Pulling in your first items…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={() => void skipSetup()}
            disabled={!isUserReady || isSaving || isExtracting}
            className="life-action-chip disabled:opacity-60"
          >
            Skip for now
          </button>
        </div>

        {!isUserReady ? <p className="life-muted-note mt-3">Loading your account...</p> : null}
        {submitError ? <p className="life-connector-card__error mt-3">{submitError}</p> : null}
      </section>

      <section className="life-onboarding-stack">
        <ConnectorSection
          title="Recommended connections"
          subtitle="Start here for the live ingestion sources."
          connectors={recommendedConnectors}
          accountBySlug={accountBySlug}
          pendingSlug={pendingSlug}
          actionErrors={actionErrors}
          onConnect={connectConnector}
          onDisconnect={disconnectConnector}
        />

        <ConnectorSection
          title="More connectors"
          subtitle="Optional or roadmap services."
          connectors={secondaryConnectors}
          accountBySlug={accountBySlug}
          pendingSlug={pendingSlug}
          actionErrors={actionErrors}
          onConnect={connectConnector}
          onDisconnect={disconnectConnector}
        />

        <section className="life-card life-onboarding-footer">
          <div>
            <p className="life-onboarding-footer__title">Want to revisit setup later?</p>
            <p className="life-onboarding-footer__copy">Use Connections from the sidebar or come back here after you’ve explored the app.</p>
          </div>
          <Link to="/connections" className="life-action-chip inline-flex items-center gap-2">
            <ExternalLink size={14} />
            Manage connections
          </Link>
        </section>
      </section>
    </main>
  )
}
