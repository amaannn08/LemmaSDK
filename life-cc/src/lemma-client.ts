import { LemmaClient } from 'lemma-sdk'

// Shared Lemma client for this app. Runtime config comes from .env.local
// (VITE_LEMMA_API_URL / VITE_LEMMA_AUTH_URL / VITE_LEMMA_POD_ID), which
// `lemma apps init` writes for you. import.meta.env is typed via
// "vite/client" in tsconfig.json.
export const lemmaClient = new LemmaClient({
  apiUrl: import.meta.env.VITE_LEMMA_API_URL,
  authUrl: import.meta.env.VITE_LEMMA_AUTH_URL,
  podId: import.meta.env.VITE_LEMMA_POD_ID,
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
