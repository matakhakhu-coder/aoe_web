/**
 * public/sw.js
 * AOE_WEB — Application Shell Service Worker
 *
 * Registered from src/main.js in PROD builds only (never in Vite DEV mode
 * to avoid interfering with HMR).
 *
 * ─── Caching strategy ─────────────────────────────────────────────────────────
 *
 * Shell (HTML + manifest)     → Network-first with shell fallback
 *   Ensures users always get the latest app on connectivity, but can still
 *   launch offline from the cached shell.
 *
 * Hashed static assets (/assets/*)  → Cache-first (immutable)
 *   Vite appends content hashes to filenames. A cached asset URL is forever
 *   valid — serve instantly from cache, skip the network.
 *
 * API routes (/api/*)         → Network-only (no caching)
 *   Webhook data must never be served stale. Always bypass cache.
 *
 * Cross-origin requests       → Pass through unmodified
 *
 * ─── Cache versioning ─────────────────────────────────────────────────────────
 * Bump CACHE_VERSION on each deployment to invalidate previous caches.
 * Old caches are cleaned up during the activate event.
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME    = `aoe-shell-${CACHE_VERSION}`

/** Files to pre-cache during service worker installation */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => {
        // Skip waiting so the new SW activates immediately
        return self.skipWaiting()
      })
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            // Remove all AOE caches that are not the current version
            .filter((name) => name.startsWith('aoe-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => {
        // Claim all open clients immediately — no page reload required
        return self.clients.claim()
      })
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin GET requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API routes — always bypass cache (webhook / serverless data must be fresh)
  if (url.pathname.startsWith('/api/')) return

  // Hashed static assets — cache first (content-addressed, never stale)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(_cacheFirst(request))
    return
  }

  // HTML navigation + shell files — network first with offline fallback
  event.respondWith(_networkFirstWithShellFallback(request))
})

// ─── Cache strategies ─────────────────────────────────────────────────────────

/**
 * Cache-first: serve from cache immediately; fetch and cache on miss.
 * Used for content-hashed Vite build assets that never change for a given URL.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function _cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      // Clone before consuming — response body can only be read once
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Asset unavailable offline', { status: 503 })
  }
}

/**
 * Network-first: attempt network; fall back to cache; ultimate fallback to shell.
 * Used for HTML and shell files that may update between deployments.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function _networkFirstWithShellFallback(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Network failed — serve from cache
    const cached = await caches.match(request)
    if (cached) return cached

    // Ultimate fallback: serve the cached app shell for all navigation requests
    // This lets the SPA router handle the route client-side even when offline
    const shell = await caches.match('/index.html')
    if (shell) return shell

    return new Response(
      '<html><body><p style="font-family:monospace;padding:2rem">AOE offline — reconnect to continue.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    )
  }
}
