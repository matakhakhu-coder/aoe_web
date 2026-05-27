/**
 * src/components/Navigation.js
 * Fixed Bottom Navigation Bar
 *
 * Two primary targets:
 *   - Production Board  (id: 'dashboard') — shows pending order count badge
 *   - Inventory Switch  (id: 'inventory') — stock state overview
 *
 * render(activeView) → HTML string
 * init()             → wires click handlers + listens to view:changed for active state updates
 *
 * Active state transitions are applied via direct DOM manipulation on view:changed
 * (no full re-render needed — avoids flash and listener rebinding overhead).
 */

import { bus } from '@/core/bus.js'
import { ORDERS } from '@/fixtures/orders.js'
import { FLAGS } from '@/core/flags.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _pendingCount() {
  if (!FLAGS.ordersSimulated) return 0
  return ORDERS.filter((o) => o.status === 'Pending').length
}

const _ICON_ORDERS = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    class="w-[22px] h-[22px]">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>`

const _ICON_INVENTORY = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    class="w-[22px] h-[22px]">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>`

// ─── Tab definitions ──────────────────────────────────────────────────────────

const _TABS = [
  { id: 'dashboard', label: 'Orders',    icon: _ICON_ORDERS },
  { id: 'inventory', label: 'Inventory', icon: _ICON_INVENTORY },
]

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * @param {'dashboard'|'inventory'} activeView
 * @returns {string} HTML string
 */
export function render(activeView = 'dashboard') {
  const pending = _pendingCount()

  const tabs = _TABS.map((tab) => {
    const isActive = tab.id === activeView
    const baseClass = 'nav-tab relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors duration-150 min-h-[44px] focus:outline-none'
    const stateClass = isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
    const badge = tab.id === 'dashboard'
      ? `<span
           id="nav-orders-badge"
           class="absolute top-2 right-[calc(50%-18px)] flex items-center justify-center min-w-[18px] h-[18px] bg-amber-400 text-zinc-950 text-[10px] font-mono font-bold leading-none px-1 rounded-full${pending > 0 ? '' : ' invisible'}"
         >${pending}</span>`
      : ''
    const indicator = isActive
      ? `<span class="nav-indicator absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-emerald-500 rounded-full"></span>`
      : `<span class="nav-indicator absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-transparent rounded-full"></span>`

    return `
      <button
        data-nav="${tab.id}"
        aria-label="Navigate to ${tab.label}"
        aria-current="${isActive ? 'page' : 'false'}"
        class="${baseClass} ${stateClass}"
      >
        ${indicator}
        <div class="relative">
          ${tab.icon}
          ${badge}
        </div>
        <span class="text-[11px] font-medium tracking-wide">${tab.label}</span>
      </button>`
  }).join('')

  return `
    <nav
      id="app-nav"
      role="navigation"
      aria-label="Primary navigation"
      class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/85 backdrop-blur-md border-t border-zinc-800 pb-safe"
    >
      <div class="flex items-stretch max-w-lg mx-auto">
        ${tabs}
      </div>
    </nav>`
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let _initDone = false

export function init() {
  if (_initDone) return
  _initDone = true

  // Wire tab click → nav:change event
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      bus.emit('nav:change', btn.dataset.nav)
    })
  })

  // Update orders badge count — driven by ProductionBoard via nav:badge:update
  bus.on('nav:badge:update', ({ count }) => {
    const badge = document.getElementById('nav-orders-badge')
    if (!badge) return
    badge.textContent = count
    badge.classList.toggle('invisible', count === 0)
  })

  // Update active state via DOM (no re-render — avoids listener rebinding)
  bus.on('view:changed', (viewName) => {
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      const isActive = btn.dataset.nav === viewName

      // Text colour
      btn.classList.toggle('text-emerald-400', isActive)
      btn.classList.toggle('text-zinc-500', !isActive)
      btn.classList.toggle('hover:text-zinc-300', !isActive)
      btn.setAttribute('aria-current', isActive ? 'page' : 'false')

      // Top indicator line
      const indicator = btn.querySelector('.nav-indicator')
      if (indicator) {
        indicator.classList.toggle('bg-emerald-500', isActive)
        indicator.classList.toggle('bg-transparent', !isActive)
      }
    })
  })
}
