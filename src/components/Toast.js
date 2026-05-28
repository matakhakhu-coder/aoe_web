/**
 * src/components/Toast.js
 * Self-Dismissing Notification Snackbar — WhatsApp Native Style
 *
 * Renders into the #toast-container element mounted by main.js.
 * Positioned above the bottom navigation bar via .toast-offset utility.
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
  success: { dot: 'bg-[#00a884]', border: 'border-[#00a884]/30' },
  warning: { dot: 'bg-[#ffd279]', border: 'border-[#ffd279]/30' },
  error:   { dot: 'bg-red-400',   border: 'border-red-400/30' },
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
    <div
      class="flex items-center gap-3 bg-[#202c33] border ${cfg.border} border border-[#2b3943]
             rounded-xl px-4 py-3 shadow-2xl shadow-black/60
             max-w-[320px] w-full pointer-events-auto"
    >
      <span class="w-2 h-2 flex-shrink-0 rounded-full ${cfg.dot}"></span>
      <p class="text-sm text-[#e9edef] leading-snug">${message}</p>
    </div>`

  _timer = setTimeout(() => {
    if (container) container.innerHTML = ''
  }, 2500)
}
