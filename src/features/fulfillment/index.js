/**
 * src/features/fulfillment/index.js
 * Deep-Link Fulfillment Trigger Generator
 *
 * Builds a WhatsApp URL scheme wrapper pre-filled with the banking details
 * message template. Tapping the generated link on a mobile device opens the
 * customer's native WhatsApp app with the chat open and message pre-composed.
 *
 * Simulation mode: uses inline placeholder banking credentials.
 * Live mode: swap _simConfig for a real import from config.js (gitignored).
 *
 * Message template matches ARCHAAR_BUILD_MANIFEST.md § Fulfillment Message Template.
 */

import { FLAGS } from '@/core/flags.js'

// ─── Simulation configuration ─────────────────────────────────────────────────
// Placeholder values used while FLAGS.adminSimulated === true.
// Replace by importing from './config.js' when live credentials are received.
const _simConfig = {
  bankName:      'Capitec Bank',
  accountNumber: '[ACCOUNT PENDING]',
  accountHolder: '[HOLDER PENDING]',
  payshapId:     '[PAYSHAP PENDING]',
}

/**
 * Generates a fully encoded wa.me deep-link URL pre-filled with banking details.
 *
 * @param {Object} order            - An order object matching the `orders` table schema
 * @param {string} order.phone_number   - E.164 format: +27XXXXXXXXX
 * @param {string|null} order.customer_name
 * @param {string} order.order_summary
 * @param {number} order.total_amount
 * @returns {string} https://wa.me/{phone}?text={encodedMessage}
 */
export function generateFulfillmentTrigger(order) {
  // Live mode would import from './config.js' — same shape as _simConfig
  const cfg = _simConfig

  const name = order.customer_name || 'there'
  const amount = Number(order.total_amount).toFixed(2)

  const lines = [
    `Hi ${name}, I've locked in your order for ${order.order_summary} (Total Due: R${amount}).`,
    ``,
    `Please transfer payment to:`,
    `Bank: ${cfg.bankName}`,
    `Account: ${cfg.accountNumber}`,
    `Holder: ${cfg.accountHolder}`,
    `Reference: ${order.phone_number} (your number)`,
    ``,
    `Or PayShap to: ${cfg.payshapId}`,
    ``,
    `Send proof of payment here once done — thank you! 🙌`,
  ]

  const message = lines.join('\n')
  // Strip all non-digit characters to get the raw phone number for wa.me
  const phone = order.phone_number.replace(/\D/g, '')

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
