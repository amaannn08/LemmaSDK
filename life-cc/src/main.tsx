import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthGuard, useCurrentUser } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import { Layout } from './Layout'
import { ConnectionsScreen } from './ConnectionsScreen'
import { Dashboard } from './Dashboard'
import { CategoryView } from './CategoryView'
import { UnclassifiedView } from './UnclassifiedView'
import { AiBriefing } from './AiBriefing'
import { AskAi } from './AskAi'
import { CommitmentsProvider } from './CommitmentsContext'
import { BriefingProvider } from './BriefingContext'
import { OnboardingScreen } from './OnboardingScreen'
import { useOnboardingState } from './onboarding-state'
import './styles.css'

// One QueryClient per app. Connector accounts/pod info are fetched through it
// (see ConnectionsScreen) — no manual fetch-in-useEffect, no polling.
const queryClient = new QueryClient()

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f0ece4] text-sm text-[#6f6458]">
      Checking access...
    </main>
  )
}

function OnboardingGate() {
  const location = useLocation()
  const { user, isLoading: userLoading } = useCurrentUser({ client: lemmaClient })
  const { isComplete, isLoading: onboardingLoading } = useOnboardingState()
  const routeState = location.state as { from?: string; onboardingUnlocked?: boolean } | null

  if (userLoading || onboardingLoading) {
    return <LoadingScreen />
  }

  if (routeState?.onboardingUnlocked) {
    return <Outlet />
  }

  const hasOnboarding = Boolean(user) && isComplete
  const currentPath = location.pathname

  if (currentPath !== '/onboarding' && !hasOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (currentPath === '/onboarding' && hasOnboarding) {
    const state = location.state as { from?: string } | null
    return <Navigate to={state?.from || '/dashboard'} replace />
  }

  return <Outlet />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard
        client={lemmaClient}
        loadingFallback={
          <LoadingScreen />
        }
      >
        <CommitmentsProvider>
          <BriefingProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<OnboardingGate />}>
                  <Route path="onboarding" element={<OnboardingScreen />} />
                  <Route element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="connections" element={<ConnectionsScreen />} />
                    <Route path="loops" element={<CategoryView category="loop" title="Open Loops" />} />
                    <Route path="deadlines" element={<CategoryView category="deadline" title="Deadlines" />} />
                    <Route path="recurring" element={<CategoryView category="recurring" title="Recurring Tasks" />} />
                    <Route path="documents" element={<CategoryView category="document" title="Documents" />} />
                    <Route path="followups" element={<CategoryView category="followup" title="Follow-ups" />} />
                    <Route path="unclassified" element={<UnclassifiedView />} />
                    <Route path="snoozed" element={<CategoryView title="Snoozed" status="snoozed" />} />
                    <Route
                      path="ai"
                      element={
                        <div className="flex flex-col gap-4">
                          <AiBriefing />
                          <AskAi />
                        </div>
                      }
                    />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </BriefingProvider>
        </CommitmentsProvider>
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
