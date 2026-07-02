import { LemmaClient } from 'lemma-sdk'

type LemmaRuntimeConfig = {
  apiUrl?: string
  authUrl?: string
  podId?: string
  timeoutMs?: number
}

const runtimeConfig = (window as Window & { __LEMMA_CONFIG__?: LemmaRuntimeConfig }).__LEMMA_CONFIG__ ?? {}
const envConfig = import.meta.env

// Shared Lemma client for this app. Lemma-hosted builds inject `window.__LEMMA_CONFIG__`
// at runtime, while local Vite dev falls back to the usual VITE_* env vars.
export const lemmaClient = new LemmaClient({
  apiUrl: runtimeConfig.apiUrl ?? envConfig.VITE_LEMMA_API_URL,
  authUrl: runtimeConfig.authUrl ?? envConfig.VITE_LEMMA_AUTH_URL,
  podId: runtimeConfig.podId ?? envConfig.VITE_LEMMA_POD_ID,
  // ponytail: SDK default is 30s; agent runs (LLM generation) routinely exceed that
  // under load, so the shared client needs headroom for every LLM-backed call.
  timeoutMs: runtimeConfig.timeoutMs ?? 90_000,
})

// ponytail: lemma-sdk's checkAuth() treats any /users/me hiccup (network
// blip, 5xx, a stale local session-exists check) as a real logout, and
// markUnauthenticated() fires straight off SuperTokens' UNAUTHORISED event
// with no re-check. Both flash the AuthGuard sign-in screen even though the
// session is still good (a reload re-verifies and it passes). Re-confirm
// with an authoritative cookie check before trusting either signal.
const auth = lemmaClient.auth
const rawCheckAuth = auth.checkAuth.bind(auth)
auth.checkAuth = async () => {
  const result = await rawCheckAuth()
  return result.status === 'unauthenticated' ? rawCheckAuth() : result
}
const rawMarkUnauthenticated = auth.markUnauthenticated.bind(auth)
auth.markUnauthenticated = () => {
  void auth.isAuthenticatedViaCookie().then((stillAuthed) => {
    if (!stillAuthed) rawMarkUnauthenticated()
  })
}
