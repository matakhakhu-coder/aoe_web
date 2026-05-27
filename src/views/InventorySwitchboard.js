/**
 * src/views/InventorySwitchboard.js
 * Inventory Switchboard — Dynamic Stock Shield + Product Management
 *
 * Reads product catalogue from src/core/state.js (localStorage-backed).
 * Supports full CRUD: add, edit, archive — all via a recycled slide-up drawer.
 *
 * render() → returns full HTML string including the Add/Edit drawer
 * init()   → wires all event listeners; safe to call on every view activation
 *
 * ─── Drawer modes ─────────────────────────────────────────────────────────────
 * ADD  (_editingProductId = null)
 *   + Add Product button → blank form, "Add New Product" title, "Add to Catalogue" CTA
 *   submit → addProduct() → products:mutated 'add' → main.js re-renders view
 *
 * EDIT (_editingProductId = product.id)
 *   Edit button on row → pre-populated form, "Edit Product" title, "Update Product" CTA
 *   submit → updateProduct() → products:mutated 'edit' → main.js re-renders view
 *
 * ─── Toggle flow (in-place, no re-render) ────────────────────────────────────
 *   Click → DOM swap → toggleStock() → products:mutated 'toggle' → main.js ignores
 *
 * ─── Archive flow ─────────────────────────────────────────────────────────────
 *   Archive button → confirm() → archiveProduct() → products:mutated 'edit'
 *   → main.js re-renders → archived row is absent (filtered by state.getProducts())
 *
 * ─── Bus contract ─────────────────────────────────────────────────────────────
 * Emits: stock:changed  { id, name, size, in_stock } → Toast notification
 */

import { getProducts, addProduct, updateProduct, toggleStock, archiveProduct } from '@/core/state.js'
import { FLAGS } from '@/core/flags.js'
import { bus } from '@/core/bus.js'
import { formatCurrency, escapeHtml } from '@/core/utils.js'
import { showToast } from '@/components/Toast.js'

// ─── Size options (matches ARCHAAR_BUILD_MANIFEST.md schema) ──────────────────
const SIZE_OPTIONS = ['500ml', '1L', '2L', '5L']

// ─── Module-level drawer state ────────────────────────────────────────────────
let _editingProductId  = null   // null = add mode; string = edit mode (product UUID)
let _pendingImageDataUrl = null // base64 data URL staged between FileReader and submit

// ─── SVG icon helpers ─────────────────────────────────────────────────────────

const _ICON_PENCIL = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="w-[15px] h-[15px] flex-shrink-0" aria-hidden="true">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`

const _ICON_TRASH = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    class="w-[15px] h-[15px] flex-shrink-0" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>`

const _ICON_PLUS = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    class="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
    <path d="M12 5v14M5 12h14"/>
  </svg>`

const _ICON_CHECK = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    class="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`

// ─── Stock badge HTML ─────────────────────────────────────────────────────────

function _stockBadgeHTML(inStock) {
  return inStock
    ? `<span class="stock-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all duration-150 whitespace-nowrap">
         <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>IN STOCK
       </span>`
    : `<span class="stock-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 transition-all duration-150 whitespace-nowrap">
         <span class="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>OUT OF STOCK
       </span>`
}

// ─── Toggle button HTML ───────────────────────────────────────────────────────
// 44×44px touch target wraps the 48×24px visual track.
// data-id included so the unified row action handler resolves the product ID
// without walking up the DOM on every toggle interaction.

function _toggleButtonHTML(inStock, productId) {
  return inStock
    ? `<button
         role="switch"
         aria-checked="true"
         data-action="toggle-stock"
         data-id="${productId}"
         aria-label="Mark as out of stock"
         class="stock-toggle inline-flex items-center justify-center p-2.5 -m-2.5 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded-lg"
       >
         <span class="pointer-events-none flex-shrink-0 w-12 h-6 rounded-full relative transition-colors duration-200 bg-emerald-500">
           <span class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow-sm"></span>
         </span>
       </button>`
    : `<button
         role="switch"
         aria-checked="false"
         data-action="toggle-stock"
         data-id="${productId}"
         aria-label="Mark as in stock"
         class="stock-toggle inline-flex items-center justify-center p-2.5 -m-2.5 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-zinc-500/40 rounded-lg"
       >
         <span class="pointer-events-none flex-shrink-0 w-12 h-6 rounded-full relative transition-colors duration-200 bg-zinc-700">
           <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-zinc-400 shadow-sm"></span>
         </span>
       </button>`
}

