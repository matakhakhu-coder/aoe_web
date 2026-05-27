/**
 * src/views/InventorySwitchboard.js
 * Inventory Switchboard — Dynamic Stock Shield
 *
 * Renders all products from the simulated catalogue (src/fixtures/products.js)
 * when FLAGS.stockSimulated === true. Maintains a local mutable stock state map
 * so toggles are instant without a database round-trip.
 *
 * render() → returns full HTML string of the switchboard and all product rows
 * init()   → wires toggle interaction via event delegation
 *
 * Bus event contract:
 *   Emits : stock:changed  { id, name, size, in_stock: boolean }
 *           → consumed by Toast in main.js for UI confirmation
 *           → in live mode: consumed by supabase module to commit mutation
 *
 * Live mode path: FLAGS.stockSimulated = false → call supabase.from('products')
 * .update({ in_stock: next }).eq('id', id) before bus.emit
 */

import { PRODUCTS } from '@/fixtures/products.js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { formatCurrency, escapeHtml } from '@/core/utils.js'

// ─── Local stock state ────────────────────────────────────────────────────────
// Initialised from fixture data — mutations tracked here in simulation mode.
const _stockState = new Map(PRODUCTS.map((p) => [p.id, p.in_stock]))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isInStock(productId) {
  return _stockState.get(productId) ?? false
}

function _stockBadgeHTML(inStock) {
  return inStock
    ? `<span class="stock-badge inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all duration-150">
         <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
         IN STOCK
       </span>`
    : `<span class="stock-badge inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 transition-all duration-150">
         <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
         OUT OF STOCK
       </span>`
}

function _toggleButtonHTML(inStock) {
  // The visible track is 48×24px but the interactive tap target wraps it at
  // min-h-[44px] min-w-[44px] with negative margin compensation (-m-2.5)
  // so the 44px touch spec is met without disturbing the visual layout.
  return inStock
    ? `<button
         role="switch"
         aria-checked="true"
         data-action="toggle-stock"
         aria-label="Mark as out of stock"
         class="stock-toggle inline-flex items-center justify-center p-2.5 -m-2.5 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg"
       >
         <span class="pointer-events-none flex-shrink-0 w-12 h-6 rounded-full relative transition-colors duration-200 bg-emerald-500">
           <span class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"></span>
         </span>
       </button>`
    : `<button
         role="switch"
         aria-checked="false"
         data-action="toggle-stock"
         aria-label="Mark as in stock"
         class="stock-toggle inline-flex items-center justify-center p-2.5 -m-2.5 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-zinc-500/40 rounded-lg"
       >
         <span class="pointer-events-none flex-shrink-0 w-12 h-6 rounded-full relative transition-colors duration-200 bg-zinc-700">
           <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-zinc-400 shadow-sm transition-transform duration-200"></span>
         </span>
       </button>`
}

// ─── Row renderer ─────────────────────────────────────────────────────────────

function _renderRow(product) {
  const inStock = _isInStock(product.id)

  return `
    <div
      data-product-id="${product.id}"
      class="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 transition-all duration-150 hover:border-zinc-700"
    >
      <!-- Product image placeholder -->
      <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
        ${product.image_url
          ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover"/>`
          : `<span class="text-xs font-mono text-zinc-600 leading-none text-center px-1">${escapeHtml(product.size)}</span>`
        }
      </div>

      <!-- Product details -->
      <div class="flex-1 min-w-0">
        <p class="text-[15px] font-semibold text-zinc-100 leading-tight truncate">
          ${escapeHtml(product.name)}
        </p>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-xs font-mono text-zinc-500">${escapeHtml(product.size)}</span>
          <span class="text-zinc-700">·</span>
          <span class="text-xs font-mono text-zinc-400">${formatCurrency(product.price)}</span>
        </div>
      </div>

      <!-- Stock toggle + badge -->
      <div class="flex flex-col items-end gap-2 flex-shrink-0">
        ${_stockBadgeHTML(inStock)}
        <div class="flex items-center gap-2">
          ${_toggleButtonHTML(inStock)}
        </div>
      </div>
    </div>`
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  const inStockCount = [..._stockState.values()].filter(Boolean).length
  const totalCount = PRODUCTS.length

  return `
    <section id="view-inventory" class="px-4 pt-5 pb-4 space-y-3">
      <header class="flex items-end justify-between mb-1">
        <div>
          <h1 class="text-xl font-semibold text-zinc-100 leading-tight">Inventory Switchboard</h1>
          <p class="text-xs font-mono text-zinc-500 mt-0.5">
            ${totalCount} products &nbsp;·&nbsp;
            <span class="text-emerald-400">${inStockCount} in stock</span>
          </p>
        </div>
      </header>

      <div class="space-y-2">
        ${PRODUCTS.map(_renderRow).join('')}
      </div>

      <p class="text-[11px] font-mono text-zinc-600 text-center pt-2">
        Tap a toggle to change stock status · Changes broadcast via event bus
      </p>
    </section>`
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init() {
  const root = document.getElementById('scroll-root')
  if (!root) return

  // Remove previous listener before re-attaching (view may be re-activated)
  root.removeEventListener('click', _handleToggleClick)
  root.addEventListener('click', _handleToggleClick)
}

// ─── Toggle handler ───────────────────────────────────────────────────────────

function _handleToggleClick(e) {
  const btn = e.target.closest('[data-action="toggle-stock"]')
  if (!btn) return

  // Walk up to the product row to get its ID
  const row = btn.closest('[data-product-id]')
  if (!row) return
  const productId = row.dataset.productId

  // Mutate local state
  const current = _stockState.get(productId) ?? false
  const next = !current
  _stockState.set(productId, next)

  const product = PRODUCTS.find((p) => p.id === productId)

  if (FLAGS.stockSimulated) {
    // Update DOM in-place — swap badge and toggle button without full re-render
    const badge = row.querySelector('.stock-badge')
    const toggle = row.querySelector('.stock-toggle')
    if (badge) badge.outerHTML = _stockBadgeHTML(next)
    if (toggle) toggle.outerHTML = _toggleButtonHTML(next)

    // Emit event — picked up by Toast in main.js (and Supabase adapter in live mode)
    bus.emit('stock:changed', {
      id: productId,
      name: product?.name ?? productId,
      size: product?.size ?? '',
      in_stock: next,
    })
  } else {
    // Live mode: supabase.from('products').update({ in_stock: next }).eq('id', productId)
    // Then emit bus event after successful commit
  }
}
