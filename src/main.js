/**
 * src/main.js
 * AOE_WEB — Application Bootstrap & Master Shell Integration
 *
 * Responsibilities:
 *   1. Mount global stylesheet
 *   2. Register bus dev logger (dev mode only)
 *   3. Build app shell (simulation banner, scroll root, view container, nav, toast)
 *   4. Wire reactive view renderer — replaces view content on view:changed events
 *   5. Wire toast notifications for stock change confirmations
 *
 * render/init pattern:
 *   All render() calls produce HTML strings.
 *   A single innerHTML assignment mounts the full shell.
 *   All init() calls fire after mount to wire DOM listeners and bus subscriptions.
 */

import '@/styles/main.css'

// Core modules — import router to register its bus/hashchange side effects
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { getCurrentView } from '@/core/router.js'
import '@/core/router.js'
import { subscribeToOrders, subscribeToStock } from '@/core/supabase.js'
import '@/core/state.js'   // initialise product state engine on page load (seeds localStorage if empty)

// UI components
import * as Navigation from '@/components/Navigation.js'
import { showToast } from '@/components/Toast.js'

// Views
import * as ProductionBoard from '@/views/ProductionBoard.js'
import * as InventorySwitchboard from '@/views/InventorySwitchboard.js'

// ─── Bus dev logger ───────────────────────────────────────────────────────────
// ONLY permitted console.log path in the application — dev mode only.
if (import.meta.env.DEV) {
  bus.on('dev:log', (msg) => {
    // eslint-disable-next-line no-console
    console.log(msg)
  })
  bus.emit('dev:log', '[AOE] Bootstrap started — simulation flags: ' + JSON.stringify(FLAGS))
}

// ─── Shell fragments ──────────────────────────────────────────────────────────

function _simBanner() {
  if (!import.meta.env.DEV && !FLAGS.adminSimulated) return ''
  return `
    <div id="sim-banner" class="flex items-center justify-center gap-2 bg-amber-400/8 border-b border-amber-400/15 px-4 py-2 flex-shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
      <p class="text-[10px] sm:text-[11px] font-mono font-medium text-amber-400/90 tracking-widest uppercase text-center">
        System operating in simulation mode &nbsp;—&nbsp; all flags active
      </p>
    </div>`
}

// ─── View renderer ────────────────────────────────────────────────────────────

function _renderView(viewName) {
  const container = document.getElementById('view-container')
  if (!container) return

  if (viewName === 'dashboard') {
    container.innerHTML = ProductionBoard.render()
    ProductionBoard.init()
  } else if (viewName === 'inventory') {
    container.innerHTML = InventorySwitchboard.render()
    InventorySwitchboard.init()
  }

  // Scroll to top on view change
  const scrollRoot = document.getElementById('scroll-root')
  if (scrollRoot) scrollRoot.scrollTop = 0

  if (import.meta.env.DEV) {
    bus.emit('dev:log', `[AOE] View activated: ${viewName}`)
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function _bootstrap() {
  const app = document.getElementById('app')
  if (!app) return

  const initialView = getCurrentView()

  // ── Single-pass shell mount ──────────────────────────────────────────────────
  app.innerHTML = `
    <div class="flex flex-col h-screen overflow-hidden bg-zinc-950">

      ${_simBanner()}

      <!-- Scrollable view area — padding-bottom clears the fixed bottom nav -->
      <div
        id="scroll-root"
        class="flex-1 overflow-y-auto overscroll-none scroll-pad-nav"
      >
        <div id="view-container" class="max-w-lg mx-auto w-full">
          <!-- Active view rendered here -->
        </div>
      </div>

    </div>

    <!-- Fixed bottom nav — outside scroll-root so it doesn't scroll -->
    ${Navigation.render(initialView)}

    <!-- Toast container — above bottom nav, pointer-events-none so it doesn't block taps -->
    <div
      id="toast-container"
      class="fixed left-0 right-0 z-40 flex justify-center px-4 pointer-events-none toast-offset"
    ></div>`

  // ── Init all components after DOM is written ──────────────────────────────────
  Navigation.init()

  // ── Wire real-time subscriptions (sim or live depending on FLAGS) ─────────────
  subscribeToOrders()
  subscribeToStock()

  // ── Render initial view ───────────────────────────────────────────────────────
  _renderView(initialView)

  // ── Reactive view switching ───────────────────────────────────────────────────
  bus.on('view:changed', _renderView)

  // ── Toast on stock mutation ───────────────────────────────────────────────────
  bus.on('stock:changed', ({ name, size, in_stock }) => {
    const label = `${name} ${size}`
    showToast(
      in_stock
        ? `${label} marked IN STOCK`
        : `${label} marked OUT OF STOCK`,
      in_stock ? 'success' : 'warning'
    )
  })

  // ── Toast on order status update ──────────────────────────────────────────────
  bus.on('order:status:update', ({ id, status }) => {
    showToast(`Order updated → ${status}`, 'success')
  })

  // ── Inventory view refresh on product catalogue mutation ───────────────────
  // 'add'    → full view re-render so the new product row appears at the top
  //            and the header count updates cleanly.
  // 'toggle' → ignored here; InventorySwitchboard handles the in-place DOM swap
  //            already (avoids a visible re-render flash on every stock toggle).
  bus.on('products:mutated', ({ action }) => {
    if (action === 'add' && getCurrentView() === 'inventory') {
      _renderView('inventory')
    }
  })

  if (import.meta.env.DEV) {
    bus.emit('dev:log', `[AOE] Shell mounted. Initial view: ${initialView}`)
  }
}

_bootstrap()

// ─── Service Worker registration (PROD only) ───────────────────────────────────
// Never registered in Vite DEV mode — would intercept HMR fetch requests.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // SW registration failure is non-fatal — app functions without it.
        // Dispatched to dev logger; no bare console.log in committed code.
        bus.emit('dev:log', '[AOE] Service worker registration failed.')
      })
  })
}