// ─── Product row renderer ─────────────────────────────────────────────────────

function _renderRow(product) {
  return `
    <div
      data-product-id="${product.id}"
      class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-150 hover:border-zinc-700"
    >
      <!-- Main row: image · details · stock controls -->
      <div class="flex items-center gap-3 px-4 py-3">

        <!-- Product image / size placeholder -->
        <div class="flex-shrink-0 w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
          ${product.image_url
            ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" />`
            : `<span class="text-[10px] font-mono text-zinc-600 leading-tight text-center px-0.5">${escapeHtml(product.size)}</span>`
          }
        </div>

        <!-- Name · size · price -->
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-semibold text-zinc-100 leading-tight truncate">
            ${escapeHtml(product.name)}
          </p>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-xs font-mono text-zinc-500">${escapeHtml(product.size)}</span>
            <span class="text-zinc-700 text-xs">·</span>
            <span class="text-xs font-mono text-zinc-400">${formatCurrency(product.price)}</span>
          </div>
        </div>

        <!-- Stock badge + toggle -->
        <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
          ${_stockBadgeHTML(product.in_stock)}
          <div class="flex items-center">
            ${_toggleButtonHTML(product.in_stock, product.id)}
          </div>
        </div>
      </div>

      <!-- Action strip: edit · archive -->
      <div class="flex items-center justify-end gap-0.5 px-3 pb-2 border-t border-zinc-800/60 pt-1.5">
        <button
          data-action="edit"
          data-id="${product.id}"
          aria-label="Edit ${escapeHtml(product.name)}"
          class="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-600"
        >
          ${_ICON_PENCIL}
          <span>Edit</span>
        </button>
        <button
          data-action="archive"
          data-id="${product.id}"
          aria-label="Remove ${escapeHtml(product.name)}"
          class="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 py-2 text-xs font-medium text-red-500/60 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-900/40"
        >
          ${_ICON_TRASH}
          <span>Remove</span>
        </button>
      </div>
    </div>`
}

// ─── Add / Edit drawer HTML ───────────────────────────────────────────────────
// Rendered once as part of the view — hidden by default.
// Drawer mode (add vs edit) is toggled via DOM manipulation in _openAddDrawer /
// _openEditDrawer without re-rendering the full view.

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

        <!-- Drawer header -->
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
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-zinc-500 pointer-events-none select-none" aria-hidden="true">R</span>
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
              <input id="product-image" name="image" type="file" accept="image/*" class="sr-only" aria-label="Product photo" />
            </label>
            <div id="image-preview-container" class="hidden mt-2">
              <img id="image-preview" src="" alt="Selected product photo preview" class="w-full h-36 object-cover rounded-xl border border-zinc-700" />
            </div>
          </div>

          <!-- Inline validation error -->
          <p id="form-error" class="hidden text-xs font-mono text-red-400 px-1" role="alert"></p>

          <!-- Submit CTA — id allows label swap between add / edit modes -->
          <button
            id="drawer-submit-btn"
            type="submit"
            class="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-sm font-semibold py-3 rounded-lg transition-colors duration-150 min-h-[44px]"
          >
            ${_ICON_PLUS}
            <span id="drawer-submit-label">Add to Catalogue</span>
          </button>

          <!-- iOS safe-area spacer -->
          <div class="pb-safe" aria-hidden="true"></div>

        </form>
      </div>
    </div>`
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function render() {
  const products = getProducts()   // is_archived rows already excluded
  const inStockCount = products.filter((p) => p.in_stock).length
  const totalCount = products.length

  const rows = products.length > 0
    ? products.map(_renderRow).join('')
    : `<div class="flex flex-col items-center justify-center py-16 text-zinc-700">
         <p class="text-sm font-mono">No products yet — add your first variant above</p>
       </div>`

  return `
    <section id="view-inventory" class="px-4 pt-5 pb-4 space-y-3">

      <!-- Header: title · meta · Add Product CTA -->
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
          ${_ICON_PLUS}
          Add Product
        </button>
      </header>

      <!-- Product rows -->
      <div id="product-list" class="space-y-2">
        ${rows}
      </div>

      <p class="text-[11px] font-mono text-zinc-600 text-center pt-2">
        Toggle stock · Edit details · Remove to archive
      </p>

    </section>

    ${_drawerHTML()}`
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Called on every view activation (including after products:mutated re-renders).
// All listeners attach to freshly rendered DOM — no stale reference risk.

export function init() {
  // ── Unified row action handler via event delegation on scroll root ─────────
  const root = document.getElementById('scroll-root')
  if (root) {
    root.removeEventListener('click', _handleRowAction)
    root.addEventListener('click', _handleRowAction)
  }

  // ── Add Product button → open blank drawer ─────────────────────────────────
  const addBtn = document.getElementById('open-add-product')
  if (addBtn) {
    addBtn.addEventListener('click', _openAddDrawer)
  }

  // ── Drawer close — backdrop + ✕ ───────────────────────────────────────────
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

  // ── Form submit ────────────────────────────────────────────────────────────
  const form = document.getElementById('add-product-form')
  if (form) {
    form.addEventListener('submit', _handleFormSubmit)
  }
}

// ─── Drawer: open (add mode) ──────────────────────────────────────────────────

function _openAddDrawer() {
  _editingProductId  = null
  _pendingImageDataUrl = null

  // Reset form to blank state
  const form = document.getElementById('add-product-form')
  if (form) form.reset()

  // Reset image preview
  const previewContainer = document.getElementById('image-preview-container')
  if (previewContainer) previewContainer.classList.add('hidden')
  const imageLabel = document.getElementById('image-label')
  if (imageLabel) imageLabel.textContent = 'Tap to choose photo'

  // Add-mode labels
  const title = document.getElementById('drawer-title')
  if (title) title.textContent = 'Add New Product'
  const submitLabel = document.getElementById('drawer-submit-label')
  if (submitLabel) submitLabel.textContent = 'Add to Catalogue'
  const submitBtn = document.getElementById('drawer-submit-btn')
  if (submitBtn) {
    // Swap icon back to + plus (reinsert the full button content)
    submitBtn.innerHTML = `${_ICON_PLUS}<span id="drawer-submit-label">Add to Catalogue</span>`
  }

  _clearError(document.getElementById('form-error'))
  _showDrawerPanel()
}

// ─── Drawer: open (edit mode) ─────────────────────────────────────────────────

function _openEditDrawer(product) {
  _editingProductId  = product.id
  _pendingImageDataUrl = product.image_url ?? null

  // Populate form fields with existing product values
  const form = document.getElementById('add-product-form')
  if (form) {
    const nameEl  = form.elements['name']
    const sizeEl  = form.elements['size']
    const priceEl = form.elements['price']
    if (nameEl)  nameEl.value  = product.name
    if (sizeEl)  sizeEl.value  = product.size
    if (priceEl) priceEl.value = product.price
  }

  // Pre-load image preview if the product already has a photo
  const preview          = document.getElementById('image-preview')
  const previewContainer = document.getElementById('image-preview-container')
  const imageLabel       = document.getElementById('image-label')
  if (product.image_url) {
    if (preview)          preview.src = product.image_url
    if (previewContainer) previewContainer.classList.remove('hidden')
    if (imageLabel)       imageLabel.textContent = 'Current photo (tap to replace)'
  } else {
    if (preview)          preview.src = ''
    if (previewContainer) previewContainer.classList.add('hidden')
    if (imageLabel)       imageLabel.textContent = 'Tap to choose photo'
  }

  // Swap drawer title and submit button to edit mode
  const title = document.getElementById('drawer-title')
  if (title) title.textContent = 'Edit Product'
  const submitBtn = document.getElementById('drawer-submit-btn')
  if (submitBtn) {
    submitBtn.innerHTML = `${_ICON_CHECK}<span id="drawer-submit-label">Update Product</span>`
  }

  _clearError(document.getElementById('form-error'))
  _showDrawerPanel()
}

// ─── Drawer: shared show / close ─────────────────────────────────────────────

function _showDrawerPanel() {
  const drawer = document.getElementById('product-drawer')
  if (!drawer) return
  drawer.classList.remove('hidden')
  requestAnimationFrame(() => {
    const first = drawer.querySelector('input[type="text"]')
    if (first) first.focus()
  })
}

function _closeDrawer() {
  const drawer = document.getElementById('product-drawer')
  if (!drawer) return
  drawer.classList.add('hidden')
  _editingProductId    = null
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

    const imageLabel       = document.getElementById('image-label')
    const preview          = document.getElementById('image-preview')
    const previewContainer = document.getElementById('image-preview-container')

    if (imageLabel) {
      imageLabel.textContent = file.name.length > 28
        ? file.name.slice(0, 25) + '…'
        : file.name
    }
    if (preview)          preview.src = _pendingImageDataUrl
    if (previewContainer) previewContainer.classList.remove('hidden')
  }
  reader.readAsDataURL(file)
}

