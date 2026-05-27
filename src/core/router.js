/**
 * src/core/router.js
 * View Coordinator — AOE_WEB
 *
 * Zero-dependency hash-based view state manager.
 * Tracks the active view in a local string variable.
 * Communicates exclusively via src/core/bus.js — never touches the DOM directly.
 *
 * Valid views: 'dashboard' | 'inventory'
 * URL hash is kept in sync so the browser back/forward buttons work correctly.
 *
 * Event contract:
 *   Listens : nav:change(viewName)  — emitted by Navigation component on tab tap
 *   Emits   : view:changed(viewName) — consumed by main.js render loop
 */

import { bus } from '@/core/bus.js'

const VALID_VIEWS = ['dashboard', 'inventory']

function _hashView() {
  const hash = window.location.hash.slice(1)
  return VALID_VIEWS.includes(hash) ? hash : 'dashboard'
}

// Initialise from URL hash — allows direct deep-linking and page refresh
let _currentView = _hashView()

/**
 * Returns the currently active view name.
 * @returns {'dashboard'|'inventory'}
 */
export function getCurrentView() {
  return _currentView
}

/**
 * Transitions to a named view.
 * Updates local state, syncs URL hash, and emits view:changed.
 * @param {'dashboard'|'inventory'} viewName
 */
export function navigate(viewName) {
  if (!VALID_VIEWS.includes(viewName)) return
  if (viewName === _currentView) return // No-op for same view
  _currentView = viewName
  window.location.hash = viewName
  bus.emit('view:changed', viewName)
}

// ─── Bus integration ──────────────────────────────────────────────────────────

// Respond to Navigation component tab clicks
bus.on('nav:change', navigate)

// ─── Browser history integration ─────────────────────────────────────────────

// Honour browser back / forward button (hash change from non-navigate source)
window.addEventListener('hashchange', () => {
  const view = _hashView()
  if (view !== _currentView) {
    _currentView = view
    bus.emit('view:changed', view)
  }
})
