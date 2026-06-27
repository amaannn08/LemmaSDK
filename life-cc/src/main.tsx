import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGuard } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import { Layout } from './Layout'
import { ConnectionsScreen } from './ConnectionsScreen'
import { Dashboard } from './Dashboard'
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
          <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-zinc-500">Checking access...</main>
        }
      >
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<ConnectionsScreen />} />
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