// ─── Form submit handler ──────────────────────────────────────────────────────

function _handleFormSubmit(e) {
  e.preventDefault()

  const form     = e.currentTarget
  const errorEl  = document.getElementById('form-error')

  // Extract values BEFORE any state mutation (DOM will be replaced synchronously)
  const name     = form.elements['name']?.value?.trim() ?? ''
  const size     = form.elements['size']?.value ?? ''
  const priceRaw = parseFloat(form.elements['price']?.value ?? '0')

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!name)                              return _showError(errorEl, 'Variant name is required.')
  if (!size)                              return _showError(errorEl, 'Please select a container size.')
  if (isNaN(priceRaw) || priceRaw <= 0)  return _showError(errorEl, 'Price must be a positive value.')

  _clearError(errorEl)

  const imageUrl        = _pendingImageDataUrl ?? null
  const editingId       = _editingProductId   // snapshot before state mutation clears it

  if (editingId) {
    // ── Edit mode: patch existing product ────────────────────────────────────
    const updated = updateProduct(editingId, {
      name,
      size,
      price: priceRaw,
      image_url: imageUrl,
    })
    // DOM is replaced by main.js products:mutated 'edit' handler — do not
    // reference form elements or drawer after this line.
    if (updated) showToast(`${updated.name} ${updated.size} updated`, 'success')

  } else {
    // ── Add mode: create new product ──────────────────────────────────────────
    const added = addProduct({ name, size, price: priceRaw, image_url: imageUrl })
    // DOM is replaced by main.js products:mutated 'add' handler.
    if (added) showToast(`${added.name} ${added.size} added to catalogue`, 'success')
  }
}

