/**
 * src/views/ProductionBoard.js
 * Production Board — Live Sales Pipeline Control Tower
 *
 * Renders all orders as a native WhatsApp-style chat thread list.
 * Each row surfaces the customer avatar, name, order summary, relative
 * time, and a status indicator that mirrors WhatsApp messaging conventions:
 *
 *   Pending    → teal unread-count badge (wa-teal)
 *   Paid       → blue double-checkmark  (wa-blue-check)
 *   Dispatched → gray double-checkmark  (wa-text-secondary)
 *
 * render() → returns full HTML string
 * init()   → wires DOM listeners + persistent bus subscriptions (idempotent)
 *
 * Bus contract:
 *   Emits   : order:status:update  { id, status }
 *   Listens : order:status:update, order:new
 */

import { ORDERS } from '@/fixtures/orders.js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { generateFulfillmentTrigger } from '@/features/fulfillment/index.js'
import { timeAgo, formatCurrency, escapeHtml } from '@/core/utils.js'

// ─── Local state ──────────────────────────────────────────────────────────────

// Deep-copy fixtures; sorted newest-first
let _orders = ORDERS.map((o) => ({ ...o })).sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
)

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const _ICON_MSG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="w-4 h-4 flex-shrink-0">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>`

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns up to two initials from a customer name string.
 * "Zanele Mokoena" → "ZM"
 */
function _initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Parse the leading quantity from an order_summary string.
 * "2x 2L Lemon Chilli Hot" → "2"
 * Falls back to "1" if parsing fails.
 */
function _qty(summary) {
  const m = (summary || '').match(/^(\d+)x/)
  return m ? m[1] : '1'
}

// ─── Card renderer ────────────────────────────────────────────────────────────

function _renderCard(order) {
  const link        = generateFulfillmentTrigger(order)
  const displayName = escapeHtml(order.customer_name || 'Unknown Customer')
  const summary     = escapeHtml(order.order_summary)
  const isPending   = order.status === 'Pending'
  const isPaid      = order.status === 'Paid'

  const initials = _initials(order.customer_name)
  const qty      = _qty(order.order_summary)

  // ── Status indicator (right of summary line) ────────────────────────────────
  let statusBadge
  if (isPending) {
    statusBadge = `
      <span
        class="flex-shrink-0 bg-[#00a884] text-white text-[11px] font-bold rounded-full
               min-w-[22px] h-[22px] flex items-center justify-center px-1 leading-none"
      >${qty}</span>`
  } else if (isPaid) {
    statusBadge = `
      <span class="flex-shrink-0 text-[#53bdeb] text-[12px] font-semibold leading-none whitespace-nowrap">✓✓ Paid</span>`
  } else {
    // Dispatched / any other terminal state
    statusBadge = `
      <span class="flex-shrink-0 text-[#8696a0] text-[12px] font-semibold leading-none whitespace-nowrap">✓✓ Done</span>`
  }

  // ── Mark Paid button (Pending only) ─────────────────────────────────────────
  const markPaidBtn = isPending ? `
    <button
      data-action="mark-paid"
      data-order-id="${order.id}"
      aria-label="Mark order as paid"
      class="text-[13px] text-[#8696a0] hover:text-[#e9edef] font-medium
             min-h-[44px] px-2 transition-colors duration-150 focus:outline-none"
    >Mark Paid</button>` : ''

  return `
    <article
      data-order-id="${order.id}"
      class="border-b border-[#222c32] bg-[#111b21] hover:bg-[#182229] transition-colors duration-150"
    >
      <!-- Main row: avatar · content · time+badge ──────────────────────────── -->
      <div class="flex items-start gap-3 px-4 py-3">

        <!-- Customer avatar (initials) -->
        <div
          class="flex-shrink-0 w-12 h-12 rounded-full bg-[#202c33] border border-[#2b3943]
                 flex items-center justify-center select-none"
        >
          <span class="text-sm font-semibold text-[#00a884] leading-none">${initials}</span>
        </div>

        <!-- Content column -->
        <div class="flex-1 min-w-0 py-0.5">

          <!-- Name + relative time -->
          <div class="flex items-baseline justify-between gap-2 mb-0.5">
            <p class="text-[15px] font-medium text-[#e9edef] truncate leading-snug">${displayName}</p>
            <span class="text-[11px] text-[#8696a0] flex-shrink-0 tabular-nums">${timeAgo(order.created_at)}</span>
          </div>

          <!-- Order summary + status badge -->
          <div class="flex items-center justify-between gap-2">
            <p class="text-[13px] text-[#8696a0] truncate">${summary}</p>
            ${statusBadge}
          </div>

        </div>
      </div>

      <!-- Row footer: total · chat actions ─────────────────────────────────── -->
      <div class="flex items-center justify-between pl-[4.75rem] pr-4 pb-3 -mt-1 gap-2">
        <span class="text-[13px] font-mono font-semibold text-[#e9edef]">${formatCurrency(order.total_amount)}</span>
        <div class="flex items-center gap-1">
          ${markPaidBtn}
          <a
            href="${link}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Send banking details via WhatsApp"
            class="flex items-center gap-1.5 text-[13px] text-[#00a884] hover:text-[#00bd99]
                   font-medium min-h-[44px] px-2 transition-colors duration-150 focus:outline-none"
          >
            ${_ICON_MSG}
            <span>Send Details</span>
          </a>
        </div>
      </div>

    </article>`
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  const pendingCount = _orders.filter((o) => o.status === 'Pending').length
  const totalCount   = _orders.length

  const cards = _orders.length > 0
    ? _orders.map(_renderCard).join('')
    : `<div data-empty-state class="flex flex-col items-center justify-center py-20 text-[#8696a0]">
         <p class="text-sm">No orders in queue</p>
       </div>`

  return `
    <section id="view-dashboard">

      <!-- Sticky WhatsApp App Bar ──────────────────────────────────────────── -->
      <div class="sticky top-0 z-10 bg-[#202c33] h-14 flex items-center justify-between px-4 border-b border-[#222c32]">
        <div>
          <p class="text-[15px] font-medium text-[#e9edef] leading-tight">Orders</p>
          <p class="text-[12px] text-[#8696a0] mt-0.5">
            ${totalCount} total ·
            <span data-pending-count class="text-[#00a884]">${pendingCount} pending</span>
          </p>
        </div>
      </div>

      <!-- Chat-style order list ────────────────────────────────────────────── -->
      <div id="order-list">
        ${cards}
      </div>

    </section>`
}

// ─── Init ─────────────────────────────────────────────────────────────────────

let _busListenerRegistered = false

export function init() {
  // ── DOM event delegation on scroll root (re-registered each view activation) ─
  const root = document.getElementById('scroll-root')
  if (root) {
    root.removeEventListener('click', _handleClick)
    root.addEventListener('click', _handleClick)
  }

  // ── Bus listeners (registered once per session) ─────────────────────────────
  if (_busListenerRegistered) return
  _busListenerRegistered = true

  // ── order:status:update — in-place card swap ─────────────────────────────────
  bus.on('order:status:update', ({ id, status }) => {
    const order = _orders.find((o) => o.id === id)
    if (!order) return
    order.status = status

    const card = document.querySelector(`[data-order-id="${id}"]`)
    if (!card) return

    const wrapper = document.createElement('div')
    wrapper.innerHTML = _renderCard(order)
    card.replaceWith(wrapper.firstElementChild)

    const pendingCount = _orders.filter((o) => o.status === 'Pending').length
    bus.emit('nav:badge:update', { count: pendingCount })

    // Keep sticky header pending count in sync
    const container = document.getElementById('view-dashboard')
    if (container) {
      const span = container.querySelector('[data-pending-count]')
      if (span) span.textContent = `${pendingCount} pending`
    }
  })

  // ── order:new — prepend card with entrance animation ─────────────────────────
  bus.on('order:new', (newOrder) => {
    _orders.unshift({ ...newOrder })

    const container = document.getElementById('view-dashboard')
    if (!container) return

    // Remove empty-state placeholder if present
    const emptyState = container.querySelector('[data-empty-state]')
    if (emptyState) emptyState.remove()

    const wrapper = document.createElement('div')
    wrapper.innerHTML = _renderCard(newOrder)
    const newCard = wrapper.firstElementChild
    newCard.classList.add('card-enter')

    const orderList = document.getElementById('order-list')
    if (orderList) {
      orderList.insertBefore(newCard, orderList.firstChild)
    } else {
      container.appendChild(newCard)
    }

    // Update sticky header pending count
    const pendingCount = _orders.filter((o) => o.status === 'Pending').length
    const span = container.querySelector('[data-pending-count]')
    if (span) span.textContent = `${pendingCount} pending`

    bus.emit('nav:badge:update', { count: pendingCount })
  })
}

// ─── Click handler (named for removeEventListener) ────────────────────────────

function _handleClick(e) {
  const btn = e.target.closest('[data-action="mark-paid"]')
  if (!btn) return
  bus.emit('order:status:update', { id: btn.dataset.orderId, status: 'Paid' })
}
