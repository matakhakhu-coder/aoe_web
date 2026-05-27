/**
 * src/views/ProductionBoard.js
 * Production Board — Live Sales Pipeline Control Tower
 *
 * Renders all orders from the simulated order stream (src/fixtures/orders.js)
 * when FLAGS.ordersSimulated === true.
 *
 * render() → returns full HTML string of the board and all order cards
 * init()   → wires DOM event listeners + registers persistent bus listener
 *            (idempotent — safe to call on every view activation)
 *
 * Local mutable order state is maintained in _orders.
 * Cards are updated in-place on status mutation without a full re-render.
 *
 * Bus event contract:
 *   Emits   : order:status:update  { id: string, status: 'Paid' }
 *   Listens : order:status:update  (updates local state + re-renders card)
 */

import { ORDERS } from '@/fixtures/orders.js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { generateFulfillmentTrigger } from '@/features/fulfillment/index.js'
import { timeAgo, formatCurrency, formatPhone, escapeHtml } from '@/core/utils.js'

// ─── Local state ──────────────────────────────────────────────────────────────

// Deep copy fixture data — sorted newest first
let _orders = ORDERS.map((o) => ({ ...o })).sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
)

// ─── Status configuration ─────────────────────────────────────────────────────

const _STATUS = {
  Pending:    { text: 'text-amber-400',   bg: 'bg-amber-400/10',   dot: 'bg-amber-400',   label: 'Pending' },
  Paid:       { text: 'text-blue-400',    bg: 'bg-blue-400/10',    dot: 'bg-blue-400',    label: 'Paid' },
  Dispatched: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500', label: 'Dispatched' },
}

function _statusCfg(status) {
  return _STATUS[status] ?? _STATUS.Pending
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const _ICON_MSG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="w-4 h-4 flex-shrink-0">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>`

const _ICON_CHECK = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="w-4 h-4 flex-shrink-0">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`

// ─── Card renderer ────────────────────────────────────────────────────────────

function _renderCard(order) {
  const sc = _statusCfg(order.status)
  const link = generateFulfillmentTrigger(order)
  const displayName = escapeHtml(order.customer_name || 'Unknown Customer')
  const summary = escapeHtml(order.order_summary)
  const isPending = order.status === 'Pending'
  const isPaid = order.status === 'Paid'

  return `
    <article
      data-order-id="${order.id}"
      class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-200 hover:border-zinc-700"
    >
      <!-- Card header -->
      <div class="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold text-zinc-100 truncate leading-tight">${displayName}</p>
          <p class="text-xs font-mono text-zinc-500 mt-0.5">${formatPhone(order.phone_number)}</p>
        </div>
        <span class="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.text} ${sc.bg}">
          <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}"></span>
          ${sc.label}
        </span>
      </div>

      <!-- Order summary -->
      <div class="px-4 py-3 border-t border-zinc-800/70">
        <p class="text-sm text-zinc-300 leading-relaxed">${summary}</p>
      </div>

      <!-- Total + timestamp -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-zinc-800/70 bg-zinc-950/40">
        <p class="text-base font-mono font-semibold text-zinc-100">${formatCurrency(order.total_amount)}</p>
        <p class="text-xs text-zinc-600 font-mono">${timeAgo(order.created_at)}</p>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2 px-4 pb-4 pt-3">
        <a
          href="${link}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors duration-150 min-h-[44px] select-none"
        >
          ${_ICON_MSG}
          <span>Send Banking Details</span>
        </a>
        ${isPending ? `
          <button
            data-action="mark-paid"
            data-order-id="${order.id}"
            class="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 hover:text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-colors duration-150 min-h-[44px] min-w-[44px] select-none"
            aria-label="Mark order as paid"
          >
            ${_ICON_CHECK}
            <span class="hidden sm:inline">Mark Paid</span>
          </button>` : ''}
      </div>
    </article>`
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  const pendingCount = _orders.filter((o) => o.status === 'Pending').length
  const totalCount = _orders.length

  const cards = _orders.length > 0
    ? _orders.map(_renderCard).join('')
    : `<div data-empty-state class="flex flex-col items-center justify-center py-20 text-zinc-700">
         <p class="text-sm font-mono">No orders in queue</p>
       </div>`

  return `
    <section id="view-dashboard" class="px-4 pt-5 pb-4 space-y-3">
      <header class="flex items-end justify-between mb-1">
        <div>
          <h1 class="text-xl font-semibold text-zinc-100 leading-tight">Production Board</h1>
          <p class="text-xs font-mono text-zinc-500 mt-0.5">
            ${totalCount} order${totalCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
            <span class="text-amber-400">${pendingCount} pending</span>
          </p>
        </div>
      </header>
      ${cards}
    </section>`
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let _busListenerRegistered = false

export function init() {
  // ── DOM event listeners (event delegation — re-registered each view activation) ──
  // Using the scroll root for delegation so we don't need to re-wire after card updates
  const root = document.getElementById('scroll-root')
  if (root) {
    // Remove previous delegation listener to avoid duplicates on view switch
    root.removeEventListener('click', _handleClick)
    root.addEventListener('click', _handleClick)
  }

  // ── Bus listener (registered once per session) ──────────────────────────────
  if (_busListenerRegistered) return
  _busListenerRegistered = true

  bus.on('order:status:update', ({ id, status }) => {
    // Mutate local state
    const order = _orders.find((o) => o.id === id)
    if (!order) return
    order.status = status

    // Update DOM in-place — only if the card is currently rendered
    const card = document.querySelector(`[data-order-id="${id}"]`)
    if (!card) return

    // Build new card fragment and swap
    const wrapper = document.createElement('div')
    wrapper.innerHTML = _renderCard(order)
    const newCard = wrapper.firstElementChild
    card.replaceWith(newCard)

    // Keep nav badge in sync after status change
    const pendingCount = _orders.filter((o) => o.status === 'Pending').length
    bus.emit('nav:badge:update', { count: pendingCount })
  })

  bus.on('order:new', (newOrder) => {
    // Prepend to local state — newest first
    _orders.unshift({ ...newOrder })

    // Prepend card to DOM with entrance animation (if view is active)
    const container = document.getElementById('view-dashboard')
    if (!container) return

    // Remove empty-state placeholder if present
    const emptyState = container.querySelector('[data-empty-state]')
    if (emptyState) emptyState.remove()

    const wrapper = document.createElement('div')
    wrapper.innerHTML = _renderCard(newOrder)
    const newCard = wrapper.firstElementChild
    newCard.classList.add('card-enter')

    // Insert after the header — first .space-y-3 child that isn't the header
    const header = container.querySelector('header')
    if (header && header.nextSibling) {
      container.insertBefore(newCard, header.nextSibling)
    } else {
      container.appendChild(newCard)
    }

    // Update header pending count text
    const pendingSpan = container.querySelector('header .text-amber-400')
    const pendingCount = _orders.filter((o) => o.status === 'Pending').length
    if (pendingSpan) pendingSpan.textContent = `${pendingCount} pending`

    // Drive nav badge
    bus.emit('nav:badge:update', { count: pendingCount })
  })
}

// ─── Event handler (named function for removeEventListener) ──────────────────

function _handleClick(e) {
  const btn = e.target.closest('[data-action="mark-paid"]')
  if (!btn) return
  bus.emit('order:status:update', { id: btn.dataset.orderId, status: 'Paid' })
}