// ─── Unified row action handler ───────────────────────────────────────────────
// Handles toggle-stock, edit, and archive via a single delegated listener on
// #scroll-root. Named function reference allows clean removeEventListener.

function _handleRowAction(e) {
  const btn = e.target.closest('[data-action]')
  if (!btn) return

  const action    = btn.dataset.action
  const productId = btn.dataset.id

  // ── toggle-stock ───────────────────────────────────────────────────────────
  if (action === 'toggle-stock') {
    if (!productId) return
    const product = getProducts().find((p) => p.id === productId)
    if (!product) return

    const next = !product.in_stock

    // Immediate DOM swap for smooth UX — no re-render flash
    const row    = btn.closest('[data-product-id]')
    const badge  = row?.querySelector('.stock-badge')
    const toggle = row?.querySelector('.stock-toggle')
    if (badge)  badge.outerHTML  = _stockBadgeHTML(next)
    if (toggle) toggle.outerHTML = _toggleButtonHTML(next, productId)

    // Persist + emit products:mutated 'toggle' (main.js ignores toggle)
    toggleStock(productId)

    // Toast via existing stock:changed channel
    bus.emit('stock:changed', {
      id:       productId,
      name:     product.name,
      size:     product.size,
      in_stock: next,
    })
    return
  }

  // ── edit ───────────────────────────────────────────────────────────────────
  if (action === 'edit') {
    if (!productId) return
    const product = getProducts().find((p) => p.id === productId)
    if (!product) return
    _openEditDrawer(product)
    return
  }

  // ── archive ────────────────────────────────────────────────────────────────
  if (action === 'archive') {
    if (!productId) return
    const product = getProducts().find((p) => p.id === productId)
    if (!product) return

    const confirmed = window.confirm(
      `Are you sure you want to remove "${product.name} ${product.size}"?\n\nThe product will be archived and hidden from the catalogue.`
    )
    if (!confirmed) return

    archiveProduct(productId)
    // products:mutated 'edit' → main.js re-renders inventory → archived row absent
    showToast(`${product.name} ${product.size} removed from catalogue`, 'warning')
  }
}

// ─── Error helpers ────────────────────────────────────────────────────────────

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
