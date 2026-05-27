/**
 * src/views/InventorySwitchboard.js
 * Inventory Switchboard — Dynamic Stock Shield + Product Management
 *
 * Reads product catalogue from src/core/state.js (localStorage-backed, seeded
 * from fixtures on first load). Supports full product creation via a slide-up
 * drawer form with FileReader-based image preview.
 *
 * render() → returns full HTML string including the Add Product drawer
 * init()   → wires all event listeners via delegation; idempotent on re-activation
 *
 * ─── Bus contract ─────────────────────────────────────────────────────────────
 * Emits  : stock:changed   { id, name, size, in_stock }  → Toast notification
 *          (products:mutated is emitted by state.js — not re-emitted here)
 *
 * Listens: (none — main.js owns view re-renders on products:mutated 'add')
 *
 * ─── Toggle flow ──────────────────────────────────────────────────────────────
 * Click → immediate DOM swap (smooth UX) → state.toggleStock() (persist)
 * → products:mutated { action: 'toggle' } → main.js ignores → no re-render flash
 *
 * ─── Add product flow ─────────────────────────────────────────────────────────
 * Open drawer → fill form → FileReader converts image to base64 data URL
 * → submit → state.addProduct() → products:mutated { action: 'add' }
 * → main.js calls _renderView('inventory') → fresh render, drawer reset
 * → showToast confirmation
 */

import { getProducts, addProduct, toggleStock } from '@/core/state.js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { formatCurrency, escapeHtml } from '@/core/utils.js'
import { showToast } from '@/components/Toast.js'

// ─── Size options (matches ARCHAAR_BUILD_MANIFEST.md schema) ──────────────────
const SIZE_OPTIONS = ['500ml', '1L', '2L', '5L']

// ─── Module-level image staging ───────────────────────────────────────────────
// Holds the base64 data URL between FileReader onload and form submit.
// Cleared on drawer open, drawer close, and after addProduct() fires.
let _pendingImageDataUrl = null

// ─── Badge HTML helper ────────────────────────────────────────────────────────

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

// ─── Toggle button HTML helper ────────────────────────────────────────────────
// 44px × 44px touch target wraps the 48×24px visual track.
// role="switch" + aria-checked satisfies WCAG 4.1.2 (Name, Role, Value).

