/**
 * src/components/Toast.js
 * Self-Dismissing Notification Overlay
 *
 * Renders into the #toast-container element mounted by main.js.
 * Positioned above the bottom navigation bar (bottom-20).
 * Auto-dismisses after 2500ms. Subsequent calls cancel the previous timer.
 *
 * Usage:
 *   import { showToast } from '@/components/Toast.js'
 *   showToast('Garlic Hot 2L marked OUT OF STOCK', 'warning')
 *
 * Types: 'success' | 'warning' | 'error'
 */

let _timer = null

const _TYPE_CONFIG = {
  success: { dot: 'bg-emerald-500', border: 'border-emerald-500/20' },
  warning: { dot: 'bg-amber-400',   border: 'border-amber-400/20' },
  error:   { dot: 'bg-red-500',     border: 'border-red-500/20' },
}

/**
 * Displays a toast notification.
 * @param {string} message
 * @param {'success'|'warning'|'error'} type
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container')
  if (!container) return

  clearTimeout(_timer)

  const cfg = _TYPE_CONFIG[type] ?? _TYPE_CONFIG.success

  container.innerHTML = `
    <div class="flex items-center gap-3 bg-zinc-900/95 border ${cfg.border} border border-zinc-700/80 rounded-xl px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur-sm max-w-[320px] w-full pointer-events-auto">
      <span class="w-2 h-2 flex-shrink-0 rounded-full ${cfg.dot}"></span>
      <p class="text-sm text-zinc-100 leading-snug">${message}</p>
    </div>`

  _timer = setTimeout(() => {
    if (container) container.innerHTML = ''
  }, 2500)
}
