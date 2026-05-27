/**
 * src/core/supabase.js
 * Supabase Client Initialisation + Real-Time Subscription Layer
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment.
 * Short-circuits to a null client when FLAGS.adminSimulated === true —
 * no database connection is attempted in simulation mode.
 *
 * All credentials must live in .env.local only (gitignored).
 * Never destructure import.meta.env at module level.
 * Always read inside the factory function to allow substitution in tests.
 *
 * ─── Subscription contract ────────────────────────────────────────────────────
 *
 * subscribeToOrders()
 *   Simulation: DEV-only timer injects a mock order onto the bus every 20s.
 *               Inactive in PROD sim builds (no noise on a real device).
 *   Live:       Supabase postgres_changes INSERT on `orders` table →
 *               bus.emit('order:new', orderRow)
 *
 * subscribeToStock()
 *   Simulation: No-op — local _stockState Map in InventorySwitchboard owns
 *               toggle state; no external signal needed.
 *   Live:       Supabase postgres_changes UPDATE on `products` table →
 *               bus.emit('stock:changed', { id, name, size, in_stock })
 *               Allows multi-tab/multi-device stock sync without page reload.
 *
 * Views MUST NOT import supabase directly — all state flows through bus events.
 */

import { createClient } from '@supabase/supabase-js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { getProducts } from '@/core/state.js'

// ─── Client factory ───────────────────────────────────────────────────────────

/**
 * Returns a live Supabase client when adminSimulated is false.
 * Returns null when adminSimulated is true — no connection attempted.
 */
function createSupabaseClient() {
  if (FLAGS.adminSimulated) {
    return null
  }

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      '[AOE] Supabase credentials missing. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local before setting adminSimulated: false.'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
}

export const supabase = createSupabaseClient()

// ─── Orders subscription ──────────────────────────────────────────────────────

/**
 * subscribeToOrders()
 *
 * Call once from main.js _bootstrap() after the shell is mounted.
 *
 * Simulation mode (FLAGS.ordersSimulated = true):
 *   In DEV only — injects a synthetic order onto the bus every 20 seconds
 *   so the new-order entrance animation and badge counter can be verified
 *   without any live integration. Silent in PROD builds.
 *
 * Live mode (FLAGS.ordersSimulated = false):
 *   Opens a Supabase Realtime channel on postgres_changes INSERT for the
 *   `orders` table. Emits 'order:new' on the bus; ProductionBoard prepends
 *   the card. Channel is registered once and persists for the page lifetime.
 */
export function subscribeToOrders() {
  if (FLAGS.ordersSimulated) {
    // ── Simulation path (DEV only) ─────────────────────────────────────────
    if (!import.meta.env.DEV) return

    let _simCounter = 100
    const _SIM_NAMES = ['Zanele Mokoena', 'Bongani Zulu', 'Lerato Sithole', 'Dineo Mahlangu']

    setInterval(() => {
      _simCounter++

      // Pull the live state catalogue so any owner-added products appear in
      // mock orders immediately — demonstrates the full dynamic data pipeline.
      const inStockProducts = getProducts().filter((p) => p.in_stock)
      if (inStockProducts.length === 0) {
        bus.emit('dev:log', '[SIM] No in-stock products — mock order injection skipped')
        return
      }

      const product  = inStockProducts[_simCounter % inStockProducts.length]
      const qty      = (_simCounter % 3) + 1
      const customer = _SIM_NAMES[_simCounter % _SIM_NAMES.length]

      const mockOrder = {
        id:             `sim-${_simCounter}-${Date.now()}`,
        created_at:     new Date().toISOString(),
        phone_number:   `+2782${String(_simCounter).padStart(7, '0')}`,
        customer_name:  customer,
        order_summary:  `${qty}x ${product.size} ${product.name}`,
        total_amount:   product.price * qty,
        status:         'Pending',
      }

      bus.emit('dev:log', `[SIM] Injecting mock order: ${mockOrder.order_summary} from ${customer}`)
      bus.emit('order:new', mockOrder)
    }, 20000)

    return
  }

  // ── Live path ──────────────────────────────────────────────────────────────
  if (!supabase) return

  supabase
    .channel('orders-insert')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        // Never query DOM inside a Supabase callback — dispatch to bus only.
        bus.emit('order:new', payload.new)
      }
    )
    .subscribe()
}

// ─── Stock subscription ───────────────────────────────────────────────────────

/**
 * subscribeToStock()
 *
 * Call once from main.js _bootstrap() after the shell is mounted.
 *
 * Simulation mode (FLAGS.stockSimulated = true):
 *   No-op. InventorySwitchboard owns its local _stockState Map and handles
 *   toggle mutations directly. No external signal is required or desirable.
 *
 * Live mode (FLAGS.stockSimulated = false):
 *   Opens a Supabase Realtime channel on postgres_changes UPDATE for the
 *   `products` table. Emits 'stock:changed' on the bus so any connected tab
 *   or device reflects the change without a page reload.
 */
export function subscribeToStock() {
  if (FLAGS.stockSimulated) {
    // No-op in simulation — InventorySwitchboard handles local state directly.
    return
  }

  // ── Live path ──────────────────────────────────────────────────────────────
  if (!supabase) return

  supabase
    .channel('products-update')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'products' },
      (payload) => {
        const row = payload.new
        // Never query DOM inside a Supabase callback — dispatch to bus only.
        bus.emit('stock:changed', {
          id: row.id,
          name: row.name,
          size: row.size,
          in_stock: row.in_stock,
        })
      }
    )
    .subscribe()
}
