import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import { Layout } from './Layout'
import { ConnectionsScreen } from './ConnectionsScreen'
import { Dashboard } from './Dashboard'
import { CategoryView } from './CategoryView'
import { AiBriefing } from './AiBriefing'
import { AskAi } from './AskAi'
import './styles.css'

// One QueryClient per app. Connector accounts/pod info are fetched through it
// (see ConnectionsScreen) — no manual fetch-in-useEffect, no polling.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard
        client={lemmaClient}
        loadingFallback={
          <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
            Checking access...
          </main>
        }
      >
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ConnectionsScreen />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="loops" element={<CategoryView category="loop" title="Open Loops" />} />
              <Route path="deadlines" element={<CategoryView category="deadline" title="Deadlines" />} />
              <Route path="recurring" element={<CategoryView category="recurring" title="Recurring Tasks" />} />
              <Route path="documents" element={<CategoryView category="document" title="Documents" />} />
              <Route path="followups" element={<CategoryView category="followup" title="Follow-ups" />} />
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
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
