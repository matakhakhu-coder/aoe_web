/**
 * src/core/bus.js
 * Lightweight Event Bus — Pub/Sub Communication Layer
 *
 * All cross-module communication in AOE_WEB routes through this bus.
 * No module may directly import from another feature's internal files.
 * No direct DOM queries inside Supabase subscription callbacks — dispatch
 * to bus here; handle in the view layer.
 *
 * Usage:
 *   import { bus } from '@/core/bus.js'
 *   bus.on('order:new', (order) => { ... })
 *   bus.emit('order:new', orderObject)
 *   bus.off('order:new', handler)
 */

const _listeners = {}

/**
 * Subscribe to an event.
 * @param {string} event - Event name (e.g. 'order:new', 'product:stock:toggle')
 * @param {Function} fn - Handler function; receives emitted data as first argument
 */
function on(event, fn) {
  if (!_listeners[event]) {
    _listeners[event] = []
  }
  _listeners[event].push(fn)
}

/**
 * Publish an event with optional payload.
 * @param {string} event - Event name
 * @param {*} data - Payload passed to all registered handlers
 */
function emit(event, data) {
  const handlers = _listeners[event]
  if (!handlers || handlers.length === 0) return
  handlers.forEach((fn) => fn(data))
}

/**
 * Unsubscribe a specific handler from an event.
 * @param {string} event - Event name
 * @param {Function} fn - The exact function reference passed to on()
 */
function off(event, fn) {
  if (!_listeners[event]) return
  _listeners[event] = _listeners[event].filter((handler) => handler !== fn)
}

export const bus = { on, emit, off }