function _toggleButtonHTML(inStock) {
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

// ─── Product row renderer ─────────────────────────────────────────────────────

function _renderRow(product) {
  return `
    <div
      data-product-id="${product.id}"
      class="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 transition-all duration-150 hover:border-zinc-700"
    >
      <!-- Product image / placeholder -->
      <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
        ${product.image_url
          ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" />`
          : `<span class="text-xs font-mono text-zinc-600 leading-none text-center px-1">${escapeHtml(product.size)}</span>`
        }
      </div>

      <!-- Details -->
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

      <!-- Stock controls -->
      <div class="flex flex-col items-end gap-2 flex-shrink-0">
        ${_stockBadgeHTML(product.in_stock)}
        <div class="flex items-center">
          ${_toggleButtonHTML(product.in_stock)}
        </div>
      </div>
    </div>`
}

// ─── Add Product drawer ───────────────────────────────────────────────────────
// Fixed overlay above the nav (z-[60]). Initially hidden; shown on button click.
// Close: tap backdrop, tap ✕, or submit form (main.js re-render resets it).

function _drawerHTML() {
  const sizeOptions = SIZE_OPTIONS
    .map((s) => `<option value="${s}">${s}</option>`)
    .join('')

  return `
    <div
      id="product-drawer"
      class="hidden fixed inset-0 z-[60] flex items-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <!-- Tap-to-close backdrop -->
      <div
        data-action="close-drawer"
        class="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm cursor-pointer"
      ></div>

      <!-- Slide-up panel -->
      <div class="relative w-full max-w-lg mx-auto bg-zinc-900 border border-zinc-800 border-b-0 rounded-t-2xl overflow-hidden">

        <!-- Drag handle -->
        <div class="flex justify-center pt-3 pb-1 pointer-events-none" aria-hidden="true">
          <div class="w-8 h-1 rounded-full bg-zinc-700"></div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h2 id="drawer-title" class="text-base font-semibold text-zinc-100">Add New Product</h2>
          <button
            data-action="close-drawer"
            aria-label="Close drawer"
            class="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="w-4 h-4" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Scrollable form -->
        <form id="add-product-form" novalidate class="px-5 py-4 space-y-4 overflow-y-auto max-h-[72vh]">

          <!-- Variant name -->
          <div class="space-y-1.5">
            <label for="product-name" class="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Variant Name
            </label>
            <input
              id="product-name"
              name="name"
              type="text"
              autocomplete="off"
              placeholder="e.g. Lemon Chilli Hot"
              class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors duration-150 min-h-[44px]"
            />
          </div>

          <!-- Container size -->
          <div class="space-y-1.5">
            <label for="product-size" class="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Container Size
            </label>
            <div class="relative">
              <select
                id="product-size"
                name="size"
                class="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors duration-150 min-h-[44px] pr-9"
              >
                <option value="" disabled selected class="text-zinc-600">Select a size</option>
                ${sizeOptions}
              </select>
              <!-- Custom dropdown chevron -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <!-- Price in ZAR -->
          <div class="space-y-1.5">
            <label for="product-price" class="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Price (ZAR)
            </label>
            <div class="relative">
              <span
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-zinc-500 pointer-events-none select-none"
                aria-hidden="true"
              >R</span>
              <input
                id="product-price"
                name="price"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                class="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3.5 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors duration-150 min-h-[44px]"
              />
            </div>
          </div>

          <!-- Product photo — FileReader → base64 data URL -->
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Product Photo
              <span class="text-zinc-600 normal-case tracking-normal font-normal ml-1">(optional)</span>
            </label>

            <!-- Drop zone label — doubles as the visible file trigger -->
            <label
              for="product-image"
              id="image-drop-zone"
              class="flex flex-col items-center justify-center gap-2 w-full h-24 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/60 transition-colors duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                class="w-6 h-6 text-zinc-600" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span id="image-label" class="text-xs text-zinc-600 font-mono">Tap to choose photo</span>
              <!-- Visually hidden real input -->
              <input
                id="product-image"
                name="image"
                type="file"
                accept="image/*"
                class="sr-only"
                aria-label="Product photo"
              />
            </label>

            <!-- Live image preview — hidden until FileReader completes -->
            <div id="image-preview-container" class="hidden mt-2">
              <img
                id="image-preview"
                src=""
                alt="Selected product photo preview"
                class="w-full h-36 object-cover rounded-xl border border-zinc-700"
              />
            </div>
          </div>

          <!-- Inline validation error -->
          <p id="form-error" class="hidden text-xs font-mono text-red-400 px-1" role="alert"></p>

          <!-- Submit CTA -->
          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-sm font-semibold py-3 rounded-lg transition-colors duration-150 min-h-[44px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              class="w-4 h-4 flex-shrink-0" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add to Catalogue
          </button>

          <!-- Safe-area spacer — keeps submit button above iOS home indicator -->
          <div class="pb-safe" aria-hidden="true"></div>

        </form>
      </div>
    </div>`
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  const products = getProducts()
  const inStockCount = products.filter((p) => p.in_stock).length
  const totalCount = products.length

  const rows = products.length > 0
    ? products.map(_renderRow).join('')
    : `<div class="flex flex-col items-center justify-center py-16 text-zinc-700">
         <p class="text-sm font-mono">No products yet — add your first variant above</p>
       </div>`

  return `
    <section id="view-inventory" class="px-4 pt-5 pb-4 space-y-3">

      <!-- Header row: title + Add Product CTA -->
      <header class="flex items-start justify-between gap-3 mb-1">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-zinc-100 leading-tight">Inventory Switchboard</h1>
          <p id="inventory-meta" class="text-xs font-mono text-zinc-500 mt-0.5">
            ${totalCount} product${totalCount !== 1 ? 's' : ''} &nbsp;·&nbsp;
            <span class="text-emerald-400">${inStockCount} in stock</span>
          </p>
        </div>

        <button
          id="open-add-product"
          aria-label="Add new product to catalogue"
          class="flex-shrink-0 flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors duration-150 min-h-[44px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            class="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Product
        </button>
      </header>

      <!-- Product rows -->
      <div id="product-list" class="space-y-2">
        ${rows}
      </div>

      <p class="text-[11px] font-mono text-zinc-600 text-center pt-2">
        Tap a toggle to change stock status · Changes persist across sessions
      </p>

    </section>

    ${_drawerHTML()}`
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Called on every view activation and after products:mutated re-render.
// Event delegation on scroll-root is safe to remove+re-add on each activation.
// Drawer and form listeners attach to new DOM elements each render — no guards needed.

export function init() {
  // ── Product row toggle — event delegation on scroll root ──────────────────
  const root = document.getElementById('scroll-root')
  if (root) {
    root.removeEventListener('click', _handleToggleClick)
    root.addEventListener('click', _handleToggleClick)
  }

  // ── Add Product button → open drawer ──────────────────────────────────────
  const addBtn = document.getElementById('open-add-product')
  if (addBtn) {
    addBtn.addEventListener('click', _openDrawer)
  }

  // ── Drawer close — backdrop + ✕ button ────────────────────────────────────
  const drawer = document.getElementById('product-drawer')
  if (drawer) {
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close-drawer"]')) _closeDrawer()
    })
  }

  // ── File input → FileReader → image preview ────────────────────────────────
  const fileInput = document.getElementById('product-image')
  if (fileInput) {
    fileInput.addEventListener('change', _handleFileChange)
  }

  // ── Form submission ────────────────────────────────────────────────────────
  const form = document.getElementById('add-product-form')
  if (form) {
    form.addEventListener('submit', _handleFormSubmit)
  }
}

// ─── Drawer open / close ──────────────────────────────────────────────────────

function _openDrawer() {
  const drawer = document.getElementById('product-drawer')
  if (!drawer) return

  // Clear any residual staged image from a previous session
  _pendingImageDataUrl = null

  drawer.classList.remove('hidden')

  // Shift focus to the first text input for mobile keyboard
  requestAnimationFrame(() => {
    const firstInput = drawer.querySelector('input[type="text"]')
    if (firstInput) firstInput.focus()
  })
}

function _closeDrawer() {
  const drawer = document.getElementById('product-drawer')
  if (!drawer) return
  drawer.classList.add('hidden')
  _pendingImageDataUrl = null
}

// ─── FileReader handler ───────────────────────────────────────────────────────

function _handleFileChange(e) {
  const file = e.target.files?.[0]

  if (!file || !file.type.startsWith('image/')) {
    _pendingImageDataUrl = null
    return
  }

  const reader = new FileReader()

  reader.onload = (evt) => {
    _pendingImageDataUrl = evt.target.result

    // Update drop zone label
    const imageLabel = document.getElementById('image-label')
    if (imageLabel) {
      imageLabel.textContent = file.name.length > 28
        ? file.name.slice(0, 25) + '…'
        : file.name
    }

    // Reveal image preview
    const preview = document.getElementById('image-preview')
    const previewContainer = document.getElementById('image-preview-container')
    if (preview) preview.src = _pendingImageDataUrl
    if (previewContainer) previewContainer.classList.remove('hidden')
  }

  reader.readAsDataURL(file)
}

// ─── Form submit handler ──────────────────────────────────────────────────────

function _handleFormSubmit(e) {
  e.preventDefault()

  const form = e.currentTarget
  const errorEl = document.getElementById('form-error')

  // Extract values before any DOM mutation
  const name     = form.elements['name']?.value?.trim() ?? ''
  const size     = form.elements['size']?.value ?? ''
  const priceRaw = parseFloat(form.elements['price']?.value ?? '0')

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!name) {
    return _showError(errorEl, 'Variant name is required.')
  }
  if (!size) {
    return _showError(errorEl, 'Please select a container size.')
  }
  if (isNaN(priceRaw) || priceRaw <= 0) {
    return _showError(errorEl, 'Price must be a positive value (e.g. 65.00).')
  }

  // Clear previous error
  _clearError(errorEl)

  // Snapshot image data before addProduct() triggers bus emit → re-render
  const imageUrl = _pendingImageDataUrl ?? null

  // ── Commit to state ────────────────────────────────────────────────────────
  // addProduct() synchronously emits products:mutated → main.js calls
  // _renderView('inventory') → DOM is replaced. Do not touch the DOM after this.
  const added = addProduct({ name, size, price: priceRaw, image_url: imageUrl })

  // ── Post-commit feedback ───────────────────────────────────────────────────
  // Toast writes to #toast-container in the persistent app shell — always available.
  showToast(`${added.name} ${added.size} added to catalogue`, 'success')

  bus.emit('dev:log', `[AOE] Form submitted — product committed to state: ${added.id}`)
}

function _showError(el, message) {
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden')
}

function _clearError(el) {
  if (!el) return
  el.textContent = ''
  el.classList.add('hidden')
}

// ─── Toggle click handler (named function for removeEventListener) ────────────

function _handleToggleClick(e) {
  const btn = e.target.closest('[data-action="toggle-stock"]')
  if (!btn) return

  const row = btn.closest('[data-product-id]')
  if (!row) return

  const productId = row.dataset.productId
  const products  = getProducts()
  const product   = products.find((p) => p.id === productId)
  if (!product) return

  const next = !product.in_stock

  // ── Immediate DOM swap — smooth UX before state round-trip ────────────────
  const badge  = row.querySelector('.stock-badge')
  const toggle = row.querySelector('.stock-toggle')
  if (badge)  badge.outerHTML  = _stockBadgeHTML(next)
  if (toggle) toggle.outerHTML = _toggleButtonHTML(next)

  // ── Persist via state engine ───────────────────────────────────────────────
  // Emits products:mutated { action: 'toggle' } — main.js ignores this action
  // (no re-render) so the DOM swap above is the only visible change.
  toggleStock(productId)

  // ── Toast via existing stock:changed channel ───────────────────────────────
  bus.emit('stock:changed', {
    id:       productId,
    name:     product.name,
    size:     product.size,
    in_stock: next,
  })
}
