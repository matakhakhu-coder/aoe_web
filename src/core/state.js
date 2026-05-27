/**
 * src/core/state.js
 * AOE_WEB — Mutable Product State Engine
 *
 * Single source of truth for the product catalogue in the browser session.
 * Initialises from localStorage on first load; falls back to seeding from
 * src/fixtures/products.js if no persisted data exists.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 * Key   : 'aoe_dynamic_products'
 * Value : JSON array of product objects matching the `products` table schema
 * Scope : This module is browser-only — it MUST NOT be imported by
 *         api/webhook.js (Node.js serverless — no localStorage, no Vite aliases).
 *
 * ─── Bus contract ─────────────────────────────────────────────────────────────
 * Emits: products:mutated  { action: 'add'|'toggle', product: ProductRow }
 *
 *   action 'add'    → consumed by main.js to re-render the inventory view
 *   action 'toggle' → consumed by InventorySwitchboard for in-place DOM swap
 *                     (main.js deliberately ignores toggle to avoid view flash)
 *
 * ─── Live mode boundary ───────────────────────────────────────────────────────
 * When FLAGS.stockSimulated = false, state.js continues to maintain the local
 * in-memory cache. The Supabase subscription layer (supabase.js) will overwrite
 * the cache on remote UPDATE events so multi-device sync is preserved.
 * When FLAGS.adminSimulated = false, addProduct() will also write to Supabase
 * products table. This path is stubbed and documented below.
 */

import { PRODUCTS } from '@/fixtures/products.js'
import { bus } from '@/core/bus.js'

const STORAGE_KEY = 'aoe_dynamic_products'

// ─── Persistence helpers ──────────────────────────────────────────────────────

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // Corrupt or unreadable storage — fall through to seed from fixtures
  }
  return null
}

function _save(products) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
  } catch {
    // Storage quota exceeded — state is current in-memory for the session only
    bus.emit('dev:log', '[AOE] localStorage quota exceeded — product state not persisted to disk.')
  }
}

function _seed() {
  // Deep-copy fixtures so mutations don't affect the imported constant
  const seeded = PRODUCTS.map((p) => ({ ...p }))
  _save(seeded)
  bus.emit('dev:log', '[AOE] state.js seeded from fixtures — localStorage initialised.')
  return seeded
}

// ─── In-memory state ──────────────────────────────────────────────────────────
// Initialised synchronously on module load — single evaluation per page lifecycle

let _products = _load() ?? _seed()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getProducts()
 *
 * Returns a shallow copy of the current product array.
 * Mutations to the returned array do not affect internal state.
 *
 * @returns {Array<ProductRow>}
 */
export function getProducts() {
  return [..._products]
}

/**
 * addProduct({ name, size, price, image_url })
 *
 * Creates a new product row, assigns a UUID, persists to localStorage,
 * and broadcasts products:mutated { action: 'add' } on the bus.
 *
 * New products are prepended (newest-first) to match the switchboard display order.
 *
 * Validation: caller must pass a positive price and non-empty name/size.
 * addProduct() trusts its input — validate in the UI layer before calling.
 *
 * @param {{ name: string, size: string, price: number, image_url?: string|null }} product
 * @returns {ProductRow} The fully-formed row that was persisted
 */
export function addProduct({ name, size, price, image_url = null }) {
  const newProduct = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    size: String(size).trim(),
    price: Number(price),
    image_url: image_url ?? null,
    in_stock: true,
  }

  // Prepend — newest product appears at top of Inventory Switchboard
  _products = [newProduct, ..._products]
  _save(_products)

  bus.emit('products:mutated', { action: 'add', product: newProduct })
  bus.emit('dev:log', `[AOE] Product added: "${newProduct.name} ${newProduct.size}" @ R${newProduct.price}`)

  // Live mode stub (FLAGS.adminSimulated = false):
  //   supabase.from('products').insert([newProduct])
  //   Supabase Realtime will then broadcast to all connected clients.

  return newProduct
}

/**
 * toggleStock(id)
 *
 * Flips the in_stock boolean for a single product, persists to localStorage,
 * and broadcasts products:mutated { action: 'toggle' } on the bus.
 *
 * InventorySwitchboard performs the DOM swap immediately before calling this
 * function, so the UI is already updated — no re-render needed on toggle.
 *
 * @param {string} id  Product UUID
 * @returns {ProductRow|null}  The updated row, or null if the ID was not found
 */
export function toggleStock(id) {
  let updated = null

  _products = _products.map((p) => {
    if (p.id !== id) return p
    updated = { ...p, in_stock: !p.in_stock }
    return updated
  })

  if (!updated) {
    bus.emit('dev:log', `[AOE] toggleStock: product ID "${id}" not found in state — no-op`)
    return null
  }

  _save(_products)
  bus.emit('products:mutated', { action: 'toggle', product: updated })

  // Live mode stub (FLAGS.stockSimulated = false):
  //   supabase.from('products').update({ in_stock: updated.in_stock }).eq('id', id)
  //   supabase.js subscribeToStock() subscription will then sync all other clients.

  return updated
}
