/**
 * src/core/utils.js
 * Shared utility functions — AOE_WEB
 *
 * Pure functions only. No DOM access. No side effects. No imports.
 * Safe to call from any module without creating dependency cycles.
 */

/**
 * Returns a human-readable relative time string from an ISO date.
 * e.g. "just now" · "3 min ago" · "2 hr ago" · "1d ago"
 * @param {string} dateString - ISO 8601 date string
 * @returns {string}
 */
export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60)   return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Formats a numeric ZAR amount as "R 245.00"
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `R ${Number(amount).toFixed(2)}`
}

/**
 * Formats an E.164 South African phone number for display.
 * +27821234567 → +27 82 123 4567
 * Falls back to the raw value if format does not match.
 * @param {string} phone
 * @returns {string}
 */
export function formatPhone(phone) {
  const m = String(phone).replace(/\s/g, '').match(/^(\+27)(\d{2})(\d{3})(\d{4})$/)
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone
}

/**
 * Escapes a string for safe insertion into HTML text nodes.
 * Prevents XSS from user-sourced fixture or database strings.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
